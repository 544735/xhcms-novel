/** 将任意标题转为 URL slug；中文等非 ASCII 字符无法直接转写时回落到 post-<随机串> */
export function slugify(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) return `post-${randomSuffix()}`;
  const ascii = raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 80);
  return `post-${randomSuffix()}`;
}

export function randomSuffix(length = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** 在冲突时追加随机后缀，生成站点内唯一 slug */
export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = base || `post-${randomSuffix()}`;
  let attempt = 0;
  while (await exists(slug)) {
    attempt += 1;
    slug = `${base}-${randomSuffix(4)}`;
    if (attempt > 20) {
      slug = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
}
