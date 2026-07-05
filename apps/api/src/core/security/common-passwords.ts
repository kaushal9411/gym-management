/**
 * Denylist of the most-breached passwords (subset of well-known top lists).
 * Checked case-insensitively in addition to the structural policy — a
 * password can satisfy every character-class rule and still be "P@ssw0rd".
 */
export const COMMON_PASSWORDS = new Set(
  [
    'password', 'password1', 'password123', 'p@ssword', 'p@ssw0rd', 'passw0rd',
    '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
    'letmein123', 'welcome123', 'admin1234', 'iloveyou1', 'monkey123',
    'dragon123', 'football1', 'baseball1', 'sunshine1', 'princess1',
    'trustno1', 'superman1', 'batman123', 'master123', 'shadow123',
    'michael1', 'jennifer1', 'starwars1', 'whatever1', 'freedom123',
    'abc123456', 'a1b2c3d4', 'zxcvbnm12', 'qazwsx123', '1q2w3e4r5t',
    'changeme1', 'letmein1!', 'welcome1!', 'password!', 'gym123456',
    'fitness123', 'fitcloud1', 'goldgym12', '123123123', '111111111',
  ].map((p) => p.toLowerCase()),
);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
