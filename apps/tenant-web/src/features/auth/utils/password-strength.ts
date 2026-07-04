import { PASSWORD_MIN_LENGTH } from '../constants';

export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export interface PasswordStrength {
  /** 0 (empty) … 5 (all checks). */
  score: number;
  /** 0–100 for the meter width. */
  percent: number;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: PasswordChecks;
}

const LABELS: PasswordStrength['label'][] = ['Too weak', 'Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

/** Pure scoring — one point per satisfied policy rule. */
export function getPasswordStrength(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    length: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;

  return {
    score,
    percent: (score / 5) * 100,
    label: LABELS[score] ?? 'Too weak',
    checks,
  };
}

export const PASSWORD_CHECK_LABELS: Record<keyof PasswordChecks, string> = {
  length: `${PASSWORD_MIN_LENGTH}+ characters`,
  uppercase: 'Uppercase letter',
  lowercase: 'Lowercase letter',
  number: 'Number',
  special: 'Special character',
};
