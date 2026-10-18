import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/income_entry.dart';
import '../../../models/ledger_analytics.dart';
import '../../../models/paginated_result.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/income_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'income_filters.dart';
import 'income_insights.dart';
import 'income_ui.dart';

/// Sort choices: web's two sortable columns (Date, Amount) in both
/// directions. `value` = `sortBy:sortDir` as the API takes them.
const _sorts = [
  ('incomeDate:desc', 'Date · newest first'),
  ('incomeDate:asc', 'Date · oldest first'),
  ('amount:desc', 'Amount · high to low'),
  ('amount:asc', 'Amount · low to high'),
];

/// Income — web's `/income` page, redesigned for the phone and tablet.
///
/// Same order as web: gradient hero (total / entries / average chips + Add
/// income), the Period bar (period chips, branch, compare), the analytics
/// block (KPIs, trend, category donut, branch comparison, top entries — needs
/// `finance:view`, hidden on a 403), the filters (description search, sort,
/// category chips with counts, Reset), then the "All income" ledger as cards
/// with Load more. The ledger follows the period, branch, search, category and
/// sort exactly like web's table; the card menu offers web's single row action,
/// Delete (`finance:income-manage`, never on entries auto-created from a
/// payment).
///
/// Gating (see [IncomeAccess]): the menu tile / route are unchanged
/// (`finance:view` + flag `income`); analytics need `finance:view`; "Add
/// income" and Delete need `finance:income-manage`.
///
/// **Dropped vs web**: CSV / Excel export — the app has no file-saving /
/// sharing package (same documented omission as the Attendance and report
/// screens); the table's per-column header sort (a Sort picker replaces it);
/// numbered pagination (Load more replaces it); chart hover tooltips (tap /
/// drag inspection replaces them). Web has no income detail or edit screen, so
/// neither exists here.
class IncomeListScreen extends StatefulWidget {
  const IncomeListScreen({super.key});

  @override
  State<IncomeListScreen> createState() => _IncomeListScreenState();
}

class _IncomeListScreenState extends State<IncomeListScreen> {
  final _items = <IncomeEntry>[];
  List<BranchOption> _branches = [];

  // Controls (web's `useLedgerControls`).
  IncomePeriod _period = IncomePeriod.thisMonth;
  DateTimeRange? _custom;
  bool _compare = true;
  String? _branchId;
  String _search = '';
  String _category = '';
  String _sort = 'incomeDate:desc';
  int _resetKey = 0;

  // List.
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  int _total = 0;
  int _totalPages = 1;
  LedgerListSummary? _summary;
  int _listReq = 0;

  // Analytics.
  LedgerAnalytics? _analytics;
  bool _analyticsLoading = false;
  bool _analyticsForbidden = false;
  String? _analyticsError;
  int _analyticsReq = 0;

  bool get _canViewAnalytics => IncomeAccess.of(context).canViewAnalytics;

