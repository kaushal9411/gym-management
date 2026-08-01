'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ADMIN_ROUTES } from '@/constants/routes';
import { toAdminError, useLogin } from '../hooks/use-auth';
import { FormAlert } from './form-alert';
import { LoadingButton } from './loading-button';
import { PasswordInput } from './password-input';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

const DARK_FIELD_CLASS =
  'h-12 pl-11 border-white/10 bg-white/4 text-white placeholder:text-white/35 focus-visible:border-orange-400/50 focus-visible:ring-orange-400/20 text-[15px]';

export function LoginForm() {
  const router = useRouter();
  const login = useLogin();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [emailFocused, setEmailFocused] = React.useState(false);
  const [passwordFocused, setPasswordFocused] = React.useState(false);
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([]);
  const rippleId = React.useRef(0);

  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const fieldError = (name: keyof LoginFormValues) => form.formState.errors[name]?.message;

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    login.mutate(values, {
      onSuccess: () => router.push(ADMIN_ROUTES.dashboard),
      onError: (error) => setServerError(toAdminError(error).message),
    });
  });

  function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = rippleId.current++;
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    window.setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show">
      <style>{`
        @keyframes login-ripple {
          from { transform: scale(0); opacity: 0.45; }
          to { transform: scale(1); opacity: 0; }
        }
        .login-ripple-btn {
          background-image: linear-gradient(135deg, #ff8a3d 0%, #ff5a1f 45%, #e0271b 100%);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-out;
          box-shadow: 0 8px 24px -6px rgba(255, 90, 31, 0.55);
        }
        .login-ripple-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -8px rgba(255, 90, 31, 0.7); }
        .login-ripple-btn:active { transform: translateY(0) scale(0.98); }
        .login-glass-card { background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%); }
      `}</style>

      <motion.div
        variants={itemVariants}
        className="login-glass-card relative rounded-4xl border border-white/10 p-6 shadow-[0_0_60px_-15px_rgba(255,90,31,0.25),0_0_80px_-20px_rgba(34,211,238,0.15)] backdrop-blur-2xl sm:p-8"
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2 shadow-[0_0_24px_rgba(255,138,61,0.25)]">
            <ShieldCheck className="size-8 text-orange-400" strokeWidth={1.75} aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold uppercase tracking-wide text-white">FitCloud Admin</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Super Admin Portal</p>
          </div>
        </div>

        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Sign In</h1>
          <p className="text-sm text-white/50">Internal platform access only — gym owners can&apos;t sign in here.</p>
        </div>

        <FormAlert variant="error" message={serverError} />

        <form onSubmit={onSubmit} noValidate className="space-y-5" style={{ marginTop: serverError ? '1.25rem' : 0 }}>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-white/60">
              Email
            </Label>
            <div
              className={cn(
                'relative rounded-lg transition-shadow duration-200',
                emailFocused && !fieldError('email') && 'shadow-[0_0_0_4px_rgba(255,138,61,0.18)]',
              )}
            >
              <Mail
                className={cn(
                  'pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40 transition-colors duration-200',
                  emailFocused && !fieldError('email') && 'text-orange-400',
                )}
                aria-hidden
              />
              <Input
                {...form.register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@fitcloud.com"
                invalid={!!fieldError('email')}
                disabled={login.isPending}
                className={DARK_FIELD_CLASS}
                onFocus={() => setEmailFocused(true)}
                onBlur={(e) => {
                  setEmailFocused(false);
                  void form.register('email').onBlur(e);
                }}
              />
            </div>
            {fieldError('email') ? (
              <p role="alert" className="text-xs text-red-400">
                {fieldError('email')}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-white/60">
              Password
            </Label>
            <div
              className={cn(
                'relative rounded-lg transition-shadow duration-200',
                passwordFocused && !fieldError('password') && 'shadow-[0_0_0_4px_rgba(255,138,61,0.18)]',
              )}
            >
              <Lock
                className={cn(
                  'pointer-events-none absolute left-3.5 top-1/2 z-10 size-4 -translate-y-1/2 text-white/40 transition-colors duration-200',
                  passwordFocused && !fieldError('password') && 'text-orange-400',
                )}
                aria-hidden
              />
              <PasswordInput
                {...form.register('password')}
                id="password"
                autoComplete="current-password"
                placeholder="••••••••••"
                invalid={!!fieldError('password')}
                disabled={login.isPending}
                className={DARK_FIELD_CLASS}
                onFocus={() => setPasswordFocused(true)}
                onBlur={(e) => {
                  setPasswordFocused(false);
                  void form.register('password').onBlur(e);
                }}
              />
            </div>
            {fieldError('password') ? (
              <p role="alert" className="text-xs text-red-400">
                {fieldError('password')}
              </p>
            ) : null}
          </div>

          <LoadingButton
            type="submit"
            onMouseDown={spawnRipple}
            loading={login.isPending}
            loadingText="Signing in…"
            className="login-ripple-btn relative h-12 w-full overflow-hidden border-0 text-[15px] font-bold uppercase tracking-wide text-white"
          >
            Sign In
            {ripples.map((r) => (
              <span
                key={r.id}
                className="pointer-events-none absolute rounded-full bg-white/50"
                style={{ left: r.x, top: r.y, width: 10, height: 10, marginLeft: -5, marginTop: -5, animation: 'login-ripple 0.65s ease-out' }}
              />
            ))}
          </LoadingButton>
        </form>
      </motion.div>

      <motion.p variants={itemVariants} className="mt-8 text-center text-[11px] text-white/25">
        FitCloud Admin · Internal use only
      </motion.p>
    </motion.div>
  );
}
