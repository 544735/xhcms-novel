import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Form,
  FormField,
  FormSubmission,
  Paginated,
} from '@wmcms/shared';
import { normalizePage, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { clientIp } from '../../common/utils/request.util';
import { sanitizeMultilineText, sanitizePlainText } from '../../common/utils/sanitize.util';
import { ensureUniqueSlug, slugify } from '../../common/utils/slug.util';
import type { AuthenticatedRequest } from '../../common/types';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { QuerySubmissionDto } from './dto/query-submission.dto';

type FormRow = Prisma.FormGetPayload<{ include: { _count: { select: { submissions: true } } } }>;
type SubmissionRow = Prisma.FormSubmissionGetPayload<Record<string, never>>;

const SELECT_TYPES = new Set<FormField['type']>(['select', 'radio']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_PATTERN = /^[0-9+\-()\s]{5,30}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 表单元信息清洗上限 */
const FORM_NAME_MAX = 120;
const FORM_DESCRIPTION_MAX = 500;
const FORM_SUCCESS_MESSAGE_MAX = 300;
/** 单个提交文本字段的清洗上限（与字段级 maxLength 校验互补） */
const MAX_SUBMISSION_TEXT_LENGTH = 2000;
/** 字段定义里的展示文本清洗上限（label / placeholder / options[]） */
const FIELD_TEXT_MAX = 120;

/** 出库容错 parse */
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

function toForm(row: FormRow): Form {
  return {
    id: row.id,
    siteId: row.siteId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    fields: parseJson<FormField[]>(row.fields, []),
    status: row.status as Form['status'],
    successMessage: row.successMessage,
    submissionCount: row._count.submissions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSubmission(row: SubmissionRow): FormSubmission {
  return {
    id: row.id,
    formId: row.formId,
    data: parseJson<Record<string, unknown>>(row.data, {}),
    ip: row.ip,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* ---------------------------- 管理端 ---------------------------- */

  /** 表单列表（站点内全量，供选择与列表页使用） */
  async list(siteId: string): Promise<Form[]> {
    const rows = await this.prisma.form.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
    });
    return rows.map(toForm);
  }

  async get(siteId: string, id: string): Promise<Form> {
    const row = await this.prisma.form.findFirst({
      where: { id, siteId },
      include: { _count: { select: { submissions: true } } },
    });
    if (!row) throw new NotFoundException('表单不存在');
    return toForm(row);
  }

  async create(siteId: string, dto: CreateFormDto, req?: AuthenticatedRequest): Promise<Form> {
    const name = sanitizePlainText(dto.name, FORM_NAME_MAX);
    if (!name) throw new BadRequestException('表单名称不能为空');
    const fields = this.validateFields(dto.fields);
    const slug = await this.resolveSlug(siteId, dto.slug || slugify(name), undefined);

    const row = await this.prisma.form.create({
      data: {
        siteId,
        name,
        slug,
        description: dto.description
          ? sanitizePlainText(dto.description, FORM_DESCRIPTION_MAX) || null
          : null,
        fields: JSON.stringify(fields),
        status: dto.status ?? 'enabled',
        successMessage: dto.successMessage
          ? sanitizePlainText(dto.successMessage, FORM_SUCCESS_MESSAGE_MAX) || null
          : null,
      },
      include: { _count: { select: { submissions: true } } },
    });

    await this.audit.log(req, {
      action: 'form.create',
      resource: 'form',
      resourceId: row.id,
      detail: { name: row.name, slug: row.slug, fields: fields.length },
    });
    return toForm(row);
  }

  async update(
    siteId: string,
    id: string,
    dto: UpdateFormDto,
    req?: AuthenticatedRequest,
  ): Promise<Form> {
    const existing = await this.prisma.form.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('表单不存在');

    const data: Prisma.FormUpdateInput = {};
    if (dto.name !== undefined) {
      const name = sanitizePlainText(dto.name, FORM_NAME_MAX);
      if (!name) throw new BadRequestException('表单名称不能为空');
      data.name = name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description
        ? sanitizePlainText(dto.description, FORM_DESCRIPTION_MAX) || null
        : null;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.successMessage !== undefined) {
      data.successMessage = dto.successMessage
        ? sanitizePlainText(dto.successMessage, FORM_SUCCESS_MESSAGE_MAX) || null
        : null;
    }
    if (dto.fields !== undefined) data.fields = JSON.stringify(this.validateFields(dto.fields));
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const baseName = typeof data.name === 'string' ? data.name : existing.name;
      data.slug = await this.resolveSlug(siteId, dto.slug || slugify(baseName), id);
    }

    const row = await this.prisma.form.update({
      where: { id },
      data,
      include: { _count: { select: { submissions: true } } },
    });

    await this.audit.log(req, {
      action: 'form.update',
      resource: 'form',
      resourceId: id,
      detail: { fields: Object.keys(data) },
    });
    return toForm(row);
  }

  async remove(siteId: string, id: string, req?: AuthenticatedRequest): Promise<null> {
    const existing = await this.prisma.form.findFirst({ where: { id, siteId } });
    if (!existing) throw new NotFoundException('表单不存在');

    await this.prisma.form.delete({ where: { id } });
    await this.audit.log(req, {
      action: 'form.delete',
      resource: 'form',
      resourceId: id,
      detail: { name: existing.name, slug: existing.slug },
    });
    return null;
  }

  async submissions(
    siteId: string,
    formId: string,
    query: QuerySubmissionDto,
  ): Promise<Paginated<FormSubmission>> {
    await this.assertFormInSite(siteId, formId);
    const { page, pageSize, skip, take } = normalizePage(query);
    const where: Prisma.FormSubmissionWhereInput = {
      formId,
      ...(query.read === undefined ? {} : { read: query.read }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.formSubmission.count({ where }),
    ]);

    return paginate(rows.map(toSubmission), total, page, pageSize);
  }

  async markRead(
    siteId: string,
    submissionId: string,
    read: boolean,
    req?: AuthenticatedRequest,
  ): Promise<FormSubmission> {
    const existing = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, form: { siteId } },
    });
    if (!existing) throw new NotFoundException('表单提交记录不存在');

    const row = await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { read },
    });
    await this.audit.log(req, {
      action: 'form.submission_read',
      resource: 'form-submission',
      resourceId: submissionId,
      detail: { read },
    });
    return toSubmission(row);
  }

  async removeSubmission(
    siteId: string,
    submissionId: string,
    req?: AuthenticatedRequest,
  ): Promise<null> {
    const existing = await this.prisma.formSubmission.findFirst({
      where: { id: submissionId, form: { siteId } },
    });
    if (!existing) throw new NotFoundException('表单提交记录不存在');

    await this.prisma.formSubmission.delete({ where: { id: submissionId } });
    await this.audit.log(req, {
      action: 'form.submission_delete',
      resource: 'form-submission',
      resourceId: submissionId,
      detail: { formId: existing.formId },
    });
    return null;
  }

  /* ---------------------------- 门户 ---------------------------- */

  /** 门户提交表单：按字段定义校验必填 / 类型 / 长度，且只接收已声明字段 */
  async publicSubmit(
    siteSlug: string,
    formSlug: string,
    payload: Record<string, unknown>,
    req: AuthenticatedRequest,
  ): Promise<{ ok: true }> {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug } });
    if (!site || site.status !== 'enabled') {
      throw new NotFoundException('站点不存在或已停用');
    }

    const form = await this.prisma.form.findFirst({
      where: { siteId: site.id, slug: formSlug },
    });
    if (!form || form.status !== 'enabled') {
      throw new NotFoundException('表单不存在或已停用');
    }

    const fields = parseJson<FormField[]>(form.fields, []);
    const data = this.validateSubmission(fields, payload);

    await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        data: JSON.stringify(data),
        ip: clientIp(req),
        read: false,
      },
    });

    return { ok: true };
  }

  /* ---------------------------- 内部工具 ---------------------------- */

  /**
   * 字段定义校验：key 唯一、类型合法、选项类字段必须有选项。
   *
   * 展示文本（label / placeholder / options[]）在入库前统一清洗：
   * 这些值会直接进后台与门户渲染，属于可被匿名访客间接写入的文本。
   * key / type / maxLength / required 等结构性字段**不清洗**（参与取值与校验）。
   */
  private validateFields(fields: readonly FormField[]): FormField[] {
    // 先清洗再做校验，避免 `<b></b>` 这类「看着有内容、清洗后为空」的选项混过必填判断
    const normalized = fields.map((field) => {
      const label = sanitizePlainText(field.label, FIELD_TEXT_MAX);
      const placeholder = field.placeholder
        ? sanitizePlainText(field.placeholder, FIELD_TEXT_MAX)
        : '';
      const options = field.options
        ? Array.from(
            new Set(
              field.options
                .map((option) => sanitizePlainText(option, FIELD_TEXT_MAX))
                .filter((option) => option.length > 0),
            ),
          )
        : undefined;
      return { field, label, placeholder, options };
    });

    const seen = new Set<string>();
    for (const { field, label, options } of normalized) {
      if (seen.has(field.key)) {
        throw new BadRequestException(`表单字段 key「${field.key}」重复，请修改后再保存`);
      }
      seen.add(field.key);

      if (SELECT_TYPES.has(field.type) || field.type === 'checkbox') {
        if (!options?.length) {
          throw new BadRequestException(
            `字段「${label || field.key}」为选项类型，请至少配置一个选项`,
          );
        }
      }
    }

    return normalized.map(({ field, label, placeholder, options }) => ({
      key: field.key,
      label,
      type: field.type,
      ...(field.required === undefined ? {} : { required: Boolean(field.required) }),
      ...(placeholder ? { placeholder } : {}),
      ...(options ? { options } : {}),
      ...(field.maxLength ? { maxLength: field.maxLength } : {}),
    }));
  }

  /** 提交数据校验，返回仅包含已声明字段的清洗结果 */
  private validateSubmission(
    fields: FormField[],
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const source = payload && typeof payload === 'object' ? payload : {};
    const errors: string[] = [];
    const cleaned: Record<string, unknown> = {};

    for (const field of fields) {
      const raw = source[field.key];
      const isEmpty =
        raw === undefined ||
        raw === null ||
        (typeof raw === 'string' && raw.trim() === '') ||
        (Array.isArray(raw) && raw.length === 0);

      if (field.required && isEmpty) {
        errors.push(`${field.label}不能为空`);
        continue;
      }
      if (isEmpty) continue;

      if (Array.isArray(raw)) {
        // 每个字符串项都去 HTML（复选框值仍按清洗后的值匹配选项）
        const values = raw
          .map((item) =>
            typeof item === 'string'
              ? sanitizeMultilineText(item, MAX_SUBMISSION_TEXT_LENGTH)
              : String(item ?? ''),
          )
          .filter(Boolean);
        if (!values.length) continue;
        if (field.type === 'checkbox' && field.options?.length) {
          const invalid = values.filter((value) => !field.options!.includes(value));
          if (invalid.length) errors.push(`${field.label}包含不合法选项`);
        }
        cleaned[field.key] = values;
        continue;
      }

      // 入库前清洗（保留换行）。后续类型校验与长度校验都基于清洗后的值，
      // 避免 `<b>1</b>2…` 这类 HTML 填充绕过 maxLength。
      const value =
        typeof raw === 'string'
          ? sanitizeMultilineText(raw.trim(), MAX_SUBMISSION_TEXT_LENGTH)
          : raw;
      // 清洗后可能变空（例如只提交了 `<div></div>`），此时必填语义仍需成立
      if (field.required && typeof value === 'string' && !value) {
        errors.push(`${field.label}不能为空`);
        continue;
      }
      cleaned[field.key] = value;

      switch (field.type) {
        case 'email':
          if (!EMAIL_PATTERN.test(String(value))) errors.push(`${field.label}格式不正确`);
          break;
        case 'tel':
          if (!TEL_PATTERN.test(String(value))) errors.push(`${field.label}格式不正确`);
          break;
        case 'number':
          if (Number.isNaN(Number(value))) errors.push(`${field.label}必须为数字`);
          break;
        case 'date':
          if (!DATE_PATTERN.test(String(value)) || Number.isNaN(Date.parse(String(value)))) {
            errors.push(`${field.label}日期格式不正确`);
          }
          break;
        case 'select':
        case 'radio':
          if (field.options?.length && !field.options.includes(String(value))) {
            errors.push(`${field.label}的选项不合法`);
          }
          break;
        case 'checkbox':
          if (field.options?.length && !field.options.includes(String(value))) {
            errors.push(`${field.label}的选项不合法`);
          }
          break;
        default:
          break;
      }

      if (typeof value === 'string') {
        const maxLength = field.maxLength ?? 1000;
        if (value.length > maxLength) {
          errors.push(`${field.label}最多 ${maxLength} 个字符`);
        }
      }
    }

    if (errors.length) throw new BadRequestException(errors.join('；'));
    return cleaned;
  }

  private async assertFormInSite(siteId: string, formId: string): Promise<void> {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, siteId },
      select: { id: true },
    });
    if (!form) throw new NotFoundException('表单不存在');
  }

  private async resolveSlug(
    siteId: string,
    base: string,
    excludeId: string | undefined,
  ): Promise<string> {
    const candidate = base || slugify('form');
    return ensureUniqueSlug(candidate, async (slug) => {
      const row = await this.prisma.form.findFirst({
        where: { siteId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      return Boolean(row);
    });
  }
}
