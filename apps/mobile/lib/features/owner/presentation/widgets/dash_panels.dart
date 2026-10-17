import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_currency.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/branch_comparison_row.dart';
import '../../../../models/dashboard_kpis.dart';
import '../../../../models/expiring_membership_row.dart';
import '../../../../models/member_invoice.dart';
import '../../../../models/platform_announcement.dart';
import '../../../../models/recent_activity.dart';
import '../../../../models/revenue_trend_point.dart';
import '../../../../models/subscription_plan_info.dart';
import '../../../../models/trainer_performance_row.dart';
import '../../../../models/trend_point.dart';
import 'dashboard_detail_sheet.dart';
import 'dash_ui.dart';
import 'trend_chart.dart';

String _money(double v) => Formatters.currency(v);

List<T> _tail<T>(List<T>? list, [int n = 14]) {
  final l = list ?? const [];
  return l.length <= n ? l : l.sublist(l.length - n);
}

List<String> _labels(Iterable<String> dates) =>
    dates.map((d) => d.length >= 10 ? d.substring(5) : d).toList();

/// The eight key figures — same tiles, order and footers as web's `KpiStrip`.
/// Tiles with a detail sheet open it on tap; Monthly expenses opens the
/// Expenses list (web: `href: '/expenses'`).
class DashKeyFigures extends StatelessWidget {
  const DashKeyFigures({
    super.key,
    required this.kpis,
    required this.revenue,
    required this.attendance,
    required this.growth,
    required this.branchId,
  });

  final DashboardKpis kpis;
  final List<RevenueTrendPoint>? revenue;
  final List<TrendPoint>? attendance;
  final List<TrendPoint>? growth;
  final String? branchId;

  @override
  Widget build(BuildContext context) {
    final k = kpis;
    final income = k.monthlyRevenue;
    final expenses = k.monthlyExpenses;
    final incomeSeries = _tail(revenue).map((p) => p.income).toList();
    final expenseSeries = _tail(revenue).map((p) => p.expenses).toList();
    final activeShare =
        k.totalMembers > 0 ? k.activeMembers / k.totalMembers * 100 : 0.0;
    final expiringShare =
        k.activeMembers > 0 ? k.expiringMemberships / k.activeMembers * 100 : 0.0;
    void detail(DashboardStatKind kind) =>
        showDashboardDetailSheet(context, kind: kind, branchId: branchId);
    String count(double n) => n.round().toString();
    String money(double n) => Formatters.currencyCompact(n);
    final net = income - expenses;

    final tiles = <Widget>[
      DashTile(
        icon: Icons.groups_rounded,
        accent: Dash.indigo,
        label: 'Active members',
        value: k.activeMembers.toDouble(),
        format: count,
        tag: 'of ${k.totalMembers}',
        footer: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: DashProgress(percent: activeShare, color: Dash.indigo),
        ),
        onTap: () => detail(DashboardStatKind.activeMembers),
      ),
      DashTile(
        icon: Icons.person_add_alt_1_rounded,
        accent: Dash.violet,
        label: 'New this month',
        value: k.newMembersThisMonth.toDouble(),
        format: count,
        footer: DashSparkline(
          values: _tail(growth).map((p) => p.value.toDouble()).toList(),
          color: Dash.violet,
        ),
        onTap: () => detail(DashboardStatKind.newRegistrations),
      ),
      DashTile(
        icon: Icons.how_to_reg_rounded,
        accent: Dash.aqua,
        label: "Today's check-ins",
        value: k.todaysAttendance.toDouble(),
        format: count,
        footer: DashSparkline(
          values: _tail(attendance).map((p) => p.value.toDouble()).toList(),
          color: Dash.aqua,
        ),
        onTap: () => detail(DashboardStatKind.attendance),
      ),
      DashTile(
        icon: Icons.event_busy_rounded,
        accent: Dash.warning,
        label: 'Expiring in 30 days',
        value: k.expiringMemberships.toDouble(),
        format: count,
        tag: 'renew soon',
        footer: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: DashProgress(percent: expiringShare, color: Dash.warning),
        ),
        onTap: () => detail(DashboardStatKind.expiringMemberships),
      ),
      DashTile(
        icon: Icons.account_balance_wallet_rounded,
        accent: Dash.success,
        label: 'Monthly income',
        value: income,
        format: money,
        footer: DashSparkline(values: incomeSeries, color: Dash.success),
        onTap: () => detail(DashboardStatKind.revenueSummary),
      ),
      DashTile(
        icon: Icons.trending_down_rounded,
        accent: Dash.danger,
        label: 'Monthly expenses',
        value: expenses,
        format: money,
        footer: DashSparkline(values: expenseSeries, color: Dash.danger),
        onTap: () => context.push(AppRoutes.expenses),
      ),
      DashTile(
        icon: net >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded,
        accent: net >= 0 ? Dash.indigo : Dash.danger,
        label: 'Net profit',
        value: net,
        format: money,
        footer: DashSparkline(
          values: [
            for (var i = 0; i < incomeSeries.length; i++)
              incomeSeries[i] -
                  (i < expenseSeries.length ? expenseSeries[i] : 0),
          ],
          color: Dash.indigo,
        ),
      ),
      DashTile(
        icon: Icons.schedule_rounded,
        accent: Dash.danger,
        label: 'Outstanding',
        value: k.outstandingPayments,
        format: money,
        onTap: () => detail(DashboardStatKind.pendingPayments),
      ),
    ];

    return Column(
      children: [
        for (var i = 0; i < tiles.length; i += 2) ...[
          if (i > 0) const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: tiles[i]),
                const SizedBox(width: 10),
                Expanded(child: tiles[i + 1]),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.color, this.label);

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppText.body(size: 11, color: AppColors.inkSoft),
          ),
        ],
      );
}

