import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/finance/payments_analytics_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/branch_option.dart';
import '../../../models/member_payment.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'payment_actions.dart';
import 'payments_ui.dart';
import 'widgets/payment_card.dart';
import 'widgets/payments_insights.dart';

const _sorts = [
  ('paymentDate:desc', 'Date · newest first'),
  ('paymentDate:asc', 'Date · oldest first'),
  ('finalAmount:desc', 'Amount · high to low'),
  ('finalAmount:asc', 'Amount · low to high'),
];

/// Statuses whose final amount counts as money received (web's footer total).
const _collected = {'SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED'};

/// Owner menu "Payments" (`finance:view` + flag `payments`) — web's
/// `/payments` page in the Members / Classes design language: gradient
/// [ListHero] (status chips with counts, record shortcut), a period bar
/// (Today / 7 days / This month / Last month / 90 days / Custom, branch,
/// compare-with-previous), the analytics (KPI cards + six panels, see
/// [PaymentsInsights]), search / sort / plan + amount filters / method chips,
/// and the payment cards with web's row menu.
///
/// **The period and branch scope both the analytics and the list**, exactly as
/// on web (the old mobile screen only scoped the analytics). The list sends
/// the range as full UTC instants — the API compares `paymentDate <=
/// new Date(dateTo)`, so a bare `YYYY-MM-DD` would drop every payment made
/// later that day. Totals under the toolbar come from the server `summary` for
/// the whole filtered set. Pushed route (not an `IndexedStack` tab), so it
/// reloads on every visit.
///
/// Gating (unchanged entry point): analytics are hidden without
/// `finance:view` / on a 403. Per-action hiding follows web's keys, which are
/// also the routes' `requirePermission`: "Record payment" and "Verify status"
/// need `finance:payment-create`, "View invoice" needs `finance:invoice-view`.
///
/// **Dropped vs web**: CSV / Excel export (no file-saving package in the app)
/// and the row checkboxes (their only effect on web is a "N selected" label).
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});

  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  // Period / scope.
  PaymentsPeriod _period = PaymentsPeriod.thisMonth;
  ({String from, String to})? _custom;
  String _branchId = '';
  bool _compare = true;
  List<BranchOption> _branches = const [];

  // List filters.
  String _status = '';
  String _method = '';
  String? _planId;
  String? _planName;
  double? _min;
  double? _max;
  String _search = '';
  String _sort = 'paymentDate:desc';
  int _resetNonce = 0;

  final _summary = ValueNotifier<PaymentListSummary?>(null);
  final _total = ValueNotifier<int?>(null);
  late final PaymentsAnalyticsCubit _analytics;
  late final PaginatedListCubit<MemberPayment> _list;
  late final bool _canView;

  ({String from, String to}) get _range => _custom ?? _period.range();

  @override
  void initState() {
    super.initState();
    _list = PaginatedListCubit<MemberPayment>((page) async {
      final r = _range;
      final parts = _sort.split(':');
      final res = await getIt<PaymentRepository>().listWithSummary(
        page: page,
        search: _search,
        status: _status.isEmpty ? null : _status,
        method: _method.isEmpty ? null : _method,
        planId: _planId,
        branchId: _branchId.isEmpty ? null : _branchId,
        minAmount: _min,
        maxAmount: _max,
        dateFrom: '${r.from}T00:00:00.000Z',
        dateTo: '${r.to}T23:59:59.999Z',
        sortBy: parts[0],
        sortDir: parts[1],
      );
      if (page == 1) {
        _summary.value = res.summary;
        _total.value = res.page.total;
      }
      return res.page;
    });
    _analytics = getIt<PaymentsAnalyticsCubit>();
    _canView = teamCan(context, PayPerm.view);
    _list.load();
    _loadAnalytics();
    _loadBranches();
  }

  @override
  void dispose() {
    _list.close();
    _analytics.close();
    _summary.dispose();
    _total.dispose();
    super.dispose();
  }

  // ── data ──────────────────────────────────────────────────────────────────

  void _loadAnalytics({bool silent = false}) {
    if (!_canView) {
      _analytics.hide();
      return;
    }
    final r = _range;
    unawaited(
      _analytics.load(
        from: r.from,
        to: r.to,
        branchId: _branchId.isEmpty ? null : _branchId,
        silent: silent,
      ),
    );
  }

  /// Branch names for the branch picker. Needs `branches:view`; without it the
  /// screen just stays tenant-wide.
  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // Optional garnish — never block the list on it.
    }
  }

  Future<void> _reloadAll({bool silent = false}) async {
    _loadAnalytics(silent: silent);
    await _list.load();
  }

  bool get _hasAdvanced => _planId != null || _min != null || _max != null;

  bool get _isDefault =>
      _status.isEmpty &&
      _method.isEmpty &&
      !_hasAdvanced &&
      _search.isEmpty &&
      _custom == null &&
      _period == PaymentsPeriod.thisMonth;

  String get _previousLabel => _custom != null
      ? 'Previous period'
      : switch (_period) {
          PaymentsPeriod.thisMonth => 'Last month',
          PaymentsPeriod.lastMonth => 'Month before',
          _ => 'Previous period',
        };

  String get _periodNoun => _custom != null
      ? 'in this period'
      : switch (_period) {
          PaymentsPeriod.today => 'today',
          PaymentsPeriod.days7 => 'in the last 7 days',
          PaymentsPeriod.thisMonth => 'this month',
          PaymentsPeriod.lastMonth => 'last month',
          PaymentsPeriod.days90 => 'in the last 90 days',
        };

  // ── actions ───────────────────────────────────────────────────────────────

  void _setStatus(String s) {
    setState(() => _status = _status == s ? '' : s);
    _list.load();
  }

  void _setPeriod(PaymentsPeriod p) {
    setState(() {
      _period = p;
      _custom = null;
    });
    _reloadAll();
  }

  Future<void> _pickCustom() async {
    final now = DateTime.now();
    final cur = _range;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year, now.month, now.day),
      initialDateRange: DateTimeRange(
        start: DateTime.tryParse(cur.from) ?? now,
        end: DateTime.tryParse(cur.to) ?? now,
      ),
    );
    if (picked == null || !mounted) return;
    if (picked.end.difference(picked.start).inDays >= 366) {
      teamSnack(context, 'Range may not exceed 366 days.', error: true);
      return;
    }
    setState(
      () => _custom = (from: payIso(picked.start), to: payIso(picked.end)),
    );
    _reloadAll();
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId.isEmpty ? null : _branchId,
      clearLabel: 'All branches',
    );
    if (v == null || !mounted) return;
    setState(() => _branchId = v);
    _reloadAll();
  }

  Future<void> _pickSort() async {
    final v = await pickOneSheet(
      context,
      title: 'Sort by',
      options: _sorts,
      current: _sort,
    );
    if (v == null || v.isEmpty || !mounted) return;
    setState(() => _sort = v);
    _list.load();
  }

  Future<void> _openFilters() async {
    final result = await showTeamSheet<_AdvancedFilters>(
      context,
      (_) => _FilterSheet(
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
    _list.load();
  }

  /// Web's Reset: filters + period back to This month (branch stays).
  void _reset() {
    setState(() {
      _status = '';
      _method = '';
      _planId = null;
      _planName = null;
      _min = null;
      _max = null;
      _search = '';
      _custom = null;
      _period = PaymentsPeriod.thisMonth;
      _resetNonce++;
    });
    _reloadAll();
  }

  Future<void> _open(MemberPayment p) async {
    await context.push(AppRoutes.paymentDetail, extra: p.id);
    if (mounted) unawaited(_reloadAll(silent: true));
  }

  Future<void> _record() async {
    await context.push(AppRoutes.recordPayment);
    if (mounted) unawaited(_reloadAll(silent: true));
  }

  Future<void> _menu(MemberPayment p, String v) async {
    switch (v) {
      case 'view':
        await _open(p);
      case 'invoice':
        await context.push(AppRoutes.invoiceDetail, extra: p.invoiceId);
      case 'verify':
        final status = await verifyPaymentStatus(context, p.id);
        if (status != null && mounted) unawaited(_reloadAll(silent: true));
      case 'copy':
        await copyPaymentNumber(context, p);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _reloadAll(silent: true),
        child: BlocBuilder<PaginatedListCubit<MemberPayment>,
            PaginatedListState<MemberPayment>>(
          bloc: _list,
          builder: (context, state) => CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _hero(top)),
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _periodBar(),
                        const SizedBox(height: 14),
                        _insights(),
                        _toolbar(),
                      ],
                    ),
                  ),
                ),
              ),
              ..._listSlivers(context, state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(double top) {
    return BlocBuilder<PaymentsAnalyticsCubit, PaymentsAnalyticsState>(
      bloc: _analytics,
      builder: (context, a) {
        final data = a is PaymentsAnalyticsLoaded ? a.data : null;
        final counts = data == null
            ? null
            : {for (final s in data.statuses) s.status: s.count};
        final total = counts?.values.fold<int>(0, (x, y) => x + y);
        String label(String base, String key) =>
            counts == null ? base : '$base · ${counts[key] ?? 0}';
        return ListHero(
          title: 'Payments',
          subtitle: data == null
              ? 'Collected, refunded and still pending.'
              : '${Formatters.currencyCompact(data.kpis.collected.value)} '
                  'collected $_periodNoun · '
                  '${data.kpis.paymentCount.value} payments · '
                  '${pct1(data.kpis.successRate.value)} success',
          topInset: top,
          side: 18 + teamSideInset(context),
          leading: ListHeroButton(
            icon: Icons.arrow_back_rounded,
            onTap: () => context.pop(),
          ),
          trailing: [
            ListHeroButton(
              icon: _hasAdvanced
                  ? Icons.filter_alt_rounded
                  : Icons.filter_alt_outlined,
              onTap: _openFilters,
            ),
            if (teamCan(context, PayPerm.create))
              ListHeroButton(icon: Icons.add_rounded, onTap: _record),
          ],
          chips: [
            PayHeroChip(
              label: total == null ? 'All' : 'All · $total',
              selected: _status.isEmpty,
              onTap: () => _setStatus(''),
            ),
            for (final s in paymentStatusValues)
              PayHeroChip(
                label: label(paymentStatusLabel(s), s),
                selected: _status == s,
                onTap: () => _setStatus(s),
              ),
          ],
        );
      },
    );
  }

  Widget _periodBar() {
    final custom = _custom;
    final branchName = _branches
            .where((b) => b.id == _branchId)
            .map((b) => b.name)
            .firstOrNull ??
        'All branches';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 38,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final p in PaymentsPeriod.values) ...[
                TeamFilterChip(
                  label: p.label,
                  selected: custom == null && _period == p,
                  onTap: () => _setPeriod(p),
                ),
                const SizedBox(width: 8),
              ],
              TeamFilterChip(
                label: custom == null
                    ? 'Custom'
                    : '${shortDay(custom.from)} – ${shortDay(custom.to)}',
                selected: custom != null,
                onTap: _pickCustom,
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            if (_branches.isNotEmpty) ...[
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.storefront_rounded,
                  label: branchName,
                  active: _branchId.isNotEmpty,
                  onTap: _pickBranch,
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  border: Border.all(color: AppColors.line),
                ),
                child: TeamToggleRow(
                  title: 'Compare',
                  subtitle: 'vs previous period',
                  value: _compare,
                  onChanged: (v) => setState(() => _compare = v),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _insights() {
    return BlocBuilder<PaymentsAnalyticsCubit, PaymentsAnalyticsState>(
      bloc: _analytics,
      builder: (context, a) {
        return switch (a) {
          PaymentsAnalyticsForbidden() => const SizedBox.shrink(),
          PaymentsAnalyticsLoading() => const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.staffB),
              ),
            ),
          PaymentsAnalyticsError(:final message) => Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Payment analytics are unavailable right now — the '
                      'list below still works.\n$message',
                      style:
                          AppText.body(size: 12.5, color: AppColors.inkFaint),
                    ),
                  ),
                  TextButton(
                    onPressed: _loadAnalytics,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          PaymentsAnalyticsLoaded(:final data) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: PaymentsInsights(
                data: data,
                compare: _compare,
                previousLabel: _previousLabel,
                onStatus: _setStatus,
              ),
            ),
        };
      },
    );
  }

  Widget _toolbar() {
    final sortLabel = _sorts.firstWhere((s) => s.$1 == _sort).$2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TeamSearchField(
          key: ValueKey('search-$_resetNonce'),
          hint: 'Search payment no., member, reference…',
          onSearch: (v) {
            setState(() => _search = v);
            _list.load();
          },
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.sort_rounded,
                label: sortLabel,
                onTap: _pickSort,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TeamToolbarButton(
                icon: Icons.tune_rounded,
                label: _hasAdvanced
                    ? [
                        if (_planName != null) _planName!,
                        if (_min != null) '≥ ${payMoney(_min!)}',
                        if (_max != null) '≤ ${payMoney(_max!)}',
                      ].join(' · ')
                    : 'Plan & amount',
                active: _hasAdvanced,
                onTap: _openFilters,
              ),
            ),
            if (!_isDefault) ...[
              const SizedBox(width: 8),
              Tooltip(
                message: 'Reset filters',
                child: GestureDetector(
                  onTap: _reset,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Icon(
                      Icons.restart_alt_rounded,
                      size: 18,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 36,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              TeamFilterChip(
                label: 'All methods',
                selected: _method.isEmpty,
                onTap: () {
                  setState(() => _method = '');
                  _list.load();
                },
              ),
              for (final m in paymentMethodValues) ...[
                const SizedBox(width: 8),
                TeamFilterChip(
                  label: paymentMethodLabel(m),
                  selected: _method == m,
                  color: PayColors.method(m),
                  onTap: () {
                    setState(() => _method = _method == m ? '' : m);
                    _list.load();
                  },
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        ValueListenableBuilder<PaymentListSummary?>(
          valueListenable: _summary,
          builder: (context, s, _) => ValueListenableBuilder<int?>(
            valueListenable: _total,
            builder: (context, total, _) => Text(
              [
                if (total != null) '$total result${total == 1 ? '' : 's'}',
                if (s != null) '${payMoney(s.collectedTotal)} collected',
                if (s != null) '${payMoney(s.refundedTotal)} refunded',
              ].join(' · '),
              style: AppText.body(
                size: 12,
                color: AppColors.inkSoft,
                weight: FontWeight.w800,
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
      ],
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
              title: 'No payments match these filters.',
              message: _isDefault
                  ? 'Recorded payments appear here.'
                  : 'Try another period or loosen the filters.',
            ),
          ),
        ],
      PaginatedListLoaded(:final items, :final hasMore, :final loadingMore) => [
          teamCardSliver<MemberPayment>(
            context,
            items: items,
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
            footer: _footer(items, hasMore, loadingMore),
            builder: (p, i) => PayRise(
              index: i,
              child: PaymentCard(
                key: ValueKey('pay-${p.id}'),
                payment: p,
                canViewInvoice: teamCan(context, PayPerm.invoiceView),
                canVerify: teamCan(context, PayPerm.create),
                onTap: () => _open(p),
                onMenu: (v) => _menu(p, v),
              ),
            ),
          ),
        ],
    };
  }

  Widget _footer(List<MemberPayment> items, bool hasMore, bool loadingMore) {
    final pageTotal = items
        .where((p) => _collected.contains(p.status))
        .fold<double>(0, (s, p) => s + p.finalAmount);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        children: [
          Text(
            'Loaded total ${payMoney(pageTotal)}',
            style: AppText.body(
              size: 12,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
          if (hasMore)
            loadingMore
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: CircularProgressIndicator(color: AppColors.staffB),
                  )
                : TextButton(
                    onPressed: _list.loadMore,
                    child: const Text('Load more'),
                  ),
        ],
      ),
    );
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
/// min/max amount (web's "All plans" select and Min / Max inputs). Returns
/// the new filters, or null if dismissed.
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
    } catch (_) {
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
        plan?.name ??
            (_planId == widget.initial.planId ? widget.initial.planName : null),
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
          borderSide: BorderSide(color: AppColors.line),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final plans = _plans;
    return TeamSheetScaffold(
      icon: Icons.tune_rounded,
      title: 'Filter payments',
      subtitle: 'Plan and amount range',
      color: TeamColors.indigo,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Text('PLAN', style: AppText.eyebrow()),
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
          Text('AMOUNT RANGE', style: AppText.eyebrow()),
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
                child: TeamOutlineButton(
                  label: 'Clear',
                  onTap: () => Navigator.of(context)
                      .pop(const _AdvancedFilters(null, null, null, null)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: TeamGradientButton(
                  label: 'Apply',
                  icon: Icons.check_rounded,
                  onTap: _apply,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
