import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/hr_admin.dart';
import 'apply_leave_screen.dart';
import 'approvals_screen.dart';
import 'team_attendance_screen.dart';
import 'widgets/hr_form_kit.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/motion.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import 'employee_detail_screen.dart';
import 'hr_palette.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **HR** - the manager / owner overview (`GET /hr/overview`, `hr:view`).
///
/// Today's headcount split into present / late / half-day / on-leave /
/// not-marked tiles (count-up), a pending-approvals banner with its badge,
/// the last 7 days as stacked bars, who is on leave in the next 14 days,
/// upcoming holidays, and - only for `hr:payroll_manage` holders - the month's
/// payroll state. Every block is permission-aware exactly like the API
/// (`upcomingLeaves` is empty without `hr:leave_manage`, `payroll` is null
/// without `hr:payroll_manage`), and the entry tiles are gated on the same
/// keys.
///
/// **Quick actions** mirror the web overview: Mark attendance, Leaves, Apply
/// on behalf and Team calendar (`hr:leave_manage`), Monthly attendance,
/// Employees, Run payroll (`hr:payroll_manage`) and Shifts & holidays - each
/// shown only when the user holds the key its destination needs. "Who is off
/// soon" is a horizontal strip of the next 14 days (`hr:leave_manage`) and the
/// upcoming holidays link to Setup.
class HrOverviewScreen extends StatefulWidget {
  const HrOverviewScreen({super.key});

  @override
  State<HrOverviewScreen> createState() => _HrOverviewScreenState();
}

