'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import { useUpdateNotificationTemplate } from '../hooks/use-notifications';
import type { NotificationChannel, NotificationTemplate } from '../types';

const CHANNEL_OPTIONS: Array<{ value: NotificationChannel; label: string; disabled?: boolean }> = [
  { value: 'IN_APP', label: 'In-App' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PUSH', label: 'Push (Future)', disabled: true },
  { value: 'SMS', label: 'SMS (Future)', disabled: true },
];

/** Edit dialog: same fields, validation (none) and PUSH/SMS 'Future' disabled behaviour as before, in the gradient-header family of RefundDialog. */
export function TemplateEditDialog({ template, onClose }: { template: NotificationTemplate | null; onClose: () => void }) {
  const updateTemplate = useUpdateNotificationTemplate();
  const [channels, setChannels] = React.useState<NotificationChannel[]>([]);
  const [titleTemplate, setTitleTemplate] = React.useState('');
  const [bodyTemplate, setBodyTemplate] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    if (!template) return;
    setChannels(template.channels);
    setTitleTemplate(template.titleTemplate);
    setBodyTemplate(template.bodyTemplate);
    setIsActive(template.isActive);
  }, [template]);

  const toggleChannel = (channel: NotificationChannel) => {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    updateTemplate.mutate(
      { type: template.type, input: { channels, titleTemplate, bodyTemplate, isActive } },
      {
        onSuccess: () => {
          toast.success('Template updated.');
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={template !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg gap-0 overflow-y-auto rounded-3xl p-0 [&>button:last-child]:right-5 [&>button:last-child]:top-5 [&>button:last-child]:z-10 [&>button:last-child]:bg-white/20 [&>button:last-child]:text-white [&>button:last-child]:opacity-100 [&>button:last-child]:hover:bg-white/30">
        <div className="px-6 py-[22px] text-white" style={{ backgroundImage: 'linear-gradient(115deg, #4338ca, #7c3aed 62%, #c026d3)' }}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">Edit template</p>
          <DialogTitle className="mt-1 pr-10 text-[22px] font-extrabold">{template?.label}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/85">
            Placeholders like <code>{'{{memberName}}'}</code> are filled in automatically.
          </DialogDescription>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-6">
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
              className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-xs outline-none transition-all duration-150 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-4">
              {CHANNEL_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox id={`channel-${opt.value}`} checked={channels.includes(opt.value)} disabled={opt.disabled} onCheckedChange={() => toggleChannel(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox id="templateActive" checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
            Active
          </label>
          <LoadingButton type="submit" className="w-full" loading={updateTemplate.isPending} loadingText="Saving…">
            Save template
          </LoadingButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
