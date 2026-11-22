import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/hr/hr_me_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/hr_summary.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../models/hr_leave.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hr_palette.dart';
import 'my_payslips_screen.dart';
import 'widgets/hr_calendar_card.dart';
import 'widgets/hr_clock_hero.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **My HR** - every staff role's personal HR page (`/hr/me/*`).
///
/// Hero: live clock ring + the big Check in / Check out button, today's shift
/// and late indicator (all from `GET /hr/me/summary`, the button obeys the
/// server's `canCheckIn` / `canCheckOut`). Below: month totals, the month
/// attendance heatmap (tap a day for the punches and - for a manual mark -
/// who marked it and why), leave balance rings per leave type, pending and
/// upcoming leaves, upcoming holidays and the latest payslip.
///
/// Permission gating mirrors the API: the summary / calendar need
/// `hr:self_attendance`; the leave blocks and Apply / My leaves need
/// `hr:self_leave`; the payslip tile needs `hr:self_payslip`. A role holding
/// only the leave / payslip keys gets the links without the clock.
///
/// The OWNER has no StaffProfile today, so the API answers 403
/// `NOT_AN_EMPLOYEE`; that is shown as an explanation, not an error.
///
/// **Dropped vs the brief**: nothing - every element is backed by an endpoint.
/// Mutations are never optimistic: the button shows a spinner and the screen
/// updates from the server's response, then the summary is re-fetched.
class MyHrScreen extends StatelessWidget {
  const MyHrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<HrMeCubit>(
      create: (_) => HrMeCubit(getIt<HrRepository>())..load(),
      child: const _MyHrView(),
    );
  }
}

class _MyHrView extends StatefulWidget {
  const _MyHrView();

  @override
  State<_MyHrView> createState() => _MyHrViewState();
}

class _MyHrViewState extends State<_MyHrView> {
  int _tick = 0;

  Future<void> _refresh() async {
    setState(() => _tick++);
    await context.read<HrMeCubit>().load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<HrMeCubit, HrMeState>(
      listener: (context, state) {
        if (state is! HrMeLoaded) return;
        final cubit = context.read<HrMeCubit>();
        if (state.notice != null) {
          HapticFeedback.heavyImpact();
          hrSnack(context, state.notice!, error: true);
          cubit.dismissNotice();
        }
        if (state.celebrate != null) {
          HapticFeedback.lightImpact();
          final out = state.celebrate == HrPunch.checkOut;
          final msg = out
              ? 'Checked out. See you tomorrow!'
              : 'Checked in. Have a great shift!';
          hrSnack(context, msg);
          hrAnnounce(context, msg);
          cubit.celebrated();
        }
      },
      builder: (context, state) {
        return switch (state) {
          HrMeLoading() => const _Frame(child: _LoadingBody()),
          HrMeError(:final notAnEmployee, :final message) => _Frame(
              child: notAnEmployee
                  ? const _NotAnEmployee()
                  : Padding(
                      padding: const EdgeInsets.only(top: 80),
                      child: AppErrorView(
                        message: message,
                        onRetry: () => context.read<HrMeCubit>().load(),
                      ),
                    ),
            ),
          HrMeLoaded() => _Loaded(
              state: state,
              tick: _tick,
              onRefresh: _refresh,
            ),
        };
      },
    );
  }
}

