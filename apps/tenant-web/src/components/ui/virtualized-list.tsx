'use client';

import * as React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedListProps<T> {
  items: T[];
  /** Fixed row height in px — required by the windowing math. */
  itemHeight: number;
  /** Height of the scrollable viewport. */
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  /** Extra rows rendered above/below the viewport so fast scrolling doesn't show blank gaps. Default 6. */
  overscan?: number;
}

/**
 * Global Loading & Performance Optimization (Prompt 23) — a generic
 * windowed list for genuinely large, flat (non-paginated) datasets. Most
 * lists in this app already paginate server-side (20/page), which is
 * usually the better fix for "large datasets" — reach for this only for
 * the rarer case of a full, unpaginated collection rendered client-side
 * (e.g. the Permission Matrix's ~100+ permission rows). Only the rows
 * within (and just around) the visible viewport are ever mounted.
 */
export function VirtualizedList<T>({ items, itemHeight, height, renderItem, className, overscan = 6 }: VirtualizedListProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  return (
    <div ref={scrollRef} className={className} style={{ height, overflowY: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderItem(items[virtualRow.index] as T, virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
