'use client';

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { toMeasurementError, useCreateMeasurement, useDeleteMeasurement, useMemberMeasurements, useUpdateMeasurement } from '../hooks/use-measurements';
import type { BodyMeasurement, BodyMeasurementFormValues } from '../types';
import { summarizeMeasurement } from '../utils';
import { EMPTY_MEASUREMENT_FORM, MeasurementFormFields, measurementFormToPayload, measurementToFormValues } from './measurement-form-fields';

interface MemberMeasurementsCardProps {
  memberId: string;
}

/** Trainer/Owner/Manager-logged historical body-measurement trend log for a member — separate from the profile's single current height/weight fields above. */
export function MemberMeasurementsCard({ memberId }: MemberMeasurementsCardProps) {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('measurements:view');
  const canCreate = hasPermission('measurements:create');
  const canUpdate = hasPermission('measurements:update');
  const canDelete = hasPermission('measurements:delete');

  const measurements = useMemberMeasurements(canView ? memberId : null);
  const create = useCreateMeasurement(memberId);
  const update = useUpdateMeasurement(memberId);
  const remove = useDeleteMeasurement(memberId);

  const [adding, setAdding] = React.useState(false);
  const [newValues, setNewValues] = React.useState<BodyMeasurementFormValues>(EMPTY_MEASUREMENT_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState<BodyMeasurementFormValues>(EMPTY_MEASUREMENT_FORM);

  if (!canView) return null;

  const entries = measurements.data ?? [];
  const latest = entries[0] ?? null;
  const history = entries.slice(1);

  const handleAdd = () => {
    create.mutate(measurementFormToPayload(newValues), {
      onSuccess: () => {
        toast.success('Measurement recorded.');
        setAdding(false);
        setNewValues(EMPTY_MEASUREMENT_FORM);
      },
      onError: (err) => toast.error(toMeasurementError(err).message),
    });
  };

  const startEdit = (entry: BodyMeasurement) => {
    setEditingId(entry.id);
    setEditValues(measurementToFormValues(entry));
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    update.mutate(
      { id: editingId, payload: measurementFormToPayload(editValues) },
      {
        onSuccess: () => {
          toast.success('Measurement updated.');
          setEditingId(null);
        },
        onError: (err) => toast.error(toMeasurementError(err).message),
      },
    );
  };

  const handleDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => toast.success('Measurement deleted.'),
      onError: (err) => toast.error(toMeasurementError(err).message),
    });
  };

  return (
    <Card id="measurements" data-testid="measurements-card">
      <CardHeader>
        <CardTitle className="text-base">Body measurements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {measurements.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No measurements recorded yet.</p>
        ) : editingId === latest?.id ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <MeasurementFormFields value={editValues} onChange={setEditValues} />
            <div className="flex gap-2">
              <Button size="sm" disabled={update.isPending} onClick={handleSaveEdit}>
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          latest && (
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{new Date(latest.recordedAt).toLocaleDateString()}</p>
                <p className="text-sm text-muted-foreground">{summarizeMeasurement(latest)}</p>
                {latest.notes ? <p className="mt-1 text-xs text-muted-foreground">{latest.notes}</p> : null}
                {latest.recordedBy ? <p className="mt-1 text-xs text-muted-foreground">Recorded by {latest.recordedBy.name}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                {canUpdate ? (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Edit" onClick={() => startEdit(latest)}>
                    <Pencil className="size-4" />
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Delete" disabled={remove.isPending} onClick={() => handleDelete(latest.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          )
        )}

        {canCreate ? (
          adding ? (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
              <MeasurementFormFields value={newValues} onChange={setNewValues} />
              <div className="flex gap-2">
                <Button size="sm" disabled={create.isPending} onClick={handleAdd}>
                  {create.isPending ? 'Saving…' : 'Save measurement'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewValues(EMPTY_MEASUREMENT_FORM); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              Record measurement
            </Button>
          )
        ) : null}

        {history.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer select-none text-muted-foreground transition-colors hover:text-foreground">
              History ({history.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {history.map((entry) =>
                editingId === entry.id ? (
                  <div key={entry.id} className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
                    <MeasurementFormFields value={editValues} onChange={setEditValues} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={update.isPending} onClick={handleSaveEdit}>
                        {update.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 px-2.5 py-2">
                    <div>
                      <span className="font-medium">{new Date(entry.recordedAt).toLocaleDateString()}</span>{' '}
                      <span className="text-xs text-muted-foreground">{summarizeMeasurement(entry)}</span>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {canUpdate ? (
                        <Button size="icon" variant="ghost" className="size-7" aria-label="Edit" onClick={() => startEdit(entry)}>
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="icon" variant="ghost" className="size-7" aria-label="Delete" disabled={remove.isPending} onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ),
              )}
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
