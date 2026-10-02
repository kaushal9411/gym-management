import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/attendance_summary.dart';
import '../../../../models/expiring_membership_row.dart';
import '../../../../models/gym_member.dart';
import '../../../../models/income_entry.dart';
import '../../../../models/member_invoice.dart';
import '../../../../repositories/attendance_repository.dart';
import '../../../../repositories/income_repository.dart';
import '../../../../repositories/invoice_repository.dart';
import '../../../../repositories/member_repository.dart';
import '../../../../repositories/reports_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';

/// What a KPI tile opens — mirrors web's `DashboardStatKind` 1:1 (first
/// built and verified on web, then mirrored here per the user's own
/// two-step request).
enum DashboardStatKind {
  attendance,
  activeMembers,
  expiringMemberships,
  newRegistrations,
  revenueSummary,
  pendingPayments,
}

String _titleFor(DashboardStatKind kind) => switch (kind) {
      DashboardStatKind.attendance => "Today's Attendance",
      DashboardStatKind.activeMembers => 'Active Members',
      DashboardStatKind.expiringMemberships => 'Expiring Memberships',
      DashboardStatKind.newRegistrations => 'New Members (this month)',
      DashboardStatKind.revenueSummary => 'Monthly Revenue',
      DashboardStatKind.pendingPayments => 'Outstanding Payments',
    };

/// Opens the bottom sheet showing the real records behind a dashboard KPI
/// tile. [branchId] mirrors whatever branch the KPI row itself is scoped to
/// (`DashboardCubit`'s `selectedBranchId`), so the detail list always
/// agrees with the number that was tapped.
void showDashboardDetailSheet(
  BuildContext context, {
  required DashboardStatKind kind,
  String? branchId,
}) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface2,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: (_) => _DashboardDetailSheet(kind: kind, branchId: branchId),
  );
}

class _DashboardDetailSheet extends StatelessWidget {
  const _DashboardDetailSheet({required this.kind, this.branchId});

  final DashboardStatKind kind;
  final String? branchId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titleFor(kind), style: AppText.display(size: 16)),
            const SizedBox(height: 12),
            Expanded(
              child: switch (kind) {
                DashboardStatKind.attendance => _TodayAttendanceDetail(branchId: branchId),
                DashboardStatKind.activeMembers => _ActiveMembersDetail(branchId: branchId),
                DashboardStatKind.expiringMemberships => _ExpiringMembershipsDetail(branchId: branchId),
                DashboardStatKind.newRegistrations => _NewMembersDetail(branchId: branchId),
                DashboardStatKind.revenueSummary => _MonthlyRevenueDetail(branchId: branchId),
                DashboardStatKind.pendingPayments => _OutstandingPaymentsDetail(branchId: branchId),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ViewAllLink extends StatelessWidget {
  const _ViewAllLink({required this.route});

  final String route;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {
          Navigator.of(context).pop();
          context.push(route);
        },
        child: const Text('View all →'),
      ),
    );
  }
}

String _fmtDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

String _fmtTime(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

DateTime _monthStart() {
  final now = DateTime.now();
  return DateTime(now.year, now.month, 1);
}

// ── Today's Attendance ──────────────────────────────────────────────────

class _TodayAttendanceDetail extends StatefulWidget {
  const _TodayAttendanceDetail({this.branchId});

  final String? branchId;

  @override
  State<_TodayAttendanceDetail> createState() => _TodayAttendanceDetailState();
}

class _TodayAttendanceDetailState extends State<_TodayAttendanceDetail> {
  List<AttendanceRecord>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final rows = await getIt<AttendanceRepository>().today(branchId: widget.branchId);
      if (!mounted) return;
      setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'No check-ins yet today', icon: Icons.how_to_reg_rounded);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _rows!.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
            itemBuilder: (context, i) {
              final a = _rows![i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(a.memberName, style: AppText.body(weight: FontWeight.w700)),
                subtitle: Text(
                  a.checkOutTime != null
                      ? 'In ${_fmtTime(a.checkInTime)} · Out ${_fmtTime(a.checkOutTime!)}'
                      : 'In ${_fmtTime(a.checkInTime)}',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
                trailing: Text(
                  a.checkOutTime != null ? 'Checked out' : 'Inside',
                  style: AppText.body(size: 11, weight: FontWeight.w700, color: a.checkOutTime != null ? AppColors.inkFaint : AppColors.success),
                ),
              );
            },
          ),
        ),
        _ViewAllLink(route: AppRoutes.attendanceHistory),
      ],
    );
  }
}

