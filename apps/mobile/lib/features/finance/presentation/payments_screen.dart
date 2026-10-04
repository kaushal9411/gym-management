import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/finance/payments_analytics_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/payments_analytics_header.dart';

const paymentStatusTones = {
  'SUCCESS': AppPillTone.success,
  'PENDING': AppPillTone.warning,
  'FAILED': AppPillTone.danger,
  'REFUNDED': AppPillTone.neutral,
  'PARTIALLY_REFUNDED': AppPillTone.warning,
  'CANCELLED': AppPillTone.neutral,
};

/// The ledger behind design frame "14. Payment detail", topped with a
/// compact analytics header (`GET /payments/analytics`, see
/// [PaymentsAnalyticsHeader] for what was dropped vs web). The design has no
/// payments-list frame of its own, so this list is the minimal entry point,
/// built to match the Income/Expenses list frames.
///
/// Filters (status chips + plan / amount-range sheet) are sent to
/// `GET /payments`; the `summary` totals shown under them cover the whole
/// filtered set, not just the loaded page. The analytics period chips do NOT
/// filter the list — they only scope the analytics header. The header hides
/// itself without `finance:view` / on a 403. Both cubits load once in
/// `initState` (this screen is pushed, not an IndexedStack tab, so it
/// reloads on every visit).
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  String? _status;
  String? _planId;
  String? _planName;
  double? _min;
  double? _max;
  final _summary = ValueNotifier<PaymentListSummary?>(null);
  late final PaymentsAnalyticsCubit _analytics;
  late final PaginatedListCubit<MemberPayment> _list;

  static const _statuses = [
    null,
    'SUCCESS',
    'PENDING',
    'FAILED',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
  ];

  @override
  void initState() {
    super.initState();
    _list = PaginatedListCubit<MemberPayment>((page) async {
      final r = await getIt<PaymentRepository>().listWithSummary(
        page: page,
        status: _status,
        planId: _planId,
        minAmount: _min,
        maxAmount: _max,
      );
      if (page == 1) _summary.value = r.summary;
      return r.page;
    })
      ..load();
    _analytics = getIt<PaymentsAnalyticsCubit>();
    final session = context.read<SessionCubit>().state;
    final canView = session is SessionAuthenticatedStaff &&
        session.user.hasPermission('finance:view');
    if (canView) {
      _analytics.load();
    } else {
      _analytics.hide();
    }
  }

  @override
  void dispose() {
    _list.close();
    _analytics.close();
    _summary.dispose();
    super.dispose();
  }

  bool get _hasAdvanced => _planId != null || _min != null || _max != null;

  Future<void> _refresh() async {
    final session = context.read<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff &&
        session.user.hasPermission('finance:view')) {
      unawaited(_analytics.load());
    }
    await _list.load();
  }

  Future<void> _openFilters() async {
    final result = await showModalBottomSheet<_AdvancedFilters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _FilterSheet(
        initial: _AdvancedFilters(_planId, _planName, _min, _max),
      ),
    );
    if (result == null || !mounted) return;
    setState(() {
      _planId = result.planId;
      _planName = result.planName;
      _min = result.min;
      _max = result.max;
    });
    await _list.load();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<PaymentsAnalyticsCubit>.value(value: _analytics),
        BlocProvider<PaginatedListCubit<MemberPayment>>.value(value: _list),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: BlocBuilder<PaginatedListCubit<MemberPayment>,
              PaginatedListState<MemberPayment>>(
            builder: (context, state) {
              final count = state is PaginatedListLoaded<MemberPayment>
                  ? '${state.items.length} loaded'
                  : '';
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(count, style: AppText.eyebrow()),
                  Text('Payments', style: AppText.display(size: 18)),
                ],
              );
            },
          ),
          actions: [
            IconButton(
              tooltip: 'Filters',
              onPressed: _openFilters,
              icon: Icon(
                _hasAdvanced ? Icons.filter_alt : Icons.filter_alt_outlined,
                color: _hasAdvanced ? AppColors.staffPillFg : AppColors.ink,
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: BlocBuilder<PaginatedListCubit<MemberPayment>,
              PaginatedListState<MemberPayment>>(
            builder: (context, state) {
              return RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: _refresh,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    const SliverPadding(
                      padding: EdgeInsets.fromLTRB(18, 8, 18, 0),
                      sliver: SliverToBoxAdapter(
                        child: PaymentsAnalyticsHeader(),
                      ),
                    ),
                    SliverToBoxAdapter(child: _filterBar()),
                    ..._listSlivers(context, state),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _filterBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 34,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final s in _statuses)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(
                        s == null
                            ? 'All'
                            : s.replaceAll('_', ' ').toLowerCase(),
                      ),
                      selected: s == _status,
                      showCheckmark: false,
                      onSelected: (_) {
                        setState(() => _status = s);
                        _list.load();
                      },
                      backgroundColor: AppColors.surface2,
                      selectedColor: AppColors.staffSoft,
                      side: BorderSide(
                        color: s == _status ? AppColors.staffB : AppColors.line,
                      ),
                      labelStyle: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: s == _status
                            ? AppColors.staffPillFg
                            : AppColors.inkSoft,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (_hasAdvanced) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                if (_planName != null) AppPill(label: _planName!),
                if (_min != null)
                  AppPill(label: 'min ${Formatters.currency(_min!)}'),
                if (_max != null)
                  AppPill(label: 'max ${Formatters.currency(_max!)}'),
              ],
            ),
          ],
          const SizedBox(height: 8),
          ValueListenableBuilder<PaymentListSummary?>(
            valueListenable: _summary,
            builder: (context, s, _) => s == null
                ? const SizedBox.shrink()
                : Text(
                    'Matching: ${Formatters.currency(s.collectedTotal)} '
                    'collected · ${Formatters.currency(s.refundedTotal)} '
                    'refunded',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkSoft,
                      weight: FontWeight.w700,
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  List<Widget> _listSlivers(
    BuildContext context,
    PaginatedListState<MemberPayment> state,
  ) {
    Widget fill(Widget child) => SliverFillRemaining(
          hasScrollBody: false,
          child: SizedBox(height: 260, child: child),
        );
    return switch (state) {
      PaginatedListLoading() => [fill(const AppLoadingView())],
      PaginatedListError(:final message) => [
          fill(AppErrorView(message: message, onRetry: _list.load)),
        ],
      PaginatedListLoaded(:final items) when items.isEmpty => [
          fill(
            AppEmptyState(
              icon: Icons.payments_outlined,
              title: _status != null || _hasAdvanced
                  ? 'No matching payments'
                  : 'No payments yet',
              message: _status != null || _hasAdvanced
                  ? 'Try loosening the filters.'
                  : 'Recorded payments appear here.',
            ),
          ),
        ],
      PaginatedListLoaded(:final items, :final hasMore, :final loadingMore) => [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
            sliver: SliverList.builder(
              itemCount: items.length + (hasMore ? 1 : 0),
              itemBuilder: (context, i) {
                if (i == items.length) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Center(
                      child: loadingMore
                          ? const CircularProgressIndicator(
                              color: AppColors.staffB,
                            )
                          : TextButton(
                              onPressed: _list.loadMore,
                              child: const Text('Load more'),
                            ),
                    ),
                  );
                }
                return _PaymentCard(
                  payment: items[i],
                  onTap: () async {
                    await context.push(
                      AppRoutes.paymentDetail,
                      extra: items[i].id,
                    );
                    if (mounted) unawaited(_refresh());
                  },
                );
              },
            ),
          ),
        ],
    };
  }
}

