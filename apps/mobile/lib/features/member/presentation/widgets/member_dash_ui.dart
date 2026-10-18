import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_currency.dart';
import '../../../../models/body_measurement.dart';
import '../../../../models/gym_info.dart';
import '../../../../models/member_invoice.dart';
import '../../../../models/member_overview.dart';
import '../../../../shared/widgets/menu_button.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../../shared/widgets/notification_bell_icon.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../../shared/widgets/app_pill.dart';
import '../../../team/presentation/widgets/team_ui.dart'
    show TeamColors, fmtDate;
import 'member_insights.dart';

String memberMoney(double v) =>
    '${AppCurrency.symbol}${v.toStringAsFixed(v == v.roundToDouble() ? 0 : 2)}';

String _day(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return iso;
  const m = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day} ${m[d.month - 1]}';
}

String _time(String hhmm) {
  final p = hhmm.split(':');
  if (p.length < 2) return hhmm;
  final h = int.tryParse(p[0]) ?? 0;
  return '${h % 12 == 0 ? 12 : h % 12}:${p[1]} ${h < 12 ? 'AM' : 'PM'}';
}

const _memberHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF053B34), Color(0xFF0A6E5E), Color(0xFF0FA58A)],
);

// ───────────────────────────────────────────────────────────────── hero

/// Web's `DashboardHero`: greeting, first name, plan + validity, id / status /
/// branch chips, the days-left ring, three stats and the Renew / Book class /
/// My QR actions — in the member palette (lime → teal). Renew is the solid
/// button when the plan is missing, expired or within 14 days (web's rule).
class MemberHero extends StatelessWidget {
  const MemberHero({
    required this.overview,
    required this.greeting,
    required this.displayName,
    required this.avatarUrl,
    required this.hasQr,
    required this.onRenew,
    required this.onBook,
    required this.onQr,
    super.key,
  });

  final MemberOverview overview;
  final String greeting;
  final String displayName;
  final String? avatarUrl;
  final bool hasQr;
  final VoidCallback onRenew;
  final VoidCallback onBook;
  final VoidCallback onQr;