class _HrOverviewScreenState extends State<HrOverviewScreen> {
  HrOverview? _o;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final o = await getIt<HrRepository>().overview();
      if (!mounted) return;
      setState(() {
        _o = o;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && _o == null) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _go(String route, {Object? extra}) async {
    await context.push<void>(route, extra: extra);
    if (mounted) _load(silent: true);
  }

  Future<void> _applyOnBehalf() async {
    final who = await showHrEmployeePicker(
      context,
      title: 'Apply leave for…',
      excludeUserId: hrSelfId(context),
    );
    if (who == null || !mounted) return;
    await context.push<bool>(
      AppRoutes.hrApplyLeave,
      extra: HrApplyLeaveArgs(onBehalfOf: who),
    );
    if (mounted) _load(silent: true);
  }

  /// The web overview's quick actions, each shown only when the user holds
  /// the key the destination needs.
  List<_Entry> _quickActions(HrOverview o, {required bool canLeave, required bool canPay}) => [
        _Entry(
          icon: Icons.event_available_rounded,
          label: 'Mark attendance',
          color: HrPalette.present,
          onTap: () => _go(AppRoutes.hrTeamAttendance),
        ),
        if (canLeave)
          _Entry(
            icon: Icons.fact_check_rounded,
            label: 'Leaves',
            color: HrPalette.pending,
            badge: o.pendingLeaves,
            onTap: () => _go(AppRoutes.hrApprovals),
          ),
        if (canLeave)
          _Entry(
            icon: Icons.person_add_alt_1_rounded,
            label: 'Apply on behalf',
            color: HrPalette.onLeave,
            onTap: _applyOnBehalf,
          ),
        if (canLeave)
          _Entry(
            icon: Icons.calendar_month_rounded,
            label: 'Team calendar',
            color: HrPalette.run,
            onTap: () => _go(
              AppRoutes.hrApprovals,
              extra: const HrLeavesArgs(openCalendar: true),
            ),
          ),
        _Entry(
          icon: Icons.grid_view_rounded,
          label: 'Monthly attendance',
          color: HrPalette.late,
          onTap: () => _go(
            AppRoutes.hrTeamAttendance,
            extra: const HrAttendanceArgs(monthGrid: true),
          ),
        ),
        _Entry(
          icon: Icons.badge_rounded,
          label: 'Employees',
          color: HrPalette.onLeave,
          onTap: () => _go(AppRoutes.hrEmployees),
        ),
        if (canPay)
          _Entry(
            icon: Icons.payments_rounded,
            label: 'Run payroll',
            color: HrPalette.money,
            onTap: () => _go(AppRoutes.hrPayroll),
          ),
        _Entry(
          icon: Icons.tune_rounded,
          label: 'Shifts & holidays',
          color: HrPalette.holiday,
          onTap: () => _go(AppRoutes.hrSetup),
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final o = _o;
    final canLeave = hrCan(context, HrPerm.leaveManage);
    final canPay = hrCan(context, HrPerm.payrollManage);
    var i = 0;
    return HrPage(
      title: 'HR',
      subtitle: o == null ? 'People, time off and pay' : hrDateWd(o.date),
      onRefresh: () => _load(silent: true),
      chips: [
        if (o != null) ...[
          ListHeroChip(
            icon: Icons.groups_rounded,
            label: '${o.headcount} employees',
          ),
          if (o.pendingLeaves > 0 && canLeave)
            ListHeroChip(
              icon: Icons.hourglass_top_rounded,
              label: '${o.pendingLeaves} pending',
            ),
        ],
      ],
      slivers: [
        if (_loading && o == null)
          const SliverToBoxAdapter(child: _OverviewSkeleton())
        else if (_error != null && o == null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 30),
              child: AppErrorView(message: _error!, onRetry: _load),
            ),
          )
        else if (o != null)
          SliverList.list(
            children: [
              if (canLeave && o.pendingLeaves > 0) ...[
                StaggeredCard(
                  index: i++,
                  child: _ApprovalsBanner(
                    count: o.pendingLeaves,
                    onTap: () => _go(AppRoutes.hrApprovals),
                  ),
                ),
                const SizedBox(height: 16),
              ],
              HrSectionHeader(
                title: 'Today',
                trailing: 'Team attendance',
                onTrailingTap: () => _go(AppRoutes.hrTeamAttendance),
              ),
              _TodayGrid(o: o, onTap: () => _go(AppRoutes.hrTeamAttendance)),
              const SizedBox(height: 12),
              StaggeredCard(
                index: i++,
                child: HrCard(child: HrTodayBar(today: o.today)),
              ),
              const SizedBox(height: 18),
              StaggeredCard(
                index: i++,
                child: _QuickActions(
                  items: _quickActions(o, canLeave: canLeave, canPay: canPay),
                ),
              ),
              if (o.trend.isNotEmpty) ...[
                const SizedBox(height: 18),
                const HrSectionHeader(title: 'Last 7 days'),
                StaggeredCard(
                  index: i++,
                  child: HrCard(child: HrTrendBars(points: o.trend)),
                ),
              ],
              if (o.payroll != null) ...[
                const SizedBox(height: 18),
                const HrSectionHeader(title: 'Payroll'),
                StaggeredCard(
                  index: i++,
                  child: _PayrollCard(
                    p: o.payroll!,
                    onTap: () => _go(AppRoutes.hrPayroll),
                  ),
                ),
              ],
              if (canLeave) ...[
                const SizedBox(height: 18),
                HrSectionHeader(
                  title: 'Who is off soon',
                  trailing: 'Team calendar',
                  onTrailingTap: () => _go(
                    AppRoutes.hrApprovals,
                    extra: const HrLeavesArgs(openCalendar: true),
                  ),
                ),
                if (o.upcomingLeaves.isEmpty)
                  Text(
                    'Everyone is in - no approved leave in the next two '
                    'weeks.',
                    key: const Key('off-soon-empty'),
                    style: AppText.body(color: AppColors.inkFaint),
                  )
                else
                  SizedBox(
                    key: const Key('off-soon-strip'),
                    height: 112,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: o.upcomingLeaves.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 10),
                      itemBuilder: (context, idx) {
                        final l = o.upcomingLeaves[idx];
                        return StaggeredCard(
                          index: idx,
                          child: _UpcomingLeaveCard(
                            leave: l,
                            onTap: () => context.push(
                              AppRoutes.hrEmployeeDetail,
                              extra: HrEmployeeArgs(
                                userId: l.employee.userId,
                                name: l.employee.name,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
              ],
              if (o.upcomingHolidays.isNotEmpty) ...[
                const SizedBox(height: 14),
                HrSectionHeader(
                  title: 'Upcoming holidays',
                  trailing: 'Setup',
                  onTrailingTap: () => _go(AppRoutes.hrSetup),
                ),
                for (final h in o.upcomingHolidays) ...[
                  HrCard(
                    key: Key('holiday-${h.id}'),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.celebration_rounded,
                          size: 18,
                          color: HrPalette.holiday,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            h.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Text(
                          hrDateWd(h.date),
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w700,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
            ],
          ),
      ],
    );
  }
}

class _OverviewSkeleton extends StatelessWidget {
  const _OverviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        HrShimmerBox(height: 64, radius: AppRadii.card),
        SizedBox(height: 14),
        Row(
          children: [
            Expanded(child: HrShimmerBox(height: 96, radius: 18)),
            SizedBox(width: 10),
            Expanded(child: HrShimmerBox(height: 96, radius: 18)),
            SizedBox(width: 10),
            Expanded(child: HrShimmerBox(height: 96, radius: 18)),
          ],
        ),
        SizedBox(height: 14),
        HrSkeletonList(count: 3, height: 80),
      ],
    );
  }
}

class _ApprovalsBanner extends StatelessWidget {
  const _ApprovalsBanner({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$count leave requests waiting for approval',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF59E0B), Color(0xFFEF4444)],
              ),
              borderRadius: BorderRadius.circular(AppRadii.card),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.35),
                  blurRadius: 16,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Row(
              children: [
                const PulseDot(color: Colors.white, size: 10),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$count leave ${count == 1 ? 'request needs' : 'requests need'} a decision',
                        style: AppText.body(
                          size: 14,
                          weight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Approve or reject with a remark',
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w700,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.arrow_forward_rounded, color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TodayGrid extends StatelessWidget {
  const _TodayGrid({required this.o, required this.onTap});

  final HrOverview o;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = o.today;
    final tiles = <HrStatTile>[
      HrStatTile(
        label: 'Present',
        value: t.present,
        color: HrPalette.present,
        icon: Icons.check_circle_rounded,
        onTap: onTap,
        index: 0,
      ),
      HrStatTile(
        label: 'Late',
        value: t.late,
        color: HrPalette.late,
        icon: Icons.schedule_rounded,
        onTap: onTap,
        index: 1,
      ),
      HrStatTile(
        label: 'Half day',
        value: t.halfDay,
        color: HrPalette.halfDay,
        icon: Icons.contrast_rounded,
        onTap: onTap,
        index: 2,
      ),
      HrStatTile(
        label: 'On leave',
        value: t.onLeave,
        color: HrPalette.onLeave,
        icon: Icons.beach_access_rounded,
        onTap: onTap,
        index: 3,
      ),
      HrStatTile(
        label: 'Absent',
        value: t.absent,
        color: HrPalette.absent,
        icon: Icons.close_rounded,
        onTap: onTap,
        index: 4,
      ),
      HrStatTile(
        label: 'Yet to check in',
        value: t.yetToCheckIn,
        color: HrPalette.notMarked,
        icon: Icons.more_horiz_rounded,
        onTap: onTap,
        index: 5,
      ),
      HrStatTile(
        label: 'In now',
        value: t.checkedInNow,
        color: HrPalette.money,
        icon: Icons.login_rounded,
        onTap: onTap,
        index: 6,
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) => GridView(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: c.maxWidth >= 700 ? 7 : 3,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          mainAxisExtent: 112,
        ),
        children: tiles,
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.items});

  final List<_Entry> items;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      key: const Key('quick-actions'),
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final e in items)
          SizedBox(
            width:
                (MediaQuery.sizeOf(context).width.clamp(0, 840) - 36 - 10) / 2,
            child: e,
          ),
      ],
    );
  }
}

class _Entry extends StatelessWidget {
  const _Entry({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: badge != null && badge! > 0 ? '$label, $badge pending' : label,
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.2), Colors.transparent],
              ),
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: color.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                ),
                if (badge != null && badge! > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.danger,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Text(
                      '$badge',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  )
                else
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: AppColors.inkFaint,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PayrollCard extends StatelessWidget {
  const _PayrollCard({required this.p, required this.onTap});

  final HrOverviewPayroll p;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = switch (p.status) {
      'PAID' => HrPalette.paid,
      'APPROVED' => HrPalette.run,
      'DRAFT' => HrPalette.draft,
      _ => HrPalette.notMarked,
    };
    final label = switch (p.status) {
      'NOT_GENERATED' => 'Not generated',
      'DRAFT' => 'Draft',
      'APPROVED' => 'Approved',
      'PAID' => 'Paid',
      _ => p.status,
    };
    return HrCard(
      accent: color,
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.payments_rounded, color: color),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hrMonthLabelFromKey(p.month),
                  style: AppText.display(size: 15),
                ),
                Text(
                  p.notGenerated
                      ? 'Not generated yet - open Payroll to generate it'
                      : '${p.unpaidPayslips ?? 0} payslip'
                          '${p.unpaidPayslips == 1 ? '' : 's'} unpaid',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (p.totalNet != null)
                Text(
                  Formatters.currency(p.totalNet!),
                  style: AppText.display(size: 16, color: color),
                ),
              const SizedBox(height: 4),
              HrChip(label: label, color: color, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _UpcomingLeaveCard extends StatelessWidget {
  const _UpcomingLeaveCard({required this.leave, required this.onTap});

  final HrUpcomingLeave leave;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hue = HrPalette.leaveType(leave.leaveType.colorHex);
    final dates = leave.startDate == leave.endDate
        ? hrDateWd(leave.startDate)
        : '${hrDate(leave.startDate)} – ${hrDate(leave.endDate)}';
    return Semantics(
      button: true,
      label: '${leave.employee.name}, ${leave.leaveType.name}, $dates, '
          '${hrDays(leave.days)} days',
      excludeSemantics: true,
      child: SizedBox(
        width: 210,
        child: HrCard(
          accent: hue,
          onTap: onTap,
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  HrAvatar(employee: leave.employee, size: 32),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          leave.employee.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 13,
                            weight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          leave.leaveType.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              Text(
                dates,
                style: AppText.body(size: 12, weight: FontWeight.w800),
              ),
              Text(
                '${hrDays(leave.days)} day${leave.days == 1 ? '' : 's'}'
                '${leave.dayPart.isHalf ? ' · ${leave.dayPart.label}' : ''}',
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Seven stacked bars (present / late / half-day / on-leave / absent) that
/// grow in on first paint, labelled by weekday. Tap a bar to read its numbers.
class HrTrendBars extends StatefulWidget {
  const HrTrendBars({super.key, required this.points});

  final List<HrTrendPoint> points;

  @override
  State<HrTrendBars> createState() => _HrTrendBarsState();
}

class _HrTrendBarsState extends State<HrTrendBars> {
  int? _sel;

  static const _wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  Widget build(BuildContext context) {
    final pts = widget.points;
    final maxTotal = pts.fold<int>(1, (m, p) => p.total > m ? p.total : m);
    final sel = _sel == null ? null : pts[_sel!];
    const barH = 120.0;
    final reduce = reduceMotion(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: barH + 22,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < pts.length; i++)
                Expanded(
                  child: Semantics(
                    button: true,
                    label: '${hrDateWd(pts[i].date)}: ${pts[i].present} '
                        'present, ${pts[i].late} late, ${pts[i].halfDay} half '
                        'day, ${pts[i].onLeave} on leave, ${pts[i].absent} '
                        'absent',
                    excludeSemantics: true,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _sel = _sel == i ? null : i),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          TweenAnimationBuilder<double>(
                            tween: Tween(
                              begin: 0,
                              end: pts[i].total / maxTotal,
                            ),
                            duration: reduce
                                ? Duration.zero
                                : Duration(milliseconds: 600 + i * 70),
                            curve: Curves.easeOutCubic,
                            builder: (context, t, _) => Container(
                              width: 22,
                              height: (barH * t).clamp(2.0, barH),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(7),
                                border: _sel == i
                                    ? Border.all(
                                        color: AppColors.ink,
                                        width: 1.4,
                                      )
                                    : null,
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Column(
                                children: [
                                  for (final seg in [
                                    (pts[i].absent, HrPalette.absent),
                                    (pts[i].onLeave, HrPalette.onLeave),
                                    (pts[i].halfDay, HrPalette.halfDay),
                                    (pts[i].late, HrPalette.late),
                                    (pts[i].present, HrPalette.present),
                                  ])
                                    if (seg.$1 > 0)
                                      Expanded(
                                        flex: seg.$1,
                                        child: Container(color: seg.$2),
                                      ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _wd[pts[i].date.weekday - 1],
                            style: AppText.body(
                              size: 10.5,
                              weight: FontWeight.w800,
                              color: _sel == i
                                  ? AppColors.ink
                                  : AppColors.inkFaint,
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
        const SizedBox(height: 10),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 180),
          child: sel == null
              ? HrLegend(
                  key: const ValueKey('legend'),
                  items: const [
                    ('Present', HrPalette.present, Icons.check_rounded),
                    ('Late', HrPalette.late, Icons.schedule_rounded),
                    ('Half day', HrPalette.halfDay, Icons.contrast_rounded),
                    ('On leave', HrPalette.onLeave, Icons.beach_access_rounded),
                    ('Absent', HrPalette.absent, Icons.close_rounded),
                  ],
                )
              : Text(
                  key: ValueKey(sel.date),
                  '${hrDateWd(sel.date)}: ${sel.present} present · '
                  '${sel.late} late · ${sel.halfDay} half day · '
                  '${sel.onLeave} on leave · ${sel.absent} absent',
                  style: AppText.body(size: 12, weight: FontWeight.w700),
                ),
        ),
      ],
    );
  }
}

/// One slice of [HrTodayBar].
class HrTodaySegment {
  const HrTodaySegment(this.label, this.value, this.color);

  final String label;
  final int value;
  final Color color;
}

/// "Today at a glance": one stacked bar split into the mutually exclusive
/// buckets (present, late, half day, on leave, absent, weekly off, holiday,
/// yet to check in) - together they add up to the headcount - with a legend
/// of the non-empty ones.
class HrTodayBar extends StatelessWidget {
  const HrTodayBar({super.key, required this.today});

  final HrTodayBuckets today;

  /// The slices, in display order (zero ones included).
  static List<HrTodaySegment> segments(HrTodayBuckets t) => [
        HrTodaySegment('Present', t.present, HrPalette.present),
        HrTodaySegment('Late', t.late, HrPalette.late),
        HrTodaySegment('Half day', t.halfDay, HrPalette.halfDay),
        HrTodaySegment('On leave', t.onLeave, HrPalette.onLeave),
        HrTodaySegment('Absent', t.absent, HrPalette.absent),
        HrTodaySegment('Weekly off', t.weeklyOff, HrPalette.weeklyOff),
        HrTodaySegment('Holiday', t.holiday, HrPalette.holiday),
        HrTodaySegment('Yet to check in', t.yetToCheckIn, HrPalette.notMarked),
      ];

  @override
  Widget build(BuildContext context) {
    final segs = segments(today).where((x) => x.value > 0).toList();
    final total = segs.fold<int>(0, (a, x) => a + x.value);
    final reduce = reduceMotion(context);
    return Semantics(
      container: true,
      label: 'Today: ${segs.map((x) => '${x.value} ${x.label.toLowerCase()}').join(', ')}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TODAY AT A GLANCE', style: AppText.eyebrow()),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              key: const Key('today-bar'),
              height: 14,
              child: total == 0
                  ? Container(color: AppColors.surface3)
                  : TweenAnimationBuilder<double>(
                      tween: Tween(begin: reduce ? 1 : 0, end: 1),
                      duration: reduce
                          ? Duration.zero
                          : const Duration(milliseconds: 700),
                      curve: Curves.easeOutCubic,
                      builder: (context, t, child) => Align(
                        alignment: Alignment.centerLeft,
                        widthFactor: 1,
                        child: FractionallySizedBox(
                          widthFactor: t,
                          alignment: Alignment.centerLeft,
                          child: child,
                        ),
                      ),
                      child: Row(
                        children: [
                          for (final x in segs)
                            Expanded(
                              flex: x.value,
                              child: Container(color: x.color),
                            ),
                        ],
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              for (final x in segs)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: x.color,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      '${x.label} ${x.value}',
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w700,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}
