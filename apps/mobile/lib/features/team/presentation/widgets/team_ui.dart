import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/profile_photo.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/option_picker_field.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';

/// Shared building blocks for the Team & Access screens (staff roster, staff
/// profile, users, roles, permissions, invitations). Same visual language as
/// the redesigned Members screens: coloured gradient headers, icon-per-field
/// tiles, animated counters / bars / rings, bottom-sheet detail views.

/// Palette used across the Team screens (the same family as Members/Leads).
class TeamColors {
  TeamColors._();

  static const indigo = Color(0xFF6366F1);
  static const violet = Color(0xFF8B5CF6);
  static const teal = Color(0xFF14B8A6);
  static const amber = Color(0xFFF59E0B);
  static const rose = Color(0xFFFF5C7A);
  static const green = Color(0xFF10B981);
  static const fuchsia = Color(0xFFC026D3);
  static const sky = Color(0xFF0EA5E9);
  static const slate = Color(0xFF64748B);

  /// Hero banners / primary CTAs.
  static const cta = LinearGradient(colors: [indigo, violet, fuchsia]);
  static const ctaGreen = LinearGradient(
    colors: [Color(0xFF059669), Color(0xFF14B8A6)],
  );

  /// Rotation used for per-role / per-resource colouring.
  static const rotation = [
    indigo,
    violet,
    teal,
    amber,
    rose,
    green,
    fuchsia,
    sky,
  ];
}

// ── responsive helpers ──────────────────────────────────────────────────────

/// Content is capped to this width (centred) on tablets / landscape; the
/// gradient heroes stay full-bleed. Phones (< [kTeamMaxWidth]) are untouched.
const kTeamMaxWidth = 1280.0;

/// Width from which cards / fields / tiles switch to multi-column layouts.
const kTeamWideBreak = 600.0;

/// Horizontal inset that centres a [maxWidth]-wide column in the screen
/// (0 on phones).
double teamSideInset(BuildContext context, {double maxWidth = kTeamMaxWidth}) =>
    math.max(0, (MediaQuery.sizeOf(context).width - maxWidth) / 2);

/// 1 column on phones, 2 on tablets — for sliver card lists.
int teamColumns(BuildContext context) =>
    MediaQuery.sizeOf(context).width >= kTeamWideBreak ? 2 : 1;

/// Caps [child] to [maxWidth] and centres it. Implemented with symmetric
/// padding (not Align/ConstrainedBox) so the child still receives *tight*
/// width constraints — on a phone this is a no-op.
class TeamCenter extends StatelessWidget {
  const TeamCenter({
    super.key,
    required this.child,
    this.maxWidth = kTeamMaxWidth,
  });

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final inset = teamSideInset(context, maxWidth: maxWidth);
    if (inset == 0) return child;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: inset),
      child: child,
    );
  }
}

/// Lays [children] out in one column (narrow) or two equal columns (when the
/// available width is >= 560), each row as tall as its tallest card. Do not
/// nest inside another IntrinsicHeight — it contains a LayoutBuilder.
class TeamAdaptive extends StatelessWidget {
  const TeamAdaptive({
    super.key,
    required this.children,
    this.gap = 12,
    this.rowSpacing = 12,
  });

  final List<Widget> children;

  /// Horizontal gap between the two columns.
  final double gap;

  /// Vertical space between rows / stacked children.
  final double rowSpacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        if (c.maxWidth < 560) {
          return Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) SizedBox(height: rowSpacing),
                children[i],
              ],
            ],
          );
        }
        final rows = <Widget>[];
        for (var i = 0; i < children.length; i += 2) {
          rows.add(
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : rowSpacing),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: children[i]),
                    SizedBox(width: gap),
                    Expanded(
                      child: i + 1 < children.length
                          ? children[i + 1]
                          : const SizedBox.shrink(),
                    ),
                  ],
                ),
              ),
            ),
          );
        }
        return Column(children: rows);
      },
    );
  }
}

/// Sliver list of cards: one per row on phones, two per row on tablets
/// (equal-height rows), centred within [kTeamMaxWidth]. [footer] (e.g. a
/// "Load more" button) is appended as a last full-width row.
Widget teamCardSliver<T>(
  BuildContext context, {
  required List<T> items,
  required Widget Function(T item, int index) builder,
  Widget? footer,
  EdgeInsets padding = const EdgeInsets.fromLTRB(18, 0, 18, 24),
}) {
  final cols = teamColumns(context);
  final inset = teamSideInset(context);
  final rows = (items.length / cols).ceil();
  return SliverPadding(
    padding: padding.copyWith(
      left: padding.left + inset,
      right: padding.right + inset,
    ),
    sliver: SliverList.builder(
      itemCount: rows + (footer == null ? 0 : 1),
      itemBuilder: (context, r) {
        if (r == rows) return footer!;
        if (cols == 1) return builder(items[r], r);
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var c = 0; c < cols; c++) ...[
                if (c > 0) const SizedBox(width: 12),
                Expanded(
                  child: r * cols + c < items.length
                      ? builder(items[r * cols + c], r * cols + c)
                      : const SizedBox.shrink(),
                ),
              ],
            ],
          ),
        );
      },
    ),
  );
}

// ── formatting helpers ──────────────────────────────────────────────────────

