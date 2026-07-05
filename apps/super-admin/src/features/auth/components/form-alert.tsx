'use client';

import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FormAlertProps {
  variant: 'error' | 'success' | 'locked';
  title?: string;
  message?: string | null;
}

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  locked: Lock,
} as const;

/** Animated inline form feedback — collapses away when message clears. */
export function FormAlert({ variant, title, message }: FormAlertProps) {
  const Icon = ICONS[variant];

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <Alert variant={variant === 'success' ? 'success' : 'destructive'}>
            <Icon aria-hidden />
            {title ? <AlertTitle>{title}</AlertTitle> : null}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
