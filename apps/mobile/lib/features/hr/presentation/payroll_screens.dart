import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_payroll.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hr_palette.dart';
import 'my_payslips_screen.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// Route argument of the payroll run screen.
class HrPayrollRunArgs {
  const HrPayrollRunArgs({required this.id, required this.month});

  final String id;

  /// `YYYY-MM` (hero title while the run loads).
  final String month;
}

/// **Payroll** - `GET /hr/payroll/runs` (`hr:payroll_manage`): one card per
/// month with its status, net total and a paid-payslips progress bar.
///
/// **Scope (mobile = web parity, design-only extras: none):** mobile reads
/// payroll and records payments (mark one payslip paid, pay all) - the actions
/// that happen away from a desk. Generating a run, recalculating, deleting a
/// draft, approving it, editing payslip lines / bonus / advance recovery and
/// editing pay structures stay on the web, where the numbers can be reviewed.
class PayrollScreen extends StatelessWidget {
  const PayrollScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<HrPayrollRun>>(
      create: (_) => PaginatedListCubit<HrPayrollRun>(
        (page) => getIt<HrRepository>().payrollRuns(page: page),
      )..load(),
      child: const _PayrollView(),
    );
  }
}

class _PayrollView extends StatelessWidget {
  const _PayrollView();

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<PaginatedListCubit<HrPayrollRun>>();
    return BlocBuilder<PaginatedListCubit<HrPayrollRun>,
        PaginatedListState<HrPayrollRun>>(
      builder: (context, state) {
        final runs = state is PaginatedListLoaded<HrPayrollRun>
            ? state.items
            : const <HrPayrollRun>[];
        final latest = runs.isEmpty ? null : runs.first;
        return HrPage(
          title: 'Payroll',
          subtitle: 'Monthly salary runs',
          onRefresh: cubit.load,
          chips: [
            if (latest != null) ...[
              ListHeroChip(
                icon: Icons.calendar_month_rounded,
                label: hrMonthLabelFromKey(latest.month),
              ),
              ListHeroChip(
                icon: Icons.payments_rounded,
                label: Formatters.currency(latest.totalNet),
              ),
            ],
          ],
          slivers: hrPagedSlivers<HrPayrollRun>(
            context,
            state,
            cubit: cubit,
            emptyTitle: 'No payroll runs yet',
            emptyMessage: 'Generate a month\'s payroll on the web; it shows '
                'up here to review and pay.',
            emptyIcon: Icons.payments_outlined,
            skeletonHeight: 120,
            itemBuilder: (context, r, i) => _RunCard(
              run: r,
              onTap: () async {
                await context.push<void>(
                  AppRoutes.hrPayrollRun,
                  extra: HrPayrollRunArgs(id: r.id, month: r.month),
                );
                if (context.mounted) cubit.load();
              },
            ),
          ),
        );
      },
    );
  }
}

class _RunCard extends StatelessWidget {
  const _RunCard({required this.run, required this.onTap});

