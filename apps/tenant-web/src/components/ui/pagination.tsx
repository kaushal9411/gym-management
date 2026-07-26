'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  /** 1-indexed current page. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** When provided (with `pageSize`), renders a "Showing X–Y of Z" label. */
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

/** Windowed page-number list: first, last, current ± 1, with `…` gaps — caps at ~7 visible buttons regardless of totalPages. */
function buildPageWindow(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push('ellipsis');
    result.push(p);
  });
  return result;
}

/** Shared list-page pagination footer — replaces the hand-rolled "Page X of Y" + Prev/Next pattern duplicated per module. */
function Pagination({ page, totalPages, onPageChange, totalItems, pageSize, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const windowed = buildPageWindow(page, totalPages);

  const rangeLabel =
    totalItems != null && pageSize != null
      ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)} of ${totalItems}`
      : `Page ${page} of ${totalPages}`;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-col-reverse items-center justify-between gap-3 sm:flex-row', className)}
    >
      <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {windowed.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className="size-8 text-sm tabular-nums"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

export { Pagination };
