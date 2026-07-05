'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { useSession } from '@/features/auth/hooks/use-session';

/** "Still there?" popup shown ~60s before idle-timeout auto-logout. */
export function SessionExpiryModal() {
  const { showIdleWarning, extendSession } = useSession();
  const { logout } = useLogout();

  return (
    <Dialog open={showIdleWarning} onOpenChange={(open) => open || extendSession()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out automatically in less than a
            minute unless you stay active.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => logout()}>
            Sign out now
          </Button>
          <Button onClick={extendSession}>Stay signed in</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
