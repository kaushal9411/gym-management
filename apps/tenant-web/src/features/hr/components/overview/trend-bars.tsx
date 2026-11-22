'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

import { useMotionSafe } from '@/features/reports/lib/motion';
import { formatDay, todayYmd, WEEKDAYS_SHORT, weekdayIndex } from '../../lib/dates';
import { mix, TONES, type HrTone } from '../../lib/hr-palette';
import type { HrOverview } from '../../types';

const SERIES: { key: 'present' | 'late' | 'halfDay' | 'onLeave' | 'absent'; tone: HrTone }[] = [
  { key: 'present', tone: 'present' },
  { key: 'late', tone: 'late' },
  { key: 'halfDay', tone: 'half' },
  { key: 'onLeave', tone: 'leave' },
  { key: 'absent', tone: 'absent' },
];

/** 7-day stacked attendance bars. Each segment has a pattern-free tone plus the legend/table below, and an off-screen data table for screen readers. */
export function TrendBars({ trend }: { trend: HrOverview['trend'] }) {
  const m = useMotionSafe();
  const today = todayYmd();
  const max = Math.max(1, ...trend.map((d) => d.present + d.late + d.halfDay + d.onLeave + d.absent));
  const H = 168;
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: H + 28 }} role="img" aria-label="Attendance over the last seven days">
        {trend.map((d, i) => {
          const total = d.present + d.late + d.halfDay + d.onLeave + d.absent;
          const isToday = d.date === today;
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-extrabold tabular-nums text-muted-foreground">{total}</span>
              <div className="flex w-full max-w-[56px] flex-col-reverse overflow-hidden rounded-lg bg-muted/50" style={{ height: H }} title={`${formatDay(d.date, 'weekday')}: ${SERIES.map((s) => `${TONES[s.tone].label} ${d[s.key]}`).join(', ')}`}>
                {SERIES.map((s, si) => {
                  const h = (d[s.key] / max) * H;
                  if (!d[s.key]) return null;
                  const meta = TONES[s.tone];
                  return (
                    <motion.div
                      key={s.key}
                      initial={m.reduce ? false : { height: 0 }}
                      animate={{ height: h }}
                      transition={{ duration: 0.7, delay: i * 0.06 + si * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
                      className="flex items-center justify-center text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: meta.color, boxShadow: si > 0 ? `inset 0 1px 0 ${mix('white', 40)}` : undefined }}
                    >
                      {h > 16 ? d[s.key] : null}
                    </motion.div>
                  );
                })}
              </div>
              <span className={isToday ? 'text-[11px] font-extrabold text-primary' : 'text-[11px] font-semibold text-muted-foreground'}>{isToday ? 'Today' : WEEKDAYS_SHORT[weekdayIndex(d.date)]}</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5" aria-label="Legend">
        {SERIES.map((s) => {
          const meta = TONES[s.tone];
          const Icon = meta.icon;
          return (
            <li key={s.key} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded" style={{ backgroundColor: meta.color, color: 'white' }}>
                <Icon className="size-2.5" aria-hidden strokeWidth={3} />
              </span>
              {meta.label}
            </li>
          );
        })}
      </ul>
      <table className="sr-only">
        <caption>Attendance for the last seven days</caption>
        <thead>
          <tr>
            <th>Date</th>
            {SERIES.map((s) => (
              <th key={s.key}>{TONES[s.tone].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trend.map((d) => (
            <tr key={d.date}>
              <td>{formatDay(d.date, 'weekday')}</td>
              {SERIES.map((s) => (
                <td key={s.key}>{d[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One-line proportional bar of today's buckets. */
export function TodayBar({ today }: { today: HrOverview['today'] }) {
  const m = useMotionSafe();
  const parts: { tone: HrTone; value: number }[] = [
    { tone: 'present', value: today.present },
    { tone: 'late', value: today.late },
    { tone: 'half', value: today.halfDay },
    { tone: 'leave', value: today.onLeave },
    { tone: 'absent', value: today.absent },
    { tone: 'off', value: today.weeklyOff + today.holiday },
    { tone: 'none', value: today.notMarked },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={parts.map((p) => `${TONES[p.tone].label} ${p.value}`).join(', ')}>
        {parts.map((p, i) =>
          p.value ? (
            <motion.div key={p.tone} initial={m.reduce ? false : { width: 0 }} animate={{ width: `${(p.value / total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} style={{ backgroundColor: TONES[p.tone].color, opacity: p.tone === 'none' ? 0.35 : 1 }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const meta = TONES[p.tone];
            const Icon = meta.icon;
            return (
              <li key={p.tone} className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <Icon className="size-3.5" style={{ color: meta.color }} aria-hidden />
                <span className="tabular-nums">{p.value}</span>
                <span className="text-muted-foreground">{p.tone === 'off' ? 'Off / holiday' : p.tone === 'none' ? 'Yet to check in' : meta.label}</span>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
