import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../../models/report_summary.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../kit/kit.dart';

/// Shared building blocks of the "people" report screens (membership,
/// attendance, active-vs-inactive, expiring, member progress, staff, trainer
/// performance): result cards, animated bars, detail sheets, status palettes
/// and the date / time formatters that never shift a calendar day.

// ── formatting ─────────────────────────────────────────────────────────────

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

/// `2026-11-14` -> `14 Nov 2026`; plain string maths, so a date-only value can
/// never move to the neighbouring day. `—` when empty / malformed.
String peopleDate(String? iso) {
  if (iso == null || iso.length < 10) return '—';
  final y = iso.substring(0, 4);
  final m = int.tryParse(iso.substring(5, 7));
  final d = int.tryParse(iso.substring(8, 10));
  if (m == null || d == null || m < 1 || m > 12) return '—';
  return '$d ${_months[m - 1]} $y';
}

/// `6:42 AM` (device-local time).
String peopleTime(DateTime? t) {
  if (t == null) return '—';
  final l = t.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '$h:$m ${l.hour >= 12 ? 'PM' : 'AM'}';
}

/// `1h 23m` / `45m` / `<1m`.
String peopleDuration(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  if (h > 0) return '${h}h ${m}m';
  if (m > 0) return '${m}m';
  return '<1m';
}

/// Whole days between today and the `YYYY-MM-DD` [iso] (positive = future).
int? peopleDaysUntil(String? iso, {DateTime? now}) {
  if (iso == null || iso.length < 10) return null;
  final d = DateTime.tryParse(iso.substring(0, 10));
  if (d == null) return null;
  final t = now ?? DateTime.now();
  final today = DateTime(t.year, t.month, t.day);
  return DateTime(d.year, d.month, d.day).difference(today).inDays;
}

// ── status / role / method palettes ────────────────────────────────────────

/// Semantic colour of a member / staff status (API enum, any case).
Color peopleStatusColor(String status) => switch (status.toUpperCase()) {
      'ACTIVE' => RptColors.green,
      'FROZEN' => RptColors.sky,
      'EXPIRED' || 'SUSPENDED' || 'CANCELLED' => RptColors.rose,
      'PENDING' || 'INVITED' => RptColors.amber,
      'INACTIVE' => RptColors.slate,
      _ => RptColors.indigo,
    };

/// Breakdown colour hook for `RptSummaryPanel.colorFor`: statuses get their
/// semantic colour, everything else keeps the categorical palette.
Color? peopleBreakdownColor(String key, String label) =>
    key.contains('status') ? peopleStatusColor(label) : null;

/// Breakdown label hook for `RptSummaryPanel.labelFor`
/// (`MANAGER` -> `Manager`, `QR_CODE` -> `QR code`).
String peopleBreakdownLabel(String key, String label) {
  if (key.contains('method')) return peopleMethodLabel(label);
  // Only enum-valued breakdowns are prettified; plan / trainer names and
  // bucket labels ("7 days", "0-25%") stay exactly as the API sent them.
  if (key.contains('status') || key.contains('role')) return prettyEnum(label);
  return label;
}

Color peopleRoleColor(String role) => switch (role.toUpperCase()) {
      'MANAGER' => RptColors.violet,
      'TRAINER' => RptColors.teal,
      'RECEPTIONIST' => RptColors.amber,
      'OWNER' => RptColors.indigo,
      _ => RptColors.fuchsia,
    };

String peopleMethodLabel(String method) => switch (method.toUpperCase()) {
      'QR_CODE' => 'QR code',
      'RFID' => 'RFID',
      'NFC' => 'NFC',
      _ => prettyEnum(method),
    };

IconData peopleMethodIcon(String method) => switch (method.toUpperCase()) {
      'QR_CODE' => Icons.qr_code_2_rounded,
      'BIOMETRIC' => Icons.fingerprint_rounded,
      'FACE_RECOGNITION' => Icons.face_retouching_natural_rounded,
      'NFC' || 'RFID' => Icons.nfc_rounded,
      _ => Icons.touch_app_rounded,
    };

Color peopleMethodColor(String method) => switch (method.toUpperCase()) {
      'QR_CODE' => RptColors.indigo,
      'BIOMETRIC' => RptColors.fuchsia,
      'FACE_RECOGNITION' => RptColors.violet,
      'NFC' || 'RFID' => RptColors.sky,
      _ => RptColors.teal,
    };

/// Web's percent-cell colouring: >= 70 green, >= 35 amber, else rose.
Color peopleProgressColor(num percent) => percent >= 70
    ? RptColors.green
    : percent >= 35
        ? RptColors.amber
        : RptColors.rose;

/// Web's "days remaining" pill colouring: <= 7 rose, <= 14 amber, else green.
Color peopleUrgencyColor(int days) => days <= 7
    ? RptColors.rose
    : days <= 14
        ? RptColors.amber
        : RptColors.green;

// ── hero chips ─────────────────────────────────────────────────────────────

/// Up to three `ListHeroChip`s from the first numeric KPIs of [summary]
/// (web's hero stats); falls back to "N results" from [total].
List<Widget> peopleHeroChips(
  ReportSummary? summary, {
  int? total,
  String noun = 'results',
}) {
  final out = <Widget>[];
  if (summary != null) {
    for (final k in summary.kpis) {
      if (k.format == SummaryFormat.text) continue;
      final value = switch (k.format) {
        SummaryFormat.money =>
          rptFormatValue(RptFormat.money, k.value, compact: true),
        SummaryFormat.percent =>
          rptFormatValue(RptFormat.percent, k.value * k.percentScale),
        _ => rptFormatValue(RptFormat.number, k.value),
      };
      out.add(
        ListHeroChip(
          icon: switch (k.format) {
            SummaryFormat.money => Icons.account_balance_wallet_rounded,
            SummaryFormat.percent => Icons.percent_rounded,
            _ => Icons.tag_rounded,
          },
          label: '$value ${k.label.toLowerCase()}',
        ),
      );
      if (out.length == 3) break;
    }
  }
  if (out.isEmpty && total != null) {
    out.add(
      ListHeroChip(
        icon: Icons.format_list_numbered_rounded,
        label: '${rptFormatValue(RptFormat.number, total.toDouble())} $noun',
      ),
    );
  }
  return out;
}

