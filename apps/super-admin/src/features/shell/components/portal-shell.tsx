'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { useShellOverview } from '@/features/dashboard/hooks/use-dashboard';
import { CommandPalette } from './command-palette';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** Portal frame: graphite sidebar (drawer below md), sticky top bar, Ctrl/Cmd+K tenant palette. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const overview = useShellOverview(isAuthenticated);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 md:block">
        <Sidebar overview={overview.data} />
      </aside>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 md:hidden" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 w-[260px] max-w-[85vw] shadow-2xl outline-none md:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Sidebar overview={overview.data} onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar health={overview.data?.health} onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 sm:pb-24">{children}</main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}
