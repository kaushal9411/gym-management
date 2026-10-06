'use client';

import { Eye } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import type { MessageLogItem, MessageLogListResult } from '../types';
import { MessageLogChannelBadge, MessageLogStatusBadge } from './message-log-badges';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface MessageLogTableProps {
  data: MessageLogListResult | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  onPage: (p: number) => void;
  pageSize: number;
  onSelect: (item: MessageLogItem) => void;
}

/** Every Email/SMS/WhatsApp send attempt — recipient, subject/preview, status, sent-at. The "Subject / preview" cell opens the full content (DataTable has no native row-click). */
export function MessageLogTable({ data, loading, error, onRetry, page, onPage, pageSize, onSelect }: MessageLogTableProps) {
  const items = data?.items ?? [];

  const columns: DataTableColumn<MessageLogItem>[] = [
    { key: 'channel', header: 'Channel', render: (m) => <MessageLogChannelBadge channel={m.channel} /> },
    { key: 'recipient', header: 'Recipient', render: (m) => <span className="font-mono text-xs">{m.recipient}</span> },
    {
      key: 'content',
      header: 'Subject / preview',
      render: (m) => (
        <button type="button" onClick={() => onSelect(m)} className="block max-w-[320px] truncate text-left hover:underline">
          {m.subject ? <b className="font-semibold">{m.subject}</b> : <span className="text-muted-foreground">{m.content.slice(0, 60)}</span>}
        </button>
      ),
    },
    { key: 'status', header: 'Status', render: (m) => <MessageLogStatusBadge status={m.status} /> },
    { key: 'createdAt', header: 'Sent at', render: (m) => <span className="whitespace-nowrap">{fmtDateTime(m.createdAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">View</span>,
      className: 'w-10 text-right',
      render: (m) => (
        <button type="button" aria-label="View full message" onClick={() => onSelect(m)} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Eye className="size-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <section className="overflow-hidden rounded-[20px] border bg-card shadow-xs">
      <div className="px-3 pb-3 pt-3 sm:px-4">
        <DataTable columns={columns} rows={items} rowKey={(m) => m.id} loading={loading} error={error} onRetry={onRetry} emptyMessage="No messages match these filters." />
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t px-5 py-4">
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={onPage} totalItems={data?.total} pageSize={pageSize} />
        </div>
      ) : null}
    </section>
  );
}
