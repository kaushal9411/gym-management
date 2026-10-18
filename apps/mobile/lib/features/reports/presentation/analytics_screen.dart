import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_comparison_row.dart';
import '../../../models/report_summary.dart' show ReportSummaryFilters;
import '../../../repositories/analytics_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'analytics/analytics_branch_parts.dart';
import 'analytics/analytics_logic.dart';
import 'analytics/analytics_view_chart.dart';
import 'kit/kit.dart';

/// One loaded series view: merged rows (current + previous) or its status.
class _Series {
  const _Series({
    this.rows = const [],
    this.loading = true,
    this.error = false,
  });

  final List<AnalyticsRow> rows;
  final bool loading;
  final bool error;
}

class _Branches {
  const _Branches({
    this.current = const [],
    this.previous,
    this.loading = true,
    this.error = false,
  });

  final List<BranchComparisonRow> current;
  final List<BranchComparisonRow>? previous;
  final bool loading;
  final bool error;
}

/// Analytics — web's `/analytics` page, redesigned for the phone and tablet.
///
/// Same structure as web: a gradient hero (headline numbers) with the view
/// tabs (Overview + the seven views), the Period bar (period chips, branch,
/// "Compare with previous period"), then either the Overview grid — one chart
/// card per view with its change vs the previous period and a Deep dive
/// button — or a single view in focus with its four stat tiles and a large
/// chart. Branch Comparison has its own ranking view with a metric switcher.
///
/// Built on the report kit (`kit/`): [RptPeriodController] + [RptPeriodBar],
/// [RptChartCard], [RptKpiGrid], [RptTrendChart] / [RptMultiSeriesChart] (via
/// [AnalyticsViewChart]), [RptHBarChart] and [RptGroupedBarChart].
///
/// Data: the same `/analytics/*` endpoints web calls (revenue-trends,
/// attendance-trends, membership-growth, new-member-growth, retention,
/// payment-collection, branch-comparison), for the selected range and — when
/// comparing — the previous range of equal length. Views load lazily: the
/// overview loads all of them, a focused view only its own. Ranges over 366
/// days (the API's cap) are flagged by the period bar and not requested.
///
/// Gating: unchanged menu/route gating (`analytics:view`); like web's page the
/// screen itself also shows "You don't have access to analytics." without that
/// key (the API would answer 403 anyway) and makes no request.
///
/// [initialView] opens a view directly (the Reports Center's analytics
/// catalogue cards pass it as the route `extra`); null = Overview.
///
/// **Export** (`reports:export`, like web): a focused view's hero gets the
/// "Export" pill (PDF / Excel / CSV / Print of `analytics-<view>` for the
/// selected range + branch); the Overview has none.
///
/// **Dropped vs web**: chart hover tooltips (tap / drag inspection replaces
/// them); the header-branch seeding (mobile has no global branch selector, so
/// the branch starts as "All branches").
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key, this.initialView});

  final AnalyticsView? initialView;

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  late AnalyticsView? _view = widget.initialView; // null = Overview
  final _controls = RptPeriodController();
  String _lastScope = '';
  bool _lastCompare = true;

  /// Bumped on every scope change so late responses for an old scope are
  /// ignored.
  int _scope = 0;
  final Map<AnalyticsView, _Series> _series = {};
  _Branches? _branchData;

  ({String from, String to}) get _range => _controls.range;
  bool get _compare => _controls.compare;

  List<AnalyticsView> get _active =>
      _view == null ? AnalyticsView.values : [_view!];

  /// Same key web's page checks. Read once at start so a viewer without it
  /// never triggers a request (the API would answer 403 anyway).
  bool get _allowed {
    final session = context.read<SessionCubit>().state;
    return session is! SessionAuthenticatedStaff ||
        session.user.hasPermission('analytics:view');
  }

  @override
  void initState() {
    super.initState();
    _lastScope = _controls.scope;
    _lastCompare = _controls.compare;
    _controls.addListener(_onControls);
    if (!_allowed) return;
    _controls.loadBranches();
    _ensureLoaded();
  }

  @override
  void dispose() {
    _controls
      ..removeListener(_onControls)
      ..dispose();
    super.dispose();
  }

  void _onControls() {
    final scopeChanged = _controls.scope != _lastScope;
    final compareChanged = _controls.compare != _lastCompare;
    _lastScope = _controls.scope;
    _lastCompare = _controls.compare;
    if (!_allowed) return;
    // Turning Compare on needs the previous-period data; turning it off just
    // hides it.
    if (scopeChanged || (compareChanged && _controls.compare)) {
      _reload();
    } else if (mounted) {
      setState(() {});
    }
  }

  void _reload() {
    _scope++;
    _series.clear();
    _branchData = null;
    if (mounted) setState(() {});
    _ensureLoaded();
  }

  void _ensureLoaded() {
    if (!_controls.rangeReady) return;
    for (final v in _active) {
      if (v == AnalyticsView.branches) {
        if (_branchData == null) _loadBranches();
      } else if (!_series.containsKey(v)) {
        _loadSeries(v);
      }
    }
  }

  DateTime _d(String ymd) => DateTime.parse(ymd);

  Future<List<AnalyticsPoint>> _fetch(
    AnalyticsView v,
    String from,
    String to,
  ) async {
    final repo = getIt<AnalyticsRepository>();
    final f = _d(from);
    final t = _d(to);
    final b = _controls.branchId;
    switch (v) {
      case AnalyticsView.revenue:
        return AnalyticsPoint.fromMoney(
          await repo.revenueTrends(from: f, to: t, branchId: b),
        );
      case AnalyticsView.collection:
        return AnalyticsPoint.fromMoney(
          await repo.paymentCollection(from: f, to: t, branchId: b),
        );
      case AnalyticsView.attendance:
        return AnalyticsPoint.fromCounts(
          await repo.attendanceTrends(from: f, to: t, branchId: b),
        );
      case AnalyticsView.membershipGrowth:
        return AnalyticsPoint.fromCounts(
          await repo.membershipGrowth(from: f, to: t, branchId: b),
        );
      case AnalyticsView.newMembers:
        return AnalyticsPoint.fromCounts(
          await repo.newMemberGrowth(from: f, to: t, branchId: b),
        );
      case AnalyticsView.retention:
        return AnalyticsPoint.fromCounts(
          await repo.retention(from: f, to: t, branchId: b),
        );
      case AnalyticsView.branches:
        return const [];
    }
  }

  Future<void> _loadSeries(AnalyticsView v) async {
    final scope = _scope;
    setState(() => _series[v] = const _Series());
    final r = _range;
    final prev = previousRange(r.from, r.to);
    try {
      final current = await _fetch(v, r.from, r.to);
      List<AnalyticsPoint>? previous;
      if (_compare) {
        try {
          previous = await _fetch(v, prev.from, prev.to);
        } catch (_) {
          previous = null; // the comparison is optional — keep the chart
        }
      }
      if (!mounted || scope != _scope) return;
      setState(() {
        _series[v] = _Series(
          rows: mergeSeries(current, previous),
          loading: false,
        );
      });
    } catch (_) {
      if (!mounted || scope != _scope) return;
      setState(() => _series[v] = const _Series(loading: false, error: true));
    }
  }

  Future<void> _loadBranches() async {
    final scope = _scope;
    setState(() => _branchData = const _Branches());
    final r = _range;
    final prev = previousRange(r.from, r.to);
    final repo = getIt<AnalyticsRepository>();
    final branch = _controls.branchId;
    try {
      final current = await repo.branchComparison(
        from: _d(r.from),
        to: _d(r.to),
        branchId: branch,
      );
      List<BranchComparisonRow>? previous;
      if (_compare) {
        try {
          previous = await repo.branchComparison(
            from: _d(prev.from),
            to: _d(prev.to),
            branchId: branch,
          );
        } catch (_) {
          previous = null;
        }
      }
      if (!mounted || scope != _scope) return;
      setState(
        () => _branchData = _Branches(
          current: current,
          previous: previous,
          loading: false,
        ),
      );
    } catch (_) {
      if (!mounted || scope != _scope) return;
      setState(
        () => _branchData = const _Branches(loading: false, error: true),
      );
    }
  }

  // ── controls ──────────────────────────────────────────────────────────────

  final Map<AnalyticsView?, GlobalKey> _tabKeys = {};

  void _setView(AnalyticsView? v) {
    setState(() => _view = v);
    _ensureLoaded();
    // Deep dive can select a chip that is scrolled out of sight.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _tabKeys[v]?.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(
          ctx,
          duration: const Duration(milliseconds: 250),
          alignment: 0.5,
        );
      }
    });
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    // Watched so a permission change rebuilds; the load guard uses [_allowed].
    context.watch<SessionCubit>();
    final allowed = _allowed;
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: !allowed
          ? Column(
              children: [
                _hero(top, const []),
                Expanded(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "You don't have access to analytics.",
                        textAlign: TextAlign.center,
                        style: AppText.body(color: AppColors.inkFaint),
                      ),
                    ),
                  ),
                ),
              ],
            )
          : RefreshIndicator(
              color: AppColors.staffB,
              backgroundColor: AppColors.surface2,
              onRefresh: () async => _reload(),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _hero(top, _heroChips())),
                  SliverToBoxAdapter(
                    child: TeamCenter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(18, 14, 18, 32),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _tabs(),
                            const SizedBox(height: 12),
                            RptPeriodBar(
                              controller: _controls,
                              accent: RptColors.indigo,
                            ),
                            const SizedBox(height: 14),
                            _content(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _hero(double top, List<Widget> chips) {
    final v = _view;
    return ListHero(
      title: v?.title ?? 'Analytics',
      subtitle: v?.subtitle ??
          'Trends and comparisons across revenue, attendance, members and '
              'branches.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      // Like web, export only appears on a focused view (the Overview shows
      // all seven at once and has nothing single to export).
      trailing: [
        if (v != null && _allowed)
          RptExportButton(
            spec: RptExportSpec(
              reportType: v.exportType,
              title: v.title,
              filters: () => ReportSummaryFilters(
                from: DateTime.parse(_range.from),
                to: DateTime.parse(_range.to),
                branchId: _controls.branchId,
              ),
              enabled: _controls.rangeReady,
            ),
          ),
      ],
      chips: chips,
    );
  }

  /// Web's hero numbers: the overview headlines, or the focused view's
  /// Total / Daily average / Peak day. Empty until loaded.
  List<Widget> _heroChips() {
    final v = _view;
    if (v == null) {
      final out = <Widget>[];
      void add(AnalyticsView view, String label, IconData icon) {
        final s = _series[view];
        if (s == null || s.loading || s.error) return;
        final st = computeStats(s.rows, snapshot: view.isSnapshot);
        out.add(
          ListHeroChip(
            icon: icon,
            label: '$label ${compactAnalytics(view.format, st.total)}',
          ),
        );
      }

      add(AnalyticsView.revenue, 'Income', Icons.trending_up_rounded);
      add(AnalyticsView.attendance, 'Check-ins', Icons.how_to_reg_rounded);
      add(
        AnalyticsView.newMembers,
        'New members',
        Icons.person_add_alt_1_rounded,
      );
      return out;
    }
    if (!v.isSeries) return const [];
    final s = _series[v];
    if (s == null || s.loading || s.error) return const [];
    final st = computeStats(s.rows, snapshot: v.isSnapshot);
    String f(double x) => compactAnalytics(v.format, x);
    return [
      ListHeroChip(
        icon: Icons.functions_rounded,
        label: '${v.isSnapshot ? 'Latest' : 'Total'} '
            '${f(v.isSnapshot ? st.latest : st.total)}',
      ),
      ListHeroChip(
        icon: Icons.show_chart_rounded,
        label: 'Daily avg ${f(st.average)}',
      ),
      ListHeroChip(
        icon: Icons.trending_up_rounded,
        label: 'Peak ${f(st.peak)}',
      ),
    ];
  }

  Widget _tabs() {
    Widget chip(
      AnalyticsView? key,
      String label,
      bool sel,
      Color c,
      VoidCallback onTap,
    ) =>
        Padding(
          key: _tabKeys.putIfAbsent(key, GlobalKey.new),
          padding: const EdgeInsets.only(right: 8),
          child: TeamFilterChip(
            label: label,
            selected: sel,
            color: c,
            onTap: onTap,
          ),
        );
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          chip(
            null,
            'Overview',
            _view == null,
            TeamColors.indigo,
            () => _setView(null),
          ),
          for (final v in AnalyticsView.values)
            chip(v, v.title, _view == v, v.color, () => _setView(v)),
        ],
      ),
    );
  }

  Widget _content() {
    if (!_controls.rangeReady) {
      return const RptChartCard(
        title: 'Pick a valid range',
        color: RptColors.slate,
        icon: Icons.date_range_rounded,
        empty: true,
        emptyText: 'Pick a valid date range (start on or before end, at most '
            '$kRptMaxRangeDays days).',
        child: SizedBox.shrink(),
      );
    }
    final v = _view;
    if (v == null) return _overviewGrid();
    return _focus(v);
  }

  /// One column on phones; two on tablets (the branch card spans both).
  Widget _overviewGrid() {
    return RptPanelGrid(
      panels: [
        for (final v in AnalyticsView.values)
          if (v != AnalyticsView.branches) RptPanel(_overviewCard(v)),
        RptPanel(full: true, _overviewCard(AnalyticsView.branches)),
      ],
    );
  }

  int get _days => _controls.days;

  // ── overview ──────────────────────────────────────────────────────────────

  Widget _overviewCard(AnalyticsView v) {
    if (v == AnalyticsView.branches) {
      final b = _branchData;
      return RptChartCard(
        title: v.title,
        subtitle: v.subtitle,
        color: v.color,
        icon: v.icon,
        loading: b == null || b.loading,
        error: b?.error ?? false,
        errorText: 'Could not load this view.',
        empty: b != null && !b.loading && !b.error && b.current.isEmpty,
        emptyText: 'No branch data for this period.',
        onRetry: _loadBranches,
        actions: AnalyticsDeepDive(label: v.title, onTap: () => _setView(v)),
        child: AnalyticsBranchBars(
          rows: b?.current ?? const [],
          previous: b?.previous,
          compare: _compare,
        ),
      );
    }
    final s = _series[v];
    final loading = s == null || s.loading;
    final stats = (loading || s.error)
        ? null
        : computeStats(s.rows, snapshot: v.isSnapshot);
    final basis =
        stats == null ? 0.0 : (v.isSnapshot ? stats.latest : stats.total);
    final prevBasis = stats == null
        ? null
        : (v.isSnapshot ? stats.prevLatest : stats.prevTotal);
    return RptChartCard(
      title: v.title,
      subtitle: v.subtitle,
      color: v.color,
      icon: v.icon,
      loading: loading,
      error: s?.error ?? false,
      errorText: 'Could not load this view.',
      empty: !loading && !s.error && s.rows.isEmpty,
      onRetry: () => _loadSeries(v),
      actions: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_compare && stats != null) ...[
            RptDeltaBadge(value: basis, previous: prevBasis),
            const SizedBox(width: 6),
          ],
          AnalyticsDeepDive(label: v.title, onTap: () => _setView(v)),
        ],
      ),
      child: AnalyticsViewChart(
        view: v,
        rows: s?.rows ?? const [],
        compare: _compare,
        height: 190,
      ),
    );
  }

  // ── focus ─────────────────────────────────────────────────────────────────

  Widget _focus(AnalyticsView v) {
    final r = _range;
    if (v == AnalyticsView.branches) {
      final b = _branchData;
      return RptChartCard(
        title: v.title,
        subtitle: '${r.from} – ${r.to}',
        color: v.color,
        icon: v.icon,
        loading: b == null || b.loading,
        error: b?.error ?? false,
        errorText: 'Could not load this view.',
        empty: b != null && !b.loading && !b.error && b.current.isEmpty,
        emptyText: 'No branch data for this period.',
        onRetry: _loadBranches,
        minHeight: 260,
        child: AnalyticsBranchFocus(
          rows: b?.current ?? const [],
          previous: b?.previous,
          compare: _compare,
        ),
      );
    }
    final s = _series[v];
    final loading = s == null || s.loading;
    final failed = s?.error ?? false;
    final stats = (loading || failed)
        ? null
        : computeStats(s.rows, snapshot: v.isSnapshot);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (stats != null) ...[
          LayoutBuilder(
            builder: (context, box) => RptKpiGrid(
              columns: box.maxWidth >= 700 ? 4 : 2,
              kpis: _statTiles(v, stats),
            ),
          ),
          const SizedBox(height: 12),
        ],
        RptChartCard(
          title: v.title,
          subtitle: '${r.from} – ${r.to}',
          color: v.color,
          icon: v.icon,
          loading: loading,
          error: failed,
          errorText: 'Could not load this view.',
          empty: !loading && !failed && s.rows.isEmpty,
          onRetry: () => _loadSeries(v),
          minHeight: 280,
          child: AnalyticsViewChart(
            view: v,
            rows: s?.rows ?? const [],
            compare: _compare,
            height: 260,
          ),
        ),
      ],
    );
  }

  /// Web's `ViewStatsRow`: four tiles — total/latest, average, peak day and
  /// the change vs previous (or the span when not comparing).
  List<RptKpi> _statTiles(AnalyticsView v, AnalyticsStats st) {
    final f = v.format.rpt;
    final money = v.format == AnalyticsFormat.money;
    final c = v.color;
    final dual = v.dual;
    if (dual != null) {
      final isRate = v == AnalyticsView.collection;
      final tb = st.totalB ?? 0;
      final rate = tb == 0 ? 0.0 : st.total / tb * 100;
      final prevRate = st.prevTotal != null && (st.prevTotalB ?? 0) != 0
          ? st.prevTotal! / st.prevTotalB! * 100
          : null;
      return [
        RptKpi(
          label: 'Total ${dual.$1.toLowerCase()}',
          value: st.total,
          format: f,
          previous: st.prevTotal,
          icon: Icons.functions_rounded,
          color: c,
          compact: true,
        ),
        RptKpi(
          label: 'Total ${dual.$2.toLowerCase()}',
          value: tb,
          format: f,
          previous: st.prevTotalB,
          invert: v == AnalyticsView.revenue,
          icon: Icons.show_chart_rounded,
          color: c,
          compact: true,
        ),
        if (isRate)
          RptKpi(
            label: 'Collection rate',
            value: rate,
            format: RptFormat.percent,
            previous: prevRate,
            icon: Icons.speed_rounded,
            color: c,
            hint: 'collected / invoiced',
          )
        else
          RptKpi(
            label: 'Net',
            value: st.total - tb,
            format: f,
            previous: st.prevTotal == null
                ? null
                : st.prevTotal! - (st.prevTotalB ?? 0),
            icon: Icons.speed_rounded,
            color: c,
            compact: true,
          ),
        RptKpi(
          label: 'Peak ${dual.$1.toLowerCase()} day',
          value: st.peak,
          format: f,
          icon: Icons.trending_up_rounded,
          color: c,
          compact: true,
          hint: st.peakDate.isEmpty ? null : analyticsShortDate(st.peakDate),
        ),
      ];
    }
    final snap = v.isSnapshot;
    return [
      RptKpi(
        label: snap ? 'Latest' : 'Total',
        value: snap ? st.latest : st.total,
        format: f,
        previous: snap ? st.prevLatest : st.prevTotal,
        icon: Icons.functions_rounded,
        color: c,
        compact: money,
      ),
      RptKpi(
        label: 'Daily average',
        value: st.average,
        format: f,
        previous: st.prevAverage,
        icon: Icons.show_chart_rounded,
        color: c,
        compact: money,
      ),
      RptKpi(
        label: 'Peak day',
        value: st.peak,
        format: f,
        icon: Icons.trending_up_rounded,
        color: c,
        compact: money,
        hint: st.peakDate.isEmpty ? null : analyticsShortDate(st.peakDate),
      ),
      if (_compare && st.change != null)
        RptKpi(
          label: 'Change vs previous',
          value: st.change!,
          format: RptFormat.percent,
          icon: Icons.speed_rounded,
          color: c,
          hint: snap ? 'latest vs latest' : 'total vs total',
        )
      else
        RptKpi(
          label: 'Days in range',
          value: _days.toDouble(),
          icon: Icons.calendar_today_rounded,
          color: c,
          hint: _compare ? 'no previous data' : null,
        ),
    ];
  }
}
