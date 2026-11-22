import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/hr/hr_load_cubit.dart';
import '../../../bloc/hr/payroll_run_cubit.dart';
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
import 'widgets/hr_form_kit.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';
import 'widgets/payslip_edit_sheet.dart';

/// Route argument of the payroll run screen.
class HrPayrollRunArgs {
  const HrPayrollRunArgs({required this.id, required this.month});

  final String id;

  /// `YYYY-MM` (hero title while the run loads).
  final String month;
}

/// **Payroll** - `hr:payroll_manage`.
///
/// Pick a month (nothing after the current one) and **generate** its payroll -
/// a DRAFT payslip per employee from attendance, leave and pay structure - or,
/// when the month already has a run, open it. Below, the run history: one card
/// per month with status, net total and a paid-payslips bar. Everything after
/// generation (recalculate, edit payslips, approve, delete a draft, pay) lives
/// on the run screen.
class PayrollScreen extends StatefulWidget {
  const PayrollScreen({super.key});

  @override
  State<PayrollScreen> createState() => _PayrollScreenState();
}

class _PayrollScreenState extends State<PayrollScreen> {
  String _month = HrMonthStepper.currentKey();
  bool _generating = false;

  late final PaginatedListCubit<HrPayrollRun> _history = PaginatedListCubit(
    (page) => getIt<HrRepository>().payrollRuns(page: page),
  )..load();

  /// Every run (up to 100) - used to tell whether the picked month already
  /// has one, whatever page of the history it is on.
  late final HrLoadCubit<List<HrPayrollRun>> _all = HrLoadCubit(
    () async => (await getIt<HrRepository>().payrollRuns(limit: 100)).items,
  )..load();

  @override
  void dispose() {
    _history.close();
    _all.close();
    super.dispose();
  }

  Future<void> _reload() async {
    await _history.load();
    await _all.load(silent: true);
  }

  Future<void> _open(HrPayrollRun r) async {
    await context.push<void>(
      AppRoutes.hrPayrollRun,
      extra: HrPayrollRunArgs(id: r.id, month: r.month),
    );
    if (mounted) _reload();
  }

