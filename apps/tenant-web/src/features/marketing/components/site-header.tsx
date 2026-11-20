'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { AUTH_ROUTES } from '@/features/auth/constants';
import { NAV_LINKS } from '../constants';

/**
 * Sticky top bar. Login and Register are always visible in the corner (also on
 * phones) and are plain links: nothing here redirects until someone clicks one.
 * The section links collapse into a menu on small screens.
 */
export function SiteHeader({ name }: { name: string }) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [section, setSection] = React.useState<string>('');
  const close = () => setOpen(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlights the nav link of the section that is on screen.
  React.useEffect(() => {
    const targets = NAV_LINKS.map((l) => document.querySelector(l.href)).filter((el): el is Element => el !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setSection('#' + hit.target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.2, 0.6] },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <header className={`sticky top-0 z-40 border-b backdrop-blur-xl transition-all duration-300 ${scrolled ? 'border-foreground/15 bg-background/90 shadow-sm' : 'border-foreground/10 bg-background/70'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${name} home`}>
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-cyan-400 text-base font-black text-[#1a0f08]">
            {name.trim().charAt(0).toUpperCase() || 'F'}
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">{name}</span>
        </Link>

        <nav aria-label="Sections" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={`relative rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring ${section === l.href ? 'text-foreground' : 'text-foreground/65'}`}>
              {l.label}
              {section === l.href ? <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-orange-500 to-cyan-400" transition={{ type: 'spring', stiffness: 380, damping: 32 }} /> : null}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={AUTH_ROUTES.login}
            className="inline-flex h-10 items-center rounded-xl border border-foreground/20 px-4 text-sm font-semibold text-foreground outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Login
          </Link>
          <Link
            href={AUTH_ROUTES.register}
            className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-orange-500 to-orange-400 px-4 text-sm font-bold text-[#1a0f08] shadow-[0_6px_24px_-6px_rgba(255,106,53,0.7)] outline-none transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
          >
            Register
          </Link>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-foreground/20 text-foreground outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-sections"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-sections" aria-label="Sections" className="border-t border-foreground/10 bg-background px-4 py-3 lg:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={close} className="block rounded-lg px-3 py-3 text-[15px] font-medium text-foreground/80 hover:bg-foreground/5 hover:text-foreground">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
