import { CheckCircle2, XCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface MemberActionCardProps {
  name: string;
  memberId: string;
  profilePhotoUrl: string | null;
  eligible: boolean;
  reason: string | null;
  actionLabel: string;
  onAction: () => void;
  busy?: boolean;
}

/** Shared "here's who we found, here's whether they can act, here's the button" card used by both the QR and manual check-in/out flows. */
export function MemberActionCard({ name, memberId, profilePhotoUrl, eligible, reason, actionLabel, onAction, busy }: MemberActionCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt="" /> : null}
            <AvatarFallback>{name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{memberId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {reason ? (
            <span className="flex items-center gap-1 text-sm text-destructive">
              <XCircle className="size-4" /> {reason}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-success">
              <CheckCircle2 className="size-4" /> Eligible
            </span>
          )}
          <Button size="sm" disabled={!eligible || busy} onClick={onAction}>
            {busy ? 'Working…' : actionLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