  Future<void> _generate() async {
    final isCurrent = _month == HrMonthStepper.currentKey();
    final input = await showTeamSheet<_GenerateInput>(
      context,
      (ctx) => TeamSheetScaffold(
        icon: Icons.auto_awesome_rounded,
        color: HrPalette.money,
        title: 'Generate ${hrMonthLabelFromKey(_month)}',
        subtitle: 'Draft payslips for every employee',
        child: _GenerateForm(provisional: isCurrent),
      ),
    );
    if (input == null || !mounted) return;
    setState(() => _generating = true);
    try {
      final d = await getIt<HrRepository>().generatePayroll(
        _month,
        notes: input.notes,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      hrSnack(
        context,
        '${hrMonthLabelFromKey(_month)} payroll generated for '
        '${d.run.employeeCount} employees',
      );
      await _open(d.run);
    } on ApiException catch (e) {
      if (mounted) {
        hrSnack(context, e.detailedMessage, error: true);
        // 409 CONFLICT = somebody generated it meanwhile: show it.
        _reload();
      }
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _history),
        BlocProvider.value(value: _all),
      ],
      child: BlocBuilder<PaginatedListCubit<HrPayrollRun>,
          PaginatedListState<HrPayrollRun>>(
        builder: (context, state) {
          final runs = state is PaginatedListLoaded<HrPayrollRun>
              ? state.items
              : const <HrPayrollRun>[];
          final latest = runs.isEmpty ? null : runs.first;
          return HrPage(
            title: 'Payroll',
            subtitle: 'Generate, approve and pay a month',
            onRefresh: _reload,
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
            slivers: [
              const SliverToBoxAdapter(
                child: HrSectionHeader(title: 'Pick a month'),
              ),
              SliverToBoxAdapter(
                child: HrMonthStepper(
                  month: _month,
                  max: HrMonthStepper.currentKey(),
                  onChanged: (m) => setState(() => _month = m),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              SliverToBoxAdapter(
                child: BlocBuilder<HrLoadCubit<List<HrPayrollRun>>,
                    HrLoadState<List<HrPayrollRun>>>(
                  builder: (context, s) => _MonthCard(
                    month: _month,
                    state: s,
                    generating: _generating,
                    onGenerate: _generate,
                    onOpen: _open,
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 18)),
              const SliverToBoxAdapter(
                child: HrSectionHeader(title: 'Payroll history'),
              ),
              ...hrPagedSlivers<HrPayrollRun>(
                context,
                state,
                cubit: _history,
                emptyTitle: 'No payroll runs yet',
                emptyMessage: 'Generate your first month above.',
                emptyIcon: Icons.payments_outlined,
                skeletonHeight: 120,
                itemBuilder: (context, r, i) =>
                    _RunCard(run: r, onTap: () => _open(r)),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _GenerateInput {
  const _GenerateInput(this.notes);

  final String? notes;
}

class _GenerateForm extends StatefulWidget {
  const _GenerateForm({required this.provisional});

  final bool provisional;

  @override
  State<_GenerateForm> createState() => _GenerateFormState();
}

class _GenerateFormState extends State<_GenerateForm> {
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'This creates a draft payslip for every employee from their '
          'attendance, leave and pay structure. You can still edit and '
          'recalculate it before approving.',
          style: AppText.body(color: AppColors.inkSoft),
        ),
        if (widget.provisional) ...[
          const SizedBox(height: 10),
          const HrRemark(
            remark: 'This month is still running, so the sheet is '
                'provisional: days after today count as paid. Recalculate '
                'while it is a draft.',
            color: HrPalette.late,
          ),
        ],
        const SizedBox(height: 12),
        TextField(
          key: const Key('generate-notes'),
          controller: _notes,
          maxLength: 300,
          minLines: 2,
          maxLines: 3,
          style: AppText.body(),
          decoration: hrFieldDecoration(
            'Internal note for this run (optional)',
            focus: HrPalette.money,
          ),
        ),
        const SizedBox(height: 10),
        TeamGradientButton(
          key: const Key('generate-confirm'),
          label: 'Generate payroll',
          icon: Icons.auto_awesome_rounded,
          gradient: const LinearGradient(
            colors: [HrPalette.paid, HrPalette.money],
          ),
          onTap: () => Navigator.of(context).pop(
            _GenerateInput(
              _notes.text.trim().isEmpty ? null : _notes.text.trim(),
            ),
          ),
        ),
      ],
    );
  }
}

class _MonthCard extends StatelessWidget {
  const _MonthCard({
    required this.month,
    required this.state,
    required this.generating,
    required this.onGenerate,
    required this.onOpen,
  });

  final String month;
  final HrLoadState<List<HrPayrollRun>> state;
  final bool generating;
  final VoidCallback onGenerate;
  final ValueChanged<HrPayrollRun> onOpen;

  @override
  Widget build(BuildContext context) {
    if (state is HrLoadLoading<List<HrPayrollRun>>) {
      return const HrShimmerBox(height: 120, radius: AppRadii.card);
    }
    final all = state is HrLoadLoaded<List<HrPayrollRun>>
        ? (state as HrLoadLoaded<List<HrPayrollRun>>).data
        : const <HrPayrollRun>[];
    HrPayrollRun? existing;
    for (final r in all) {
      if (r.month == month) existing = r;
    }
    if (existing != null) {
      final r = existing;
      final c = HrPalette.payrollRun(r.status);
      return HrCard(
        key: const Key('month-existing'),
        accent: c,
        onTap: () => onOpen(r),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${hrMonthLabelFromKey(r.month)} · ${r.status.label}',
                    style: AppText.display(size: 16),
                  ),
                  Text(
                    '${r.employeeCount} employees · net '
                    '${Formatters.currency(r.totalNet)} · ${r.paidCount} paid',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_rounded),
          ],
        ),
      );
    }
    return HrCard(
      accent: HrPalette.money,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No payroll yet for ${hrMonthLabelFromKey(month)}.',
            style: AppText.body(size: 13.5, weight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          Text(
            'Generating creates a draft payslip for every employee.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 12),
          TeamGradientButton(
            key: const Key('generate-payroll'),
            label: 'Generate ${hrMonthLabelFromKey(month)}',
            icon: Icons.auto_awesome_rounded,
            loading: generating,
            gradient: const LinearGradient(
              colors: [HrPalette.paid, HrPalette.money],
            ),
            onTap: generating ? null : onGenerate,
          ),
        ],
      ),
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

/// One run, end to end (`hr:payroll_manage`).
///
/// * **DRAFT** - totals, every payslip with **Edit** (bonus, advance recovery,
///   extra allowance / deduction lines; the server recomputes), **Recalculate**
///   (re-reads attendance / leave / pay structures, keeps manual lines),
///   **Approve run** (locks it; confirmation) and **Delete draft**
///   (confirmation).
/// * **APPROVED** - locked; **Pay** per payslip (mode, paid-on <= today, note)
///   and **Pay all unpaid**; a paid payslip links to the SALARY expense the
///   server created.
/// * **PAID** - the locked record.
///
/// State lives in [PayrollRunCubit]: no optimistic UI, totals come from the
/// API and count up when they change; a 409 (`ALREADY_PAID`, `INVALID_STATE`)
/// shows the server's message and reloads the run.
class PayrollRunScreen extends StatelessWidget {
  const PayrollRunScreen({super.key, required this.args});

  final HrPayrollRunArgs args;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PayrollRunCubit>(
      create: (_) => PayrollRunCubit(getIt<HrRepository>(), args.id)..load(),
      child: _RunView(args: args),
    );
  }
}

class _RunView extends StatelessWidget {
  const _RunView({required this.args});

  final HrPayrollRunArgs args;

  Future<void> _approve(BuildContext context, PayrollRunLoaded s) async {
    final cubit = context.read<PayrollRunCubit>();
    final ok = await hrConfirmSheet(
      context,
      title: 'Approve ${hrMonthLabelFromKey(s.run.month)} payroll?',
      message: '${s.run.employeeCount} payslip'
          '${s.run.employeeCount == 1 ? '' : 's'} totalling '
          '${Formatters.currency(s.run.totalNet)} will be locked and become '
          'visible to employees. This cannot be undone.',
      confirmLabel: 'Yes, approve and lock',
      color: HrPalette.paid,
      icon: Icons.verified_rounded,
      cancelLabel: 'Not yet',
    );
    if (ok) await cubit.approve();
  }

  Future<void> _delete(BuildContext context, PayrollRunLoaded s) async {
    final cubit = context.read<PayrollRunCubit>();
    final ok = await hrConfirmSheet(
      context,
      title: 'Delete this draft?',
      message: 'All draft payslips for ${hrMonthLabelFromKey(s.run.month)} '
          'will be removed. You can generate the month again afterwards.',
      confirmLabel: 'Delete draft',
    );
    if (ok) await cubit.deleteDraft();
  }

  Future<void> _edit(BuildContext context, HrPayslip p) async {
    final cubit = context.read<PayrollRunCubit>();
    final edit = await showPayslipEditSheet(context, payslip: p);
    if (edit != null) await cubit.savePayslip(p.id, edit);
  }

  /// Pay flow for one payslip; returns the paid payslip (`null` = cancelled
  /// or failed - the cubit already put the reason in a snackbar).
  Future<HrPayslip?> _pay(BuildContext context, HrPayslip p) async {
    final cubit = context.read<PayrollRunCubit>();
    final input = await showPaySheet(
      context,
      title: 'Pay ${p.summary.employee?.name ?? 'employee'}',
      subtitle: '${hrMonthLabelFromKey(p.month)} salary',
      amount: p.netPay,
    );
    if (input == null) return null;
    final ok = await cubit.pay(
      p,
      mode: input.mode,
      paidOn: input.paidOn,
      remark: input.remark,
    );
    if (!ok) return null;
    final s = cubit.state;
    if (s is! PayrollRunLoaded) return null;
    for (final x in s.detail.payslips) {
      if (x.id == p.id) return x;
    }
    return null;
  }

  Future<void> _payAll(BuildContext context, PayrollRunLoaded s) async {
    final cubit = context.read<PayrollRunCubit>();
    final unpaid = s.unpaid;
    final input = await showPaySheet(
      context,
      title: 'Pay all unpaid',
      subtitle: '${unpaid.length} payslips · '
          '${hrMonthLabelFromKey(s.run.month)}',
      amount: s.unpaidTotal,
      confirmLabel: 'Pay ${unpaid.length} payslips',
    );
    if (input == null) return;
    await cubit.payAll(
      mode: input.mode,
      paidOn: input.paidOn,
      remark: input.remark,
    );
  }

  void _showResult(BuildContext context, HrPayAllResult r) {
    showTeamSheet<void>(
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
    final cubit = context.read<PayrollRunCubit>();
    return BlocConsumer<PayrollRunCubit, PayrollRunState>(
      listenWhen: (a, b) {
        if (b is! PayrollRunLoaded) return false;
        if (a is! PayrollRunLoaded) return b.notice != null || b.deleted;
        return (b.notice != null && b.notice != a.notice) ||
            (b.deleted && !a.deleted) ||
            (b.payAllResult != null &&
                !identical(b.payAllResult, a.payAllResult));
      },
      listener: (context, s) {
        if (s is! PayrollRunLoaded) return;
        if (s.notice != null) {
          hrSnack(context, s.notice!, error: s.noticeIsError);
          cubit.clearNotice();
        }
        if (s.payAllResult != null) _showResult(context, s.payAllResult!);
        if (s.deleted) Navigator.of(context).maybePop();
      },
      builder: (context, state) {
        final loaded = state is PayrollRunLoaded ? state : null;
        final run = loaded?.run;
        return HrPage(
          title: hrMonthLabelFromKey(run?.month ?? args.month),
          subtitle: 'Payroll run',
          onRefresh: () => cubit.load(silent: true),
          chips: [
            if (run != null) ...[
              ListHeroChip(icon: Icons.flag_rounded, label: run.status.label),
              ListHeroChip(
                icon: Icons.verified_rounded,
                label: '${run.paidCount}/${run.employeeCount} paid',
              ),
            ],
          ],
          slivers: [
            switch (state) {
              PayrollRunLoading() => const SliverToBoxAdapter(
                  child: HrSkeletonList(count: 4, height: 100),
                ),
              PayrollRunError(:final message) => SliverToBoxAdapter(
                  child: AppErrorView(message: message, onRetry: cubit.load),
                ),
              final PayrollRunLoaded s => SliverList.list(
                  children: _body(context, s),
                ),
            },
          ],
        );
      },
    );
  }

  List<Widget> _body(BuildContext context, PayrollRunLoaded s) {
    final run = s.run;
    final color = HrPalette.payrollRun(run.status);
    final payable = s.isApproved;
    final busy = s.busy != null;
    final slips = s.detail.payslips;
    return [
      _RunSummary(run: run, color: color),
      const SizedBox(height: 14),
      if (!s.isDraft)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: HrRemark(
            key: const Key('run-locked'),
            remark: run.status == PayrollRunStatus.paid
                ? 'Paid in full - this run is locked.'
                : 'Approved'
                    '${run.approvedAt != null ? ' ${hrDateY(hrToIst(run.approvedAt!))}' : ''}'
                    '${run.approvedByName != null ? ' by ${run.approvedByName}' : ''}'
                    ' - amounts can no longer be edited.',
            color: HrPalette.paid,
          ),
        ),
      if (s.isDraft) ...[
        const HrRemark(
          remark: 'Review the salary sheet, adjust bonuses or advances, then '
              'approve to lock it.',
          color: HrPalette.draft,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TeamOutlineButton(
                key: const Key('run-recalculate'),
                label: s.busy == PayrollAction.recalculate
                    ? 'Recalculating…'
                    : 'Recalculate',
                icon: Icons.refresh_rounded,
                onTap: busy
                    ? null
                    : () => context.read<PayrollRunCubit>().recalculate(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TeamGradientButton(
                key: const Key('run-approve'),
                label: 'Approve run',
                icon: Icons.verified_rounded,
                loading: s.busy == PayrollAction.approve,
                gradient: const LinearGradient(
                  colors: [HrPalette.paid, HrPalette.money],
                ),
                onTap: busy ? null : () => _approve(context, s),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            key: const Key('run-delete'),
            onPressed: busy ? null : () => _delete(context, s),
            icon: const Icon(
              Icons.delete_outline_rounded,
              size: 18,
              color: AppColors.danger,
            ),
            label: Text(
              'Delete draft',
              style: AppText.body(
                size: 13,
                weight: FontWeight.w800,
                color: AppColors.danger,
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
      ],
      if (payable && s.unpaid.isNotEmpty) ...[
        TeamGradientButton(
          key: const Key('run-pay-all'),
          label: 'Pay all ${s.unpaid.length} unpaid',
          icon: Icons.payments_rounded,
          loading: s.busy == PayrollAction.payAll,
          gradient: const LinearGradient(
            colors: [HrPalette.paid, HrPalette.money],
          ),
          onTap: busy ? null : () => _payAll(context, s),
        ),
        const SizedBox(height: 14),
      ],
      HrSectionHeader(title: 'Payslips (${slips.length})'),
      if (slips.isEmpty)
        const AppEmptyState(
          title: 'No payslips',
          message: 'No employees were eligible for this month.',
          icon: Icons.receipt_long_outlined,
        ),
      for (var i = 0; i < slips.length; i++) ...[
        StaggeredCard(
          index: i,
          child: _PayslipRow(
            p: slips[i],
            canPay: payable,
            canEdit: s.isDraft && slips[i].status == PayslipStatus.draft,
            busy: busy,
            onPay: () => _pay(context, slips[i]),
            onEdit: () => _edit(context, slips[i]),
            onOpen: () async {
              final cubit = context.read<PayrollRunCubit>();
              await context.push(
                AppRoutes.hrPayslipDetail,
                extra: HrPayslipArgs(
                  id: slips[i].id,
                  month: slips[i].month,
                  admin: true,
                  onPay: payable && slips[i].status == PayslipStatus.draft
                      ? () => _pay(context, slips[i])
                      : null,
                ),
              );
              cubit.load(silent: true);
            },
          ),
        ),
        const SizedBox(height: 10),
      ],
      if (slips.isNotEmpty) _TotalsCard(totals: HrRunTotals.of(slips)),
    ];
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
                  HrMoneyCount(
                    key: const Key('run-net'),
                    value: run.totalNet,
                    style: AppText.display(size: 26, color: color),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 14,
                    runSpacing: 4,
                    children: [
                      _Mini('Gross', run.totalGross),
                      _Mini('Deductions', run.totalDeductions),
                      _Mini('Paid', run.paidAmount),
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
  final double value;

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
          HrMoneyCount(
            value: value,
            style: AppText.body(size: 12.5, weight: FontWeight.w800),
          ),
        ],
      );
}

class _TotalsCard extends StatelessWidget {
  const _TotalsCard({required this.totals});

  final HrRunTotals totals;

  @override
  Widget build(BuildContext context) {
    Widget row(String label, double v, Color c, {String prefix = ''}) =>
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              HrMoneyCount(
                value: v,
                prefix: prefix,
                style: AppText.body(
                  size: 13.5,
                  weight: FontWeight.w900,
                  color: c,
                ),
              ),
            ],
          ),
        );
    return HrCard(
      key: const Key('run-totals'),
      accent: HrPalette.money,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('SALARY SHEET TOTALS', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          row('Base salary', totals.base, AppColors.ink),
          row('Additions', totals.additions, HrPalette.paid, prefix: '+ '),
          row('Deductions', totals.deductions, HrPalette.absent, prefix: '− '),
          const Divider(height: 16),
          row('Net pay', totals.net, HrPalette.money),
          const SizedBox(height: 4),
          Text(
            'Deductions include attendance loss, fixed deductions, late '
            'penalty and advance recovery.',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }
}

class _PayslipRow extends StatelessWidget {
  const _PayslipRow({
    required this.p,
    required this.canPay,
    required this.canEdit,
    required this.busy,
    required this.onPay,
    required this.onEdit,
    required this.onOpen,
  });

  final HrPayslip p;
  final bool canPay;
  final bool canEdit;
  final bool busy;
  final VoidCallback onPay;
  final VoidCallback onEdit;
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
                  '${hrDays(p.workingDays - p.unpaidDays)}/'
                  '${hrDays(p.workingDays)} paid days · '
                  '${Formatters.currency(p.baseSalary)} base',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
                if (p.expenseId != null) const HrExpenseLink(compact: true),
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
                _PillButton(
                  key: Key('pay-${p.id}'),
                  label: 'Pay',
                  color: HrPalette.paid,
                  onTap: busy ? null : onPay,
                )
              else if (canEdit)
                _PillButton(
                  key: Key('edit-${p.id}'),
                  label: 'Edit',
                  color: HrPalette.money,
                  onTap: busy ? null : onEdit,
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

class _PillButton extends StatelessWidget {
  const _PillButton({
    super.key,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 28,
        child: TextButton(
          onPressed: onTap,
          style: TextButton.styleFrom(
            backgroundColor: onTap == null ? AppColors.surface3 : color,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          child: Text(
            label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
        ),
      );
}
