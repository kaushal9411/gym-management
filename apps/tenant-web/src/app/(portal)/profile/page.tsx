'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/hooks/use-current-user';

/**
 * PLACEHOLDER — read-only profile view proving the /auth/me integration
 * works. Editable profile management (photo, phone, password change UI)
 * is a future Profile module; this page is authentication scope only.
 */
export default function ProfilePage() {
  const user = useCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="text-muted-foreground">Name:</span> {user?.name}</p>
        <p><span className="text-muted-foreground">Email:</span> {user?.email}</p>
        <p><span className="text-muted-foreground">Role:</span> {user?.role}</p>
      </CardContent>
    </Card>
  );
}
