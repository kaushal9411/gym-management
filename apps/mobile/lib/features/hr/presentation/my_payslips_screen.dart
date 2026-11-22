import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/export/export_sink.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/hr_payroll.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/motion.dart';
import '../../../models/hr_enums.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hr_palette.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// Route argument of the payslip detail.
class HrPayslipArgs {
  const HrPayslipArgs({
    required this.id,
    required this.month,
    this.admin = false,
    this.onPay,
  });

  final String id;

  /// `YYYY-MM` (hero title while the full payslip loads).
  final String month;

  /// `true` reads `/hr/payroll/payslips/:id` (HR) instead of `/hr/me/...`.
  final bool admin;

  /// HR only: shows "Mark as paid" (payslip is DRAFT and its run APPROVED).
  /// Runs the pay flow and returns the paid payslip (or null if cancelled).
  final Future<HrPayslip?> Function()? onPay;
}

/// Net pay, month and status of a payslip (My HR + both payslip lists).
class HrPayslipTile extends StatelessWidget {
  const HrPayslipTile({
    super.key,
    required this.payslip,
    required this.onTap,
    this.showEmployee = false,
  });

  final HrPayslipSummary payslip;
  final VoidCallback onTap;
  final bool showEmployee;

  @override
  Widget build(BuildContext context) {
    final p = payslip;
    final color = HrPalette.payslip(p.status);
    return Semantics(
      button: true,
      label: '${hrMonthLabelFromKey(p.month)} payslip, net '
          '${Formatters.currency(p.netPay)}, ${p.status.label}',
      excludeSemantics: true,
      child: HrCard(
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
              child: Icon(Icons.receipt_long_rounded, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    showEmployee && p.employee != null
                        ? p.employee!.name
                        : hrMonthLabelFromKey(p.month),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 15),
                  ),
                  Text(
                    showEmployee
                        ? hrMonthLabelFromKey(p.month)
                        : 'Gross ${Formatters.currency(p.grossEarnings)} · '
                            'Deductions '
                            '${Formatters.currency(p.totalDeductions)}',
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
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  Formatters.currency(p.netPay),
                  style: AppText.display(size: 16, color: color),
                ),
                const SizedBox(height: 4),
                HrChip(label: p.status.label, color: color, dense: true),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// **My payslips** - `GET /hr/me/payslips` (`hr:self_payslip`). The API only
/// returns payslips whose payroll run is APPROVED or PAID, so a draft run
/// never leaks to employees.
class MyPayslipsScreen extends StatelessWidget {
  const MyPayslipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<HrPayslipSummary>>(
      create: (_) => PaginatedListCubit<HrPayslipSummary>(
        (page) => getIt<HrRepository>().myPayslips(page: page),
      )..load(),
      child: const _MyPayslipsView(),
    );
  }
}

class _MyPayslipsView extends StatelessWidget {
  const _MyPayslipsView();

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<PaginatedListCubit<HrPayslipSummary>>();
    return BlocBuilder<PaginatedListCubit<HrPayslipSummary>,
        PaginatedListState<HrPayslipSummary>>(
      builder: (context, state) {
        final loaded = state is PaginatedListLoaded<HrPayslipSummary>
            ? state.items
            : const <HrPayslipSummary>[];
        final paid = loaded.where((p) => p.isPaid).length;
        return HrPage(
          title: 'My payslips',
          subtitle: 'Salary slips released by HR',
          onRefresh: cubit.load,
          chips: [
            if (loaded.isNotEmpty) ...[
              ListHeroChip(
                icon: Icons.receipt_long_rounded,
                label: '${loaded.length} payslips',
              ),
              ListHeroChip(
                icon: Icons.verified_rounded,
                label: '$paid paid',
              ),
            ],
          ],
          slivers: hrPagedSlivers<HrPayslipSummary>(
            context,
            state,
            cubit: cubit,
            emptyTitle: 'No payslips yet',
            emptyMessage:
                'Your payslip appears here once HR approves the month\'s '
                'payroll.',
            emptyIcon: Icons.receipt_long_outlined,
            skeletonHeight: 76,
            itemBuilder: (context, p, i) => HrPayslipTile(
              payslip: p,
              onTap: () => context.push(
                AppRoutes.hrPayslipDetail,
                extra: HrPayslipArgs(id: p.id, month: p.month),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Payslip detail - used for the employee's own payslip (`/hr/me/payslips/:id`)
/// and, with [HrPayslipArgs.admin], for HR (`/hr/payroll/payslips/:id`).
///
/// The money block mirrors the contract's formula (§9): base + allowances -
/// attendance deduction + overtime + bonus = gross; fixed + extra deductions
/// + late penalty + advance recovery = deductions; net = gross - deductions.
/// "Download PDF" fetches the server-rendered PDF and opens the share sheet.
class PayslipDetailScreen extends StatefulWidget {
  const PayslipDetailScreen({super.key, required this.args});

  final HrPayslipArgs args;

  @override
  State<PayslipDetailScreen> createState() => _PayslipDetailScreenState();
}

class _PayslipDetailScreenState extends State<PayslipDetailScreen> {
  HrPayslip? _p;
  String? _error;
  bool _loading = true;
  bool _pdfBusy = false;
  bool _paying = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final repo = getIt<HrRepository>();
      final p = widget.args.admin
          ? await repo.payrollPayslip(widget.args.id)
          : await repo.myPayslip(widget.args.id);
      if (!mounted) return;
      setState(() {
        _p = p;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && _p == null) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pdf() async {
    final p = _p;
    if (p == null || _pdfBusy) return;
    setState(() => _pdfBusy = true);
    try {
      final repo = getIt<HrRepository>();
      final file = widget.args.admin
          ? await repo.payrollPayslipPdf(p.id, month: p.month)
          : await repo.myPayslipPdf(p.id, month: p.month);
      await getIt<ExportSink>().share(file);
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.message, error: true);
    } catch (_) {
      if (mounted) hrSnack(context, 'Could not open the PDF.', error: true);
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  Future<void> _pay() async {
    final onPay = widget.args.onPay;
    if (onPay == null || _paying) return;
    setState(() => _paying = true);
    try {
      final paid = await onPay();
      if (paid != null && mounted) setState(() => _p = paid);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _p;
    final month = hrMonthLabelFromKey(p?.month ?? widget.args.month);
    final color = p == null ? HrPalette.money : HrPalette.payslip(p.status);
    return HrPage(
      title: month,
      subtitle: p?.summary.employee?.name ?? 'Payslip',
      onRefresh: () => _load(silent: true),
      chips: [
        if (p != null)
          ListHeroChip(
            icon: p.status == PayslipStatus.paid
                ? Icons.verified_rounded
                : Icons.hourglass_top_rounded,
            label: p.status.label,
          ),
        if (p != null)
          ListHeroChip(
            icon: Icons.payments_rounded,
            label: Formatters.currency(p.netPay),
          ),
      ],
      trailing: [
        if (p != null)
          ListHeroButton(
            icon: Icons.picture_as_pdf_rounded,
            onTap: _pdfBusy ? null : _pdf,
          ),
      ],
      slivers: [
        if (_loading && p == null)
          const SliverToBoxAdapter(child: HrSkeletonList(count: 3, height: 140))
        else if (_error != null && p == null)
          SliverToBoxAdapter(
            child: AppErrorView(message: _error!, onRetry: _load),
          )
        else if (p != null)
          SliverList.list(
            children: [
              _NetCard(p: p, color: color),
              const SizedBox(height: 14),
              _AttendanceBreakdown(p: p),
              const SizedBox(height: 14),
              _MoneyBlock(p: p),
              if (p.notes.isNotEmpty) ...[
                const SizedBox(height: 14),
                for (final n in p.notes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: HrRemark(remark: n, color: HrPalette.late),
                  ),
              ],
              if (p.status == PayslipStatus.paid) ...[
                const SizedBox(height: 14),
                _PaidBlock(p: p),
              ],
              const SizedBox(height: 18),
              if (widget.args.onPay != null && p.status == PayslipStatus.draft)
                TeamGradientButton(
                  label: 'Mark as paid',
                  icon: Icons.payments_rounded,
                  loading: _paying,
                  gradient: const LinearGradient(
                    colors: [HrPalette.paid, HrPalette.money],
                  ),
                  onTap: _pay,
                ),
              if (widget.args.onPay != null && p.status == PayslipStatus.draft)
                const SizedBox(height: 10),
              TeamGradientButton(
                label: 'Download PDF',
                icon: Icons.picture_as_pdf_rounded,
                loading: _pdfBusy,
                gradient: TeamColors.cta,
                onTap: _pdf,
              ),
            ],
          ),
      ],
    );
  }
}

class _NetCard extends StatelessWidget {
  const _NetCard({required this.p, required this.color});

  final HrPayslip p;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return FadeUp(
      index: 0,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              color.withValues(alpha: 0.28),
              color.withValues(alpha: 0.06),
            ],
          ),
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('NET PAY', style: AppText.eyebrow()),
            const SizedBox(height: 4),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: p.netPay),
              duration: reduceMotion(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 1100),
              curve: Curves.easeOutCubic,
              builder: (context, v, _) => Text(
                Formatters.currency(v),
                style: AppText.display(size: 34, color: color),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _Mini('Gross', Formatters.currency(p.grossEarnings)),
                const SizedBox(width: 18),
                _Mini('Deductions', Formatters.currency(p.totalDeductions)),
                const SizedBox(width: 18),
                _Mini('Daily rate', Formatters.currency(p.dailyRate)),
              ],
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
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w800)),
        ],
      );
}

class _AttendanceBreakdown extends StatelessWidget {
  const _AttendanceBreakdown({required this.p});

  final HrPayslip p;

  @override
  Widget build(BuildContext context) {
    final items = <(String, String, Color)>[
      ('Working days', hrDays(p.workingDays), AppColors.inkSoft),
      ('Present', hrDays(p.presentDays), HrPalette.present),
      ('Half days', hrDays(p.halfDays), HrPalette.halfDay),
      ('Paid leave', hrDays(p.paidLeaveDays), HrPalette.onLeave),
      ('Unpaid leave', hrDays(p.unpaidLeaveDays), HrPalette.cancelled),
      ('Absent', hrDays(p.absentDays), HrPalette.absent),
      ('Holidays', hrDays(p.holidayDays), HrPalette.holiday),
      ('Weekly offs', hrDays(p.weeklyOffDays), HrPalette.weeklyOff),
      ('Late marks', '${p.lateCount}', HrPalette.late),
    ];
    return HrCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('How the month was counted', style: AppText.display(size: 15)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final i in items)
                Container(
                  width: 98,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: i.$3.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        i.$2,
                        style: AppText.display(size: 18, color: i.$3),
                      ),
                      Text(
                        i.$1,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 10.5,
                          weight: FontWeight.w700,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          if (p.unpaidDays > 0) ...[
            const SizedBox(height: 10),
            Text(
              '${hrDays(p.unpaidDays)} unpaid day'
              '${p.unpaidDays == 1 ? '' : 's'} at '
              '${Formatters.currency(p.dailyRate)} per day.',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _MoneyBlock extends StatelessWidget {
  const _MoneyBlock({required this.p});

  final HrPayslip p;

  @override
  Widget build(BuildContext context) {
    final allowanceLines = p.lines.where((l) => l.isAllowance).toList();
    final deductionLines = p.lines.where((l) => !l.isAllowance).toList();
    return Column(
      children: [
        HrCard(
          child: Column(
            children: [
              _Section('Earnings', HrPalette.paid),
              _Row('Base salary', p.baseSalary),
              if (allowanceLines.isNotEmpty)
                for (final l in allowanceLines) _Row(l.name, l.amount)
              else ...[
                if (p.fixedAllowances > 0)
                  _Row('Fixed allowances', p.fixedAllowances),
                if (p.extraAllowances > 0)
                  _Row('Extra allowances', p.extraAllowances),
              ],
              if (p.overtimePay > 0) _Row('Overtime pay', p.overtimePay),
              if (p.bonus > 0) _Row('Bonus', p.bonus),
              if (p.attendanceDeduction > 0)
                _Row(
                  'Attendance deduction',
                  -p.attendanceDeduction,
                  color: HrPalette.absent,
                ),
              const Divider(height: 18),
              _Row('Gross earnings', p.grossEarnings, bold: true),
            ],
          ),
        ),
        const SizedBox(height: 14),
        HrCard(
          child: Column(
            children: [
              _Section('Deductions', HrPalette.absent),
              if (deductionLines.isNotEmpty)
                for (final l in deductionLines) _Row(l.name, l.amount)
              else ...[
                if (p.fixedDeductions > 0)
                  _Row('Fixed deductions', p.fixedDeductions),
                if (p.extraDeductions > 0)
                  _Row('Other deductions', p.extraDeductions),
              ],
              if (p.latePenalty > 0) _Row('Late penalty', p.latePenalty),
              if (p.advanceRecovery > 0)
                _Row('Advance recovery', p.advanceRecovery),
              if (p.totalDeductions == 0)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'No deductions this month',
                      style: AppText.body(
                        size: 12.5,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ),
              const Divider(height: 18),
              _Row('Total deductions', p.totalDeductions, bold: true),
            ],
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section(this.title, this.color);

  final String title;
  final Color color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(title, style: AppText.display(size: 15)),
          ],
        ),
      );
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.amount, {this.bold = false, this.color});

  final String label;
  final double amount;
  final bool bold;
  final Color? color;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppText.body(
                  size: 13,
                  weight: bold ? FontWeight.w800 : FontWeight.w600,
                  color: bold ? null : AppColors.inkSoft,
                ),
              ),
            ),
            Text(
              Formatters.currency(amount),
              style: AppText.tabular(
                size: 13.5,
                weight: bold ? FontWeight.w900 : FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      );
}

class _PaidBlock extends StatelessWidget {
  const _PaidBlock({required this.p});

  final HrPayslip p;

  @override
  Widget build(BuildContext context) {
    return HrCard(
      accent: HrPalette.paid,
      child: Column(
        children: [
          HrInfoRow(
            label: 'Paid on',
            value: p.paidOn != null
                ? hrDateY(p.paidOn!)
                : (p.summary.paidAt != null
                    ? hrDateY(hrToIst(p.summary.paidAt!))
                    : '–'),
            icon: Icons.event_available_rounded,
          ),
          HrInfoRow(
            label: 'Payment mode',
            value: p.summary.paymentMode?.label ?? '–',
            icon: Icons.account_balance_wallet_rounded,
          ),
          if (p.paidBy != null)
            HrInfoRow(
              label: 'Paid by',
              value: p.paidBy!.name,
              icon: Icons.person_rounded,
            ),
          if (p.paidRemark != null && p.paidRemark!.isNotEmpty)
            HrInfoRow(
              label: 'Note',
              value: p.paidRemark!,
              icon: Icons.notes_rounded,
            ),
        ],
      ),
    );
  }
}
