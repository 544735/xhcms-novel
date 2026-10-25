'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dropdown } from '@/components/ui/dropdown';
import { useAuthStore } from '@/lib/auth';

export function SiteSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const currentSiteId = useAuthStore((state) => state.currentSiteId);
  const setCurrentSite = useAuthStore((state) => state.setCurrentSite);

  const sites = user?.sites ?? [];
  const current = sites.find((site) => site.id === currentSiteId) ?? sites[0];

  if (!sites.length) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        无可用站点
      </span>
    );
  }

  return (
    <Dropdown
      widthClassName="w-60"
      trigger={
        <button
          type="button"
          className="inline-flex max-w-[220px] items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm transition-colors hover:bg-muted"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-bold text-white">
            {current?.name.slice(0, 1)}
          </span>
          <span className="truncate font-medium text-foreground">{current?.name ?? '选择站点'}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
      items={sites.map((site) => ({
        label: site.name,
        icon:
          site.id === current?.id ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Building2 className="h-3.5 w-3.5" />
          ),
        onSelect: () => {
          if (site.id === current?.id) return;
          setCurrentSite(site.id);
          void queryClient.invalidateQueries();
          router.refresh();
        },
      }))}
    />
  );
}