/// `PENDING_VERIFICATION` -> `Pending verification`.
String prettyEnum(String? v) {
  if (v == null || v.isEmpty) return '';
  final s = v.replaceAll('_', ' ').toLowerCase();
  return s[0].toUpperCase() + s.substring(1);
}

String fmtDate(DateTime? d) {
  if (d == null) return '—';
  // `@db.Date` columns arrive as UTC midnight — keep the calendar day rather
  // than letting a western timezone shift it to the day before.
  final dateOnly = d.isUtc && d.hour == 0 && d.minute == 0 && d.second == 0;
  final l = dateOnly ? d : d.toLocal();
  return '${l.day.toString().padLeft(2, '0')}/'
      '${l.month.toString().padLeft(2, '0')}/${l.year}';
}

String fmtDateTime(DateTime? d) {
  if (d == null) return 'Never';
  final l = d.toLocal();
  final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
  final m = l.minute.toString().padLeft(2, '0');
  return '${fmtDate(l)}, $h:$m ${l.hour >= 12 ? 'pm' : 'am'}';
}

/// `YYYY-MM-DD` — the wire format for `@db.Date` fields.
String isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// Parses a `YYYY-MM-DD` (or full ISO) string into a local date, or null.
DateTime? parseIsoDate(String? s) {
  if (s == null || s.isEmpty) return null;
  final d = DateTime.tryParse(s.length >= 10 ? s.substring(0, 10) : s);
  return d;
}

/// "Today" / "Yesterday" / "3d ago" / "2mo ago" / "Never".
String relativeAgo(DateTime? d, {String never = 'Never'}) {
  if (d == null) return never;
  final days = DateTime.now().difference(d).inDays;
  if (days <= 0) return 'Today';
  if (days == 1) return 'Yesterday';
  if (days < 30) return '${days}d ago';
  if (days < 365) return '${days ~/ 30}mo ago';
  return '${days ~/ 365}y ago';
}

/// "3 years" / "5 months" / "12 days" split for the Tenure tile.
(int, String) tenureOf(DateTime joined) {
  final days = DateTime.now().difference(joined).inDays.clamp(0, 100000);
  if (days >= 365) {
    final y = days ~/ 365;
    return (y, y == 1 ? 'year' : 'years');
  }
  if (days >= 30) {
    final m = days ~/ 30;
    return (m, m == 1 ? 'month' : 'months');
  }
  return (days, days == 1 ? 'day' : 'days');
}

/// Stable colour for an IAM role name: system roles have fixed hues, custom
/// roles are spread over the rotation by a name hash.
Color iamRoleColor(String name) {
  switch (name) {
    case 'OWNER':
      return TeamColors.rose;
    case 'MANAGER':
      return TeamColors.teal;
    case 'TRAINER':
      return TeamColors.violet;
    case 'RECEPTIONIST':
      return TeamColors.indigo;
    case 'MEMBER':
      return TeamColors.green;
    case 'SUPER_ADMIN':
      return TeamColors.fuchsia;
  }
  final h = name.codeUnits.fold<int>(0, (a, c) => (a * 31 + c) & 0x7fffffff);
  return TeamColors.rotation[h % TeamColors.rotation.length];
}

IconData iamRoleIcon(String name) => switch (name) {
      'OWNER' => Icons.workspace_premium_rounded,
      'MANAGER' => Icons.admin_panel_settings_rounded,
      'TRAINER' => Icons.fitness_center_rounded,
      'RECEPTIONIST' => Icons.support_agent_rounded,
      'MEMBER' => Icons.person_rounded,
      'SUPER_ADMIN' => Icons.security_rounded,
      _ => Icons.shield_rounded,
    };

/// Colour per account status (staff + users share the same enum).
Color statusColor(String status, {bool deleted = false}) {
  if (deleted) return TeamColors.rose;
  return switch (status) {
    'ACTIVE' => TeamColors.green,
    'PENDING_VERIFICATION' => TeamColors.amber,
    'LOCKED' => TeamColors.rose,
    'SUSPENDED' => TeamColors.sky,
    'DEACTIVATED' => TeamColors.slate,
    _ => TeamColors.indigo,
  };
}

String statusLabel(String status, {bool deleted = false}) {
  if (deleted) return 'Deleted';
  return prettyEnum(status);
}

IconData statusIcon(String status, {bool deleted = false}) {
  if (deleted) return Icons.delete_outline_rounded;
  return switch (status) {
    'ACTIVE' => Icons.check_circle_rounded,
    'PENDING_VERIFICATION' => Icons.mark_email_unread_rounded,
    'LOCKED' => Icons.lock_rounded,
    'SUSPENDED' => Icons.pause_circle_rounded,
    'DEACTIVATED' => Icons.block_rounded,
    _ => Icons.person_rounded,
  };
}

/// Whether the signed-in staff user holds [permission]. Every Team action is
/// gated through this, the same way web's `usePermissions().hasPermission` is.
bool teamCan(BuildContext context, String permission) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff && s.user.hasPermission(permission);
}

/// The signed-in staff user's id (to stop people editing their own access).
String? teamSelfId(BuildContext context) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff ? s.user.id : null;
}

// ── snackbars + dialogs ─────────────────────────────────────────────────────

