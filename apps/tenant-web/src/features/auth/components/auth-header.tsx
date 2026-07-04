'use client';

import { motion } from 'framer-motion';

import { TenantLogo } from '@/features/tenant/components/tenant-logo';
import { useTenant } from '@/features/tenant/tenant-provider';

interface AuthHeaderProps {
  title: string;
  subtitle?: string;
  /** Show the tenant's welcome message under the gym name (login screen). */
  showWelcome?: boolean;
}

/** Gym branding header — logo, name, and page heading, animated in. */
export function AuthHeader({ title, subtitle, showWelcome }: AuthHeaderProps) {
  const tenant = useTenant();

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <TenantLogo />
      </motion.div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{tenant.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {showWelcome ? (
          <p className="text-sm text-muted-foreground">{tenant.branding.welcomeMessage}</p>
        ) : subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
