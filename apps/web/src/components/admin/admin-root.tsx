'use client';

import { usePathname } from 'next/navigation';
import { AdminShell } from './admin-shell';
import { AuthGuard } from './auth-guard';

export function AdminRoot({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