void teamSnack(BuildContext context, String message, {bool error = false}) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: error ? AppColors.danger : null,
      ),
    );
}

Future<bool> confirmTeam(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Confirm',
  bool destructive = false,
}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      backgroundColor: AppColors.surface2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      title: Text(title, style: AppText.display(size: 18)),
      content: Text(
        message,
        style: AppText.body(size: 13, color: AppColors.inkSoft),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(
            'Cancel',
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(
            confirmLabel,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: destructive ? AppColors.danger : TeamColors.violet,
            ),
          ),
        ),
      ],
    ),
  );
  return ok == true;
}

// ── bottom sheets ───────────────────────────────────────────────────────────

/// Opens [content] as a scroll-controlled modal bottom sheet (Flutter's stock
/// sheet already slides up natively).
Future<T?> showTeamSheet<T>(BuildContext context, WidgetBuilder content) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface2,
    // Keep sheets from stretching across a tablet.
    constraints: const BoxConstraints(maxWidth: 640),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: content,
  );
}

/// Drag handle + icon/title header + scrollable body, capped at 85% height.
class TeamSheetScaffold extends StatelessWidget {
  const TeamSheetScaffold({
    super.key,
    required this.icon,
    required this.title,
    required this.color,
    required this.child,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Color color;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    alignment: Alignment.center,
                    child: Icon(icon, size: 18, color: color),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppText.display(size: 17)),
                        if (subtitle != null)
                          Text(
                            subtitle!,
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Generic single-choice sheet: a list of `(value, label)` rows with a tick on
/// the current one. Returns the picked value, `''` for the "clear" row.
Future<String?> pickOneSheet(
  BuildContext context, {
  required String title,
  required List<(String, String)> options,
  required String? current,
  String? clearLabel,
}) {
  return showTeamSheet<String>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.tune_rounded,
      title: title,
      color: TeamColors.violet,
      child: Column(
        children: [
          if (clearLabel != null)
            _PickRow(
              label: clearLabel,
              selected: current == null,
              onTap: () => Navigator.of(ctx).pop(''),
            ),
          for (final o in options)
            _PickRow(
              label: o.$2,
              selected: o.$1 == current,
              onTap: () => Navigator.of(ctx).pop(o.$1),
            ),
        ],
      ),
    ),
  );
}

class _PickRow extends StatelessWidget {
  const _PickRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 13),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: AppText.body(
                    size: 14,
                    weight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: selected ? TeamColors.violet : AppColors.ink,
                  ),
                ),
              ),
              if (selected)
                const Icon(
                  Icons.check_rounded,
                  size: 18,
                  color: TeamColors.violet,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── KPI tiles ───────────────────────────────────────────────────────────────

class TeamKpi {
  const TeamKpi({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
    this.active = false,
    this.text,
  });

  final String label;
  final int value;

  /// Pre-formatted figure shown instead of the animated [value] (e.g. a
  /// decimal average such as `2.5`).
  final String? text;
  final Color color;
  final IconData icon;

  /// Highlights the tile (it is the current list filter).
  final bool active;
}

/// Two-column grid of animated KPI tiles. [onTap] gets the tile index.
class TeamKpiGrid extends StatelessWidget {
  const TeamKpiGrid({
    super.key,
    required this.tiles,
    required this.loading,
    this.onTap,
  });

  final List<TeamKpi> tiles;
  final bool loading;
  final ValueChanged<int>? onTap;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) =>
          _kpiGrid(context, constraints.maxWidth >= 560 ? 4 : 2),
    );
  }

  Widget _kpiGrid(BuildContext context, int columns) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      itemCount: tiles.length,
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
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
              onTap: loading || onTap == null ? null : () => onTap!(i),
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
                  border: Border.all(
                    color: t.active ? t.color : t.color.withValues(alpha: 0.22),
                    width: t.active ? 1.6 : 1,
                  ),
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
                    else if (t.text != null)
                      Text(
                        t.text!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 22, color: t.color),
                      )
                    else
                      CountUp(
                        value: t.value,
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
    );
  }
}

// ── insight panels ──────────────────────────────────────────────────────────

/// Dashboard-style section card: tinted gradient header band (icon chip +
/// title + optional count badge + chevron) over a plain body.
class TeamInsightCard extends StatelessWidget {
  const TeamInsightCard({
    super.key,
    required this.icon,
    required this.title,
    required this.color,
    required this.child,
    this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String title;
  final Color color;
  final VoidCallback? onTap;
  final Widget child;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 10),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [color.withValues(alpha: 0.18), Colors.transparent],
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            color,
                            Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                          ],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, size: 15, color: Colors.white),
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        title,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                    ),
                    if (trailing != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          trailing!,
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w800,
                            color: color,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                    ],
                    if (onTap != null)
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 18,
                        color: AppColors.inkFaint,
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Horizontal share bars that grow in. [rows] = (label, count).
class TeamBarRows extends StatelessWidget {
  const TeamBarRows({
    super.key,
    required this.rows,
    this.colors = TeamColors.rotation,
    this.showPercent = false,
    this.onRowTap,
  });

