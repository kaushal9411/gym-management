/** j***doe@gmail.com → keeps first char + domain, masks the rest. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'•'.repeat(Math.max(local.length - 1, 2))}@${domain}`;
}
