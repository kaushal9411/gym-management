'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { TimerOff } from 'lucide-react';

import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AUTH_ROUTES } from '../../constants';
import { LoginHero } from '../login-hero';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

/**
 * Same premium neon-glass shell as `/login` and `/forgot-password` — mirrors
 * their background, brand mark, card and footer so navigating here (e.g.
 * after an idle timeout redirect) reads as the same continuous experience
 * rather than a visually jarring drop into the older split-screen
 * `(auth)/layout.tsx` shell every other status page still uses.
 */
export function SessionExpiredView() {
  const tenant = useTenant();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <style>{`
        .login-glass-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%);
        }
        .login-ripple-btn {
          background-image: linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out;
          box-shadow: 0 8px 24px -6px rgba(255, 90, 31, 0.55);
        }
        .login-ripple-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px -8px rgba(255, 90, 31, 0.7);
        }
        .login-ripple-btn:active {
          transform: translateY(0) scale(0.98);
        }
      `}</style>

      <LoginHero backgroundImageUrl={tenant.branding.loginBackgroundUrl} />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          <motion.div variants={containerVariants} initial="hidden" animate="show">
            <motion.div
              variants={itemVariants}
              className="login-glass-card relative rounded-4xl border border-white/10 p-6 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl sm:p-8"
            >
              {/* Brand mark */}
              <div className="mb-7 flex flex-col items-center gap-3 text-center">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  <TenantLogo size="lg" className="size-full rounded-xl" />
                </div>
                <div>
                  <p className="text-lg font-bold uppercase tracking-wide text-white">{tenant.name}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Gym Portal</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-5 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-400/10 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
                  <TimerOff className="size-8 text-orange-300" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-white">Your session has expired</h1>
                  <p className="text-sm text-white/50">
                    For your security you were signed out after a period of inactivity. Sign in again to pick up where you left off.
                  </p>
                </div>

                <Link
                  href={AUTH_ROUTES.login}
                  className="login-ripple-btn relative flex h-12 w-full items-center justify-center overflow-hidden rounded-lg border-0 text-[15px] font-bold uppercase tracking-wide text-white"
                >
                  Sign in again
                </Link>
              </div>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-white/25">
              Powered by <span className="font-semibold text-white/40">FitCloud</span> · © {new Date().getFullYear()}
            </motion.p>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