/// Income vs expenses for the selected range (web `MoneyChartPanel`).
class DashMoneyPanel extends StatelessWidget {
  const DashMoneyPanel({super.key, required this.revenue});

  final List<RevenueTrendPoint> revenue;

  @override
  Widget build(BuildContext context) {
    final income = revenue.fold<double>(0, (s, p) => s + p.income);
    final expenses = revenue.fold<double>(0, (s, p) => s + p.expenses);
    final net = income - expenses;
    final netColor = net >= 0 ? Dash.success : Dash.danger;
    return DashPanel(
      icon: Icons.account_balance_wallet_rounded,
      accent: Dash.success,
      title: 'Income vs expenses',
      chip: 'Net ${net >= 0 ? '+' : '-'}${_money(net.abs())}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: DashSumTile(
                  value: _money(income),
                  label: 'Income',
                  color: Dash.success,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DashSumTile(
                  value: _money(expenses),
                  label: 'Expenses',
                  color: Dash.danger,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DashSumTile(
                  value: _money(net),
                  label: 'Net profit',
                  color: net >= 0 ? Dash.indigo : netColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _Legend(Dash.success, 'Income'),
              const SizedBox(width: 16),
              _Legend(Dash.danger, 'Expenses'),
            ],
          ),
          const SizedBox(height: 10),
          TrendChart(
            values: revenue.map((p) => p.income).toList(),
            secondValues: revenue.map((p) => p.expenses).toList(),
            secondColor: Dash.danger,
            dateLabels: _labels(revenue.map((p) => p.date)),
            color: Dash.success,
          ),
        ],
      ),
    );
  }
}

/// Active / expiring / inactive ring plus "New this month" and "Active
/// share" bars (web `MembersPanel`, `reports:view`).
class DashMembersPanel extends StatelessWidget {
  const DashMembersPanel({super.key, required this.kpis});

  final DashboardKpis kpis;

