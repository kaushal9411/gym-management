import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { accentVar, tint } from '@/features/members/components/detail/detail-ui';

interface MemberActionCardProps {
  name: string;
  memberId: string;
  profilePhotoUrl: string | null;
  eligible: boolean;
  reason: string | null;
  actionLabel: string;
  onAction: () => void;
  busy?: boolean;
}

/** Shared "here's who we found, here's whether they can act, here's the button" card used by both the QR and manual check-in/out flows. */
export function MemberActionCard({ name, memberId, profilePhotoUrl, eligible, reason, actionLabel, onAction, busy }: MemberActionCardProps) {
  const tone = eligible ? 'success' : 'destructive';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-xs"
      style={{ backgroundImage: `linear-gradient(135deg, ${tint(tone, 10)}, transparent 70%)`, borderColor: tint(tone, 25) }}
    >
      <div className="flex items-center gap-3">
        <span
          className="block shrink-0 rounded-full p-[2.5px]"
          style={{ backgroundImage: `conic-gradient(from 200deg, ${accentVar(tone)}, color-mix(in oklch, ${accentVar(tone)} 40%, white), var(--chart-7), ${accentVar(tone)})` }}
        >
          <Avatar className="size-11 border-2 border-card">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt="" /> : null}
            <AvatarFallback className="font-bold text-white" style={{ backgroundImage: `linear-gradient(135deg, ${accentVar(tone)}, var(--chart-7))` }}>
              {name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </span>
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-muted-foreground">{memberId}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        {reason ? (
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--destructive)' }}>
            <XCircle className="size-4" /> {reason}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--success)' }}>
            <CheckCircle2 className="size-4" /> Eligible
          </span>
        )}
        <Button
          size="sm"
          disabled={!eligible || busy}
          onClick={onAction}
          className="border-0 text-white shadow-md disabled:opacity-50"
          style={eligible ? { backgroundImage: 'linear-gradient(120deg, var(--success), var(--chart-3))' } : undefined}
        >
          {busy ? 'Working…' : actionLabel}
        </Button>
      </div>
    </motion.div>
  );
}
