/**
 * Remembers which gym's subdomain the last "find your gym" pick resolved
 * to, so a returning visitor to the bare/platform host skips straight to
 * their gym's login instead of picking from the dropdown every time.
 *
 * Plain localStorage, scoped to the bare host only — the ONLY page that
 * ever needs to read this is the bare host itself (deciding whether to
 * auto-redirect on load). The tenant subdomain's "Change gym" link can't
 * reach this storage at all (a different origin — no cross-subdomain
 * localStorage, no equivalent of a cookie's `Domain` attribute), so it
 * doesn't try to clear it directly; it signals back via a `?changeGym=1`
 * query param instead (see `find-gym-form.tsx`), which works across
 * origins for free since it's just part of the URL being navigated to.
 * (A `Domain`-scoped cookie was tried first and confirmed live to silently
 * fail for the `*.localhost` dev shortcut — Chrome won't honor a `Domain`
 * attribute on a single-label host like `localhost`, only real multi-label
 * domains — so this sidesteps that entirely rather than special-casing it.)
 */
const STORAGE_KEY = 'fitcloud.remembered-gym-slug';

export function getRememberedGymSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setRememberedGymSlug(slug: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (slug) {
      window.localStorage.setItem(STORAGE_KEY, slug);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable (private mode) — the picker just shows every time, never an error
  }
}
