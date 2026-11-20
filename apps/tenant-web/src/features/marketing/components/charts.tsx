'use client';

/**
 * Small hand-drawn SVG charts for the marketing page. They are illustrations, so every place that uses
 * them says "Sample data". They draw themselves in when scrolled into view (and just appear under
 * reduced motion). Colours come from Tailwind text classes through `currentColor`, so both themes work.
 */
import * as React from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * True once the chart's frame has scrolled into view (or always, under reduced motion).
 * Watching the whole frame is more reliable than watching a bar that starts at zero size.
 */
export function useSeen(ref: React.RefObject<Element | null>): boolean {
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return !!reduce || inView;
}

/** Smooth line through the points (Catmull-Rom converted to cubic Beziers). */
export function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M ${pts[0]![0]} ${pts[0]![1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d.push(`C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`);
  }
  return d.join(' ');
}

export function AreaChart({ data, className = 'text-orange-500', height = 120, labels }: { data: number[]; className?: string; height?: number; labels?: string[] }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, '');
  const W = 400;
  const H = height;
  const pad = 8;
  const max = Math.max(...data) * 1.1;
  const pts: Array<[number, number]> = data.map((v, i) => [pad + (i * (W - pad * 2)) / (data.length - 1), H - pad - 14 - (v / max) * (H - pad * 2 - 14)]);
  const line = smoothPath(pts);
  const area = `${line} L ${pts[pts.length - 1]![0]} ${H - 14} L ${pts[0]![0]} ${H - 14} Z`;
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full ${className}`} role="img" aria-label="Line chart (sample data)">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1={pad} x2={W - pad} y1={(H - 14) * g} y2={(H - 14) * g} className="stroke-foreground/10" strokeDasharray="3 5" />
      ))}
      <motion.path
        d={area}
        fill={`url(#area-${id})`}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, delay: 0.5 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.5, ease: EASE }}
      />
      <motion.circle
        cx={last[0]}
        cy={last[1]}
        r={4.5}
        fill="currentColor"
        className="stroke-background"
        strokeWidth={2}
        initial={reduce ? false : { scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 1.4, type: 'spring', stiffness: 260, damping: 14 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
      />
      {labels?.map((l, i) => (
        <text key={l + i} x={pad + (i * (W - pad * 2)) / (labels.length - 1)} y={H - 2} textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'} className="fill-foreground/45 text-[9px]">
          {l}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({
  data,
  labels,
  className = 'text-cyan-500',
  height = 110,
  highlight,
}: {
  data: number[];
  labels?: string[];
  className?: string;
  height?: number;
  highlight?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<SVGSVGElement>(null);
  const seen = useSeen(ref);
  const W = 300;
  const H = height;
  const max = Math.max(...data);
  const gap = 8;
  const bw = (W - gap * (data.length + 1)) / data.length;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={`h-auto w-full ${className}`} role="img" aria-label="Bar chart (sample data)">
      {data.map((v, i) => {
        const h = Math.max(4, (v / max) * (H - 22));
        return (
          <g key={i}>
            <motion.rect
              x={gap + i * (bw + gap)}
              y={H - 16 - h}
              width={bw}
              height={h}
              rx={4}
              fill="currentColor"
              opacity={highlight === undefined || highlight === i ? 1 : 0.45}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: seen ? 1 : 0 }}
              transition={{ duration: 0.8, delay: i * 0.07, ease: EASE }}
              style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
            />
            {labels?.[i] ? (
              <text x={gap + i * (bw + gap) + bw / 2} y={H - 3} textAnchor="middle" className="fill-foreground/45 text-[9px]">
                {labels[i]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export interface DonutSlice {
  value: number;
  /** A Tailwind text-colour class, e.g. `text-orange-500`. */
  className: string;
  label: string;
}

export function Donut({ slices, size = 120, thickness = 14, center }: { slices: DonutSlice[]; size?: number; thickness?: number; center?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" role="img" aria-label="Donut chart (sample data)">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-foreground/10" />
        {slices.map((s) => {
          const f = s.value / total;
          const start = offset;
          offset += f;
          return (
            <motion.circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={thickness}
              strokeLinecap="butt"
              pathLength={1}
              strokeDashoffset={-start}
              className={s.className}
              initial={reduce ? { strokeDasharray: `${Math.max(0, f - 0.012)} 1` } : { strokeDasharray: '0 1' }}
              whileInView={{ strokeDasharray: `${Math.max(0, f - 0.012)} 1` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
            />
          );
        })}
      </svg>
      {center ? <div className="absolute inset-0 grid place-items-center text-center">{center}</div> : null}
    </div>
  );
}

export function Ring({ value, size = 88, thickness = 9, className = 'text-orange-500', children }: { value: number; size?: number; thickness?: number; className?: string; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const r = (size - thickness) / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className={`size-full -rotate-90 ${className}`} role="img" aria-label={`${Math.round(value * 100)} percent (sample data)`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={thickness} className="stroke-foreground/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          pathLength={1}
          initial={reduce ? { strokeDasharray: `${value} 1` } : { strokeDasharray: '0 1' }}
          whileInView={{ strokeDasharray: `${value} 1` }}
          viewport={{ once: true }}
          transition={{ duration: 1.3, ease: EASE, delay: 0.1 }}
        />
      </svg>
      {children ? <div className="absolute inset-0 grid place-items-center text-center">{children}</div> : null}
    </div>
  );
}

/** Weekday by hour grid, darker = busier. Values are 0 to 4. */
export function Heatmap({ rows, rowLabels, className = 'text-cyan-500' }: { rows: number[][]; rowLabels: string[]; className?: string }) {
  const reduce = useReducedMotion();
  const cols = rows[0]!.length;
  return (
    <div className={className} role="img" aria-label="Busy hours heatmap (sample data)">
      <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}>
        {rows.map((row, r) => (
          <React.Fragment key={rowLabels[r]}>
            <span className="pr-1.5 text-[10px] leading-5 text-foreground/45">{rowLabels[r]}</span>
            {row.map((v, c) => (
              <motion.span
                key={c}
                className="h-5 rounded-[4px] bg-current"
                style={{ opacity: 0.1 + v * 0.22 }}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 0.1 + v * 0.22, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: (r * cols + c) * 0.012, duration: 0.35 }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ data, className = 'text-orange-500' }: { data: number[]; className?: string }) {
  const reduce = useReducedMotion();
  const W = 80;
  const H = 24;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts: Array<[number, number]> = data.map((v, i) => [(i * W) / (data.length - 1), H - 2 - ((v - min) / (max - min || 1)) * (H - 4)]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-6 w-20 ${className}`} aria-hidden>
      <motion.path
        d={smoothPath(pts)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: EASE }}
      />
    </svg>
  );
}
