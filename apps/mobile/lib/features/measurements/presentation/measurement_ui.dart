import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../models/user_profile.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Single place that answers "may this signed-in staff user do X on the Body
/// Measurements screens?". A thin, pure wrapper over the permission list so
/// the gating matrix can be unit-tested.
///
/// **What the redesign did NOT change**: the pages are still reached through
/// the Owner / Manager / Receptionist / Trainer Menu tiles (`measurements:view`,
/// no feature flag) and the member plane's own Menu tile; routes and their
/// `extra` types are untouched.
///
/// **Per-action hiding** (new; the old screens showed every action and let the
/// API answer 403) follows web's `MemberMeasurementsCard` / `/measurements`
/// page 1:1 — each key exists in `prisma/seed.ts` and equals the route's
/// `requirePermission`:
/// * Record measurement (hero +, empty-state button, detail button) -> `measurements:create`
/// * Edit entry -> `measurements:update`
/// * Delete entry -> `measurements:delete`
class MeasurementAccess {
  const MeasurementAccess(this.user);

  /// Resolved from the session; a non-staff session can do nothing.
  static MeasurementAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    return MeasurementAccess(s is SessionAuthenticatedStaff ? s.user : null);
  }

  final UserProfile? user;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  bool get canView => _has('measurements:view');
  bool get canCreate => _has('measurements:create');
  bool get canUpdate => _has('measurements:update');
  bool get canDelete => _has('measurements:delete');
}

// ── the eight measured values ───────────────────────────────────────────────

/// One recordable value. Bounds mirror the API's `measurement.validators.ts`
/// (everything strictly positive except body fat, which may be 0).
enum MeasurementField {
  weight(
    'Weight',
    'kg',
    500,
    Icons.monitor_weight_rounded,
    TeamColors.indigo,
  ),
  height('Height', 'cm', 300, Icons.height_rounded, TeamColors.sky),
  bodyFat(
    'Body fat',
    '%',
    80,
    Icons.percent_rounded,
    TeamColors.amber,
    allowZero: true,
  ),
  chest('Chest', 'cm', 300, Icons.accessibility_new_rounded, TeamColors.teal),
  waist('Waist', 'cm', 300, Icons.straighten_rounded, TeamColors.rose),
  hips('Hips', 'cm', 300, Icons.straighten_rounded, TeamColors.violet),
  biceps('Biceps', 'cm', 150, Icons.fitness_center_rounded, TeamColors.fuchsia),
  thighs('Thighs', 'cm', 200, Icons.directions_run_rounded, TeamColors.green);

  const MeasurementField(
    this.label,
    this.unit,
    this.max,
    this.icon,
    this.color, {
    this.allowZero = false,
  });

  final String label;
  final String unit;
  final double max;
  final IconData icon;
  final Color color;
  final bool allowZero;

  /// `Weight (kg)` — the form label.
  String get formLabel => '$label ($unit)';

  /// The girth fields (everything measured with a tape).
  bool get isGirth => const {chest, waist, hips, biceps, thighs}.contains(this);

  double? of(BodyMeasurement m) => switch (this) {
        weight => m.weightKg,
        height => m.heightCm,
        bodyFat => m.bodyFatPercent,
        chest => m.chestCm,
        waist => m.waistCm,
        hips => m.hipsCm,
        biceps => m.bicepsCm,
        thighs => m.thighsCm,
      };

  /// `78.5 kg`, `18%`.
  String show(double v) => unit == '%' ? '${fmtNum(v)}%' : '${fmtNum(v)} $unit';
}

/// Fields of [m] that carry a value, in the form's order.
List<MeasurementField> recordedFields(BodyMeasurement m) => [
      for (final f in MeasurementField.values)
        if (f.of(m) != null) f,
    ];

// ── number + date helpers ───────────────────────────────────────────────────

