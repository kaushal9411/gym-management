import Link from 'next/link';

import { AUTH_ROUTES } from '@/features/auth/constants';
import { NAV_LINKS } from '../constants';

export function SiteFooter({ name }: { name: string }) {
  return (
    <footer className="border-t border-foreground/10 bg-muted py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xs">
          <p className="text-lg font-bold text-foreground">{name}</p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/55">Gym management software for owners, trainers and members.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-2 text-sm sm:grid-cols-3">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-foreground/65 hover:text-foreground">{l.label}</a>
          ))}
          <Link href={AUTH_ROUTES.login} className="text-foreground/65 hover:text-foreground">Login</Link>
          <Link href={AUTH_ROUTES.register} className="text-foreground/65 hover:text-foreground">Register</Link>
          <Link href="/privacy" className="text-foreground/65 hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="text-foreground/65 hover:text-foreground">Terms</Link>
        </nav>
      </div>
      <p className="mx-auto mt-10 max-w-6xl px-4 text-xs text-foreground/35 sm:px-6">
        © {new Date().getFullYear()} {name}. All rights reserved. Photos from{' '}
        <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">Pexels</a>.
      </p>
    </footer>
  );
}