  @override
  void initState() {
    super.initState();
    _loadBranches();
    // Pushed route (not an IndexedStack tab): reload on every visit.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reloadAll();
    });
  }

  Future<void> _loadBranches() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() => _branches = options);
    } catch (_) {
      // Non-fatal — the picker just offers "All branches".
    }
  }

  ({String from, String to}) get _range => incomeRange(_period, _custom);

  String get _customLabel {
    final c = _custom;
    return c == null ? 'Custom' : '${dayMonth(c.start)} – ${dayMonth(c.end)}';
  }

  // ── loading ───────────────────────────────────────────────────────────────

  void _reloadAll({bool silent = false}) {
    _loadList(silent: silent);
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    if (!_canViewAnalytics) {
      setState(() => _analyticsForbidden = true);
      return;
    }
    final req = ++_analyticsReq;
    final r = _range;
    setState(() {
      _analyticsLoading = true;
      _analyticsError = null;
    });
    try {
      final data = await getIt<IncomeRepository>().analytics(
        dateFrom: r.from,
        dateTo: r.to,
        branchId: _branchId,
      );
      if (!mounted || req != _analyticsReq) return;
      setState(() {
        _analytics = data;
        _analyticsLoading = false;
        _analyticsForbidden = false;
      });
    } on ApiException catch (e) {
      if (!mounted || req != _analyticsReq) return;
      setState(() {
        _analyticsLoading = false;
        // 403 (no permission / module unavailable) hides the block, as before.
        if (e.statusCode == 403) {
          _analyticsForbidden = true;
          _analytics = null;
        } else {
          _analyticsError = e.message;
        }
      });
    } catch (e) {
      if (!mounted || req != _analyticsReq) return;
      setState(() {
        _analyticsLoading = false;
        _analyticsError = 'Could not load analytics ($e)';
      });
    }
  }

  Future<({PaginatedResult<IncomeEntry> page, LedgerListSummary? summary})>
      _fetch(int page) {
    final r = _range;
    final sort = _sort.split(':');
    return getIt<IncomeRepository>().listWithSummary(
      page: page,
      search: _search,
      category: _category,
      branchId: _branchId,
      dateFrom: r.from,
      dateTo: r.to,
      sortBy: sort[0],
      sortDir: sort[1],
    );
  }

  Future<void> _loadList({bool silent = false}) async {
    final req = ++_listReq;
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final r = await _fetch(1);
      if (!mounted || req != _listReq) return;
      setState(() {
        _items
          ..clear()
          ..addAll(r.page.items);
        _page = r.page.page;
        _total = r.page.total;
        _totalPages = r.page.totalPages;
        _summary = r.summary;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(req, e.message);
    } catch (e) {
      _fail(req, 'Could not load income ($e)');
    }
  }

  void _fail(int req, String message) {
    if (!mounted || req != _listReq) return;
    if (_items.isNotEmpty) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  Future<void> _loadMore() async {
    setState(() => _loadingMore = true);
    final req = _listReq;
    try {
      final r = await _fetch(_page + 1);
      if (!mounted || req != _listReq) return;
      setState(() {
        _items.addAll(r.page.items);
        _page = r.page.page;
        _totalPages = r.page.totalPages;
        _total = r.page.total;
        _summary = r.summary ?? _summary;
      });
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not load more ($e)', error: true);
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  // ── controls ──────────────────────────────────────────────────────────────

  /// Period / branch changes re-scope the analytics and the ledger.
  void _applyScope(VoidCallback change) {
    setState(change);
    _reloadAll();
  }

  /// Search / category / sort only re-query the ledger.
  void _applyList(VoidCallback change) {
    setState(change);
    _loadList();
  }

  Future<void> _pickCustom() async {
    final now = DateTime.now();
    final r = _range;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _period == IncomePeriod.custom
          ? _custom
          : DateTimeRange(
              start: DateTime.parse(r.from),
              end: DateTime.parse(r.to),
            ),
    );
    if (picked == null) return;
    _applyScope(() {
      _custom = picked;
      _period = IncomePeriod.custom;
    });
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    _applyScope(() => _branchId = v.isEmpty ? null : v);
  }

  Future<void> _pickSort() async {
    final v = await pickOneSheet(
      context,
      title: 'Sort by',
      options: _sorts,
      current: _sort,
    );
    if (v == null || v.isEmpty) return;
    _applyList(() => _sort = v);
  }

  /// web's Reset: search, category and period back to defaults (branch and
  /// compare stay).
  void _reset() {
    setState(() {
      _search = '';
      _category = '';
      _period = IncomePeriod.thisMonth;
      _custom = null;
      _resetKey++;
    });
    _reloadAll();
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _add() async {
    final added = await context.push<bool>(AppRoutes.incomeForm);
    if (!mounted) return;
    if (added == true) teamSnack(context, 'Income recorded.');
    _reloadAll(silent: true);
  }

  Future<void> _delete(IncomeEntry e) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this income entry?',
      message: 'This soft-deletes the entry — it stays in the database for '
          'audit history but is hidden from the ledger.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await getIt<IncomeRepository>().delete(e.id);
      if (!mounted) return;
      teamSnack(context, 'Income deleted.');
      _reloadAll(silent: true);
    } on ApiException catch (err) {
      if (mounted) teamSnack(context, err.detailedMessage, error: true);
    } catch (err) {
      if (mounted) {
        teamSnack(context, 'Could not delete the entry ($err)', error: true);
      }
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final access = IncomeAccess.of(context);
    final showAnalytics = access.canViewAnalytics && !_analyticsForbidden;
    final sortLabel = _sorts.firstWhere((s) => s.$1 == _sort).$2;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () async => _reloadAll(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top, access, showAnalytics)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      IncomePeriodBar(
                        period: _period,
                        customLabel: _customLabel,
                        onPeriod: (p) => _applyScope(() => _period = p),
                        onCustom: _pickCustom,
                        branchId: _branchId,
                        branches: _branches,
                        onBranch: _pickBranch,
                        compare: _compare,
                        onCompare: (v) => setState(() => _compare = v),
                      ),
                      if (showAnalytics) ...[
                        const SizedBox(height: 12),
                        IncomeAnalyticsSection(
                          data: _analytics,
                          loading: _analyticsLoading,
                          error: _analyticsError,
                          compare: _compare,
                          period: _period,
                          onRetry: _loadAnalytics,
                        ),
                      ],
                      const SizedBox(height: 12),
                      IncomeFiltersBar(
                        searchKey: ValueKey('income-search-$_resetKey'),
                        onSearch: (v) => _applyList(() => _search = v),
                        onReset: _reset,
                        sortLabel: sortLabel,
                        onSort: _pickSort,
                        category: _category,
                        onCategory: (c) => _applyList(() => _category = c),
                        counts: showAnalytics ? _analytics?.categories : null,
                      ),
                      const SizedBox(height: 16),
                      _ledgerHeader(),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
              ),
            ),
            ..._body(access),
          ],
        ),
      ),
    );
  }

  Widget _hero(double top, IncomeAccess access, bool showAnalytics) {
    final a = _analytics;
    return ListHero(
      title: 'Income',
      subtitle: "The gym's revenue ledger",
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (access.canManage)
          ListHeroButton(icon: Icons.add_rounded, onTap: _add),
      ],
      chips: [
        if (showAnalytics && a != null) ...[
          ListHeroChip(
            icon: Icons.trending_up_rounded,
            label: '${money(a.kpis.total.value)} ${_period.noun}',
          ),
          ListHeroChip(
            icon: Icons.tag_rounded,
            label: '${a.kpis.count.value.round()} '
                '${a.kpis.count.value.round() == 1 ? 'entry' : 'entries'}',
          ),
          ListHeroChip(
            icon: Icons.bar_chart_rounded,
            label: '${money(a.kpis.average.value)} average',
          ),
        ] else if (_summary != null) ...[
          ListHeroChip(
            icon: Icons.trending_up_rounded,
            label: '${money(_summary!.total)} total',
          ),
          ListHeroChip(
            icon: Icons.tag_rounded,
            label: '${_summary!.count} '
                '${_summary!.count == 1 ? 'entry' : 'entries'}',
          ),
        ],
      ],
    );
  }

  /// web's table header: "All income · 12 results · ₹X total · ₹Y avg".
  Widget _ledgerHeader() {
    final s = _summary;
    final faint = AppText.body(
      size: 12,
      color: AppColors.inkFaint,
      weight: FontWeight.w700,
    );
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: 'All income',
            style: AppText.display(size: 17),
          ),
          if (!_loading || _items.isNotEmpty)
            TextSpan(
              text: '  · $_total result${_total == 1 ? '' : 's'}'
                  '${s == null ? '' : ' · ${money(s.total)} total · ${money(s.average)} avg'}',
              style: faint,
            ),
        ],
      ),
    );
  }

  List<Widget> _body(IncomeAccess access) {
    if (_loading && _items.isEmpty) {
      return const [
        SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
      ];
    }
    if (_error != null && _items.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _error!, onRetry: _loadList),
        ),
      ];
    }
    if (_items.isEmpty) {
      return [
        const SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.payments_outlined,
            title: 'No income found',
            message: 'No income entries match these filters.',
          ),
        ),
      ];
    }
    final loadedTotal = _items.fold<double>(0, (s, e) => s + e.amount);
    return [
      teamCardSliver<IncomeEntry>(
        context,
        items: _items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
        builder: (e, i) => IncomeEntryCard(
          key: ValueKey('income-${e.id}'),
          entry: e,
          onDelete: access.canDelete(e) ? () => _delete(e) : null,
        ),
      ),
      SliverToBoxAdapter(
        child: TeamCenter(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
            child: Column(
              children: [
                Text(
                  'Loaded total ${money(loadedTotal)}'
                  '${_summary == null ? '' : ' · All $_total filtered ${money(_summary!.total)}'}',
                  textAlign: TextAlign.center,
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
                if (_page < _totalPages)
                  LoadMoreButton(
                    loading: _loadingMore,
                    onPressed: _loadMore,
                    shownCount: _items.length,
                    totalCount: _total,
                  )
                else
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Text(
                      'Showing all $_total ${_total == 1 ? 'entry' : 'entries'}',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    ];
  }
}