class _AdvancedFilters {
  const _AdvancedFilters(this.planId, this.planName, this.min, this.max);

  final String? planId;
  final String? planName;
  final double? min;
  final double? max;
}

/// Plan picker (real `/membership-plans`, limit 100 — the API cap) +
/// min/max amount. Returns the new filters, or null if dismissed.
class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.initial});

  final _AdvancedFilters initial;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late final _min = TextEditingController(
    text: widget.initial.min?.toString() ?? '',
  );
  late final _max = TextEditingController(
    text: widget.initial.max?.toString() ?? '',
  );
  late String? _planId = widget.initial.planId;
  List<MembershipPlan>? _plans;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  @override
  void dispose() {
    _min.dispose();
    _max.dispose();
    super.dispose();
  }

  Future<void> _loadPlans() async {
    try {
      final r = await getIt<MembershipPlanRepository>().list(limit: 100);
      if (mounted) setState(() => _plans = r.items);
    } on ApiException {
      // Plan filter is optional; amount range still works without it.
      if (mounted) setState(() => _plans = const []);
    }
  }

  void _apply() {
    final min = _min.text.trim().isEmpty ? null : double.tryParse(_min.text);
    final max = _max.text.trim().isEmpty ? null : double.tryParse(_max.text);
    if ((_min.text.trim().isNotEmpty && min == null) ||
        (_max.text.trim().isNotEmpty && max == null)) {
      setState(() => _error = 'Enter valid amounts');
      return;
    }
    if (min != null && max != null && min > max) {
      setState(() => _error = 'Min cannot exceed max');
      return;
    }
    final plan = _plans?.where((p) => p.id == _planId).firstOrNull;
    Navigator.of(context).pop(
      _AdvancedFilters(
        _planId,
        plan?.name ?? widget.initial.planName,
        min,
        max,
      ),
    );
  }

  InputDecoration _dec(String hint) => InputDecoration(
        isDense: true,
        filled: true,
        fillColor: AppColors.surface3,
        hintText: hint,
        hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.line),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final plans = _plans;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        18,
        18,
        18,
        18 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Filter payments', style: AppText.display(size: 18)),
          const SizedBox(height: 14),
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Text('Plan', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          if (plans == null)
            const LinearProgressIndicator(color: AppColors.staffB)
          else
            DropdownButtonFormField<String?>(
              initialValue: plans.any((p) => p.id == _planId) ? _planId : null,
              isExpanded: true,
              dropdownColor: AppColors.surface3,
              decoration: _dec('All plans'),
              style: AppText.body(size: 14, weight: FontWeight.w600),
              items: [
                const DropdownMenuItem<String?>(child: Text('All plans')),
                for (final p in plans)
                  DropdownMenuItem<String?>(value: p.id, child: Text(p.name)),
              ],
              onChanged: (v) => setState(() => _planId = v),
            ),
          const SizedBox(height: 14),
          Text('Amount range', style: AppText.eyebrow()),
          const SizedBox(height: 6),
          Row(
            children: [
              for (final c in [_min, _max]) ...[
                Expanded(
                  child: TextField(
                    controller: c,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'^\d*\.?\d{0,2}'),
                      ),
                    ],
                    style: AppText.body(size: 15, weight: FontWeight.w600),
                    decoration: _dec(c == _min ? 'Min' : 'Max'),
                  ),
                ),
                if (c == _min) const SizedBox(width: 10),
              ],
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Clear',
                  variant: AppButtonVariant.ghost,
                  onPressed: () => Navigator.of(context)
                      .pop(const _AdvancedFilters(null, null, null, null)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(child: AppButton(label: 'Apply', onPressed: _apply)),
            ],
          ),
        ],
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment, required this.onTap});

  final MemberPayment payment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payment.memberName,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${payment.paymentNumber} · ${payment.method} · '
                      '${payment.paymentDate.day}/${payment.paymentDate.month}/'
                      '${payment.paymentDate.year}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    Formatters.currency(payment.finalAmount),
                    style: AppText.tabular(size: 13, weight: FontWeight.w800),
                  ),
                  if (payment.totalRefunded > 0) ...[
                    const SizedBox(height: 2),
                    Text(
                      '-${Formatters.currency(payment.totalRefunded)} refunded',
                      style: AppText.body(
                        size: 10.5,
                        color: AppColors.warning,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  AppPill(
                    label: payment.status.replaceAll('_', ' '),
                    tone: paymentStatusTones[payment.status] ??
                        AppPillTone.neutral,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
