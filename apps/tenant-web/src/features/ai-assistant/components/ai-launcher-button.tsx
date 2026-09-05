'use client';

import * as React from 'react';
import { Bot } from 'lucide-react';

import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTenant } from '@/features/tenant/tenant-provider';
import { AiChatPanel } from './ai-chat-panel';

const STORAGE_KEY = 'fitcloud-ai-launcher-position';
const BUTTON_SIZE = 56; // size-14
const MARGIN = 20; // matches the old bottom-5/right-5 corner anchor
const DRAG_THRESHOLD_PX = 6; // movement below this still counts as a click, not a drag

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampToViewport(pos: { x: number; y: number }) {
  return {
    x: clamp(pos.x, MARGIN, window.innerWidth - BUTTON_SIZE - MARGIN),
    y: clamp(pos.y, MARGIN, window.innerHeight - BUTTON_SIZE - MARGIN),
  };
}

function defaultPosition() {
  return { x: window.innerWidth - BUTTON_SIZE - MARGIN, y: window.innerHeight - BUTTON_SIZE - MARGIN };
}

/**
 * Global floating entry point — mounted once in `app-providers.tsx`, same
 * pattern as `<GlobalLoader/>`/`<SessionExpiryModal/>`. Gated on BOTH the
 * `ai_coach` plan feature flag AND the `ai:use` permission, same two-check
 * pattern `/support`'s page uses for its own plan-gated section (feature
 * flag = "is this on the tenant's plan", permission = "can THIS user use
 * it") — renders nothing at all rather than a disabled/greyed-out button
 * when either check fails, so its absence doesn't hint at a feature the
 * user isn't entitled to.
 *
 * Draggable (Pointer Events — mouse + touch in one API, no new dependency,
 * same "native browser API first" precedent as the CMS rich-text editor,
 * super-admin's twin of this component got the same update): a press that
 * moves less than `DRAG_THRESHOLD_PX` still opens the chat panel as a
 * click; anything past that repositions the button instead and persists
 * the new spot to `localStorage` per-browser, clamped so it can never end
 * up dragged fully off-screen (re-clamped on window resize too).
 */
export function AiLauncherButton() {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const dragRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number; dragged: boolean } | null>(null);
  const { isAuthenticated } = useAuth();
  const tenant = useTenant();
  const { hasPermission } = usePermissions();

  const isEnabled = isAuthenticated && tenant.featureFlags.includes('ai_coach') && hasPermission('ai:use');

  React.useEffect(() => {
    let initial = defaultPosition();
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) initial = clampToViewport(JSON.parse(saved) as { x: number; y: number });
    } catch {
      // localStorage blocked/unavailable (private window, cleared site data) — falls back to the default corner.
    }
    setPosition(initial);
  }, []);

  React.useEffect(() => {
    const handleResize = () => setPosition((prev) => (prev ? clampToViewport(prev) : prev));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!position) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y, dragged: false };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    if (!state) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) state.dragged = true;
    if (state.dragged) setPosition(clampToViewport({ x: state.originX + dx, y: state.originY + dy }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragRef.current;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (!state) return;
    if (state.dragged) {
      setPosition((current) => {
        if (current) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {
            // Position just won't persist across reloads — not worth surfacing.
          }
        }
        return current;
      });
    } else {
      setOpen(true);
    }
  };

  if (!isEnabled || !position) return null;

  return (
    <>
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ position: 'fixed', left: position.x, top: position.y, touchAction: 'none' }}
        className="z-40 flex size-14 cursor-grab items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        aria-label="Open AI Business Assistant — drag to reposition"
      >
        <Bot className="size-6" aria-hidden />
      </button>
      <AiChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
