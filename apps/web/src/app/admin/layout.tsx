import type { Metadata } from 'next';
import { AdminRoot } from '@/components/admin/admin-root';

export const metadata: Metadata = {
  title: { default: '管理后台', template: '%s · XHCMS 管理后台' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoot>{children}</AdminRoot>;
}