// ── result card ────────────────────────────────────────────────────────────

/// The card every people report row uses: gradient-ringed avatar (or a custom
/// [leading]), name + subtitle, a [trailing] pill / badge and any number of
/// [children] (bars, tags, stat tiles) underneath. Fades up on first build
/// (staggered by [index]); [onTap] adds the ripple + chevron.
class PeopleCard extends StatelessWidget {
  const PeopleCard({
    super.key,
    required this.name,
    required this.color,
    this.subtitle,
    this.trailing,
    this.leading,
    this.children = const [],
    this.onTap,
    this.index = 0,
    this.avatarSize = 42,
  });

  final String name;
  final String? subtitle;
  final Color color;
  final Widget? leading;
  final Widget? trailing;
  final List<Widget> children;
  final VoidCallback? onTap;
  final int index;
  final double avatarSize;

  @override
  Widget build(BuildContext context) {
    final body = Material(
      color: AppColors.surface2,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  leading ??
                      PeopleAvatar(name: name, color: color, size: avatarSize),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 14, weight: FontWeight.w800),
                        ),
                        if (subtitle != null && subtitle!.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              subtitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (trailing != null) ...[
                    const SizedBox(width: 8),
                    trailing!,
                  ],
                  if (onTap != null && trailing == null)
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                ],
              ),
              for (final c in children) ...[
                const SizedBox(height: 10),
                c,
              ],
            ],
          ),
        ),
      ),
    );
    return RptReveal(index: index % 6, child: body);
  }
}

/// Initials in a gradient ring tinted [color].
class PeopleAvatar extends StatelessWidget {
  const PeopleAvatar({
    super.key,
    required this.name,
    required this.color,
    this.size = 42,
  });

  final String name;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [color, color.withValues(alpha: 0.35)],
        ),
      ),
      child: UserAvatar(avatarUrl: null, name: name, size: size),
    );
  }
}

/// Small coloured pill (status, role, method).
class PeoplePill extends StatelessWidget {
  const PeoplePill({
    super.key,
    required this.label,
    required this.color,
    this.icon,
    this.dot = false,
  });

  final String label;
  final Color color;
  final IconData? icon;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A labelled bar that grows to [value] (0..1) when it first appears.
class PeopleBar extends StatelessWidget {
  const PeopleBar({
    super.key,
    required this.value,
    required this.color,
    this.label,
    this.valueText,
    this.height = 7,
  });

  final double value;
  final Color color;
  final String? label;
  final String? valueText;
  final double height;

  @override
  Widget build(BuildContext context) {
    final v = value.isNaN ? 0.0 : value.clamp(0.0, 1.0);
    final dur = reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 800);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (label != null || valueText != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 5),
            child: Row(
              children: [
                if (label != null)
                  Expanded(
                    child: Text(
                      label!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w700,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  )
                else
                  const Spacer(),
                if (valueText != null)
                  Text(
                    valueText!,
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
              ],
            ),
          ),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: v),
          duration: dur,
          curve: Curves.easeOutCubic,
          builder: (context, t, _) => ClipRRect(
            borderRadius: BorderRadius.circular(height),
            child: Stack(
              children: [
                Container(height: height, color: RptColors.track),
                FractionallySizedBox(
                  widthFactor: t,
                  child: Container(
                    height: height,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color.withValues(alpha: 0.7), color],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Animated ring with a centre label (days left, percent...).
class PeopleRing extends StatelessWidget {
  const PeopleRing({
    super.key,
    required this.value,
    required this.color,
    required this.child,
    this.size = 50,
    this.stroke = 5,
  });

  final double value;
  final Color color;
  final Widget child;
  final double size;
  final double stroke;

  @override
  Widget build(BuildContext context) {
    final v = value.isNaN ? 0.0 : value.clamp(0.0, 1.0);
    final dur = reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 900);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: v),
            duration: dur,
            curve: Curves.easeOutCubic,
            builder: (context, t, _) => SizedBox(
              width: size,
              height: size,
              child: CircularProgressIndicator(
                value: t,
                strokeWidth: stroke,
                strokeCap: StrokeCap.round,
                color: color,
                backgroundColor: RptColors.track,
              ),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Icon + big figure + caption — the little stat tiles inside a card.
class PeopleStat extends StatelessWidget {
  const PeopleStat({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppText.display(size: 17, color: AppColors.ink),
          ),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 10,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}

// ── detail sheet ───────────────────────────────────────────────────────────

/// Bottom sheet with a person's full row: header, [tiles] (two-up
/// `TeamFieldTile`s) and optional [extra] content (bars).
Future<void> showPeopleSheet(
  BuildContext context, {
  required String title,
  required Color color,
  required IconData icon,
  String? subtitle,
  List<Widget> tiles = const [],
  List<Widget> extra = const [],
}) {
  return showTeamSheet<void>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: icon,
      title: title,
      subtitle: subtitle,
      color: color,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (tiles.isNotEmpty) TeamTileGrid(tiles: tiles),
          for (final e in extra) ...[
            const SizedBox(height: 14),
            e,
          ],
        ],
      ),
    ),
  );
}