  final List<(String, int)> rows;
  final List<Color> colors;
  final bool showPercent;
  final ValueChanged<int>? onRowTap;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return Text(
        'No data yet.',
        style: AppText.body(size: 12.5, color: AppColors.inkFaint),
      );
    }
    final max = rows.map((r) => r.$2).fold(1, (a, b) => b > a ? b : a);
    final total = rows.fold(0, (a, r) => a + r.$2);
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          InkWell(
            onTap: onRowTap == null ? null : () => onRowTap!(i),
            borderRadius: BorderRadius.circular(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        rows[i].$1,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      showPercent && total > 0
                          ? '${rows[i].$2} · ${(rows[i].$2 / total * 100).round()}%'
                          : '${rows[i].$2}',
                      style: AppText.body(
                        size: 12,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                GrowBar(
                  ratio: rows[i].$2 == 0 ? 0 : rows[i].$2 / max,
                  height: 7,
                  track: AppColors.surface3,
                  colors: [
                    colors[i % colors.length],
                    colors[i % colors.length].withValues(alpha: 0.55),
                  ],
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

/// A flagged person (name + reason chip) for "Needs attention" lists.
class TeamPersonRow extends StatelessWidget {
  const TeamPersonRow({
    super.key,
    required this.name,
    required this.detail,
    required this.color,
    this.avatarUrl,
    this.onTap,
  });

  final String name;
  final String detail;
  final Color color;
  final String? avatarUrl;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [color, color.withValues(alpha: 0.4)],
                  ),
                ),
                child: UserAvatar(avatarUrl: avatarUrl, name: name, size: 30),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 12.5, weight: FontWeight.w800),
                    ),
                    Text(
                      detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: AppColors.inkFaint,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small uppercase caption above a group inside a card / sheet.
class TeamGroupLabel extends StatelessWidget {
  const TeamGroupLabel(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 4),
      child: Text(text.toUpperCase(), style: AppText.eyebrow(color: color)),
    );
  }
}

// ── toolbar bits ────────────────────────────────────────────────────────────

class TeamFilterChip extends StatelessWidget {
  const TeamFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.color,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? TeamColors.violet;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? c : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: c.withValues(alpha: 0.35),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w800,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

class TeamToolbarButton extends StatelessWidget {
  const TeamToolbarButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: active
                ? TeamColors.violet.withValues(alpha: 0.14)
                : AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.field),
            border: Border.all(
              color: active ? TeamColors.violet : AppColors.line,
            ),
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 15,
                color: active ? TeamColors.violet : AppColors.inkFaint,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Search box with a built-in 400ms debounce; [onSearch] gets the trimmed text.
class TeamSearchField extends StatefulWidget {
  const TeamSearchField({
    super.key,
    required this.hint,
    required this.onSearch,
  });

  final String hint;
  final ValueChanged<String> onSearch;

  @override
  State<TeamSearchField> createState() => _TeamSearchFieldState();
}

class _TeamSearchFieldState extends State<TeamSearchField> {
  final _controller = TextEditingController();
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String v) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 400),
      () => widget.onSearch(v.trim()),
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: _changed,
      style: AppText.body(size: 14, weight: FontWeight.w600),
      decoration: InputDecoration(
        hintText: widget.hint,
        hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
        filled: true,
        fillColor: AppColors.surface2,
        prefixIcon: Icon(
          Icons.search_rounded,
          size: 19,
          color: AppColors.inkFaint,
        ),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                icon: Icon(
                  Icons.close_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                ),
                onPressed: () {
                  _controller.clear();
                  _debounce?.cancel();
                  widget.onSearch('');
                  setState(() {});
                },
              ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: TeamColors.violet),
        ),
      ),
    );
  }
}