/// Plain frame (gradient strip + back button) for the loading / error states.
class _Frame extends StatelessWidget {
  const _Frame({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          children: [
            Container(
              height: 120 + top,
              padding: EdgeInsets.fromLTRB(18, 14 + top, 18, 0),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: HrPalette.clockCard),
                borderRadius:
                    BorderRadius.vertical(bottom: Radius.circular(30)),
              ),
              child: Row(
                children: [
                  ListHeroButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => context.pop(),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'My HR',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
              child: child,
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingBody extends StatelessWidget {
  const _LoadingBody();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        HrShimmerBox(height: 130, radius: AppRadii.card),
        SizedBox(height: 12),
        HrSkeletonList(count: 3, height: 90),
      ],
    );
  }
}

class _NotAnEmployee extends StatelessWidget {
  const _NotAnEmployee();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 40),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: HrPalette.onLeave.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.badge_outlined,
              size: 34,
              color: HrPalette.onLeave,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No employee profile',
            style: AppText.display(size: 18),
          ),
          const SizedBox(height: 6),
          Text(
            'Your account is not set up as an employee, so there is no '
            'personal attendance, leave or payslip to show. If you manage '
            'the team, open HR from the menu.',
            textAlign: TextAlign.center,
            style: AppText.body(color: AppColors.inkFaint, size: 13),
          ),
        ],
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({
    required this.state,
    required this.tick,
    required this.onRefresh,
  });

  final HrMeLoaded state;
  final int tick;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final s = state.summary;
    final att = s.today.attendance;
    final canLeave = hrCan(context, HrPerm.selfLeave);
    final canPay = hrCan(context, HrPerm.selfPayslip);
    final top = MediaQuery.of(context).padding.top;
    final inset = teamSideInset(context, maxWidth: 840);
    final cubit = context.read<HrMeCubit>();
    var i = 0;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: onRefresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: HrClockHero(
                summary: s,
                punching: state.punching,
                topInset: top,
                side: 18 + inset,
                onBack: () => context.pop(),
                onBell: () async {
                  await context.push<void>(AppRoutes.hrInbox);
                  if (context.mounted) cubit.load(silent: true);
                },
                onCheckIn: cubit.checkIn,
                onCheckOut: cubit.checkOut,
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(18 + inset, 16, 18 + inset, 40),
              sliver: SliverList.list(
                children: [
                  StaggeredCard(
                    index: i++,
                    child: _QuickActions(canLeave: canLeave, canPay: canPay),
                  ),
                  const SizedBox(height: 18),
                  StaggeredCard(
                    index: i++,
                    child: _MonthStats(summary: s),
                  ),
                  const SizedBox(height: 18),
                  const HrSectionHeader(title: 'Attendance'),
                  StaggeredCard(
                    index: i++,
                    child: HrAttendanceCalendarCard(
                      fetch: (m) =>
                          getIt<HrRepository>().myAttendance(month: m),
                      refreshKey:
                          '$tick|${att.status.api}|${att.checkInTime}|${att.checkOutTime}',
                    ),
                  ),
                  if (canLeave) ...[
                    const SizedBox(height: 18),
                    HrSectionHeader(
                      title: 'Leave balance',
                      trailing: 'Apply',
                      onTrailingTap: () => _apply(context, cubit),
                    ),
                    StaggeredCard(
                      index: i++,
                      child: _Balances(balances: s.leaveBalances),
                    ),
                    if (s.pendingLeaves.isNotEmpty ||
                        s.upcomingLeaves.isNotEmpty) ...[
                      const SizedBox(height: 18),
                      HrSectionHeader(
                        title: 'My leaves',
                        trailing: 'See all',
                        onTrailingTap: () => context.push(AppRoutes.hrMyLeaves),
                      ),
                      for (final r in [
                        ...s.pendingLeaves,
                        ...s.upcomingLeaves.where(
                          (u) => !s.pendingLeaves.any((p) => p.id == u.id),
                        ),
                      ]) ...[
                        StaggeredCard(
                          index: i++,
                          child: HrLeaveCard(
                            request: r,
                            onTap: () => context.push(AppRoutes.hrMyLeaves),
                          ),
                        ),
                        const SizedBox(height: 10),
                      ],
                    ],
                  ],
                  if (s.upcomingHolidays.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    const HrSectionHeader(title: 'Upcoming holidays'),
                    StaggeredCard(
                      index: i++,
                      child: _Holidays(holidays: s.upcomingHolidays),
                    ),
                  ],
                  if (canPay && s.latestPayslip != null) ...[
                    const SizedBox(height: 18),
                    HrSectionHeader(
                      title: 'Latest payslip',
                      trailing: 'All payslips',
                      onTrailingTap: () => context.push(AppRoutes.hrPayslips),
                    ),
                    StaggeredCard(
                      index: i++,
                      child: HrPayslipTile(
                        payslip: s.latestPayslip!,
                        onTap: () => context.push(
                          AppRoutes.hrPayslipDetail,
                          extra: HrPayslipArgs(
                            id: s.latestPayslip!.id,
                            month: s.latestPayslip!.month,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _apply(BuildContext context, HrMeCubit cubit) async {
    final done = await context.push<bool>(AppRoutes.hrApplyLeave);
    if (done == true && context.mounted) cubit.load(silent: true);
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.canLeave, required this.canPay});

  final bool canLeave;
  final bool canPay;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<HrMeCubit>();
    final tiles = <Widget>[
      if (canLeave)
        _ActionTile(
          icon: Icons.add_circle_rounded,
          label: 'Apply leave',
          color: HrPalette.onLeave,
          onTap: () async {
            final done = await context.push<bool>(AppRoutes.hrApplyLeave);
            if (done == true && context.mounted) cubit.load(silent: true);
          },
        ),
      if (canLeave)
        _ActionTile(
          icon: Icons.event_note_rounded,
          label: 'My leaves',
          color: HrPalette.late,
          onTap: () => context.push(AppRoutes.hrMyLeaves),
        ),
      if (canPay)
        _ActionTile(
          icon: Icons.receipt_long_rounded,
          label: 'Payslips',
          color: HrPalette.money,
          onTap: () => context.push(AppRoutes.hrPayslips),
        ),
    ];
    if (tiles.isEmpty) return const SizedBox.shrink();
    return Row(
      children: [
        for (var i = 0; i < tiles.length; i++) ...[
          if (i > 0) const SizedBox(width: 10),
          Expanded(child: tiles[i]),
        ],
      ],
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color.withValues(alpha: 0.2), Colors.transparent],
            ),
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(size: 12, weight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MonthStats extends StatelessWidget {
  const _MonthStats({required this.summary});

  final HrMeSummary summary;

  @override
  Widget build(BuildContext context) {
    final st = summary.monthStats;
    final tiles = <HrStatTile>[
      HrStatTile(
        label: 'Present',
        value: st.present,
        color: HrPalette.present,
        icon: Icons.check_circle_rounded,
        index: 0,
      ),
      HrStatTile(
        label: 'Late',
        value: st.late,
        color: HrPalette.late,
        icon: Icons.schedule_rounded,
        index: 1,
      ),
      HrStatTile(
        label: 'Half day',
        value: st.halfDay,
        color: HrPalette.halfDay,
        icon: Icons.contrast_rounded,
        index: 2,
      ),
      HrStatTile(
        label: 'On leave',
        value: st.onLeave,
        color: HrPalette.onLeave,
        icon: Icons.beach_access_rounded,
        index: 3,
      ),
      HrStatTile(
        label: 'Absent',
        value: st.absent,
        color: HrPalette.absent,
        icon: Icons.cancel_rounded,
        index: 4,
      ),
      HrStatTile(
        label: 'Hours worked',
        text: hrDuration(st.workedMinutes),
        color: HrPalette.money,
        icon: Icons.timer_rounded,
        index: 5,
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        HrSectionHeader(title: hrMonthLabelFromKey(summary.month)),
        LayoutBuilder(
          builder: (context, c) => GridView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: c.maxWidth >= 700 ? 6 : 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              mainAxisExtent: 112,
            ),
            children: tiles,
          ),
        ),
      ],
    );
  }
}

class _Balances extends StatelessWidget {
  const _Balances({required this.balances});

  final List<HrLeaveBalance> balances;

  @override
  Widget build(BuildContext context) {
    if (balances.isEmpty) {
      return HrCard(
        child: Text(
          'No leave types are set up yet.',
          style: AppText.body(color: AppColors.inkFaint),
        ),
      );
    }
    return HrCard(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final b in balances)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: HrBalanceRing(
                  label: b.leaveType.name,
                  remaining: b.available ?? 0,
                  total: b.entitled ?? 0,
                  used: b.used,
                  unlimited: b.unlimited,
                  color: HrPalette.leaveType(b.leaveType.colorHex),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Holidays extends StatelessWidget {
  const _Holidays({required this.holidays});

  final List<HrHoliday> holidays;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 78,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: holidays.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final h = holidays[i];
          return Container(
            width: 150,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  HrPalette.holiday.withValues(alpha: 0.22),
                  Colors.transparent,
                ],
              ),
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: HrPalette.holiday.withValues(alpha: 0.3),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  hrDateWd(h.date),
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: HrPalette.holiday,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  h.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
