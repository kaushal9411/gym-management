import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../models/group_class.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks of the redesigned Classes screens (catalog list,
/// class detail / form, weekly schedule, calendar, session detail, add
/// attendee, and the member plane's booking tab).

// ── status / colour helpers ─────────────────────────────────────────────────

/// Deleted -> rose, active -> green, inactive -> amber (web's `ClassCard`).
Color classTone(GroupClass c) {
  if (c.isDeleted) return TeamColors.rose;
  return c.isActive ? TeamColors.green : TeamColors.amber;
}

String classStatus(GroupClass c) {
  if (c.isDeleted) return 'Deleted';
  return c.isActive ? 'Active' : 'Inactive';
}

IconData classStatusIcon(GroupClass c) {
  if (c.isDeleted) return Icons.delete_outline_rounded;
  return c.isActive ? Icons.check_circle_rounded : Icons.pause_circle_rounded;
}

/// Session status -> colour (`SCHEDULED` is the normal state).
Color sessionTone(String status) => switch (status) {
      'CANCELLED' => TeamColors.rose,
      'COMPLETED' => TeamColors.slate,
      _ => TeamColors.indigo,
    };

String sessionStatusLabel(String status) => switch (status) {
      'CANCELLED' => 'Cancelled',
      'COMPLETED' => 'Completed',
      'SCHEDULED' => 'Scheduled',
      _ => prettyEnum(status),
    };

/// Booking status -> colour + label (`BOOKED` / `ATTENDED` / `NO_SHOW` ...).
Color bookingTone(String status) => switch (status) {
      'ATTENDED' => TeamColors.green,
      'NO_SHOW' => TeamColors.rose,
      'CANCELLED' => TeamColors.slate,
      _ => TeamColors.indigo,
    };

String bookingStatusLabel(String status) => switch (status) {
      'BOOKED' => 'Booked',
      'ATTENDED' => 'Attended',
      'NO_SHOW' => 'Missed',
      'CANCELLED' => 'Cancelled',
      _ => prettyEnum(status),
    };

/// Stable per-class accent from its name.
Color classAccent(String name) {
  final h = name.codeUnits.fold<int>(0, (a, c) => (a * 31 + c) & 0x7fffffff);
  return TeamColors.rotation[h % TeamColors.rotation.length];
}

/// One colour per weekday (web's `DAY_ACCENTS`).
Color weekDayColor(WeekDay d) => switch (d) {
      WeekDay.monday => TeamColors.indigo,
      WeekDay.tuesday => TeamColors.violet,
      WeekDay.wednesday => TeamColors.teal,
      WeekDay.thursday => TeamColors.amber,
      WeekDay.friday => TeamColors.green,
      WeekDay.saturday => TeamColors.rose,
      WeekDay.sunday => TeamColors.fuchsia,
    };

/// Capacity usage colour: full -> rose, 75%+ -> amber, else [base].
Color capacityTone(int booked, int capacity, {Color base = TeamColors.indigo}) {
  if (capacity > 0 && booked >= capacity) return TeamColors.rose;
  if (capacity > 0 && booked / capacity >= 0.75) return TeamColors.amber;
  return base;
}

// ── time / date helpers ─────────────────────────────────────────────────────

/// `07:00` -> `7:00 AM` (anything unparseable is returned as-is).
String classTime(String hhmm) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm);
  if (m == null) return hhmm;
  final h = int.parse(m.group(1)!);
  final min = m.group(2)!;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:$min ${h >= 12 ? 'PM' : 'AM'}';
}

String classTimeRange(String start, String end) =>
    '${classTime(start)} – ${classTime(end)}';

/// `HH:mm` (24h) from a [TimeOfDay] — the wire format of a slot.
String hhmm(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

TimeOfDay? parseHhmm(String s) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(s);
  if (m == null) return null;
  return TimeOfDay(
    hour: int.parse(m.group(1)!),
    minute: int.parse(m.group(2)!),
  );
}

const _dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String dowLabel(DateTime d) => _dow[d.weekday - 1];

/// `5 Oct`.
String dayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';

