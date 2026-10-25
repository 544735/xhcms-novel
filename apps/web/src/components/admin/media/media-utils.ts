import { API_BASE_URL } from '@/lib/api';

/**
 * 资源地址解析：
 * - 绝对地址 / data: / blob: 原样返回；
 * - `/uploads/…` 由 API 源站托管（上传文件），补全 API origin；
 * - 其余相对路径（如内置封面 `/covers/xxx.svg`）由 Web 源站托管，保持相对路径。
 */
export function resolveMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (!url.startsWith('/uploads/')) {
    return url;
  }
  let origin = '';
  try {
    origin = new URL(API_BASE_URL).origin;
  } catch {
    origin = '';
  }
  return `${origin}${url}`;
}

export function isImageMime(mimeType: string | null | undefined): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

export function formatDimensions(width: number | null, height: number | null): string {
  if (!width || !height) return '—';
  return `${width} × ${height}`;
}
