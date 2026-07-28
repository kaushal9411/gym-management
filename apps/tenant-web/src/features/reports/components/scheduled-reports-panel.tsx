'use client';

import * as React from 'react';
import { Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { cn } from '@/lib/utils';
import {
  toReportError,
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useRunScheduledReportNow,
  useScheduledReports,
  useToggleScheduledReport,
} from '../hooks/use-reports';
import type { ScheduledReportFrequency } from '../types';
import { REPORT_TYPE_OPTIONS } from './report-cards';

const selectClassName = cn(
  'h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
);

export function ScheduledReportsPanel() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('reports:export');

  const schedules = useScheduledReports();
  const createSchedule = useCreateScheduledReport();
  const deleteSchedule = useDeleteScheduledReport();
  const toggleSchedule = useToggleScheduledReport();
  const runNow = useRunScheduledReportNow();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [reportType, setReportType] = React.useState(REPORT_TYPE_OPTIONS[0]!.value);
  const [frequency, setFrequency] = React.useState<ScheduledReportFrequency>('WEEKLY');
  const [recipients, setRecipients] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  if (!hasPermission('reports:view')) return null;

  const resetForm = () => {
    setName('');
    setReportType(REPORT_TYPE_OPTIONS[0]!.value);
    setFrequency('WEEKLY');
    setRecipients('');
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const recipientEmails = recipients
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    if (!name.trim() || recipientEmails.length === 0) {
      setError('Name and at least one recipient email are required.');
      return;
    }
    createSchedule.mutate(
      { name, reportType, frequency, recipientEmails },
      {
        onSuccess: () => {
          toast.success('Scheduled report created.');
          setDialogOpen(false);
          resetForm();
        },
        onError: (err) => setError(toReportError(err).message),
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Scheduled Reports</CardTitle>
        {canManage ? (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> Schedule a report
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {schedules.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (schedules.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No scheduled reports yet — set one up for automatic email delivery.</p>
        ) : (
          (schedules.data ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm last:border-0 last:pb-0">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.reportType} · {s.frequency.toLowerCase()} · {s.recipientEmails.length} recipient(s) · next run {new Date(s.nextRunAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant={s.isActive ? 'secondary' : 'outline'}>{s.isActive ? 'Active' : 'Paused'}</Badge>
                {canManage ? (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleSchedule.mutate({ id: s.id, isActive: !s.isActive })}
                    >
                      {s.isActive ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      disabled={runNow.isPending}
                      onClick={() => runNow.mutate(s.id, { onSuccess: () => toast.success('Run recorded — email will be sent shortly.') })}
                    >
                      <Play className="size-3.5" /> Run now
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => setConfirmDeleteId(s.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule a report</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="scheduleName" required>
                Name
              </Label>
              <Input id="scheduleName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly revenue summary" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleReportType">Report</Label>
              <select id="scheduleReportType" className={selectClassName} value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleFrequency">Frequency</Label>
              <select
                id="scheduleFrequency"
                className={selectClassName}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ScheduledReportFrequency)}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduleRecipients" required>
                Recipient emails (comma-separated)
              </Label>
              <Input id="scheduleRecipients" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="owner@gym.com, manager@gym.com" />
            </div>
            <Button type="submit" className="w-full" disabled={createSchedule.isPending}>
              {createSchedule.isPending ? 'Creating…' : 'Create schedule'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title="Delete this scheduled report?"
        description="This stops its automatic email delivery. This action can't be undone."
        destructive
        loading={deleteSchedule.isPending}
        onConfirm={() => {
          if (confirmDeleteId) deleteSchedule.mutate(confirmDeleteId, { onSuccess: () => toast.success('Scheduled report deleted.') });
          setConfirmDeleteId(null);
        }}
      />
    </Card>
  );
}
