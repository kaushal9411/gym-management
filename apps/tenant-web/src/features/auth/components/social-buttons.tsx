'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Brand marks inlined (CSP-safe, no external assets). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5l-3.9 3C3.1 21.3 7.2 24 12 24z" />
      <path fill="#FBBC05" d="M5.1 14.4c-.3-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-4-3C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4L19.1 3C17 1.1 14.7 0 12 0 7.2 0 3.1 2.7 1.2 6.6l4 3c.9-2.9 3.6-4.9 6.8-4.9z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <rect width="11" height="11" x="0.5" y="0.5" fill="#F25022" />
      <rect width="11" height="11" x="12.5" y="0.5" fill="#7FBA00" />
      <rect width="11" height="11" x="0.5" y="12.5" fill="#00A4EF" />
      <rect width="11" height="11" x="12.5" y="12.5" fill="#FFB900" />
    </svg>
  );
}

/**
 * SSO placeholders — the buttons are real and accessible; clicking opens a
 * “coming soon” modal until the identity providers are wired to the API.
 */
export function SocialLoginButtons({ disabled }: { disabled?: boolean }) {
  const [pendingProvider, setPendingProvider] = React.useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setPendingProvider('Google')}
        >
          <GoogleIcon />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setPendingProvider('Microsoft')}
        >
          <MicrosoftIcon />
          Microsoft
        </Button>
      </div>

      <Dialog open={pendingProvider !== null} onOpenChange={(open) => !open && setPendingProvider(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingProvider} sign-in is coming soon</DialogTitle>
            <DialogDescription>
              Single sign-on will be enabled when the identity integration ships. Use your email and
              password for now.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