/// `78` / `78.5` / `78.55` — no trailing zeros.
String fmtNum(double v) {
  if (v == v.roundToDouble()) return v.toStringAsFixed(0);
  final s = v.toStringAsFixed(2);
  return s.endsWith('0') ? s.substring(0, s.length - 1) : s;
}

/// Parses what a person typed: empty -> null, `78,5` is accepted like `78.5`.
double? parseMeasurementNumber(String text) {
  final t = text.trim().replaceAll(',', '.');
  if (t.isEmpty) return null;
  return double.tryParse(t);
}

/// Whole days since [iso] (web's `daysSince`).
int daysSince(DateTime d, {DateTime? now}) =>
    (now ?? DateTime.now()).difference(d).inDays;

/// Not measured for this many days = "stale" (web's `STALE_DAYS`).
const kMeasurementStaleDays = 30;

String ageLabel(int days) => days <= 0 ? 'Today' : '${days}d ago';

/// Green when measured within the last 30 days, amber after that.
Color freshnessTone(int days) =>
    days <= kMeasurementStaleDays ? TeamColors.green : TeamColors.amber;

/// The calendar day a person sees for an entry. Dates recorded from the
/// app are UTC midnight (a plain date) and must not shift in a western
/// timezone; real instants are shown in local time.
DateTime entryDay(DateTime d) {
  final dateOnly = d.isUtc && d.hour == 0 && d.minute == 0 && d.second == 0;
  final l = dateOnly ? d : d.toLocal();
  return DateTime(l.year, l.month, l.day);
}

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

/// `12 Sep` (chart axis / short labels).
String shortDay(DateTime d) {
  final l = entryDay(d);
  return '${l.day} ${_months[l.month - 1]}';
}

/// `12 Sep 2026`.
String longDay(DateTime d) {
  final l = entryDay(d);
  return '${l.day} ${_months[l.month - 1]} ${l.year}';
}

/// Initials for the avatar fallbacks.
String initialsOf(String name) {
  final words =
      name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return '?';
  if (words.length == 1) return words.first[0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// ── small shared widgets ────────────────────────────────────────────────────

/// Cards / compact switch (web's grid / list toggle).
class MeasurementViewToggle extends StatelessWidget {
  const MeasurementViewToggle({
    super.key,
    required this.compact,
    required this.onChanged,
  });

  final bool compact;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget btn(IconData icon, String tip, bool on, bool value) => Tooltip(
          message: tip,
          child: GestureDetector(
            onTap: () => onChanged(value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: on ? TeamColors.cta : null,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: 19,
                color: on ? Colors.white : AppColors.inkFaint,
              ),
            ),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          btn(Icons.grid_view_rounded, 'Cards', !compact, false),
          btn(Icons.view_list_rounded, 'Compact list', compact, true),
        ],
      ),
    );
  }
}

/// A small tinted "Weight 78.5 kg" chip for one recorded value.
class MeasurementValueChip extends StatelessWidget {
  const MeasurementValueChip({
    super.key,
    required this.field,
    required this.value,
  });

  final MeasurementField field;
  final double value;

  @override
  Widget build(BuildContext context) {
    final c = field.color;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: c.withValues(alpha: 0.25)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(field.icon, size: 12, color: c),
          const SizedBox(width: 5),
          Text(
            field.label,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            field.show(value),
            style: AppText.body(size: 12, weight: FontWeight.w800, color: c),
          ),
        ],
      ),
    );
  }
}

/// Avatar with a gradient ring in the entry's freshness tone.
class MeasuredAvatar extends StatelessWidget {
  const MeasuredAvatar({
    super.key,
    required this.name,
    required this.url,
    required this.tone,
    this.size = 56,
  });

  final String name;
  final String? url;
  final Color tone;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: SweepGradient(
          colors: [tone, TeamColors.fuchsia, TeamColors.violet, tone],
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surface,
        ),
        child: UserAvatar(avatarUrl: url, name: name, size: size),
      ),
    );
  }
}