  @override
  Widget build(BuildContext context) {
    final o = overview;
    final m = o.membership;
    final first = displayName.trim().split(RegExp(r'\s+')).first;
    final urgent = m == null || m.expired || m.daysLeft <= 14;
    final subtitle = m == null
        ? 'No active membership yet'
        : m.expired
            ? '${m.planName} expired on ${_day(m.endDate)}'
            : '${m.planName} · valid until ${_day(m.endDate)}';
    return Container(
      decoration: const BoxDecoration(
        gradient: _memberHeroGradient,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            right: -50,
            top: -60,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppColors.memberA.withValues(alpha: 0.35),
                    AppColors.memberA.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const MenuButton(),
                    const Spacer(),
                    const NotificationBellIcon(isStaff: false),
                    const SizedBox(width: 10),
                    UserAvatar(
                      avatarUrl: avatarUrl,
                      name: displayName,
                      role: AppRole.member,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            greeting.toUpperCase(),
                            style: AppText.eyebrow(
                              color: Colors.white.withValues(alpha: 0.8),
                            ),
                          ),
                          Text(
                            first,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.display(
                              size: 30,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            subtitle,
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.9),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              _HeroChip(o.member.memberId),
                              if (m != null)
                                _HeroChip(
                                  m.expired
                                      ? 'Expired'
                                      : prettyStatus(m.status),
                                ),
                              if (o.member.branchName != null)
                                _HeroChip(o.member.branchName!),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (m != null && m.totalDays > 0) ...[
                      const SizedBox(width: 12),
                      _HeroRing(
                        fraction: m.remainingFraction,
                        days: math.max(m.daysLeft, 0),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _HeroStat('Total visits', o.attendance.totalVisits),
                    _HeroStat('Streak', o.attendance.currentStreakDays),
                    _HeroStat('This month', o.attendance.thisMonthVisits),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _HeroButton(
                        icon: Icons.credit_card_rounded,
                        label: 'Renew',
                        solid: urgent,
                        onTap: onRenew,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _HeroButton(
                        icon: Icons.event_available_rounded,
                        label: 'Book class',
                        onTap: onBook,
                      ),
                    ),
                    if (hasQr) ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: _HeroButton(
                          icon: Icons.qr_code_2_rounded,
                          label: 'My QR',
                          onTap: onQr,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String prettyStatus(String s) =>
      s.isEmpty ? s : s[0] + s.substring(1).toLowerCase().replaceAll('_', ' ');
}

class _HeroChip extends StatelessWidget {
  const _HeroChip(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
        ),
        child: Text(
          text,
          style: AppText.body(
            size: 11,
            weight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat(this.label, this.value);

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AnimatedNumber(
              value: value.toDouble(),
              format: (v) => v.round().toString(),
              style: AppText.display(size: 24, color: Colors.white),
            ),
            Text(
              label,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.8),
              ),
            ),
          ],
        ),
      );
}

class _HeroButton extends StatelessWidget {
  const _HeroButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.solid = false,
  });

  final IconData icon;
  final String label;
  final bool solid;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = solid ? AppColors.memberOnGrad : Colors.white;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
        decoration: BoxDecoration(
          gradient: solid ? AppColors.memberGrad : null,
          color: solid ? null : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(14),
          border: solid
              ? null
              : Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: fg,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroRing extends StatelessWidget {
  const _HeroRing({required this.fraction, required this.days});

  final double fraction;
  final int days;

  @override
  Widget build(BuildContext context) => AnimatedFraction(
        fraction: fraction,
        builder: (_, v) => SizedBox(
          width: 84,
          height: 84,
          child: CustomPaint(
            painter: _OnDarkRing(v),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$days',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  Text(
                    'DAYS LEFT',
                    style: AppText.body(
                      size: 8.5,
                      weight: FontWeight.w800,
                      color: Colors.white.withValues(alpha: 0.8),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}

class _OnDarkRing extends CustomPainter {
  _OnDarkRing(this.fraction);

  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 8.0;
    final arc = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawArc(
      arc,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = Colors.white.withValues(alpha: 0.25),
    );
    if (fraction <= 0) return;
    canvas.drawArc(
      arc,
      -math.pi / 2,
      math.pi * 2 * fraction.clamp(0, 1),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant _OnDarkRing old) => old.fraction != fraction;
}

// ───────────────────────────────────────────────────────────────── tiles

/// One animated stat tile (web's `StatTile`): icon chip, label, big value,
/// hint, optional progress bar and delta; tappable when [onTap] is set.
class MemberStatTile extends StatelessWidget {
  const MemberStatTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.value,
    required this.hint,
    this.progress,
    this.delta,
    this.onTap,
    super.key,
  });

  final String label;
  final IconData icon;
  final Color color;
  final Widget value;
  final String hint;
  final double? progress;
  final double? delta;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final up = (delta ?? 0) >= 0;
    final body = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 15, color: color),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            ],
          ),
          DefaultTextStyle(
            style: AppText.display(size: 22, color: AppColors.ink),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: value,
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (progress != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress!.clamp(0.0, 1.0),
                    minHeight: 5,
                    backgroundColor: AppColors.surface3,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
              ],
              Row(
                children: [
                  if (delta != null) ...[
                    Icon(
                      up
                          ? Icons.arrow_upward_rounded
                          : Icons.arrow_downward_rounded,
                      size: 12,
                      color: up ? TeamColors.green : TeamColors.rose,
                    ),
                    const SizedBox(width: 2),
                  ],
                  Expanded(
                    child: Text(
                      hint,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: body,
      ),
    );
  }
}

/// Lays tiles out 2-up on phones and 3 / 6-up on wider screens.
class MemberTileGrid extends StatelessWidget {
  const MemberTileGrid({required this.tiles, super.key});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, c) {
          final cols = c.maxWidth >= 900 ? 6 : (c.maxWidth >= 600 ? 3 : 2);
          const gap = 10.0;
          final w = (c.maxWidth - gap * (cols - 1)) / cols;
          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (var i = 0; i < tiles.length; i++)
                StaggeredReveal(
                  index: i,
                  child: SizedBox(width: w, height: 112, child: tiles[i]),
                ),
            ],
          );
        },
      );
}

// ───────────────────────────────────────────────────────────────── cards

/// Section card (web's `SectionCard`): tinted icon, title / subtitle, optional
/// action link, body.
class MemberSection extends StatelessWidget {
  const MemberSection({
    required this.title,
    required this.icon,
    required this.color,
    required this.child,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.flush = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final Color color;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool flush;
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 17, color: color),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 14.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                        if (subtitle != null)
                          Text(
                            subtitle!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (actionLabel != null)
                    TextButton(
                      onPressed: onAction,
                      style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        foregroundColor: AppColors.memberPillFg,
                      ),
                      child: Text(
                        actionLabel!,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w800,
                          color: AppColors.memberPillFg,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (flush)
              child
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                child: child,
              ),
          ],
        ),
      );
}