/// Soft tinted pill (role / work status / badges on cards).
class TeamTag extends StatelessWidget {
  const TeamTag({
    super.key,
    required this.label,
    required this.color,
    this.icon,
  });

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular icon + caption quick action (Call / Email / ...).
class TeamQuickAction extends StatelessWidget {
  const TeamQuickAction({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.35 : 1,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 17, color: color),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: AppText.body(size: 11, weight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── detail-screen pieces ────────────────────────────────────────────────────

/// Gradient pill tab bar (held as an index by the screen).
class TeamTabBar extends StatelessWidget {
  const TeamTabBar({
    super.key,
    required this.names,
    required this.index,
    required this.onChanged,
  });

  final List<String> names;
  final int index;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) => TeamCenter(child: _bar());

  Widget _bar() {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: names.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final selected = i == index;
          return GestureDetector(
            onTap: () => onChanged(i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 15),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                gradient: selected ? TeamColors.cta : null,
                color: selected ? null : AppColors.surface,
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: TeamColors.violet.withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ]
                    : null,
                border: selected ? null : Border.all(color: AppColors.line),
              ),
              child: Text(
                names[i],
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.inkSoft,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Frosted pill on the gradient hero (status, role, branch, ...).
class TeamHeroPill extends StatelessWidget {
  const TeamHeroPill(this.text, {super.key, this.icon, this.dot});

  final String text;
  final IconData? icon;
  final Color? dot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot != null) ...[
            PulseDot(color: dot!, size: 8),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[
            Icon(icon, size: 13, color: Colors.white),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Frosted action button on the hero (Call / Email / Resend ...).
class TeamHeroAction extends StatelessWidget {
  const TeamHeroAction({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 11),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 16, color: Colors.white),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Animated gradient hero for the staff / user profile pages: spinning-ring
/// avatar, name, subtitle, frosted pills and an optional action row. Lay it
/// out under a transparent AppBar (`extendBodyBehindAppBar`); [topInset] is
/// `MediaQuery.padding.top + kToolbarHeight`.
class TeamHero extends StatelessWidget {
  const TeamHero({
    super.key,
    required this.topInset,
    required this.name,
    required this.subtitle,
    required this.pills,
    this.avatarUrl,
    this.statusDot,
    this.actions = const [],
    this.onAvatarTap,
    this.uploading = false,
  });

  final double topInset;
  final String name;
  final String subtitle;
  final String? avatarUrl;
  final Color? statusDot;
  final List<Widget> pills;
  final List<Widget> actions;
  final VoidCallback? onAvatarTap;
  final bool uploading;

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
            padding: EdgeInsets.fromLTRB(16, 8 + topInset, 16, 22),
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: GestureDetector(
                    onTap: uploading ? null : onAvatarTap,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        SpinningRing(
                          size: 104,
                          child: UserAvatar(
                            avatarUrl: avatarUrl,
                            name: name,
                            size: 96,
                          ),
                        ),
                        if (uploading)
                          Positioned.fill(
                            child: Container(
                              decoration: const BoxDecoration(
                                color: Colors.black45,
                                shape: BoxShape.circle,
                              ),
                              alignment: Alignment.center,
                              child: const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        if (onAvatarTap != null)
                          Positioned(
                            right: 2,
                            bottom: 4,
                            child: Container(
                              width: 26,
                              height: 26,
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.camera_alt_rounded,
                                size: 14,
                                color: Color(0xFF4338CA),
                              ),
                            ),
                          ),
                        if (statusDot != null)
                          Positioned(
                            left: 4,
                            top: 6,
                            child: Container(
                              padding: const EdgeInsets.all(3),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: PulseDot(color: statusDot!, size: 10),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    subtitle,
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: pills,
                  ),
                ),
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 4,
                    child: Row(
                      children: [
                        for (var i = 0; i < actions.length; i++) ...[
                          if (i > 0) const SizedBox(width: 8),
                          actions[i],
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Animated summary tile for the profile pages (icon, value, label).
class TeamSummaryTile extends StatelessWidget {
  const TeamSummaryTile({
    super.key,
    required this.index,
    required this.icon,
    required this.color,
    required this.label,
    this.number,
    this.suffix = '',
    this.text,
    this.hint,
    this.onTap,
  });

  final int index;
  final IconData icon;
  final Color color;
  final String label;
  final int? number;
  final String suffix;
  final String? text;
  final String? hint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final style = AppText.display(size: 20, color: color);
    return FadeUp(
      index: index,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color.withValues(alpha: 0.14), Colors.transparent],
              ),
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: color.withValues(alpha: 0.25)),
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
                        color: color.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Icon(icon, size: 14, color: color),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        label.toUpperCase(),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 9.5,
                          weight: FontWeight.w800,
                          color: AppColors.inkFaint,
                        ).copyWith(letterSpacing: 0.6),
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                if (number != null)
                  CountUp(value: number!, suffix: suffix, style: style)
                else
                  Text(
                    text ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: style,
                  ),
                if (hint != null)
                  Text(
                    hint!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 10.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Two-column grid of [TeamSummaryTile]s with a fixed tile height.
class TeamSummaryGrid extends StatelessWidget {
  const TeamSummaryGrid({super.key, required this.tiles});

  final List<TeamSummaryTile> tiles;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        // 3 columns when the tiles divide evenly, otherwise 4 (tablet).
        final wide = c.maxWidth >= 560;
        final columns = !wide ? 2 : (tiles.length % 3 == 0 ? 3 : 4);
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          crossAxisCount: columns,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          mainAxisExtent: 104,
          children: tiles,
        );
      },
    );
  }
}

/// Coloured section card: gradient header band (icon chip, title, optional
/// subtitle, optional Edit chip) over the body. Mirrors the Member detail
/// `_profileCard`.
class TeamSectionCard extends StatelessWidget {
  const TeamSectionCard({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.child,
    this.subtitle,
    this.onEdit,
    this.editLabel = 'Edit',
    this.trailing,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final VoidCallback? onEdit;
  final String editLabel;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.03),
                ],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      colors: [
                        color,
                        Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: 0.4),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(icon, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppText.display(size: 15)),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
                if (onEdit != null)
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(99),
                      onTap: onEdit,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(99),
                          border:
                              Border.all(color: color.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.edit_rounded, size: 12, color: color),
                            const SizedBox(width: 4),
                            Text(
                              editLabel,
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w800,
                                color: color,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
            child: child,
          ),
        ],
      ),
    );
  }
}

/// Icon tile showing one labelled value ("Not set" when empty).
class TeamFieldTile extends StatelessWidget {
  const TeamFieldTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.maxLines = 2,
  });

  final IconData icon;
  final String label;
  final String? value;
  final Color color;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final empty = value == null || value!.isEmpty || value == '—';
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withValues(alpha: empty ? 0.04 : 0.09),
        border: Border.all(color: color.withValues(alpha: empty ? 0.1 : 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              color: color.withValues(alpha: empty ? 0.1 : 0.2),
            ),
            child: Icon(
              icon,
              size: 15,
              color: empty ? color.withValues(alpha: 0.5) : color,
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 9,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ).copyWith(letterSpacing: 0.5),
                ),
                const SizedBox(height: 2),
                Text(
                  empty ? 'Not set' : value!,
                  maxLines: maxLines,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: empty ? FontWeight.w600 : FontWeight.w800,
                    color: empty ? AppColors.inkFaint : AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Lays [tiles] out two per row (a full-width tile when the list is odd or a
/// tile is marked full by being placed in its own call).
class TeamTileGrid extends StatelessWidget {
  const TeamTileGrid({super.key, required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 560 ? 3 : 2;
        final rows = <Widget>[];
        for (var i = 0; i < tiles.length; i += cols) {
          rows.add(
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var k = 0; k < cols; k++) ...[
                      if (k > 0) const SizedBox(width: 8),
                      Expanded(
                        child: i + k < tiles.length
                            ? tiles[i + k]
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          );
        }
        return Column(children: rows);
      },
    );
  }
}

/// ✓ / ✗ checklist row.
class TeamCheckRow extends StatelessWidget {
  const TeamCheckRow({
    super.key,
    required this.label,
    required this.ok,
    this.detail,
    this.color = TeamColors.green,
  });

  final String label;
  final bool ok;
  final String? detail;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ok
                  ? color.withValues(alpha: 0.18)
                  : AppColors.danger.withValues(alpha: 0.12),
            ),
            child: Icon(
              ok ? Icons.check_rounded : Icons.close_rounded,
              size: 13,
              color: ok ? color : AppColors.danger,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: ok ? AppColors.ink : AppColors.inkFaint,
              ),
            ),
          ),
          if (detail != null)
            Text(
              detail!,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
        ],
      ),
    );
  }
}

