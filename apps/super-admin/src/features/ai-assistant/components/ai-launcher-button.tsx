'use client';

import * as React from 'react';
import { Bot } from 'lucide-react';

import { useAuth, useHasPermission } from '@/features/auth/hooks/use-auth';
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
 * pattern as tenant-web's launcher (both got this drag update together).
 * Gated on `dashboard:read` (matches the backend router's gate) — every
 * admin role has this, so effectively "any logged-in admin can use it."
 *
 * Draggable (Pointer Events — mouse + touch in one API, no new dependency,
 * same "native browser API first" precedent as the CMS rich-text editor):
 * a press that moves less than `DRAG_THRESHOLD_PX` still opens the chat
 * panel as a click; anything past that repositions the button instead and
 * persists the new spot to `localStorage` per-browser, clamped so it can
 * never end up dragged fully off-screen (re-clamped on window resize too).
 */
export function AiLauncherButton() {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ x: number; y: number } | null>(null);
  const dragRef = React.useRef<{ startX: number; startY: number; originX: number; originY: number; dragged: boolean } | null>(null);
  const { isAuthenticated } = useAuth();
  const canUse = useHasPermission('dashboard:read');

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

  if (!isAuthenticated || !canUse || !position) return null;

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