/// A centred "nothing here" block.
class MemberEmpty extends StatelessWidget {
  const MemberEmpty({
    required this.icon,
    required this.title,
    required this.message,
    super.key,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
        child: Column(
          children: [
            Icon(icon, color: AppColors.inkFaint),
            const SizedBox(height: 4),
            Text(title, style: AppText.body(size: 13, weight: FontWeight.w800)),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
}

/// One row of a flush list (icon chip, title, subtitle, trailing).
class MemberListRow extends StatelessWidget {
  const MemberListRow({
    required this.icon,
    required this.title,
    required this.color,
    this.subtitle,
    this.trailing,
    this.onTap,
    super.key,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Color color;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        maxLines: 2,
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
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
            ],
          ),
        ),
      );
}

/// Attendance: 12-week heatmap + weekday bars (the shared heatmap card) with
/// web's three mini facts under it.
class MemberAttendanceCard extends StatelessWidget {
  const MemberAttendanceCard({
    required this.attendance,
    required this.onHistory,
    super.key,
  });

  final OverviewAttendance attendance;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    final a = attendance;
    final total = a.daily.fold<int>(0, (s, d) => s + d.visits);
    Widget mini(String label, String? value) => Expanded(
          child: Column(
            children: [
              Text(
                value ?? '—',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 14, weight: FontWeight.w800),
              ),
              Text(
                label,
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
    return MemberSection(
      title: 'Attendance',
      subtitle:
          '$total ${total == 1 ? 'visit' : 'visits'} in the last 12 weeks',
      icon: Icons.show_chart_rounded,
      color: TeamColors.sky,
      actionLabel: 'History',
      onAction: onHistory,
      child: Column(
        children: [
          if (total == 0)
            const MemberEmpty(
              icon: Icons.show_chart_rounded,
              title: 'No visits in the last 12 weeks',
              message: 'Check in at the gym and your streak starts here.',
            )
          else
            AttendanceHeatmapCard(attendance: a),
          const SizedBox(height: 10),
          Row(
            children: [
              mini('Best streak', '${a.bestStreakDays}d'),
              mini(
                'Avg visit',
                a.avgVisitMinutes == null ? null : '${a.avgVisitMinutes} min',
              ),
              mini(
                'Last visit',
                a.lastVisitAt == null ? null : _day(a.lastVisitAt!),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class MemberClassesCard extends StatelessWidget {
  const MemberClassesCard({
    required this.classes,
    required this.onBook,
    super.key,
  });

  final List<OverviewClass> classes;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) => MemberSection(
        title: 'Upcoming classes',
        subtitle: 'Your next bookings',
        icon: Icons.event_note_rounded,
        color: TeamColors.violet,
        actionLabel: 'Book',
        onAction: onBook,
        flush: true,
        child: classes.isEmpty
            ? const MemberEmpty(
                icon: Icons.event_note_rounded,
                title: 'Nothing booked',
                message: 'Book a class for the week ahead.',
              )
            : Column(
                children: [
                  for (final c in classes.take(3))
                    MemberListRow(
                      icon: Icons.event_note_rounded,
                      color: TeamColors.violet,
                      title: c.name,
                      subtitle: '${_day(c.date)} · ${_time(c.startTime)}–'
                          '${_time(c.endTime)}'
                          '${c.trainerName != null ? ' · ${c.trainerName}' : ''}',
                      trailing: AppPill(
                        label: c.bookingStatus == 'BOOKED'
                            ? 'Booked'
                            : c.bookingStatus,
                        tone: AppPillTone.success,
                      ),
                      onTap: onBook,
                    ),
                ],
              ),
      );
}

class MemberWorkoutCard extends StatelessWidget {
  const MemberWorkoutCard({
    required this.workout,
    required this.onOpen,
    super.key,
  });

  final OverviewWorkout? workout;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final w = workout;
    return MemberSection(
      title: 'Workout',
      subtitle: w?.planName ?? 'No plan assigned',
      icon: Icons.fitness_center_rounded,
      color: const Color(0xFFF97316),
      actionLabel: 'Open',
      onAction: onOpen,
      child: w == null
          ? const MemberEmpty(
              icon: Icons.fitness_center_rounded,
              title: 'No workout plan',
              message: 'Ask your trainer to assign you one.',
            )
          : Row(
              children: [
                AnimatedFraction(
                  fraction: w.progressPercent / 100,
                  builder: (_, v) => SizedBox(
                    width: 78,
                    height: 78,
                    child: CustomPaint(
                      painter: RingPainter(
                        fraction: v,
                        color: const Color(0xFFF97316),
                      ),
                      child: Center(
                        child: Text(
                          '${w.progressPercent}%',
                          style: AppText.display(size: 17),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${w.completedExercises} of ${w.totalExercises} '
                        'exercises done',
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${w.completedThisWeek} completed this week',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
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

/// Web's "Body snapshot": latest weight / body fat / waist with the change
/// since the previous record. Hidden numbers stay hidden (null → not shown).
class MemberBodyCard extends StatelessWidget {
  const MemberBodyCard({
    required this.measurements,
    required this.loading,
    required this.onAll,
    super.key,
  });

  final List<BodyMeasurement>? measurements;
  final bool loading;
  final VoidCallback onAll;

  @override
  Widget build(BuildContext context) {
    final sorted = [...?measurements]
      ..sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
    final latest = sorted.isEmpty ? null : sorted.first;
    final prev = sorted.length > 1 ? sorted[1] : null;
    final metrics = <(String, String, double?, double?)>[
      if (latest != null) ...[
        ('Weight', 'kg', latest.weightKg, prev?.weightKg),
        ('Body fat', '%', latest.bodyFatPercent, prev?.bodyFatPercent),
        ('Waist', 'cm', latest.waistCm, prev?.waistCm),
      ],
    ].where((m) => m.$3 != null).toList();
    String n(double v) => v.toStringAsFixed(v == v.roundToDouble() ? 0 : 1);
    return MemberSection(
      title: 'Body snapshot',
      subtitle: latest == null
          ? (loading ? 'Loading…' : 'No measurements yet')
          : 'Recorded ${fmtDate(latest.recordedAt)}',
      icon: Icons.straighten_rounded,
      color: TeamColors.green,
      actionLabel: 'All',
      onAction: onAll,
      child: metrics.isEmpty
          ? MemberEmpty(
              icon: Icons.straighten_rounded,
              title: loading ? 'Loading…' : 'No measurements yet',
              message: 'Your trainer records these during check-ups.',
            )
          : Row(
              children: [
                for (var i = 0; i < metrics.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Builder(
                      builder: (context) {
                        final m = metrics[i];
                        final diff = m.$4 == null
                            ? null
                            : (((m.$3! - m.$4!) * 10).round() / 10);
                        return Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.surface3,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  '${n(m.$3!)}${m.$2}',
                                  style: AppText.display(size: 17),
                                ),
                              ),
                              Text(
                                m.$1,
                                style: AppText.body(
                                  size: 11,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w600,
                                ),
                              ),
                              if (diff != null && diff != 0)
                                Text(
                                  '${diff > 0 ? '+' : ''}${n(diff)}${m.$2}',
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w800,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

/// Web's "Recent invoices": last four, status chips, and a Pay strip for the
/// first unpaid one.
class MemberBillingCard extends StatelessWidget {
  const MemberBillingCard({
    required this.invoices,
    required this.billing,
    required this.onAll,
    required this.onPay,
    super.key,
  });

  final List<MemberInvoice> invoices;
  final OverviewBilling billing;
  final VoidCallback onAll;
  final void Function(MemberInvoice) onPay;

  AppPillTone _tone(String s) => switch (s) {
        'PAID' => AppPillTone.success,
        'OVERDUE' => AppPillTone.danger,
        _ => AppPillTone.warning,
      };

  @override
  Widget build(BuildContext context) {
    MemberInvoice? unpaid;
    for (final i in invoices) {
      if (i.status != 'PAID') {
        unpaid = i;
        break;
      }
    }
    return MemberSection(
      title: 'Recent invoices',
      subtitle: billing.paidLast90Days > 0
          ? '${memberMoney(billing.paidLast90Days)} paid in the last 90 days'
          : null,
      icon: Icons.receipt_long_rounded,
      color: TeamColors.amber,
      actionLabel: 'All',
      onAction: onAll,
      flush: true,
      child: invoices.isEmpty
          ? const MemberEmpty(
              icon: Icons.receipt_long_rounded,
              title: 'No invoices yet',
              message: "Your invoices will show up here once you're billed.",
            )
          : Column(
              children: [
                for (final inv in invoices.take(4))
                  MemberListRow(
                    icon: Icons.receipt_long_rounded,
                    color: TeamColors.amber,
                    title: inv.invoiceNumber,
                    subtitle: '${fmtDate(inv.invoiceDate)} · '
                        '${memberMoney(inv.totalAmount)}',
                    trailing: AppPill(
                      label: inv.status.replaceAll('_', ' '),
                      tone: _tone(inv.status),
                    ),
                    onTap: onAll,
                  ),
                if (unpaid != null)
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
                    color: TeamColors.amber.withValues(alpha: 0.12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${unpaid.invoiceNumber} · '
                            '${memberMoney(unpaid.totalAmount)} due '
                            '${fmtDate(unpaid.dueDate)}',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        FilledButton(
                          key: const ValueKey('dash-pay'),
                          onPressed: () => onPay(unpaid!),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.memberB,
                            foregroundColor: AppColors.memberOnGrad,
                            visualDensity: VisualDensity.compact,
                          ),
                          child: const Text('Pay'),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

/// Web's "Your gym": trainer, branch, member since, today's hours, address,
/// phone / e-mail / website — only the fields that exist.
class MemberGymCard extends StatelessWidget {
  const MemberGymCard({
    required this.overview,
    required this.gym,
    required this.onMore,
    super.key,
  });

  final MemberOverview overview;
  final GymInfo? gym;
  final VoidCallback onMore;

  Future<void> _launch(Uri uri) async {
    await launchUrl(uri, mode: LaunchMode.externalApplication)
        .catchError((_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final m = overview.member;
    const days = [
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', //
      'sunday',
    ];
    final today = days[DateTime.now().weekday - 1];
    final hours = gym?.branch?.businessHours ?? gym?.businessHours;
    GymHour? todayHours;
    for (final h in hours ?? const <GymHour>[]) {
      if (h.day.toLowerCase() == today) todayHours = h;
    }
    final addr = (gym?.branch?.address ?? gym?.address)?.oneLine;
    final phone = gym?.branch?.phone ?? gym?.phone;
    final email = gym?.branch?.email ?? gym?.email;
    final website = gym?.website;
    return MemberSection(
      title: gym?.name ?? 'Your gym',
      subtitle: m.branchName,
      icon: Icons.storefront_rounded,
      color: TeamColors.indigo,
      actionLabel: 'More',
      onAction: onMore,
      flush: true,
      child: Column(
        children: [
          if (m.trainerName != null)
            MemberListRow(
              icon: Icons.person_outline_rounded,
              color: TeamColors.indigo,
              title: m.trainerName!,
              subtitle: 'Your trainer',
            ),
          if (m.branchName != null)
            MemberListRow(
              icon: Icons.storefront_outlined,
              color: TeamColors.indigo,
              title: m.branchName!,
              subtitle: 'Your branch',
            ),
          MemberListRow(
            icon: Icons.verified_user_outlined,
            color: TeamColors.indigo,
            title: _day(m.joiningDate),
            subtitle: 'Member since',
          ),
          if (todayHours != null)
            MemberListRow(
              icon: Icons.schedule_rounded,
              color: TeamColors.indigo,
              title: todayHours.closed ||
                      todayHours.open == null ||
                      todayHours.close == null
                  ? 'Closed today'
                  : '${_time(todayHours.open!)} – ${_time(todayHours.close!)}',
              subtitle: "Today's hours",
            ),
          if (addr != null && addr.isNotEmpty)
            MemberListRow(
              icon: Icons.place_outlined,
              color: TeamColors.indigo,
              title: addr,
              subtitle: 'Address',
            ),
          if (phone != null && phone.isNotEmpty)
            MemberListRow(
              icon: Icons.call_outlined,
              color: TeamColors.indigo,
              title: phone,
              subtitle: 'Call the front desk',
              onTap: () => _launch(Uri(scheme: 'tel', path: phone)),
            ),
          if (email != null && email.isNotEmpty)
            MemberListRow(
              icon: Icons.mail_outline_rounded,
              color: TeamColors.indigo,
              title: email,
              subtitle: 'Email',
              onTap: () => _launch(Uri(scheme: 'mailto', path: email)),
            ),
          if (website != null && website.isNotEmpty)
            MemberListRow(
              icon: Icons.public_rounded,
              color: TeamColors.indigo,
              title: website.replaceFirst(RegExp(r'^https?://'), ''),
              subtitle: 'Website',
              onTap: () {
                final u = Uri.tryParse(website);
                if (u != null) _launch(u);
              },
            ),
        ],
      ),
    );
  }
}

/// Web's "My data" strip (GDPR export lives on its own screen here).
class MemberDataCard extends StatelessWidget {
  const MemberDataCard({required this.onExport, super.key});

  final VoidCallback onExport;

  @override
  Widget build(BuildContext context) => MemberSection(
        title: 'My data',
        icon: Icons.shield_outlined,
        color: TeamColors.slate,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Download everything on file for you — profile, attendance, '
              'plans, invoices, and bookings — as a JSON file.',
              style: AppText.body(
                size: 12.5,
                color: AppColors.inkSoft,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              key: const ValueKey('dash-export'),
              onPressed: onExport,
              child: const Text('Download my data'),
            ),
          ],
        ),
      );
}

/// The check-in QR from `GET /portal/me` (`data:` URL or http URL).
Widget memberQrImage(String url) {
  if (url.startsWith('data:')) {
    final raw = url.contains(',') ? url.split(',').last : '';
    try {
      return Image.memory(base64Decode(raw), width: 220, height: 220);
    } catch (_) {
      return const Icon(Icons.qr_code_2_rounded, size: 120);
    }
  }
  return Image.network(url, width: 220, height: 220);
}
