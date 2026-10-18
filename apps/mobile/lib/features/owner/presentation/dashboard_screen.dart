import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/dashboard/owner_dashboard_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/menu_button.dart';
import '../../../shared/widgets/notification_bell_icon.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../reports/presentation/widgets/report_filter_bar.dart';
import 'widgets/dash_hero.dart';
import 'widgets/dash_panels.dart';

/// Owner "Overview". A mobile layout of tenant-web's dashboard page: same
/// sections, same order, same endpoints (see [OwnerDashboardCubit]) —
/// hero with the 7/30/90-day range, eight key figures, Income vs expenses,
/// Members, Attendance, New members, Expiring, Outstanding, Live activity,
/// Branch comparison, Staff, Collection & membership health, Announcements
/// and Your plan.
///
/// Like web, a panel renders only when the viewer holds its permission
/// (`reports:view`, `analytics:view`, `finance:view`) and its data loaded.
///
/// Deliberately not shown, because web does not show them either: Upcoming
/// Birthdays (web renders only an "available once Members go live"
/// placeholder; no endpoint returns member birthdays) and the onboarding
/// checklist card.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final user = session is SessionAuthenticatedStaff ? session.user : null;
    final access = DashboardAccess(
      reports: user?.hasPermission('reports:view') ?? false,
      analytics: user?.hasPermission('analytics:view') ?? false,
      finance: user?.hasPermission('finance:view') ?? false,
    );
    return BlocProvider<OwnerDashboardCubit>(
      // Keyed on the access set so a permission change rebuilds the cubit.
      key: ValueKey(access),
      create: (_) => getIt<OwnerDashboardCubit>(param1: access)..load(),
      child: _DashboardView(access: access),
    );
  }
}

class _DashboardView extends StatelessWidget {
  const _DashboardView({required this.access});

  final DashboardAccess access;

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final staff = session is SessionAuthenticatedStaff ? session : null;
    final tenantName = staff?.tenant.name ?? '';
    final name = staff?.user.name ?? '';
    final avatarUrl = staff?.user.avatarUrl;
    final user = staff?.user;

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => context.read<OwnerDashboardCubit>().load(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Row(
            children: [
              const MenuButton(),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tenantName, style: AppText.eyebrow()),
                    Text('Overview', style: AppText.display(size: 22)),
                  ],
                ),
              ),
              const NotificationBellIcon(isStaff: true),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () => context.push(AppRoutes.myProfile),
                child: UserAvatar(avatarUrl: avatarUrl, name: name),
              ),
            ],
          ),
          const SizedBox(height: 16),
          BlocBuilder<OwnerDashboardCubit, OwnerDashboardState>(
            builder: (context, state) {
              return switch (state) {
                OwnerDashboardLoading() => const Padding(
                    padding: EdgeInsets.only(top: 60),
                    child: AppLoadingView(),
                  ),
                OwnerDashboardError(:final message) => Padding(
                    padding: const EdgeInsets.only(top: 40),
                    child: AppErrorView(
                      message: message,
                      onRetry: () => context.read<OwnerDashboardCubit>().load(),
                    ),
                  ),
                OwnerDashboardLoaded() => _Loaded(
                    state: state,
                    firstName: name.trim().split(RegExp(r'\s+')).first,
                    tenantName: tenantName,
                    canAddMember:
                        user?.hasPermission('members:create') ?? false,
                    canRecordPayment:
                        user?.hasPermission('finance:view') ?? false,
                    canCheckIn: user?.hasPermission('attendance:view') ?? false,
                  ),
              };
            },
          ),
        ],
      ),
    );
  }
}

class _Loaded extends StatelessWidget {
  const _Loaded({
    required this.state,
    required this.firstName,
    required this.tenantName,
    required this.canAddMember,
    required this.canRecordPayment,
    required this.canCheckIn,
  });

  final OwnerDashboardLoaded state;
  final String firstName;
  final String tenantName;
  final bool canAddMember;
  final bool canRecordPayment;
  final bool canCheckIn;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<OwnerDashboardCubit>();
    final d = state.data;
    final k = d.kpis;

    final panels = <Widget>[
      if (k != null)
        DashKeyFigures(
          kpis: k,
          revenue: d.revenue,
          attendance: d.attendance,
          growth: d.growth,
          branchId: state.selectedBranchId,
        ),
      if (d.revenue != null) DashMoneyPanel(revenue: d.revenue!),
      if (k != null) DashMembersPanel(kpis: k),
      if (d.attendance != null)
        DashAttendancePanel(points: d.attendance!, days: state.rangeDays),
      if (d.growth != null) DashNewMembersPanel(points: d.growth!),
      if (d.expiring != null) DashExpiringPanel(rows: d.expiring!),
      if (d.outstanding != null) DashOutstandingPanel(invoices: d.outstanding!),
      if (d.activities != null) DashActivityPanel(items: d.activities!),
      if (d.branchRows != null) DashBranchPanel(rows: d.branchRows!),
      if (k != null) DashStaffPanel(kpis: k, trainers: d.trainers ?? const []),
      if (k != null)
        DashHealthPanel(kpis: k, collection: d.collection ?? const []),
      DashAnnouncementsPanel(items: d.announcements),
      DashPlanPanel(
        subscription: d.subscription,
        activeBranches: k?.activeBranches ?? state.branches.length,
      ),
    ];

    return AnimatedOpacity(
      opacity: state.refreshing ? 0.55 : 1,
      duration: const Duration(milliseconds: 180),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (state.branches.length > 1) ...[
            ReportFilterBar(
              branches: state.branches,
              selectedBranchId: state.selectedBranchId,
              onBranchChanged: cubit.selectBranch,
            ),
            const SizedBox(height: 14),
          ],
          DashHero(
            firstName: firstName,
            tenantName: tenantName,
            kpis: k,
            rangeDays: state.rangeDays,
            onRangeChanged: cubit.selectRange,
            canAddMember: canAddMember,
            canRecordPayment: canRecordPayment,
            canCheckIn: canCheckIn,
          ),
          if (d.unavailableMessage != null) ...[
            const SizedBox(height: 16),
            _UnavailableNotice(message: d.unavailableMessage!),
          ],
          for (final p in panels) ...[const SizedBox(height: 16), p],
        ],
      ),
    );
  }
}

/// Shown when a section the viewer may see could not load — most often a
/// module the gym's plan excludes (Reports / Analytics / Income / Expenses).
class _UnavailableNotice extends StatelessWidget {
  const _UnavailableNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 18,
            color: AppColors.warning,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Some dashboard sections are not available for this gym: $message',
              style: AppText.body(size: 12.5, color: AppColors.inkSoft),
            ),
          ),
        ],
      ),
    );
  }
}
