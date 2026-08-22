import { Badge } from '@/components/ui/badge';

/** The single "Deleted" tag used across every soft-deletable list/detail view (members, staff, users,
 * membership plans, workout/diet plans, exercises/foods, classes, branches) — red and blinking to draw
 * the eye to records that are hidden from normal operation, reusing the app's `destructive` token rather
 * than a new color. Kept dashed (rather than the solid border other destructive statuses like "Expired"/
 * "Revoked" use) so "soft-deleted" still reads as visually distinct from those. Uses the custom
 * `animate-blink` keyframe (see `globals.css`) rather than Tailwind's stock `animate-pulse`, which is too
 * subtle to read as "blinking" at badge size — `animate-blink` still respects the app's global
 * `prefers-reduced-motion` override, so this stays still for users who need that. */
export function DeletedBadge() {
  return (
    <Badge
      variant="outline"
      className="animate-blink border-dashed border-destructive/50 bg-destructive/10 text-destructive"
    >
      Deleted
    </Badge>
  );
}
