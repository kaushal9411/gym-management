'use client';

import * as React from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { CalendarCheck, CheckCircle2, Flame, IndianRupee, type LucideIcon } from 'lucide-react';

import { GALLERY, type HomePhoto } from '../images';
import { SectionHead } from './content-sections';
import { Photo } from './photo';

interface Chip {
  icon: LucideIcon;
  text: string;
  tone: string;
  /** Tailwind position classes inside the tile. */
  pos: string;
  delay: number;
}

interface Tile {
  photo: HomePhoto;
  ratio: string;
  chip?: Chip;
}

const COLS: Tile[][] = [
  [
    { photo: GALLERY.ropes!, ratio: 'aspect-[3/4]', chip: { icon: CheckCircle2, text: 'Workout done', tone: 'text-emerald-600 dark:text-emerald-300', pos: 'bottom-4 left-4', delay: 0 } },
    { photo: GALLERY.crunch!, ratio: 'aspect-[4/3]' },
  ],
  [
    { photo: GALLERY.yoga!, ratio: 'aspect-[4/3]', chip: { icon: CalendarCheck, text: 'Class booked · 6:30 pm', tone: 'text-cyan-700 dark:text-cyan-300', pos: 'left-4 top-4', delay: 1.2 } },
    { photo: GALLERY.curl!, ratio: 'aspect-[3/4]', chip: { icon: Flame, text: '5-day streak', tone: 'text-orange-600 dark:text-orange-300', pos: 'bottom-4 right-4', delay: 0.6 } },
  ],
  [
    { photo: GALLERY.treadmill!, ratio: 'aspect-[4/3]' },
    { photo: GALLERY.pushup!, ratio: 'aspect-[4/3]', chip: { icon: IndianRupee, text: 'Plan renewed', tone: 'text-emerald-600 dark:text-emerald-300', pos: 'bottom-4 left-4', delay: 1.8 } },
    { photo: GALLERY.barbell!, ratio: 'aspect-[4/3]' },
  ],
];

function FloatingChip({ chip }: { chip: Chip }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`absolute z-10 flex items-center gap-2 rounded-full border border-foreground/10 bg-card/95 px-3 py-1.5 text-xs font-bold text-foreground shadow-lg backdrop-blur ${chip.pos}`}
      initial={reduce ? false : { opacity: 0, scale: 0.7, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.5 + chip.delay * 0.2 }}
    >
      <motion.span animate={reduce ? undefined : { y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: chip.delay }} className="flex items-center gap-2">
        <chip.icon className={`size-4 ${chip.tone}`} aria-hidden />
        {chip.text}
      </motion.span>
    </motion.div>
  );
}

function PhotoTile({ tile, index }: { tile: Tile; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.figure
      className={`group relative overflow-hidden rounded-3xl border border-foreground/10 bg-foreground/5 shadow-xl ${tile.ratio}`}
      initial={reduce ? false : { opacity: 0, scale: 0.94, clipPath: 'inset(12% 12% 12% 12% round 24px)' }}
      whileInView={{ opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0% round 24px)' }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
    >
      <div className="absolute inset-0 transition-transform duration-[900ms] ease-out group-hover:scale-110">
        <Photo photo={tile.photo} sizes="(min-width: 1024px) 28vw, 45vw" />
      </div>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80" />
      {tile.chip ? <FloatingChip chip={tile.chip} /> : null}
    </motion.figure>
  );
}

function Column({ tiles, progress, range, offset }: { tiles: Tile[]; progress: MotionValue<number>; range: [number, number]; offset: number }) {
  const reduce = useReducedMotion();
  const y = useTransform(progress, [0, 1], range);
  return (
    <motion.div style={reduce ? undefined : { y }} className="flex flex-col gap-4 sm:gap-6">
      {tiles.map((t, i) => (
        <PhotoTile key={t.photo.src} tile={t} index={offset + i} />
      ))}
    </motion.div>
  );
}

/** A photo mosaic whose three columns drift at different speeds as you scroll, with live-looking chips floating on the photos. */
export function GallerySection() {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  return (
    <section className="relative overflow-hidden border-t border-foreground/10 py-20 sm:py-28" aria-labelledby="gallery-title">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Built for the gym floor" title="Train. Track. Transform." body="Your members train. The app keeps count: workouts, streaks, classes and payments, so they stay on track and you stay on top." />
        <h2 id="gallery-title" className="sr-only">Train. Track. Transform.</h2>

        <div ref={ref} className="mt-14 grid grid-cols-2 items-start gap-4 sm:gap-6 lg:grid-cols-3">
          <Column tiles={COLS[0]!} progress={scrollYProgress} range={[50, -70]} offset={0} />
          <Column tiles={COLS[1]!} progress={scrollYProgress} range={[-40, 60]} offset={1} />
          <div className="hidden lg:block">
            <Column tiles={COLS[2]!} progress={scrollYProgress} range={[70, -50]} offset={2} />
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-foreground/40">Photos are for illustration. Chips on the photos are examples of what members see in the app.</p>
      </div>
    </section>
  );
}
