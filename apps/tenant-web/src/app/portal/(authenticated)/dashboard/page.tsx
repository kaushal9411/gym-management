'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemberProfile } from '@/features/member-portal/hooks/use-member-portal';
import { memberPortalService } from '@/features/member-portal/services/member-portal.service';

export default function MemberDashboardPage() {
  const { data: profile, isLoading } = useMemberProfile();
  const [exporting, setExporting] = React.useState(false);

  if (isLoading || !profile) return <Skeleton className="h-64 w-full rounded-xl" />;

  const handleExport = async () => {
    setExporting(true);
    try {
      await memberPortalService.downloadGdprExport(profile.memberId);
    } catch {
      toast.error('Could not download your data — please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Avatar className="size-16">
            <AvatarImage src={profile.profilePhotoUrl ?? undefined} alt={profile.name} />
            <AvatarFallback>{profile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">
              {profile.memberId} · {profile.branch.name}
            </p>
            <Badge variant={profile.status === 'ACTIVE' ? 'success' : 'secondary'} className="mt-1">
              {profile.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Membership</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.currentMembership ? (
              <>
                <p className="font-medium">{profile.currentMembership.planName}</p>
                <p className="text-sm text-muted-foreground">
                  {profile.currentMembership.status} · expires {new Date(profile.currentMembership.endDate).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No active membership on file.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">My check-in QR code</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {profile.qrCodeImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- QR code is a data-URL/object-storage URL, not an optimizable static asset (same convention as the staff-side QR display).
              <img src={profile.qrCodeImageUrl} alt="Check-in QR code" className="size-40" />
            ) : (
              <p className="text-sm text-muted-foreground">No QR code on file.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {profile.trainer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My trainer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{profile.trainer.name}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My data</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">Download everything on file for you — profile, attendance, plans, invoices, and bookings — as a JSON file.</p>
          <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={exporting} onClick={handleExport}>
            {exporting ? 'Preparing…' : 'Download my data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