  final HrPayrollRun run;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.payrollRun(run.status);
    return Semantics(
      button: true,
      label: '${hrMonthLabelFromKey(run.month)} payroll, ${run.status.label}, '
          'net ${Formatters.currency(run.totalNet)}, '
          '${run.paidCount} of ${run.employeeCount} paid',
      excludeSemantics: true,
      child: HrCard(
        accent: c,
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    hrMonthLabelFromKey(run.month),
                    style: AppText.display(size: 17),
                  ),
                ),
                HrChip(label: run.status.label, color: c),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              Formatters.currency(run.totalNet),
              style: AppText.display(size: 26, color: c),
            ),
            Text(
              'net payable · ${run.employeeCount} employees',
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 12),
            GrowBar(
              ratio: run.paidFraction,
              colors: [c.withValues(alpha: 0.6), c],
              height: 8,
              track: c.withValues(alpha: 0.15),
            ),
            const SizedBox(height: 6),
            Text(
              '${run.paidCount} of ${run.employeeCount} paid · '
              '${Formatters.currency(run.paidAmount)}',
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// One run: totals, a paid-progress ring, and every payslip with its status.
/// While the run is APPROVED each unpaid payslip has a **Pay** button (payment
/// mode + paid-on date + note; the server creates the salary expense) and
/// **Pay all unpaid** settles the rest in one go. A DRAFT run is read-only
/// here (approve it on the web first); a PAID run is just the record.
class PayrollRunScreen extends StatefulWidget {
  const PayrollRunScreen({super.key, required this.args});

  final HrPayrollRunArgs args;

  @override
  State<PayrollRunScreen> createState() => _PayrollRunScreenState();
}

class _PayrollRunScreenState extends State<PayrollRunScreen> {
  HrPayrollRunDetail? _d;
  String? _error;
  bool _loading = true;
  bool _payingAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final d = await getIt<HrRepository>().payrollRun(widget.args.id);
      if (!mounted) return;
      setState(() {
        _d = d;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && _d == null) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Pay flow for one payslip; returns the paid payslip (null = cancelled or
  /// failed - the error is already on screen).
  Future<HrPayslip?> _pay(HrPayslip p) async {
    final input = await showPaySheet(
      context,
      title: 'Pay ${p.summary.employee?.name ?? 'employee'}',
      subtitle: '${hrMonthLabelFromKey(p.month)} salary',
      amount: p.netPay,
    );
    if (input == null || !mounted) return null;
    try {
      final paid = await getIt<HrRepository>().payPayslip(
        p.id,
        mode: input.mode,
        paidOn: input.paidOn,
        remark: input.remark,
      );
      if (!mounted) return paid;
      HapticFeedback.mediumImpact();
      hrSnack(
        context,
        '${p.summary.employee?.name ?? 'Payslip'} paid '
        '${Formatters.currency(p.netPay)}',
      );
      _load(silent: true);
      return paid;
    } on ApiException catch (e) {
      if (mounted) {
        hrSnack(context, e.detailedMessage, error: true);
        // ALREADY_PAID / INVALID_STATE mean our copy is stale.
        _load(silent: true);
      }
      return null;
    }
  }

  Future<void> _payAll() async {
    final d = _d;
    if (d == null) return;
    final unpaid = d.payslips.where((p) => p.status == PayslipStatus.draft);
    final total = unpaid.fold<double>(0, (s, p) => s + p.netPay);
    final input = await showPaySheet(
      context,
      title: 'Pay all unpaid',
      subtitle:
          '${unpaid.length} payslips · ${hrMonthLabelFromKey(d.run.month)}',
      amount: total,
      confirmLabel: 'Pay ${unpaid.length} payslips',
    );
    if (input == null || !mounted) return;
    setState(() => _payingAll = true);
    try {
      final r = await getIt<HrRepository>().payAll(
        d.run.id,
        mode: input.mode,
        paidOn: input.paidOn,
        remark: input.remark,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      await _showResult(r);
      _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) {
        hrSnack(context, e.detailedMessage, error: true);
        _load(silent: true);
      }
    } finally {
      if (mounted) setState(() => _payingAll = false);
    }
  }

  Future<void> _showResult(HrPayAllResult r) {
    return showTeamSheet<void>(
      context,
      (ctx) => TeamSheetScaffold(
        icon: r.failed.isEmpty
            ? Icons.check_circle_rounded
            : Icons.warning_amber_rounded,
        color: r.failed.isEmpty ? HrPalette.paid : HrPalette.late,
        title: r.failed.isEmpty ? 'All paid' : 'Paid with problems',
        subtitle: '${r.paid} paid · ${r.skipped} already paid · '
            '${r.failed.length} failed',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final f in r.failed)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: HrRemark(remark: f.$2, color: HrPalette.absent),
              ),
            if (r.failed.isEmpty)
              Text(
                'Every unpaid payslip was settled and its salary expense '
                'recorded.',
                style: AppText.body(color: AppColors.inkSoft),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    final run = d?.run;
    final color =
        run == null ? HrPalette.money : HrPalette.payrollRun(run.status);
    final payable = run?.status == PayrollRunStatus.approved;
    final unpaid = d == null
        ? 0
        : d.payslips.where((p) => p.status == PayslipStatus.draft).length;
    return HrPage(
      title: hrMonthLabelFromKey(run?.month ?? widget.args.month),
      subtitle: 'Payroll run',
      onRefresh: () => _load(silent: true),
      chips: [
        if (run != null) ...[
          ListHeroChip(
            icon: Icons.flag_rounded,
            label: run.status.label,
          ),
          ListHeroChip(
            icon: Icons.verified_rounded,
            label: '${run.paidCount}/${run.employeeCount} paid',
          ),
        ],
      ],
      slivers: [
        if (_loading && d == null)
          const SliverToBoxAdapter(child: HrSkeletonList(count: 4, height: 100))
        else if (_error != null && d == null)
          SliverToBoxAdapter(
            child: AppErrorView(message: _error!, onRetry: _load),
          )
        else if (d != null && run != null)
          SliverList.list(
            children: [
              _RunSummary(run: run, color: color),
              const SizedBox(height: 14),
              if (run.status == PayrollRunStatus.draft)
                const HrRemark(
                  remark: 'This run is still a draft. Review and approve it '
                      'on the web; payments open once it is approved.',
                  color: HrPalette.draft,
                ),
              if (payable && unpaid > 0) ...[
                TeamGradientButton(
                  label: 'Pay all $unpaid unpaid',
                  icon: Icons.payments_rounded,
                  loading: _payingAll,
                  gradient: const LinearGradient(
                    colors: [HrPalette.paid, HrPalette.money],
                  ),
                  onTap: _payAll,
                ),
                const SizedBox(height: 14),
              ],
              HrSectionHeader(title: 'Payslips (${d.payslips.length})'),
              for (var i = 0; i < d.payslips.length; i++) ...[
                StaggeredCard(
                  index: i,
                  child: _PayslipRow(
                    p: d.payslips[i],
                    canPay: payable,
                    onPay: () => _pay(d.payslips[i]),
                    onOpen: () => context.push(
                      AppRoutes.hrPayslipDetail,
                      extra: HrPayslipArgs(
                        id: d.payslips[i].id,
                        month: d.payslips[i].month,
                        admin: true,
                        onPay: payable &&
                                d.payslips[i].status == PayslipStatus.draft
                            ? () => _pay(d.payslips[i])
                            : null,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ],
          ),
      ],
    );
  }
}

class _RunSummary extends StatelessWidget {
  const _RunSummary({required this.run, required this.color});

  final HrPayrollRun run;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return FadeUp(
      index: 0,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withValues(alpha: 0.26),
              color.withValues(alpha: 0.05),
            ],
          ),
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            AnimatedRing(
              value: run.paidFraction,
              size: 88,
              stroke: 10,
              colors: [color.withValues(alpha: 0.5), color],
              track: color.withValues(alpha: 0.16),
              child: Text(
                '${(run.paidFraction * 100).round()}%',
                style: AppText.display(size: 18, color: color),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('NET PAYABLE', style: AppText.eyebrow()),
                  Text(
                    Formatters.currency(run.totalNet),
                    style: AppText.display(size: 26, color: color),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 14,
                    runSpacing: 4,
                    children: [
                      _Mini('Gross', Formatters.currency(run.totalGross)),
                      _Mini(
                        'Deductions',
                        Formatters.currency(run.totalDeductions),
                      ),
                      _Mini('Paid', Formatters.currency(run.paidAmount)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
          Text(value, style: AppText.body(size: 12.5, weight: FontWeight.w800)),
        ],
      );
}

class _PayslipRow extends StatelessWidget {
  const _PayslipRow({
    required this.p,
    required this.canPay,
    required this.onPay,
    required this.onOpen,
  });

  final HrPayslip p;
  final bool canPay;
  final VoidCallback onPay;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.payslip(p.status);
    final e = p.summary.employee;
    return HrCard(
      onTap: onOpen,
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          if (e != null) ...[
            HrAvatar(employee: e, size: 40),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  e?.name ?? 'Employee',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                Text(
                  '${hrDays(p.presentDays)} present · '
                  '${hrDays(p.unpaidDays)} unpaid days',
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
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                Formatters.currency(p.netPay),
                style: AppText.display(size: 15, color: c),
              ),
              const SizedBox(height: 4),
              if (canPay && p.status == PayslipStatus.draft)
                SizedBox(
                  height: 28,
                  child: TextButton(
                    key: Key('pay-${p.id}'),
                    onPressed: onPay,
                    style: TextButton.styleFrom(
                      backgroundColor: HrPalette.paid,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(99),
                      ),
                    ),
                    child: Text(
                      'Pay',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ),
                )
              else
                HrChip(label: p.status.label, color: c, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}