/// `YYYY-MM-DD` of a local date.
String dateKey(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

DateTime parseDay(String key) {
  final d = DateTime.tryParse(key.length >= 10 ? key.substring(0, 10) : key);
  return d == null ? DateTime.now() : DateTime(d.year, d.month, d.day);
}

/// `Mon, 5 Oct` for a `YYYY-MM-DD` key.
String fmtDayKey(String key) {
  final d = parseDay(key);
  return '${dowLabel(d)}, ${dayMonth(d)}';
}

/// Monday of the week containing [d] (local, midnight).
DateTime startOfWeek(DateTime d) {
  final day = DateTime(d.year, d.month, d.day);
  return DateTime(day.year, day.month, day.day - (day.weekday - 1));
}

DateTime addDays(DateTime d, int n) => DateTime(d.year, d.month, d.day + n);

/// Local start / end of a session (its `HH:mm` times are wall-clock on
/// `sessionDate`, as web's member page reads them).
DateTime sessionStart(String dayKey, String startTime) =>
    _at(dayKey, startTime);

DateTime sessionEnd(String dayKey, String endTime) => _at(dayKey, endTime);

DateTime _at(String dayKey, String time) {
  final d = parseDay(dayKey);
  final t = parseHhmm(time) ?? const TimeOfDay(hour: 0, minute: 0);
  return DateTime(d.year, d.month, d.day, t.hour, t.minute);
}

/// "in 25 min" / "in 3h 5m" / "in 2d 4h".
String countdownLabel(Duration d) {
  final mins = d.inMinutes < 0 ? 0 : d.inMinutes;
  if (mins < 60) return 'in $mins min';
  final h = mins ~/ 60;
  if (h < 24) return 'in ${h}h ${mins % 60}m';
  return 'in ${h ~/ 24}d ${h % 24}h';
}

String plural(int n, String one, [String? many]) =>
    '$n ${n == 1 ? one : (many ?? '${one}s')}';

String initialsOf(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  final s = parts.take(2).map((w) => w[0]).join().toUpperCase();
  return s.isEmpty ? '?' : s;
}

/// `GET /class-sessions` dates are `YYYY-MM-DD` — `true` for a session whose
/// end time has already passed.
bool sessionEnded(ClassSession s, DateTime now) =>
    sessionEnd(s.dayKey, s.endTime).isBefore(now);

// ── hero + small widgets ────────────────────────────────────────────────────

/// Full-bleed animated gradient (never capped) with [child] laid out inside
/// the capped content column. Use under a transparent AppBar
/// (`extendBodyBehindAppBar`); [topInset] = status bar + toolbar height.
class ClassHeroShell extends StatelessWidget {
  const ClassHeroShell({
    super.key,
    required this.topInset,
    required this.child,
    this.bottom = 22,
  });

  final double topInset;
  final double bottom;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Positioned.fill(
          child: MeshHeroBackground(
            radius: BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox.expand(),
          ),
        ),
        TeamCenter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(18, 8 + topInset, 18, bottom),
            child: child,
          ),
        ),
      ],
    );
  }
}

/// Selectable chip on the gradient [ListHero] (white when selected).
class ClassHeroChip extends StatelessWidget {
  const ClassHeroChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? const Color(0xFF6D28D9) : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
        ),
        child: Text(
          label,
          style: AppText.body(size: 12.5, weight: FontWeight.w800, color: fg),
        ),
      ),
    );
  }
}

/// Gradient disc with the class's initials (web's `ClassCard` icon).
class ClassGlyph extends StatelessWidget {
  const ClassGlyph({
    super.key,
    required this.name,
    required this.color,
    this.size = 46,
  });

  final String name;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.55)!],
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.35),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        initialsOf(name),
        style: AppText.display(size: size * 0.34, color: Colors.white),
      ),
    );
  }
}

/// Booked / capacity bar that grows in, with a "N spots left" caption.
class CapacityBar extends StatelessWidget {
  const CapacityBar({
    super.key,
    required this.booked,
    required this.capacity,
    this.base = TeamColors.indigo,
    this.showCaption = true,
  });

  final int booked;
  final int capacity;
  final Color base;
  final bool showCaption;

  @override
  Widget build(BuildContext context) {
    final tone = capacityTone(booked, capacity, base: base);
    final ratio = capacity <= 0 ? 0.0 : (booked / capacity).clamp(0.0, 1.0);
    final left = capacity - booked;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showCaption)
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: Row(
              children: [
                Icon(Icons.groups_rounded, size: 13, color: AppColors.inkFaint),
                const SizedBox(width: 4),
                Text(
                  '$booked/$capacity booked',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w700,
                    color: AppColors.inkSoft,
                  ),
                ),
                const Spacer(),
                Text(
                  left <= 0 ? 'Full' : plural(left, 'spot left', 'spots left'),
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w800,
                    color: tone,
                  ),
                ),
              ],
            ),
          ),
        GrowBar(
          ratio: ratio,
          height: 7,
          track: AppColors.surface3,
          colors: [tone, tone.withValues(alpha: 0.55)],
        ),
      ],
    );
  }
}

/// Tinted status chip for sessions / bookings.
class ClassStatusChip extends StatelessWidget {
  const ClassStatusChip({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => TeamTag(label: label, color: color);
}
