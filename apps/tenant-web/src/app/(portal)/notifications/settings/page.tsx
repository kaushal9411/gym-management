'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useNotificationTemplates, useUpdateNotificationTemplate } from '@/features/notifications/hooks/use-notifications';
import type { NotificationChannel, NotificationTemplate } from '@/features/notifications/types';

const CHANNEL_OPTIONS: Array<{ value: NotificationChannel; label: string; disabled?: boolean }> = [
  { value: 'IN_APP', label: 'In-App' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PUSH', label: 'Push (Future)', disabled: true },
  { value: 'SMS', label: 'SMS (Future)', disabled: true },
];

export default function NotificationSettingsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('notifications:manage');
  const templates = useNotificationTemplates();
  const updateTemplate = useUpdateNotificationTemplate();

  const [editing, setEditing] = React.useState<NotificationTemplate | null>(null);
  const [channels, setChannels] = React.useState<NotificationChannel[]>([]);
  const [titleTemplate, setTitleTemplate] = React.useState('');
  const [bodyTemplate, setBodyTemplate] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  const openEdit = (template: NotificationTemplate) => {
    setEditing(template);
    setChannels(template.channels);
    setTitleTemplate(template.titleTemplate);
    setBodyTemplate(template.bodyTemplate);
    setIsActive(template.isActive);
  };

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    updateTemplate.mutate(
      { type: editing.type, input: { channels, titleTemplate, bodyTemplate, isActive } },
      { onSuccess: () => { toast.success('Template updated.'); setEditing(null); } },
    );
  };

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage notification templates.</p>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/notifications">
          <ArrowLeft className="size-4" /> Back to Notifications
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground">
          Customize the title, body, and delivery channels for each automatic notification. Placeholders like <code>{'{{memberName}}'}</code> are filled in
          automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            (templates.data ?? []).map((template) => (
              <div key={template.type} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{template.label}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {template.channels.map((c) => (
                      <Badge key={c} variant="outline" className="text-[10px]">
                        {c}
                      </Badge>
                    ))}
                    {!template.isActive ? (
                      <Badge variant="outline" className="text-[10px] text-destructive">
                        Disabled
                      </Badge>
                    ) : null}
                    {template.isCustomized ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Customized
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(template)}>
                  Edit
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateTitle">Title</Label>
              <Input id="templateTitle" value={titleTemplate} onChange={(e) => setTitleTemplate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateBody">Body</Label>
              <textarea
                id="templateBody"
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-4">
                {CHANNEL_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`channel-${opt.value}`}
                      checked={channels.includes(opt.value)}
                      disabled={opt.disabled}
                      onCheckedChange={() => toggleChannel(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox id="templateActive" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
              Active
            </label>
            <Button type="submit" className="w-full" disabled={updateTemplate.isPending}>
              {updateTemplate.isPending ? 'Saving…' : 'Save template'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
