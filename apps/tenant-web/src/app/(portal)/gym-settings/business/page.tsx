'use client';

import * as React from 'react';
import { Bell, Mail, SlidersHorizontal, Globe2 } from 'lucide-react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BusinessPreview } from '@/features/gym-settings/components/previews';
import { Field, SectionCard, SettingsLayout, StatusChip, selectClassName } from '@/features/gym-settings/components/settings-ui';
import { SettingsHero } from '@/features/gym-settings/components/settings-hero';
import { StaggerGroup } from '@/features/reports/components/ui';
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

  const channels: { id: 'emailNotificationsEnabled' | 'pushNotificationsEnabled' | 'smsNotificationsEnabled' | 'whatsappNotificationsEnabled'; label: string }[] = [
    { id: 'emailNotificationsEnabled', label: 'Email notifications' },
    { id: 'pushNotificationsEnabled', label: 'Push notifications' },
    { id: 'smsNotificationsEnabled', label: 'SMS notifications' },
    { id: 'whatsappNotificationsEnabled', label: 'WhatsApp notifications' },
  ];

  return (
    <div className="space-y-5">
      <SettingsHero
        title="Business Settings"
        subtitle="Currency, timezone, formats, outbound email identity, and notification channels."
        icon={SlidersHorizontal}
        stats={businessForm ? [{ label: 'Currency', value: businessForm.currency || '-' }] : undefined}
      />

      {loading || !businessForm || !emailForm || !notificationForm ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-[20px]" />
          <Skeleton className="h-32 w-full rounded-[20px]" />
        </div>
      ) : (
        <>
          {canManage ? (
            <UnsavedChangesBar isDirty={isDirty} saving={saving} onSave={() => void handleSave()} onCancel={handleCancel} />
          ) : null}

          <SettingsLayout
            aside={
              <StaggerGroup className="space-y-5">
                <BusinessPreview form={businessForm} />
              </StaggerGroup>
            }
          >
            <StaggerGroup className="space-y-5">
              <SectionCard tone="operations" icon={Globe2} title="Regional & display" subtitle="Currency, timezone, date/time formats, and units used across the portal.">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Currency (ISO code)" htmlFor="currency" required>
                    <Input id="currency" maxLength={3} value={businessForm.currency} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, currency: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Currency symbol" htmlFor="currencySymbol">
                    <Input id="currencySymbol" maxLength={8} value={businessForm.currencySymbol} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, currencySymbol: e.target.value })} />
                  </Field>
                  <Field label="Timezone" htmlFor="timezone" required>
                    <Input id="timezone" placeholder="America/Los_Angeles" value={businessForm.timezone} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, timezone: e.target.value })} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Date format" htmlFor="dateFormat">
                    <select id="dateFormat" className={selectClassName} value={businessForm.dateFormat} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, dateFormat: e.target.value })}>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </Field>
                  <Field label="Time format" htmlFor="timeFormat">
                    <select id="timeFormat" className={selectClassName} value={businessForm.timeFormat} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, timeFormat: e.target.value })}>
                      <option value="12h">12-hour</option>
                      <option value="24h">24-hour</option>
                    </select>
                  </Field>
                  <Field label="Week starts on" htmlFor="weekStartDay">
                    <select id="weekStartDay" className={selectClassName} value={businessForm.weekStartDay} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, weekStartDay: Number(e.target.value) })}>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                        <option key={day} value={i}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Measurement unit" htmlFor="measurementUnit">
                    <select id="measurementUnit" className={selectClassName} value={businessForm.measurementUnit} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, measurementUnit: e.target.value as MeasurementUnit })}>
                      <option value="METRIC">Metric (kg, cm)</option>
                      <option value="IMPERIAL">Imperial (lb, in)</option>
                    </select>
                  </Field>
                </div>
                <Field className="sm:w-64" label="Language" htmlFor="locale" hint="Future-ready — the portal UI is English-only today.">
                  <Input id="locale" placeholder="en" value={businessForm.locale} disabled={!canManage} onChange={(e) => setBusinessForm({ ...businessForm, locale: e.target.value })} />
                </Field>
              </SectionCard>

              <SectionCard tone="members" icon={Mail} title="Email settings" subtitle="The sender identity used for outbound emails from your gym.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From name" htmlFor="emailFromName">
                    <Input id="emailFromName" value={emailForm.emailFromName ?? ''} disabled={!canManage} onChange={(e) => setEmailForm({ ...emailForm, emailFromName: e.target.value || null })} />
                  </Field>
                  <Field label="From address" htmlFor="emailFromAddress">
                    <Input id="emailFromAddress" type="email" value={emailForm.emailFromAddress ?? ''} disabled={!canManage} onChange={(e) => setEmailForm({ ...emailForm, emailFromAddress: e.target.value || null })} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard tone="staff" icon={Bell} title="Notification preferences" subtitle="Tenant-wide channel defaults — each is still capped by the plan's platform-set quota.">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {channels.map((c) => {
                    const on = notificationForm[c.id];
                    return (
                      <div key={c.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors duration-200 ${on ? 'border-primary/40 bg-primary/5' : 'bg-muted/30'}`}>
                        <Checkbox id={c.id} checked={on} disabled={!canManage} onCheckedChange={(checked) => setNotificationForm({ ...notificationForm, [c.id]: checked === true })} />
                        <Label htmlFor={c.id} className="flex-1 cursor-pointer font-semibold">
                          {c.label}
                        </Label>
                        <StatusChip tone={on ? 'good' : 'muted'}>{on ? 'On' : 'Off'}</StatusChip>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </StaggerGroup>
          </SettingsLayout>
        </>
      )}
    </div>
  );
}
