import type { PortalTheme } from './types';
import { modernTheme } from './modern';
import { magazineTheme } from './magazine';
import { minimalTheme } from './minimal';

/**
 * 小说主题注册表：站点 `site.themeKey` → 主题实现。
 * - modern 星海夜读：深色星海 + 渐变，适合玄幻/科幻书城
 * - magazine 墨香书卷：纸色衬线 + 大图头条，适合古言/现言
 * - minimal 极简纯读：白底单栏 + 文字优先，适合纯净阅读
 * 新增主题只需实现 PortalTheme 契约并在此登记（管理端 themes 模块读取 packages/shared 的主题清单）。
 */
export const PORTAL_THEMES: PortalTheme[] = [modernTheme, magazineTheme, minimalTheme];

export function getTheme(themeKey: string | null | undefined): PortalTheme {
  return PORTAL_THEMES.find((theme) => theme.key === themeKey) ?? modernTheme;
}

export type { PortalTheme, PortalContext } from './types';
