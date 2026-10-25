import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Blocks,
  BookOpen,
  CloudDownload,
  FolderTree,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Palette,
  PenTool,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** 后台导航配置（小说站，唯一来源） */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: '概览',
    items: [{ label: '仪表盘', href: '/admin', icon: LayoutDashboard, permission: 'dashboard:view', exact: true }],
  },
  {
    label: '书籍内容',
    items: [
      { label: '书籍管理', href: '/admin/novels', icon: BookOpen, permission: 'novel:view' },
      { label: '分类管理', href: '/admin/categories', icon: FolderTree, permission: 'category:view' },
      { label: '评论审核', href: '/admin/novel-comments', icon: MessageSquare, permission: 'comment:view' },
      { label: '采集中心', href: '/admin/collect', icon: CloudDownload, permission: 'collect:view' },
      { label: '媒体库', href: '/admin/media', icon: ImageIcon, permission: 'media:view' },
    ],
  },
  {
    label: '运营',
    items: [
      { label: '会员管理', href: '/admin/members', icon: Users, permission: 'member:view' },
      { label: 'VIP 与订单', href: '/admin/vip', icon: Wallet, permission: 'vip:view' },
      { label: '作者审核', href: '/admin/authors', icon: PenTool, permission: 'author:view' },
    ],
  },
  {
    label: '系统',
    items: [
      { label: '站点管理', href: '/admin/sites', icon: Activity, permission: 'site:view' },
      { label: '主题模板', href: '/admin/themes', icon: Palette, permission: 'theme:view' },
      { label: '插件中心', href: '/admin/plugins', icon: Blocks, permission: 'plugin:view' },
      { label: '管理员', href: '/admin/users', icon: Users, permission: 'user:view' },
      { label: '角色权限', href: '/admin/roles', icon: ShieldCheck, permission: 'role:view' },
      { label: '操作日志', href: '/admin/audit-logs', icon: Gauge, permission: 'audit:view' },
      { label: '站点设置', href: '/admin/settings', icon: Settings, permission: 'setting:view' },
    ],
  },
];
