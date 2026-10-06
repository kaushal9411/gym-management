/** j***doe@gmail.com → keeps first char + domain, masks the rest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

/** +91••••••7571 → keeps the last 4 digits, masks the rest. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, '');
  if (digits.length <= 4) return digits;
  return `${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
