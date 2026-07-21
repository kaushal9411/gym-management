'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { GymSettingsNav } from '@/features/gym-settings/components/gym-settings-nav';
import { UnsavedChangesBar } from '@/features/gym-settings/components/unsaved-changes-bar';
import {
  toGymSettingsError,
  useBusinessSettings,
  useEmailSettings,
  useTenantNotificationSettings,
  useUpdateBusinessSettings,
  useUpdateEmailSettings,
  useUpdateTenantNotificationSettings,
} from '@/features/gym-settings/hooks/use-gym-settings';
import type { BusinessSettings, EmailSettings, MeasurementUnit, NotificationSettings } from '@/features/gym-settings/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

type BusinessForm = Omit<BusinessSettings, 'updatedAt'>;

export default function BusinessSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('settings:manage');

  const business = useBusinessSettings();
  const email = useEmailSettings();
  const notifications = useTenantNotificationSettings();

  const updateBusiness = useUpdateBusinessSettings();
  const updateEmail = useUpdateEmailSettings();
  const updateNotifications = useUpdateTenantNotificationSettings();

  const [businessForm, setBusinessForm] = React.useState<BusinessForm | null>(null);
  const [emailForm, setEmailForm] = React.useState<EmailSettings | null>(null);
  const [notificationForm, setNotificationForm] = React.useState<NotificationSettings | null>(null);

  React.useEffect(() => {
    if (business.data && !businessForm) {
      const { updatedAt: _updatedAt, ...rest } = business.data;
      setBusinessForm(rest);
    }
  }, [business.data, businessForm]);
  React.useEffect(() => {
    if (email.data && !emailForm) setEmailForm(email.data);
  }, [email.data, emailForm]);
  React.useEffect(() => {
    if (notifications.data && !notificationForm) setNotificationForm(notifications.data);
  }, [notifications.data, notificationForm]);

  const businessBaseline = business.data ? (({ updatedAt: _u, ...rest }) => rest)(business.data) : null;
  const isDirty =
    JSON.stringify(businessForm) !== JSON.stringify(businessBaseline) ||
    JSON.stringify(emailForm) !== JSON.stringify(email.data ?? null) ||
    JSON.stringify(notificationForm) !== JSON.stringify(notifications.data ?? null);

  const saving = updateBusiness.isPending || updateEmail.isPending || updateNotifications.isPending;
  const loading = business.isPending || email.isPending || notifications.isPending;

  const handleCancel = () => {
    if (business.data) {
      const { updatedAt: _updatedAt, ...rest } = business.data;
      setBusinessForm(rest);
    }
    if (email.data) setEmailForm(email.data);
    if (notifications.data) setNotificationForm(notifications.data);
  };

  const handleSave = async () => {
    if (!businessForm || !emailForm || !notificationForm) return;
    try {
      await Promise.all([
        updateBusiness.mutateAsync(businessForm),
        updateEmail.mutateAsync(emailForm),
        updateNotifications.mutateAsync(notificationForm),
      ]);
      toast.success('Business settings saved');
    } catch (error) {
      toast.error(toGymSettingsError(error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Business Settings</h1>
        <p className="text-muted-foreground">Currency, timezone, formats, outbound email identity, and notification channels.</p>
      </div>

      <GymSettingsNav />

      {loading || !businessForm || !emailForm || !notificationForm ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={saving} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regional &amp; display</CardTitle>
              <CardDescription>Currency, timezone, date/time formats, and units used across the portal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency (ISO code)</Label>
                  <Input
                    id="currency"
                    maxLength={3}
                    value={businessForm.currency}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currencySymbol">Currency symbol</Label>
                  <Input
                    id="currencySymbol"
                    maxLength={8}
                    value={businessForm.currencySymbol}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, currencySymbol: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    placeholder="America/Los_Angeles"
                    value={businessForm.timezone}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, timezone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date format</Label>
                  <select
                    id="dateFormat"
                    className={selectClassName}
                    value={businessForm.dateFormat}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, dateFormat: e.target.value })}
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time format</Label>
                  <select
                    id="timeFormat"
                    className={selectClassName}
                    value={businessForm.timeFormat}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, timeFormat: e.target.value })}
                  >
                    <option value="12h">12-hour</option>
                    <option value="24h">24-hour</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekStartDay">Week starts on</Label>
                  <select
                    id="weekStartDay"
                    className={selectClassName}
                    value={businessForm.weekStartDay}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, weekStartDay: Number(e.target.value) })}
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                      <option key={day} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="measurementUnit">Measurement unit</Label>
                  <select
                    id="measurementUnit"
                    className={selectClassName}
                    value={businessForm.measurementUnit}
                    disabled={!canManage}
                    onChange={(e) => setBusinessForm({ ...businessForm, measurementUnit: e.target.value as MeasurementUnit })}
                  >
                    <option value="METRIC">Metric (kg, cm)</option>
                    <option value="IMPERIAL">Imperial (lb, in)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2 sm:w-64">
                <Label htmlFor="locale">Language</Label>
                <Input
                  id="locale"
                  placeholder="en"
                  value={businessForm.locale}
                  disabled={!canManage}
                  onChange={(e) => setBusinessForm({ ...businessForm, locale: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Future-ready — the portal UI is English-only today.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email settings</CardTitle>
              <CardDescription>The sender identity used for outbound emails from your gym.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emailFromName">From name</Label>
                <Input
                  id="emailFromName"
                  value={emailForm.emailFromName ?? ''}
                  disabled={!canManage}
                  onChange={(e) => setEmailForm({ ...emailForm, emailFromName: e.target.value || null })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailFromAddress">From address</Label>
                <Input
                  id="emailFromAddress"
                  type="email"
                  value={emailForm.emailFromAddress ?? ''}
                  disabled={!canManage}
                  onChange={(e) => setEmailForm({ ...emailForm, emailFromAddress: e.target.value || null })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification preferences</CardTitle>
              <CardDescription>Tenant-wide channel defaults. SMS is configuration-only — no provider is connected yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="emailNotificationsEnabled"
                  checked={notificationForm.emailNotificationsEnabled}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    setNotificationForm({ ...notificationForm, emailNotificationsEnabled: checked === true })
                  }
                />
                <Label htmlFor="emailNotificationsEnabled" className="cursor-pointer font-normal">
                  Email notifications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pushNotificationsEnabled"
                  checked={notificationForm.pushNotificationsEnabled}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    setNotificationForm({ ...notificationForm, pushNotificationsEnabled: checked === true })
                  }
                />
                <Label htmlFor="pushNotificationsEnabled" className="cursor-pointer font-normal">
                  Push notifications
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="smsNotificationsEnabled"
                  checked={notificationForm.smsNotificationsEnabled}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    setNotificationForm({ ...notificationForm, smsNotificationsEnabled: checked === true })
                  }
                />
                <Label htmlFor="smsNotificationsEnabled" className="cursor-pointer font-normal">
                  SMS notifications <span className="text-xs text-muted-foreground">(configuration only)</span>
                </Label>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
