'use client';

import { Activity, Dumbbell, Footprints, PenSquare } from 'lucide-react';

const ICON_CHIPS = [
  { icon: Dumbbell, className: 'left-[8%] top-[20%]', tint: 'cyan' },
  { icon: Footprints, className: 'left-[34%] top-[9%]', tint: 'orange' },
  { icon: Activity, className: 'right-[10%] top-[42%]', tint: 'orange' },
  { icon: PenSquare, className: 'left-[6%] top-[62%]', tint: 'cyan' },
] as const;

const DIAMONDS = [
  { className: 'left-[26%] top-[26%] size-10', tint: 'cyan', delay: '0s' },
  { className: 'right-[30%] top-[10%] size-6', tint: 'cyan', delay: '-3s' },
  { className: 'left-[16%] top-[46%] size-8', tint: 'orange', delay: '-6s' },
  { className: 'right-[8%] top-[64%] size-7', tint: 'orange', delay: '-2s' },
  { className: 'right-[22%] bottom-[10%] size-5', tint: 'cyan', delay: '-5s' },
] as const;

/**
 * Full-bleed dark "energetic gym" backdrop for the login experience — a
 * fixed neon dual-tone (orange + cyan) aesthetic, deliberately independent
 * of the app's light/dark theme toggle, matching the reference concept art.
 * Login-only: not imported anywhere else, zero effect on other auth pages.
 */
export function LoginHero() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#07070b]">
      <style>{`
        @keyframes login-bg-drift {
          0%, 100% { background-position: 0% 0%, 100% 100%; }
          50% { background-position: 8% 6%, 92% 94%; }
        }
        .login-bg-glow {
          background-image:
            radial-gradient(38% 32% at 12% 18%, rgba(255,106,53,0.28) 0%, transparent 70%),
            radial-gradient(42% 36% at 88% 82%, rgba(34,211,238,0.22) 0%, transparent 70%);
          background-size: 160% 160%, 160% 160%;
          animation: login-bg-drift 20s ease-in-out infinite;
        }
        @keyframes login-float {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -14px; }
        }
        .login-diamond { animation: login-float 7s ease-in-out infinite; }
        @keyframes login-chip-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .login-chip { animation: login-chip-float 6s ease-in-out infinite; }
        @keyframes login-pulse-dot {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.4); }
        }
        .login-dot { animation: login-pulse-dot 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .login-bg-glow, .login-diamond, .login-chip, .login-dot { animation: none !important; }
        }
      `}</style>

      {/* Ambient dual-tone glow */}
      <div aria-hidden className="login-bg-glow pointer-events-none absolute inset-0" />

      {/* Diagonal neon light streaks */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-10%] top-[8%] h-px w-[70%] -rotate-[18deg] bg-gradient-to-r from-transparent via-orange-400/70 to-transparent blur-[1px]" />
        <div className="absolute left-[-5%] top-[16%] h-px w-[55%] -rotate-[18deg] bg-gradient-to-r from-transparent via-orange-300/40 to-transparent blur-[2px]" />
        <div className="absolute right-[-10%] bottom-[10%] h-px w-[65%] -rotate-[18deg] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent blur-[1px]" />
        <div className="absolute right-[-5%] bottom-[22%] h-px w-[50%] -rotate-[18deg] bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent blur-[2px]" />
      </div>

      {/* Dot-grid texture */}
      <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden>
        <pattern id="login-grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.4" fill="white" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
      </svg>

      {/* Floating neon diamonds */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
        {DIAMONDS.map((d, i) => (
          <div
            key={i}
            className={`login-diamond absolute rotate-45 rounded-[3px] border ${d.className} ${
              d.tint === 'cyan' ? 'border-cyan-400/50 shadow-[0_0_16px_rgba(34,211,238,0.35)]' : 'border-orange-400/50 shadow-[0_0_16px_rgba(251,146,60,0.35)]'
            }`}
            style={{ animationDelay: d.delay }}
          />
        ))}
      </div>

      {/* Floating neon icon chips */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {ICON_CHIPS.map(({ icon: Icon, className, tint }, i) => (
          <div
            key={i}
            className={`login-chip absolute flex size-14 items-center justify-center rounded-2xl border backdrop-blur-sm ${className} ${
              tint === 'cyan'
                ? 'border-cyan-400/40 bg-cyan-400/5 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                : 'border-orange-400/40 bg-orange-400/5 shadow-[0_0_20px_rgba(251,146,60,0.25)]'
            }`}
            style={{ animationDelay: `${i * -1.5}s` }}
          >
            <Icon
              className={tint === 'cyan' ? 'size-6 text-cyan-300/80' : 'size-6 text-orange-300/80'}
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
        ))}
      </div>

      {/* Pulsing particle dots */}
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden sm:block">
        <span className="login-dot absolute left-[20%] top-[14%] size-1.5 rounded-full bg-orange-400" style={{ animationDelay: '-0.5s' }} />
        <span className="login-dot absolute left-[70%] top-[20%] size-1 rounded-full bg-cyan-300" style={{ animationDelay: '-1.5s' }} />
        <span className="login-dot absolute left-[82%] top-[60%] size-1.5 rounded-full bg-orange-300" style={{ animationDelay: '-2.5s' }} />
        <span className="login-dot absolute left-[14%] top-[74%] size-1 rounded-full bg-cyan-400" style={{ animationDelay: '-1s' }} />
        <span className="login-dot absolute left-[46%] top-[86%] size-1.5 rounded-full bg-orange-400" style={{ animationDelay: '-3s' }} />
      </div>

      {/* Vignette to keep the center readable */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_45%,transparent_0%,rgba(7,7,11,0.55)_100%)]" />
    </div>
  );
}