// ── Active Members ───────────────────────────────────────────────────────

class _ActiveMembersDetail extends StatefulWidget {
  const _ActiveMembersDetail({this.branchId});

  final String? branchId;

  @override
  State<_ActiveMembersDetail> createState() => _ActiveMembersDetailState();
}

class _ActiveMembersDetailState extends State<_ActiveMembersDetail> {
  List<GymMember>? _rows;
  int? _total;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final result = await getIt<MemberRepository>().list(
        status: 'ACTIVE',
        branchId: widget.branchId,
        limit: 20,
        sortBy: 'name',
        sortDir: 'asc',
      );
      if (!mounted) return;
      setState(() {
        _rows = result.items;
        _total = result.total;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'No active members', icon: Icons.groups_rounded);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _rows!.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
            itemBuilder: (context, i) {
              final m = _rows![i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: () {
                  Navigator.of(context).pop();
                  context.push(AppRoutes.memberDetail, extra: m);
                },
                title: Text(m.name, style: AppText.body(weight: FontWeight.w700)),
                subtitle: Text(
                  '${m.memberId} · ${m.branch.name}',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
                trailing: Text(
                  m.currentMembership?.planName ?? '—',
                  style: AppText.body(size: 12, weight: FontWeight.w600),
                ),
              );
            },
          ),
        ),
        if (_total != null && _total! > _rows!.length)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Showing ${_rows!.length} of $_total', style: AppText.body(size: 11, color: AppColors.inkFaint)),
          ),
      ],
    );
  }
}

// ── Expiring Memberships ────────────────────────────────────────────────

class _ExpiringMembershipsDetail extends StatefulWidget {
  const _ExpiringMembershipsDetail({this.branchId});

  final String? branchId;

  @override
  State<_ExpiringMembershipsDetail> createState() => _ExpiringMembershipsDetailState();
}

class _ExpiringMembershipsDetailState extends State<_ExpiringMembershipsDetail> {
  List<ExpiringMembershipRow>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final result = await getIt<ReportsRepository>().expiringMemberships(branchId: widget.branchId, limit: 20);
      if (!mounted) return;
      setState(() => _rows = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'No memberships expiring in the next 30 days', icon: Icons.event_busy_rounded);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _rows!.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
            itemBuilder: (context, i) {
              final r = _rows![i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${r.name} (${r.memberCode})', style: AppText.body(weight: FontWeight.w700)),
                subtitle: Text('${r.plan} · ends ${r.endDate}', style: AppText.body(size: 12, color: AppColors.inkFaint)),
                trailing: Text(
                  '${r.daysRemaining}d',
                  style: AppText.body(size: 12, weight: FontWeight.w700, color: r.daysRemaining <= 7 ? AppColors.danger : AppColors.warning),
                ),
              );
            },
          ),
        ),
        _ViewAllLink(route: AppRoutes.expiringMembershipsReport),
      ],
    );
  }
}

// ── New Members (this month) ────────────────────────────────────────────

class _NewMembersDetail extends StatefulWidget {
  const _NewMembersDetail({this.branchId});

  final String? branchId;

  @override
  State<_NewMembersDetail> createState() => _NewMembersDetailState();
}

class _NewMembersDetailState extends State<_NewMembersDetail> {
  List<GymMember>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final result = await getIt<MemberRepository>().list(
        branchId: widget.branchId,
        limit: 50,
        sortBy: 'createdAt',
        sortDir: 'desc',
      );
      if (!mounted) return;
      final cutoff = _monthStart();
      setState(() => _rows = result.items.where((m) => !m.createdAt.isBefore(cutoff)).toList());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'No new members yet this month', icon: Icons.person_add_alt_1_rounded);
    }
    return ListView.separated(
      itemCount: _rows!.length,
      separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
      itemBuilder: (context, i) {
        final m = _rows![i];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          onTap: () {
            Navigator.of(context).pop();
            context.push(AppRoutes.memberDetail, extra: m);
          },
          title: Text(m.name, style: AppText.body(weight: FontWeight.w700)),
          subtitle: Text('${m.memberId} · ${m.branch.name}', style: AppText.body(size: 12, color: AppColors.inkFaint)),
          trailing: Text(_fmtDate(m.createdAt), style: AppText.body(size: 12, color: AppColors.inkFaint)),
        );
      },
    );
  }
}

