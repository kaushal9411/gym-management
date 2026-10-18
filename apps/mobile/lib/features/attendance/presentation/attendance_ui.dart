import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks for the redesigned Attendance screens (today view,
/// history, check-in flow, visit-detail sheet): colours / labels per check-in
/// method, formatting, the visit card, KPI tiles and the small animated charts.
/// Same visual language as Members / Leads / Team / Branches.

// ── method + status vocabulary (enum values are the API's UPPER_SNAKE) ──────

/// `(value, label)` of every `AttendanceMethod` the API accepts as a filter.
const kAttendanceMethods = <(String, String)>[
  ('QR_CODE', 'QR code'),
  ('MANUAL', 'Manual'),
  ('BIOMETRIC', 'Biometric'),
  ('FACE_RECOGNITION', 'Face recognition'),
  ('NFC', 'NFC'),
  ('RFID', 'RFID'),
];

String attendanceMethodLabel(String? method) {
  for (final m in kAttendanceMethods) {
    if (m.$1 == method) return m.$2;
  }
  return 'Unknown';
}

Color attendanceMethodColor(String? method) => switch (method) {
      'QR_CODE' => TeamColors.indigo,
      'MANUAL' => TeamColors.violet,
      'BIOMETRIC' => TeamColors.teal,
      'FACE_RECOGNITION' => TeamColors.amber,
      'NFC' => TeamColors.green,
      'RFID' => TeamColors.rose,
      _ => TeamColors.slate,
    };

IconData attendanceMethodIcon(String? method) => switch (method) {
      'QR_CODE' => Icons.qr_code_2_rounded,
      'MANUAL' => Icons.touch_app_rounded,
      'BIOMETRIC' => Icons.fingerprint_rounded,
      'FACE_RECOGNITION' => Icons.face_retouching_natural_rounded,
      'NFC' => Icons.nfc_rounded,
      'RFID' => Icons.contactless_rounded,
      _ => Icons.help_outline_rounded,
    };

// ── formatting ──────────────────────────────────────────────────────────────

/// `9:05 AM` in the device's local time (the API sends UTC).
String fmtClock(DateTime d) {
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '$h:$m ${l.hour >= 12 ? 'PM' : 'AM'}';
}

/// `1h 20m` / `45m` / `<1m`.
String fmtDuration(Duration d) {
  if (d.inMinutes < 1) return '<1m';
  final h = d.inHours;
  final m = d.inMinutes % 60;
  if (h == 0) return '${m}m';
  return m == 0 ? '${h}h' : '${h}h ${m}m';
}

/// `9 AM` for an hour of day 0-23; `—` when null.
String fmtHour(int? hour, {bool minutes = false}) {
  if (hour == null) return '—';
  final h = hour % 12 == 0 ? 12 : hour % 12;
  return '$h${minutes ? ':00' : ''} ${hour < 12 ? 'AM' : 'PM'}';
}

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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

String weekdayShort(DateTime d) => _weekdays[d.weekday - 1];

/// `12 Oct`.
String fmtDayMonth(DateTime d) => '${d.day} ${_months[d.month - 1]}';

DateTime dayOnly(DateTime d) => DateTime(d.year, d.month, d.day);

/// `Today` / `Yesterday` / `Mon, 12 Oct`.
String dayHeading(DateTime d) {
  final today = dayOnly(DateTime.now());
  final diff = today.difference(dayOnly(d)).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  return '${weekdayShort(d)}, ${fmtDayMonth(d)}';
}

/// Parses the API's `YYYY-MM-DD` trend date into a local date.
DateTime parseTrendDate(String s) =>
    DateTime.tryParse(s.length >= 10 ? s.substring(0, 10) : s) ??
    DateTime.now();

/// How long the visit lasted (or has lasted so far, when still inside).
Duration visitDuration(AttendanceRecord r) =>
    (r.checkOutTime ?? DateTime.now()).difference(r.checkInTime);

/// Records grouped by local check-in day, keeping the incoming order.
List<(DateTime, List<AttendanceRecord>)> groupRecordsByDay(
  List<AttendanceRecord> records,
) {
  final groups = <(DateTime, List<AttendanceRecord>)>[];
  for (final r in records) {
    final day = dayOnly(r.checkInTime.toLocal());
    if (groups.isNotEmpty && groups.last.$1 == day) {
      groups.last.$2.add(r);
    } else {
      groups.add((day, [r]));
    }
  }
  return groups;
}

// ── trend maths (derived from the 30-day summary series, like web) ──────────

class AttendanceTrendMetrics {
  const AttendanceTrendMetrics({
    required this.today,
    required this.yesterday,
    required this.todayDeltaPct,
    required this.thisWeekSum,
    required this.lastWeekSum,
    required this.weekDeltaPct,
    required this.weekdayPairs,
  });

  final int today;
  final int yesterday;
  final double todayDeltaPct;
  final int thisWeekSum;
  final int lastWeekSum;
  final double weekDeltaPct;

  /// `(weekday label, this week, last week)` for the last 7 days.
  final List<(String, int, int)> weekdayPairs;
}

double _deltaPct(int now, int before) => before > 0
    ? (now - before) / before * 100
    : now > 0
        ? 100
        : 0;

AttendanceTrendMetrics computeAttendanceTrend(List<AttendanceTrendDay> trend) {
  final today = trend.isEmpty ? 0 : trend.last.count;
  final yesterday = trend.length < 2 ? 0 : trend[trend.length - 2].count;
  final thisWeek = trend.length <= 7 ? trend : trend.sublist(trend.length - 7);
  final lastWeek = trend.length <= 7
      ? <AttendanceTrendDay>[]
      : trend.sublist(
          math.max(0, trend.length - 14),
          trend.length - 7,
        );
  int sum(List<AttendanceTrendDay> l) => l.fold(0, (a, d) => a + d.count);
  final thisSum = sum(thisWeek);
  final lastSum = sum(lastWeek);
  return AttendanceTrendMetrics(
    today: today,
    yesterday: yesterday,
    todayDeltaPct: _deltaPct(today, yesterday),
    thisWeekSum: thisSum,
    lastWeekSum: lastSum,
    weekDeltaPct: _deltaPct(thisSum, lastSum),
    weekdayPairs: [
      for (var i = 0; i < thisWeek.length; i++)
        (
          weekdayShort(parseTrendDate(thisWeek[i].date)),
          thisWeek[i].count,
          i < lastWeek.length ? lastWeek[i].count : 0,
        ),
    ],
  );
}

/// Check-ins per local hour of the day from a list of visits.
Map<int, int> checkInsByHour(Iterable<AttendanceRecord> records) {
  final out = <int, int>{};
  for (final r in records) {
    final h = r.checkInTime.toLocal().hour;
    out[h] = (out[h] ?? 0) + 1;
  }
  return out;
}

// ── small widgets ───────────────────────────────────────────────────────────

/// Photo (or gradient initials) with a coloured ring; a pulsing green dot on
/// the corner when [live] (the member is inside right now).
class AttendanceAvatar extends StatelessWidget {
  const AttendanceAvatar({
    super.key,
    required this.name,
    required this.color,
    this.photoUrl,
    this.size = 44,
    this.live = false,
  });

  final String name;
  final String? photoUrl;
  final Color color;
  final double size;
  final bool live;

  String get _initials {
    final w = name.trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty);
    final list = w.toList();
    if (list.isEmpty) return '?';
    if (list.length == 1) return list.first[0].toUpperCase();
    return (list[0][0] + list[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final hasPhoto = photoUrl != null && photoUrl!.isNotEmpty;
    final inner = size - 6;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            padding: const EdgeInsets.all(2.5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: [
                  color,
                  Color.lerp(color, Colors.white, 0.45)!,
                  TeamColors.fuchsia,
                  color,
                ],
              ),
            ),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.surface,
              ),
              padding: const EdgeInsets.all(1.5),
              child: hasPhoto
                  ? UserAvatar(
                      avatarUrl: photoUrl,
                      name: name,
                      size: inner - 3,
                    )
                  : Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            color,
                            Color.lerp(color, TeamColors.fuchsia, 0.55)!,
                          ],
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _initials,
                        style: AppText.body(
                          size: size * 0.3,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
            ),
          ),
          if (live)
            const Positioned(
              right: 0,
              bottom: 0,
              child: PulseDot(color: TeamColors.green, size: 10),
            ),
        ],
      ),
    );
  }
}

