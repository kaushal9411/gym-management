'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MemberChangePasswordForm } from '@/features/member-portal/components/member-change-password-form';
import { useMemberProfile } from '@/features/member-portal/hooks/use-member-portal';

export default function MemberProfilePage() {
  const { data: profile, isLoading } = useMemberProfile();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : profile ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{profile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member ID</span>
                <span className="font-medium">{profile.memberId}</span>
              </div>
              {profile.email ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{profile.email}</span>
                </div>
              ) : null}
              {profile.phone ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{profile.phone}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Branch</span>
                <span className="font-medium">{profile.branch.name}</span>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Your other signed-in devices will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