/// Destructive / lifecycle action row inside the "Danger zone" card.
class TeamActionTile extends StatelessWidget {
  const TeamActionTile({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.color = TeamColors.violet,
    this.hint,
    this.busy = false,
  });

  final IconData icon;
  final String label;
  final String? hint;
  final Color color;
  final bool busy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: busy ? null : onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: busy
                    ? Padding(
                        padding: const EdgeInsets.all(8),
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: color,
                        ),
                      )
                    : Icon(icon, size: 16, color: color),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: AppText.body(
                        size: 13,
                        weight: FontWeight.w800,
                        color: color,
                      ),
                    ),
                    if (hint != null)
                      Text(
                        hint!,
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── forms ───────────────────────────────────────────────────────────────────

/// Coloured form section (gradient header band + fields) — same look as the
/// Member `FormSection`, kept local so the Team screens don't depend on the
/// member edit scaffold file.
class TeamFormSection extends StatelessWidget {
  const TeamFormSection({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.children,
    this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return TeamSectionCard(
      icon: icon,
      color: color,
      title: title,
      subtitle: subtitle,
      child: LayoutBuilder(
        builder: (context, c) {
          if (c.maxWidth < 520) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0) const SizedBox(height: 14),
                  children[i],
                ],
              ],
            );
          }
          // Tablet: simple single-line inputs sit two per row; chip groups,
          // toggles, notes and anything custom keep the full width.
          final half = (c.maxWidth - 14) / 2;
          return Wrap(
            spacing: 14,
            runSpacing: 14,
            children: [
              for (final w in children)
                SizedBox(
                  width: _isCompactField(w) ? half : c.maxWidth,
                  child: w,
                ),
            ],
          );
        },
      ),
    );
  }

  static bool _isCompactField(Widget w) =>
      (w is AppLabeledField && w.maxLines == 1 && !w.obscureText) ||
      w is OptionPickerField ||
      w is TeamDateField;
}

/// Page frame for every Team edit screen: transparent app bar over a gradient
/// banner (avatar, name, what's being edited), the sections, then a gradient
/// Save button. Sibling of `MemberEditScaffold`, but not tied to `GymMember`.
class TeamEditScaffold extends StatelessWidget {
  const TeamEditScaffold({
    super.key,
    required this.name,
    required this.subtitle,
    required this.title,
    required this.icon,
    required this.color,
    required this.saving,
    required this.onSave,
    required this.sections,
    this.avatarUrl,
    this.error,
    this.saveLabel = 'Save changes',
    this.footer,
  });

  final String name;
  final String subtitle;
  final String? avatarUrl;
  final String title;
  final IconData icon;
  final Color color;
  final bool saving;
  final VoidCallback onSave;
  final List<Widget> sections;
  final String? error;
  final String saveLabel;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(title),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TeamBanner(
              top: top,
              name: name,
              subtitle: subtitle,
              avatarUrl: avatarUrl,
              chip: 'Editing $title',
              chipIcon: icon,
              color: color,
            ),
            TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (error != null) ...[
                      FormAlert(message: error!),
                      const SizedBox(height: 14),
                    ],
                    for (var i = 0; i < sections.length; i++) ...[
                      if (i > 0) const SizedBox(height: 14),
                      sections[i],
                    ],
                    if (footer != null) ...[
                      const SizedBox(height: 14),
                      footer!,
                    ],
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: saveLabel,
                      icon: Icons.check_rounded,
                      loading: saving,
                      onTap: onSave,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Gradient banner under a transparent AppBar for the edit / add screens.
class TeamBanner extends StatelessWidget {
  const TeamBanner({
    super.key,
    required this.top,
    required this.name,
    required this.subtitle,
    required this.chip,
    required this.chipIcon,
    required this.color,
    this.avatarUrl,
    this.initialsOnly = false,
  });