class AttendanceStatusTag extends StatelessWidget {
  const AttendanceStatusTag({super.key, required this.inside});

  final bool inside;

  @override
  Widget build(BuildContext context) => TeamTag(
        label: inside ? 'Inside' : 'Checked out',
        color: inside ? TeamColors.green : TeamColors.slate,
        icon: inside ? Icons.login_rounded : Icons.logout_rounded,
      );
}

class AttendanceMethodTag extends StatelessWidget {
  const AttendanceMethodTag({super.key, required this.method});

  final String? method;

  @override
  Widget build(BuildContext context) => TeamTag(
        label: attendanceMethodLabel(method),
        color: attendanceMethodColor(method),
        icon: attendanceMethodIcon(method),
      );
}

/// ▲ +12% / ▼ -8% / flat chip.
class AttendanceDeltaChip extends StatelessWidget {
  const AttendanceDeltaChip({super.key, required this.pct});

  final double pct;

  @override
  Widget build(BuildContext context) {
    final flat = pct.abs() < 0.5;
    final up = pct >= 0;
    final color = flat
        ? TeamColors.slate
        : up
            ? TeamColors.green
            : TeamColors.rose;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (!flat) ...[
            Icon(
              up ? Icons.trending_up_rounded : Icons.trending_down_rounded,
              size: 12,
              color: color,
            ),
            const SizedBox(width: 3),
          ],
          Text(
            flat ? 'flat' : '${up ? '+' : ''}${pct.round()}%',
            style:
                AppText.body(size: 10.5, weight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}

/// Translucent hero chip with a live pulsing dot ("12 inside now").
class AttendanceLiveChip extends StatelessWidget {
  const AttendanceLiveChip({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 7, 14, 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 14,
            height: 14,
            child: Center(
              child: PulseDot(color: Color(0xFF6EE7B7), size: 8),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

// ── visit card ──────────────────────────────────────────────────────────────

/// One visit: avatar, name / code, status, the in -> out times with duration,
/// method, and (when [onCheckOut] is given and the member is inside) a quick
/// Check out button. The whole card taps through to the detail sheet.
class AttendanceRecordCard extends StatelessWidget {
  const AttendanceRecordCard({
    super.key,
    required this.record,
    required this.onTap,
    this.showBranch = false,
    this.onCheckOut,
    this.busy = false,
  });

  final AttendanceRecord record;
  final VoidCallback onTap;
  final bool showBranch;

  /// Non-null only when the viewer may check out (`attendance:checkout`).
  final VoidCallback? onCheckOut;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final r = record;
    final inside = r.isInside;
    final color = attendanceMethodColor(r.method);
    final out = r.checkOutTime;
    final sub = [
      if (r.memberCode != null && r.memberCode!.isNotEmpty) r.memberCode!,
      if (showBranch && r.branchName != null) r.branchName!,
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  (inside ? TeamColors.green : color).withValues(alpha: 0.10),
                  Colors.transparent,
                ],
              ),
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: inside
                    ? TeamColors.green.withValues(alpha: 0.45)
                    : AppColors.line,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    AttendanceAvatar(
                      name: r.memberName,
                      photoUrl: r.memberPhotoUrl,
                      color: color,
                      live: inside,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            r.memberName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 14,
                              weight: FontWeight.w800,
                            ),
                          ),
                          if (sub.isNotEmpty)
                            Text(
                              sub,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    AttendanceStatusTag(inside: inside),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _TimeChip(
                      icon: Icons.login_rounded,
                      text: fmtClock(r.checkInTime),
                      color: TeamColors.green,
                    ),
                    _TimeChip(
                      icon: Icons.logout_rounded,
                      text: out == null ? 'Still inside' : fmtClock(out),
                      color: out == null ? TeamColors.amber : TeamColors.teal,
                    ),
                    _TimeChip(
                      icon: Icons.timer_outlined,
                      text: fmtDuration(visitDuration(r)),
                      color: TeamColors.violet,
                    ),
                    AttendanceMethodTag(method: r.method),
                  ],
                ),
                if (onCheckOut != null && inside) ...[
                  const SizedBox(height: 10),
                  _QuickCheckOut(busy: busy, onTap: onCheckOut!),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({
    required this.icon,
    required this.text,
    required this.color,
  });

  final IconData icon;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 4),
        Text(
          text,
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w700,
            color: AppColors.inkSoft,
          ),
        ),
      ],
    );
  }
}

