'use client';

/* eslint-disable @next/next/no-img-element */
import { Dumbbell } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTenant } from '../tenant-provider';

interface TenantLogoProps {
  className?: string;
  size?: 'sm' | 'lg';
}

/**
 * Gym logo — hosted image when branding provides one, otherwise an
 * initials mark in the tenant's brand color. Platform host renders the
 * FitCloud dumbbell.
 */
export function TenantLogo({ className, size = 'lg' }: TenantLogoProps) {
  const tenant = useTenant();
  const dimension = size === 'lg' ? 'size-14 rounded-2xl text-xl' : 'size-8 rounded-lg text-sm';

  if (tenant.branding.logoUrl) {
    return (
      <img
        src={tenant.branding.logoUrl}
        alt={`${tenant.name} logo`}
        className={cn(dimension, 'object-contain', className)}
      />
    );
  }

  if (tenant.id === 'platform') {
    return (
      <div
        aria-hidden
        className={cn(dimension, 'flex items-center justify-center bg-primary text-primary-foreground shadow-sm', className)}
      >
        <Dumbbell className={size === 'lg' ? 'size-7' : 'size-4'} />
      </div>
    );
  }

  const initials = tenant.name
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      aria-hidden
      className={cn(
        dimension,
        'flex items-center justify-center bg-primary font-bold text-primary-foreground shadow-sm',
        className,
      )}
    >
      {initials}
    </div>
  );
}