  @override
  Widget build(BuildContext context) {
    final total = kpis.totalMembers;
    final expiring = kpis.expiringMemberships.clamp(0, kpis.activeMembers);
    final activeOnly = (kpis.activeMembers - expiring).clamp(0, 1 << 30);
    final inactive = kpis.inactiveMembers;
    double frac(num n) => total > 0 ? n / total : 0.0;
    final rows = [
      (Dash.indigo, 'Active', activeOnly),
      (Dash.warning, 'Expiring in 30 days', expiring),
      (Dash.danger, 'Inactive', inactive),
    ];

    Widget bar(String label, String right, double pct, Color c) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
                Text(
                  right,
                  style: AppText.tabular(size: 12, color: AppColors.inkFaint),
                ),
              ],
            ),
            const SizedBox(height: 6),
            DashProgress(percent: pct, color: c),
          ],
        );

    return DashPanel(
      icon: Icons.groups_rounded,
      accent: Dash.indigo,
      title: 'Members',
      chip: '$total total',
      child: Column(
        children: [
          Row(
            children: [
              DashRing(
                size: 128,
                thickness: 18,
                segments: [frac(activeOnly), frac(expiring), frac(inactive)],
                colors: [Dash.indigo, Dash.warning, Dash.danger],
                semanticLabel: '${kpis.activeMembers} active of $total members',
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${kpis.activeMembers}',
                      style: AppText.display(size: 26),
                    ),
                    Text(
                      'active',
                      style: AppText.body(size: 10.5, color: AppColors.inkFaint),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  children: [
                    for (final r in rows)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Row(
                          children: [
                            Container(
                              width: 9,
                              height: 9,
                              decoration: BoxDecoration(
                                color: r.$1,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                            const SizedBox(width: 7),
                            Expanded(
                              child: Text(
                                r.$2,
                                style: AppText.body(size: 12),
                              ),
                            ),
                            Text(
                              '${r.$3}',
                              style: AppText.tabular(size: 12.5),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          bar(
            'New this month',
            '+${kpis.newMembersThisMonth}',
            total > 0 ? kpis.newMembersThisMonth / total * 100 : 0,
            Dash.violet,
          ),
          const SizedBox(height: 12),
          bar(
            'Active share',
            '${(frac(kpis.activeMembers) * 100).round()}%',
            frac(kpis.activeMembers) * 100,
            Dash.success,
          ),
        ],
      ),
    );
  }
}

class DashAttendancePanel extends StatelessWidget {
  const DashAttendancePanel({
    super.key,
    required this.points,
    required this.days,
  });

  final List<TrendPoint> points;
  final int days;

  @override
  Widget build(BuildContext context) {
    final total = points.fold<int>(0, (s, p) => s + p.value);
    return DashPanel(
      icon: Icons.monitor_heart_outlined,
      accent: Dash.aqua,
      title: 'Attendance',
      chip: 'Avg ${(total / days).round()} / day',
      child: TrendChart(
        values: points.map((p) => p.value.toDouble()).toList(),
        dateLabels: _labels(points.map((p) => p.date)),
        color: Dash.aqua,
      ),
    );
  }
}

class DashNewMembersPanel extends StatelessWidget {
  const DashNewMembersPanel({super.key, required this.points});

  final List<TrendPoint> points;

  @override
  Widget build(BuildContext context) {
    final total = points.fold<int>(0, (s, p) => s + p.value);
    return DashPanel(
      icon: Icons.person_add_alt_1_rounded,
      accent: Dash.violet,
      title: 'New members',
      chip: '$total joined',
      child: TrendChart(
        values: points.map((p) => p.value.toDouble()).toList(),
        dateLabels: _labels(points.map((p) => p.date)),
        color: Dash.violet,
        type: TrendChartType.bar,
      ),
    );
  }
}

class DashExpiringPanel extends StatelessWidget {
  const DashExpiringPanel({super.key, required this.rows});

  final List<ExpiringMembershipRow> rows;

  @override
  Widget build(BuildContext context) {
    return DashPanel(
      icon: Icons.schedule_rounded,
      accent: Dash.warning,
      title: 'Expiring memberships',
      trailing: GestureDetector(
        onTap: () => context.push(AppRoutes.expiringMembershipsReport),
        child: Text(
          'View all',
          style: AppText.body(
            size: 12,
            weight: FontWeight.w800,
            color: Dash.warning,
          ),
        ),
      ),
      child: rows.isEmpty
          ? const DashEmpty('Nothing expiring soon', icon: Icons.schedule_rounded)
          : Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  DashRow(
                    last: i == rows.length - 1,
                    leading: DashAvatar(rows[i].name, index: i),
                    title: rows[i].name,
                    subtitle:
                        '${rows[i].plan} · ${_ends(rows[i].daysRemaining)}',
                    trailing: DashChip(
                      '${rows[i].daysRemaining}d',
                      color: rows[i].daysRemaining <= 3
                          ? Dash.danger
                          : Dash.warning,
                    ),
                  ),
              ],
            ),
    );
  }

  static String _ends(int d) => d <= 0
      ? 'ends today'
      : d == 1
          ? 'ends tomorrow'
          : 'ends in $d days';
}

class DashOutstandingPanel extends StatelessWidget {
  const DashOutstandingPanel({super.key, required this.invoices});

  final List<MemberInvoice> invoices;

  @override
  Widget build(BuildContext context) {
    final total =
        invoices.fold<double>(0, (s, i) => s + (i.totalAmount));
    final today = DateTime.now();
    final startOfToday = DateTime(today.year, today.month, today.day);
    String date(DateTime d) => '${d.day}/${d.month}/${d.year}';
    return DashPanel(
      icon: Icons.account_balance_wallet_rounded,
      accent: Dash.danger,
      title: 'Outstanding payments',
      chip: _money(total),
      child: invoices.isEmpty
          ? const DashEmpty('Nothing outstanding', icon: Icons.credit_card_rounded)
          : Column(
              children: [
                for (var i = 0; i < invoices.length; i++)
                  InkWell(
                    onTap: () => context.push(
                      AppRoutes.memberDetail,
                      extra: invoices[i].member.id,
                    ),
                    child: DashRow(
                      last: i == invoices.length - 1,
                      leading: DashAvatar(
                        invoices[i].member.name,
                        index: i + 2,
                      ),
                      title: invoices[i].member.name,
                      subtitle: '${invoices[i].invoiceNumber} · '
                          '${(invoices[i].status == 'OVERDUE' || (invoices[i].dueDate).isBefore(startOfToday)) ? 'overdue since' : 'due'} '
                          '${date(invoices[i].dueDate)}',
                      trailing: Text(
                        _money(invoices[i].totalAmount),
                        style: AppText.tabular(size: 13, color: Dash.danger),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class DashActivityPanel extends StatelessWidget {
  const DashActivityPanel({super.key, required this.items});

  final List<RecentActivity> items;

  @override
  Widget build(BuildContext context) {
    final shown = items.take(6).toList();
    return DashPanel(
      icon: Icons.bolt_rounded,
      accent: Dash.indigo,
      title: 'Live activity',
      child: shown.isEmpty
          ? const DashEmpty('No recent activity', icon: Icons.bolt_rounded)
          : Column(
              children: [
                for (var i = 0; i < shown.length; i++)
                  DashRow(
                    last: i == shown.length - 1,
                    leading: _activityIcon(shown[i].type),
                    title: shown[i].label,
                    subtitle:
                        '${shown[i].detail} · ${Formatters.relativeTime(shown[i].occurredAt)}',
                  ),
              ],
            ),
    );
  }

  static Widget _activityIcon(RecentActivityType t) => switch (t) {
        RecentActivityType.payment =>
          DashIconChip(Icons.account_balance_wallet_rounded, color: Dash.success, size: 34),
        RecentActivityType.checkIn =>
          DashIconChip(Icons.how_to_reg_rounded, color: Dash.aqua, size: 34),
        RecentActivityType.newMember =>
          DashIconChip(Icons.person_add_alt_1_rounded, color: Dash.violet, size: 34),
      };
}

class DashBranchPanel extends StatelessWidget {
  const DashBranchPanel({super.key, required this.rows});

  final List<BranchComparisonRow> rows;

  @override
  Widget build(BuildContext context) {
    final tones = [Dash.indigo, Dash.violet, Dash.aqua, Dash.warning, Dash.success];
    final maxRevenue = rows.fold<double>(
      1,
      (m, r) => (r.revenue) > m ? r.revenue : m,
    );
    return DashPanel(
      icon: Icons.storefront_outlined,
      accent: Dash.indigo,
      title: 'Branch comparison',
      chip: 'This month',
      child: rows.isEmpty
          ? const DashEmpty('No branch data yet.')
          : Column(
              children: [
                for (var i = 0; i < rows.length; i++)
                  Padding(
                    padding: EdgeInsets.only(bottom: i == rows.length - 1 ? 0 : 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                rows[i].branch,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 13,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                            Text(
                              '${rows[i].members} members · ${rows[i].attendance} visits',
                              style: AppText.body(
                                size: 11,
                                color: AppColors.inkFaint,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        DashProgress(
                          percent: (rows[i].revenue) / maxRevenue * 100,
                          color: tones[i % tones.length],
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerRight,
                          child: Text(
                            'Revenue ${_money(rows[i].revenue)}',
                            style: AppText.body(
                              size: 11,
                              color: AppColors.inkFaint,
                            ),
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

class DashStaffPanel extends StatelessWidget {
  const DashStaffPanel({super.key, required this.kpis, required this.trainers});

  final DashboardKpis kpis;
  final List<TrainerPerformanceRow> trainers;

  @override
  Widget build(BuildContext context) {
    return DashPanel(
      icon: Icons.verified_user_outlined,
      accent: Dash.violet,
      title: 'Staff',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: DashSumTile(
                  value: '${kpis.totalStaff}',
                  label: 'Total staff',
                  color: Dash.violet,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DashSumTile(
                  value: '${kpis.activeTrainers}',
                  label: 'Active trainers',
                  color: Dash.aqua,
                ),
              ),
            ],
          ),
          if (trainers.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('TRAINER LOAD', style: AppText.eyebrow()),
            for (var i = 0; i < trainers.length; i++)
              DashRow(
                last: i == trainers.length - 1,
                leading: DashAvatar(trainers[i].name, index: i, size: 30),
                title: trainers[i].name,
                subtitle: '${trainers[i].assignedMembers} clients',
              ),
          ],
        ],
      ),
    );
  }
}

class DashHealthPanel extends StatelessWidget {
  const DashHealthPanel({
    super.key,
    required this.kpis,
    required this.collection,
  });

  final DashboardKpis kpis;
  final List<RevenueTrendPoint> collection;

  @override
  Widget build(BuildContext context) {
    final collected = collection.fold<double>(0, (s, p) => s + p.income);
    final invoiced = collection.fold<double>(0, (s, p) => s + p.expenses);
    final rate = invoiced > 0
        ? (collected / invoiced * 100).clamp(0, 100).toDouble()
        : (collected > 0 ? 100.0 : 0.0);
    final active = kpis.totalMembers > 0
        ? kpis.activeMembers / kpis.totalMembers * 100
        : 0.0;

    Widget ring(double pct, String label, Color c) => Column(
          children: [
            DashRing(
              size: 96,
              thickness: 12,
              segments: [pct / 100],
              colors: [c],
              semanticLabel: '$label ${pct.round()} percent',
              child: Text(
                '${pct.round()}%',
                style: AppText.display(size: 20),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: AppText.body(size: 11.5, color: AppColors.inkSoft),
            ),
          ],
        );

    return DashPanel(
      icon: Icons.star_outline_rounded,
      accent: Dash.success,
      title: 'Collection & membership health',
      child: Row(
        children: [
          Expanded(child: ring(rate, 'Invoiced amount collected', Dash.success)),
          Expanded(child: ring(active, 'Members active', Dash.indigo)),
        ],
      ),
    );
  }
}

class DashAnnouncementsPanel extends StatelessWidget {
  const DashAnnouncementsPanel({super.key, required this.items});

  final List<PlatformAnnouncement> items;

  @override
  Widget build(BuildContext context) {
    return DashPanel(
      icon: Icons.campaign_rounded,
      accent: Dash.warning,
      title: 'Announcements',
      child: items.isEmpty
          ? const DashEmpty(
              'No announcements',
              icon: Icons.campaign_rounded,
            )
          : Column(
              children: [
                for (final a in items)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DashIconChip(Icons.campaign_rounded, color: Dash.violet),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                a.title,
                                style: AppText.body(
                                  size: 13,
                                  weight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                a.body,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 12,
                                  color: AppColors.inkSoft,
                                ),
                              ),
                              if (a.publishedAt != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  Formatters.relativeTime(
                                    a.publishedAt!,
                                  ),
                                  style: AppText.body(
                                    size: 10.5,
                                    color: AppColors.inkFaint,
                                  ),
                                ),
                              ],
                            ],
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

class DashPlanPanel extends StatelessWidget {
  const DashPlanPanel({
    super.key,
    required this.subscription,
    required this.activeBranches,
  });

  final TenantSubscription? subscription;
  final int? activeBranches;

  @override
  Widget build(BuildContext context) {
    final sub = subscription;
    final trialEnds = sub?.trialEndsAt;
    final daysLeft = trialEnds == null
        ? null
        : trialEnds.difference(DateTime.now()).inHours <= 0
            ? 0
            : (trialEnds.difference(DateTime.now()).inHours / 24).ceil();

    Widget line(String k, String v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(k, style: AppText.body(size: 13, color: AppColors.inkFaint)),
              Text(v, style: AppText.body(size: 13, weight: FontWeight.w700)),
            ],
          ),
        );

    return DashPanel(
      icon: Icons.verified_user_outlined,
      accent: Dash.aqua,
      title: 'Your plan',
      child: Column(
        children: [
          line('Plan', sub?.plan.name ?? '—'),
          line('Status', sub?.status ?? '—'),
          if (trialEnds != null)
            line(
              'Trial ends',
              '${trialEnds.day}/${trialEnds.month}/${trialEnds.year}',
            ),
          line('Active branches', activeBranches?.toString() ?? '—'),
          line('Currency', AppCurrency.code),
          if (daysLeft != null) ...[
            const SizedBox(height: 8),
            DashProgress(
              percent: (100 - daysLeft / 14 * 100).clamp(0, 100).toDouble(),
              color: Dash.aqua,
            ),
            const SizedBox(height: 4),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '$daysLeft ${daysLeft == 1 ? 'day' : 'days'} left in your trial',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