// ── Monthly Revenue ──────────────────────────────────────────────────────

class _MonthlyRevenueDetail extends StatefulWidget {
  const _MonthlyRevenueDetail({this.branchId});

  final String? branchId;

  @override
  State<_MonthlyRevenueDetail> createState() => _MonthlyRevenueDetailState();
}

class _MonthlyRevenueDetailState extends State<_MonthlyRevenueDetail> {
  List<IncomeEntry>? _rows;
  int? _total;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final now = DateTime.now();
      final monthStart = _monthStart();
      final result = await getIt<IncomeRepository>().list(
        limit: 20,
        branchId: widget.branchId,
        dateFrom: _fmtIso(monthStart),
        dateTo: _fmtIso(now),
      );
      if (!mounted) return;
      setState(() {
        _rows = result.items;
        _total = result.total;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  String _fmtIso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'No income recorded yet this month', icon: Icons.account_balance_wallet_rounded);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _rows!.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
            itemBuilder: (context, i) {
              final entry = _rows![i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(entry.description ?? entry.category.label, style: AppText.body(weight: FontWeight.w700)),
                subtitle: Text(_fmtDate(entry.incomeDate), style: AppText.body(size: 12, color: AppColors.inkFaint)),
                trailing: Text(
                  Formatters.currency(entry.amount),
                  style: AppText.body(size: 13, weight: FontWeight.w700, color: AppColors.success),
                ),
              );
            },
          ),
        ),
        if (_total != null && _total! > _rows!.length)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Showing ${_rows!.length} of $_total', style: AppText.body(size: 11, color: AppColors.inkFaint)),
          ),
        _ViewAllLink(route: AppRoutes.income),
      ],
    );
  }
}

// ── Outstanding Payments ─────────────────────────────────────────────────

class _OutstandingPaymentsDetail extends StatefulWidget {
  const _OutstandingPaymentsDetail({this.branchId});

  final String? branchId;

  @override
  State<_OutstandingPaymentsDetail> createState() => _OutstandingPaymentsDetailState();
}

class _OutstandingPaymentsDetailState extends State<_OutstandingPaymentsDetail> {
  List<MemberInvoice>? _rows;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  /// Mirrors the dashboard KPI's `status: { in: [...] }` query — the list
  /// endpoint only takes one status at a time, so this fires 3 small
  /// parallel requests and merges them (see web's identical approach in
  /// `dashboard-detail-modal.tsx#OutstandingPaymentsDetail`).
  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final repo = getIt<InvoiceRepository>();
      final results = await Future.wait([
        repo.list(limit: 10, branchId: widget.branchId, status: 'OVERDUE'),
        repo.list(limit: 10, branchId: widget.branchId, status: 'PARTIALLY_PAID'),
        repo.list(limit: 10, branchId: widget.branchId, status: 'UNPAID'),
      ]);
      if (!mounted) return;
      final merged = results.expand((r) => r.items).toList()
        ..sort((a, b) => a.dueDate.compareTo(b.dueDate));
      setState(() => _rows = merged);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Color _statusColor(String status) => switch (status) {
        'OVERDUE' => AppColors.danger,
        'PARTIALLY_PAID' || 'UNPAID' => AppColors.warning,
        _ => AppColors.inkFaint,
      };

  @override
  Widget build(BuildContext context) {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _load);
    if (_rows == null) return const AppLoadingView();
    if (_rows!.isEmpty) {
      return const AppEmptyState(title: 'Nothing outstanding — all invoices are settled', icon: Icons.check_circle_outline_rounded);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: _rows!.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.line),
            itemBuilder: (context, i) {
              final inv = _rows![i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${inv.invoiceNumber} · ${inv.member.name}', style: AppText.body(weight: FontWeight.w700)),
                subtitle: Text(
                  'Due ${_fmtDate(inv.dueDate)} · ${inv.status.replaceAll('_', ' ')}',
                  style: AppText.body(size: 12, color: _statusColor(inv.status)),
                ),
                trailing: Text(
                  Formatters.currency(inv.totalAmount),
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              );
            },
          ),
        ),
        _ViewAllLink(route: AppRoutes.invoices),
      ],
    );
  }
}