  final double top;
  final String name;
  final String subtitle;
  final String? avatarUrl;
  final String chip;
  final IconData chipIcon;
  final Color color;
  final bool initialsOnly;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF312E81),
            Color.lerp(color, const Color(0xFF7C3AED), 0.4)!,
            TeamColors.fuchsia,
          ],
        ),
      ),
      // Gradient stays full-width; the avatar/name row is capped + centred.
      child: TeamCenter(child: _row()),
    );
  }

  Widget _row() {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white,
          ),
          child: UserAvatar(avatarUrl: avatarUrl, name: name, size: 54),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 20, color: Colors.white),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(height: 8),
              TeamHeroPill(chip, icon: chipIcon),
            ],
          ),
        ),
      ],
    );
  }
}

/// Full-width gradient button with spinner.
class TeamGradientButton extends StatelessWidget {
  const TeamGradientButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.loading = false,
    this.gradient = TeamColors.cta,
  });

  final String label;
  final IconData? icon;
  final bool loading;
  final VoidCallback? onTap;
  final LinearGradient gradient;

  @override
  Widget build(BuildContext context) {
    final shadow = gradient.colors.length > 1
        ? gradient.colors[gradient.colors.length ~/ 2]
        : gradient.colors.first;
    return GestureDetector(
      onTap: loading ? null : onTap,
      child: Opacity(
        opacity: onTap == null && !loading ? 0.5 : 1,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: gradient,
            boxShadow: [
              BoxShadow(
                color: shadow.withValues(alpha: 0.4),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: loading
              ? const Center(
                  heightFactor: 1,
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white,
                    ),
                  ),
                )
              : Row(
                  mainAxisSize: MainAxisSize.max,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (icon != null) ...[
                      Icon(icon, size: 18, color: Colors.white),
                      const SizedBox(width: 8),
                    ],
                    Flexible(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 15,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }
}

/// Single- or multi-choice chip group with a colour per group.
class TeamChipGroup extends StatelessWidget {
  const TeamChipGroup({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.options,
    required this.selected,
    required this.onToggle,
    this.hint,
  });

  final String label;
  final IconData icon;
  final Color color;
  final List<(String, String)> options;
  final Set<String> selected;
  final ValueChanged<String> onToggle;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(label, style: AppText.eyebrow()),
          ],
        ),
        if (hint != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              hint!,
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in options)
              GestureDetector(
                onTap: () => onToggle(o.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    color: selected.contains(o.$1)
                        ? color.withValues(alpha: 0.18)
                        : AppColors.surface2,
                    border: Border.all(
                      color: selected.contains(o.$1) ? color : AppColors.line,
                      width: selected.contains(o.$1) ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (selected.contains(o.$1)) ...[
                        Icon(Icons.check_rounded, size: 14, color: color),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        o.$2,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: selected.contains(o.$1)
                              ? color
                              : AppColors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Date picker field (read-only text + calendar icon). Owns its controller so
/// the value can change from outside without recreating it in `build`.
class TeamDateField extends StatefulWidget {
  const TeamDateField({
    super.key,
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.onChanged,
    this.firstDate,
    this.lastDate,
    this.clearable = true,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final bool clearable;

  @override
  State<TeamDateField> createState() => _TeamDateFieldState();
}

class _TeamDateFieldState extends State<TeamDateField> {
  late final TextEditingController _c = TextEditingController(
    text: widget.value == null ? '' : fmtDate(widget.value),
  );

  @override
  void didUpdateWidget(TeamDateField old) {
    super.didUpdateWidget(old);
    final text = widget.value == null ? '' : fmtDate(widget.value);
    if (_c.text != text) _c.text = text;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: widget.value ?? now,
      firstDate: widget.firstDate ?? DateTime(1940),
      lastDate: widget.lastDate ?? DateTime(now.year + 20),
    );
    if (picked != null) widget.onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    return AppLabeledField(
      label: widget.label,
      hintText: 'Select date',
      icon: widget.icon,
      iconColor: widget.iconColor,
      controller: _c,
      readOnly: true,
      onTap: _pick,
      suffixIcon: widget.value != null && widget.clearable
          ? IconButton(
              icon: Icon(
                Icons.close_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
              onPressed: () => widget.onChanged(null),
            )
          : Icon(
              Icons.calendar_month_rounded,
              size: 18,
              color: AppColors.inkFaint,
            ),
    );
  }
}

/// Switch row with icon, title and subtitle, on the staff gradient track.
class TeamToggleRow extends StatelessWidget {
  const TeamToggleRow({
    super.key,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
    this.icon,
    this.color = TeamColors.violet,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Color color;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onChanged == null ? 0.5 : 1,
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 16, color: color),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onChanged == null ? null : () => onChanged!(!value),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              width: 46,
              height: 27,
              padding: const EdgeInsets.all(3),
              decoration: BoxDecoration(
                gradient: value
                    ? LinearGradient(
                        colors: [
                          color,
                          Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                        ],
                      )
                    : null,
                color: value ? null : AppColors.surface3,
                borderRadius: BorderRadius.circular(99),
              ),
              alignment: value ? Alignment.centerRight : Alignment.centerLeft,
              child: Container(
                width: 21,
                height: 21,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Selectable card (icon, title, description, radio / check) used by the role
/// pickers.
class TeamChoiceCard extends StatelessWidget {
  const TeamChoiceCard({
    super.key,
    required this.title,
    required this.selected,
    required this.onTap,
    required this.color,
    this.description,
    this.icon = Icons.shield_rounded,
    this.multi = false,
    this.badge,
  });

  final String title;
  final String? description;
  final IconData icon;
  final Color color;
  final bool selected;
  final bool multi;
  final String? badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color:
                selected ? color.withValues(alpha: 0.13) : AppColors.surface2,
            border: Border.all(
              color: selected ? color : AppColors.line,
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  gradient: selected
                      ? LinearGradient(
                          colors: [
                            color,
                            Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                          ],
                        )
                      : null,
                  color: selected ? null : color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  size: 18,
                  color: selected ? Colors.white : color,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (badge != null) ...[
                          const SizedBox(width: 6),
                          TeamTag(label: badge!, color: color),
                        ],
                      ],
                    ),
                    if (description != null && description!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          description!,
                          maxLines: 2,
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
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: multi ? BoxShape.rectangle : BoxShape.circle,
                  borderRadius: multi ? BorderRadius.circular(7) : null,
                  color: selected ? color : Colors.transparent,
                  border: Border.all(
                    color: selected ? color : AppColors.inkFaint,
                    width: 1.6,
                  ),
                ),
                child: selected
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bottom action bar for wizard / long forms. Content goes in [child];
/// never put `alignment:` on a Container here (it would expand to full
/// screen height) — use a Row / `Center(heightFactor: 1)`.
class TeamBottomBar extends StatelessWidget {
  const TeamBottomBar({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      // Bar background spans the screen; the buttons stay a sensible width.
      child: TeamCenter(maxWidth: 640, child: child),
    );
  }
}

/// Outlined secondary button used beside [TeamGradientButton] in bottom bars.
class TeamOutlineButton extends StatelessWidget {
  const TeamOutlineButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: AppColors.surface2,
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 17, color: AppColors.ink),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: AppText.body(size: 14, weight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
}

// ── photo picker ────────────────────────────────────────────────────────────

/// Asks camera / gallery, returns a `data:` URL ready for `avatarUrl`, or null
/// if cancelled / invalid (a snackbar explains invalid ones).
Future<String?> pickAvatarDataUrl(BuildContext context) async {
  final source = await showModalBottomSheet<ImageSource>(
    context: context,
    backgroundColor: AppColors.surface2,
    constraints: const BoxConstraints(maxWidth: 640),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 8),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Take a photo'),
            onTap: () => Navigator.pop(sheetContext, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Choose from gallery'),
            onTap: () => Navigator.pop(sheetContext, ImageSource.gallery),
          ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (source == null) return null;
  try {
    final picked = await ImagePicker().pickImage(
      source: source,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (picked == null) return null;
    return buildPhotoDataUrl(await picked.readAsBytes());
  } on ProfilePhotoException catch (e) {
    if (context.mounted) teamSnack(context, e.message, error: true);
    return null;
  } catch (e) {
    if (context.mounted) {
      teamSnack(context, 'Could not read that photo.', error: true);
    }
    return null;
  }
}

// ── password strength ───────────────────────────────────────────────────────

/// The server's structural password policy (`passwordSchema`), as a live
/// checklist: 8+ chars, upper, lower, digit, special.
class PasswordRules extends StatelessWidget {
  const PasswordRules({super.key, required this.password});

  final String password;

  static List<(String, bool)> evaluate(String p) => [
        ('At least 8 characters', p.length >= 8),
        ('One uppercase letter', RegExp('[A-Z]').hasMatch(p)),
        ('One lowercase letter', RegExp('[a-z]').hasMatch(p)),
        ('One number', RegExp('[0-9]').hasMatch(p)),
        ('One special character', RegExp('[^A-Za-z0-9]').hasMatch(p)),
      ];

  static bool isValid(String p) => evaluate(p).every((r) => r.$2);

  @override
  Widget build(BuildContext context) {
    final rules = evaluate(password);
    final passed = rules.where((r) => r.$2).length;
    final color = passed >= 5
        ? TeamColors.green
        : passed >= 3
            ? TeamColors.amber
            : TeamColors.rose;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GrowBar(
          ratio: passed / rules.length,
          height: 6,
          track: AppColors.surface3,
          colors: [color, color.withValues(alpha: 0.6)],
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 12,
          runSpacing: 2,
          children: [
            for (final r in rules)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    r.$2 ? Icons.check_circle_rounded : Icons.circle_outlined,
                    size: 13,
                    color: r.$2 ? TeamColors.green : AppColors.inkFaint,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    r.$1,
                    style: AppText.body(
                      size: 11,
                      weight: FontWeight.w600,
                      color: r.$2 ? AppColors.inkSoft : AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}