class _QuickCheckOut extends StatelessWidget {
  const _QuickCheckOut({required this.busy, required this.onTap});

  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: busy ? null : onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: TeamColors.rose.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: TeamColors.rose.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (busy)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: TeamColors.rose,
                  ),
                )
              else
                const Icon(
                  Icons.logout_rounded,
                  size: 15,
                  color: TeamColors.rose,
                ),
              const SizedBox(width: 6),
              Text(
                'Check out',
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: TeamColors.rose,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── KPI tiles ───────────────────────────────────────────────────────────────

class AttendanceKpi {
  const AttendanceKpi({
    required this.label,
    required this.color,
    required this.icon,
    this.value,
    this.text,
    this.delta,
  });

  final String label;
  final Color color;
  final IconData icon;

  /// Animated counter value; [text] is shown instead for non-numeric tiles.
  final int? value;
  final String? text;
  final double? delta;
}

/// Two-column (four on tablets) grid of animated KPI tiles; [onTap] gets the
/// tile index and every tile opens a bottom sheet.
class AttendanceKpiGrid extends StatelessWidget {
  const AttendanceKpiGrid({
    super.key,
    required this.tiles,
    required this.onTap,
    this.loading = false,
  });

  final List<AttendanceKpi> tiles;
  final ValueChanged<int> onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) => GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: tiles.length,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: c.maxWidth >= 560 ? 4 : 2,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          mainAxisExtent: 102,
        ),
        itemBuilder: (context, i) {
          final t = tiles[i];
          return FadeUp(
            index: i,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(18),
                onTap: loading ? null : () => onTap(i),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        t.color.withValues(alpha: 0.16),
                        Colors.transparent,
                      ],
                    ),
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: t.color.withValues(alpha: 0.22)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: t.color.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(9),
                            ),
                            child: Icon(t.icon, size: 14, color: t.color),
                          ),
                          const Spacer(),
                          if (t.delta != null && !loading)
                            AttendanceDeltaChip(pct: t.delta!)
                          else
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 16,
                              color: AppColors.inkFaint,
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      if (loading)
                        Container(
                          width: 34,
                          height: 20,
                          decoration: BoxDecoration(
                            color: AppColors.surface3,
                            borderRadius: BorderRadius.circular(6),
                          ),
                        )
                      else if (t.value != null)
                        CountUp(
                          value: t.value!,
                          style: AppText.display(size: 22, color: t.color),
                        )
                      else
                        Text(
                          t.text ?? '—',
                          style: AppText.display(size: 22, color: t.color),
                        ),
                      const Spacer(),
                      Text(
                        t.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 10.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── charts ──────────────────────────────────────────────────────────────────

/// One growing vertical bar (value / max), with a caption underneath.
class _VBar extends StatelessWidget {
  const _VBar({
    required this.ratio,
    required this.colors,
    required this.height,
    this.width = 10,
  });

  final double ratio;
  final List<Color> colors;
  final double height;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: Align(
        alignment: Alignment.bottomCenter,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: ratio.clamp(0.0, 1.0)),
          duration: const Duration(milliseconds: 1000),
          curve: Curves.easeOutCubic,
          builder: (context, v, _) => Container(
            width: width,
            height: math.max(3, height * v),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(5),
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: colors,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// This week vs last week, per weekday: a violet bar (this week) beside a
/// pale one (last week).
class AttendancePairedBars extends StatelessWidget {
  const AttendancePairedBars({super.key, required this.pairs});

  final List<(String, int, int)> pairs;

  @override
  Widget build(BuildContext context) {
    final max =
        pairs.expand((p) => [p.$2, p.$3]).fold(1, (a, b) => b > a ? b : a);
    return Column(
      children: [
        SizedBox(
          height: 92,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final p in pairs)
                Expanded(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _VBar(
                        ratio: p.$3 / max,
                        height: 92,
                        width: 8,
                        colors: [
                          TeamColors.violet.withValues(alpha: 0.25),
                          TeamColors.violet.withValues(alpha: 0.45),
                        ],
                      ),
                      const SizedBox(width: 3),
                      _VBar(
                        ratio: p.$2 / max,
                        height: 92,
                        width: 8,
                        colors: const [TeamColors.indigo, TeamColors.violet],
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (final p in pairs)
              Expanded(
                child: Text(
                  p.$1,
                  textAlign: TextAlign.center,
                  style: AppText.body(
                    size: 10,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _LegendDot(color: TeamColors.violet, label: 'This week'),
            const SizedBox(width: 14),
            _LegendDot(
              color: TeamColors.violet.withValues(alpha: 0.4),
              label: 'Last week',
            ),
          ],
        ),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: AppText.body(
            size: 10.5,
            weight: FontWeight.w700,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}

/// Check-ins per hour of day as a row of growing bars; the busiest hour is
/// highlighted. Shows only the span of hours that has data (min 6 hours).
class AttendanceHourBars extends StatelessWidget {
  const AttendanceHourBars({super.key, required this.byHour, this.height = 84});

  final Map<int, int> byHour;
  final double height;

  @override
  Widget build(BuildContext context) {
    if (byHour.isEmpty) {
      return Text(
        'No check-ins yet today.',
        style: AppText.body(size: 12.5, color: AppColors.inkFaint),
      );
    }
    var lo = byHour.keys.reduce(math.min);
    var hi = byHour.keys.reduce(math.max);
    while (hi - lo < 5) {
      if (hi < 23) {
        hi++;
      } else if (lo > 0) {
        lo--;
      } else {
        break;
      }
    }
    final max = byHour.values.fold(1, (a, b) => b > a ? b : a);
    final busiest =
        byHour.entries.reduce((a, b) => b.value > a.value ? b : a).key;
    final hours = [for (var h = lo; h <= hi; h++) h];
    return Column(
      children: [
        SizedBox(
          height: height,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final h in hours)
                Expanded(
                  child: Center(
                    child: _VBar(
                      ratio: (byHour[h] ?? 0) / max,
                      height: height,
                      width: 9,
                      colors: h == busiest
                          ? const [TeamColors.amber, TeamColors.rose]
                          : [
                              TeamColors.amber.withValues(alpha: 0.35),
                              TeamColors.amber.withValues(alpha: 0.7),
                            ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (final h in hours)
              Expanded(
                child: Text(
                  hours.length > 12 && (h - lo).isOdd
                      ? ''
                      : fmtHour(h).replaceAll(' ', '').toLowerCase(),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: AppText.body(
                    size: 8.5,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
