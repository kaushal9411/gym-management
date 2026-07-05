'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  toNotificationError,
  useAnnouncements,
  useCreateAnnouncement,
  useCreateNotification,
  useNotifications,
  useSendNotification,
  useSetAnnouncementActive,
} from '@/features/notifications/hooks/use-notifications';
import type { AnnouncementAudience, NotificationChannel } from '@/features/notifications/types';

const AUDIENCES: AnnouncementAudience[] = ['ALL', 'TRIAL', 'ACTIVE', 'SPECIFIC'];

function AnnouncementsTab() {
  const { data: announcements, isLoading } = useAnnouncements();
  const createAnnouncement = useCreateAnnouncement();
  const setActive = useSetAnnouncementActive();
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [audience, setAudience] = React.useState<AnnouncementAudience>('ALL');

  const submit = () => {
    createAnnouncement.mutate(
      { title, body, audience },
      {
        onSuccess: () => {
          toast.success('Announcement created');
          setCreating(false);
          setTitle('');
          setBody('');
        },
        onError: (err) => toast.error(toNotificationError(err).message),
      },
    );
  };

  if (isLoading || !announcements) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>New announcement</Button>
      </div>

      {announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Audience: {a.audience} · Created {new Date(a.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={() => setActive.mutate({ id: a.id, isActive: !a.isActive })}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${a.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                >
                  {a.isActive ? 'Active' : 'Inactive'}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Body</Label><Input value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Audience</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}>
                {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <Button className="w-full" onClick={submit} disabled={createAnnouncement.isPending || !title || !body}>Publish announcement</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationsTab() {
  const { data: notifications, isLoading } = useNotifications();
  const createNotification = useCreateNotification();
  const sendNotification = useSendNotification();
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [channel, setChannel] = React.useState<NotificationChannel>('EMAIL');
  const [audience, setAudience] = React.useState<AnnouncementAudience>('ALL');

  const submit = () => {
    createNotification.mutate(
      { title, body, channel, audience },
      {
        onSuccess: () => {
          toast.success('Notification created — send it when ready');
          setCreating(false);
          setTitle('');
          setBody('');
        },
        onError: (err) => toast.error(toNotificationError(err).message),
      },
    );
  };

  if (isLoading || !notifications) return <Skeleton className="h-64 rounded-xl" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>New notification</Button>
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.channel} · {n.audience} · Created {new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
                {n.sentAt ? (
                  <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">Sent</span>
                ) : (
                  <Button size="sm" onClick={() => sendNotification.mutate(n.id, { onError: (err) => toast.error(toNotificationError(err).message) })} disabled={sendNotification.isPending}>
                    Send now
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>New notification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>Body</Label><Input value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Channel</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)}>
                  <option value="EMAIL">Email</option>
                  <option value="PUSH">Push</option>
                  <option value="IN_APP">In-app</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Audience</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={audience} onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}>
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <Button className="w-full" onClick={submit} disabled={createNotification.isPending || !title || !body}>Create notification</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NotificationsPage() {
  const [tab, setTab] = React.useState<'announcements' | 'notifications'>('announcements');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Global announcements (persistent banner) and one-time notifications.</p>
      </div>

      <div className="flex gap-1 border-b">
        {(['announcements', 'notifications'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'announcements' ? <AnnouncementsTab /> : <NotificationsTab />}
    </div>
  );
}
