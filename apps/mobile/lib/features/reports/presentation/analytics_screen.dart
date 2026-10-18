import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_comparison_row.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/analytics_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../income/presentation/income_filters.dart';
import '../../income/presentation/income_ui.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'analytics/analytics_chart.dart';
import 'analytics/analytics_logic.dart';
import 'analytics/analytics_view_parts.dart';

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
/// Data: the same `/analytics/*` endpoints web calls (revenue-trends,
/// attendance-trends, membership-growth, new-member-growth, retention,
/// payment-collection, branch-comparison), for the selected range and — when
/// comparing — the previous range of equal length. Views load lazily: the
/// overview loads all of them, a focused view only its own.
///
/// Gating: unchanged menu/route gating (`analytics:view`); like web's page the
/// screen itself also shows "You don't have access to analytics." without that
/// key (the API would answer 403 anyway).
///
/// **Dropped vs web**: the CSV / Excel / PDF export buttons on a focused view —
/// the app has no file-saving / sharing package (same documented omission as
/// the other report screens); chart hover tooltips (tap / drag inspection
/// replaces them); the header-branch seeding (mobile has no global branch
/// selector, so the branch starts as "All branches").
///
/// The previous Analytics screen (6-month new members, revenue-by-method
/// donut, revenue by branch) showed things web's Analytics page does not, so
/// it was replaced rather than extended.
class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  AnalyticsView? _view; // null = Overview
  IncomePeriod _period = IncomePeriod.thisMonth;
  DateTimeRange? _custom;
  bool _compare = true;
  String? _branchId;
  List<BranchOption> _branches = [];

  /// Bumped on every scope change so late responses for an old scope are
  /// ignored.
  int _scope = 0;
  final Map<AnalyticsView, _Series> _series = {};
  _Branches? _branchData;

  ({String from, String to}) get _range => incomeRange(_period, _custom);
  bool get _rangeReady => _range.from.compareTo(_range.to) <= 0;

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
    if (!_allowed) return;
    _loadBranchOptions();
    _ensureLoaded();
  }

  Future<void> _loadBranchOptions() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = options);
    } on ApiException {
      // Non-fatal: the branch picker just offers "All branches".
    } catch (_) {}
  }

  void _reload() {
    _scope++;
    _series.clear();
    _branchData = null;
    setState(() {});
    _ensureLoaded();
  }

  void _ensureLoaded() {
    if (!_rangeReady) return;
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
    final b = _branchId;
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
    try {
      final current = await repo.branchComparison(
        from: _d(r.from),
        to: _d(r.to),
        branchId: _branchId,
      );
      List<BranchComparisonRow>? previous;
      if (_compare) {
        try {
          previous = await repo.branchComparison(
            from: _d(prev.from),
            to: _d(prev.to),
            branchId: _branchId,
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

  void _setPeriod(IncomePeriod p) {
    _period = p;
    _reload();
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
          : DateTimeRange(start: _d(r.from), end: _d(r.to)),
    );
    if (picked == null) return;
    _custom = picked;
    _period = IncomePeriod.custom;
    _reload();
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
    _branchId = v.isEmpty ? null : v;
    _reload();
  }

  void _setCompare(bool v) {
    _compare = v;
    // Turning it on needs the previous-period data; turning it off just
    // hides it.
    if (v) {
      _reload();
    } else {
      setState(() {});
    }
  }

  String get _customLabel {
    final c = _custom;
    if (c == null) return 'Custom…';
    return '${dayMonth(c.start)} – ${dayMonth(c.end)}';
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
                            IncomePeriodBar(
                              period: _period,
                              customLabel: _customLabel,
                              onPeriod: _setPeriod,
                              onCustom: _pickCustom,
                              branchId: _branchId,
                              branches: _branches,
                              onBranch: _pickBranch,
                              compare: _compare,
                              onCompare: _setCompare,
                            ),
                            if (_compare && _rangeReady) ...[
                              const SizedBox(height: 8),
                              _compareNote(),
                            ],
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

  Widget _compareNote() {
    final p = previousRange(_range.from, _range.to);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        'Previous period: ${analyticsShortDate(p.from)} – '
        '${analyticsShortDate(p.to)}. Dashed lines show the previous period '
        'of equal length.',
        style: AppText.body(
          size: 11.5,
          color: AppColors.inkFaint,
          weight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _content() {
    if (!_rangeReady) {
      return const AnalyticsCard(
        title: 'Pick a valid range',
        color: TeamColors.slate,
        icon: Icons.date_range_rounded,
        empty: true,
        emptyText: 'Pick a valid date range (start on or before end).',
        child: SizedBox.shrink(),
      );
    }
    final v = _view;
    if (v == null) {
      return _overviewGrid();
    }
    return _focus(v);
  }

  /// One column on phones; two on tablets (the branch card spans both).
  /// Plain columns, not `TeamAdaptive` — that one measures its children with
  /// `IntrinsicHeight`, which the charts' `LayoutBuilder` can't support.
  Widget _overviewGrid() {
    final series = [
      for (final v in AnalyticsView.values)
        if (v != AnalyticsView.branches) _overviewCard(v),
    ];
    final branch = _overviewCard(AnalyticsView.branches);
    return LayoutBuilder(
      builder: (context, box) {
        if (box.maxWidth < 700) {
          return Column(
            children: [
              for (final w in [...series, branch]) ...[
                w,
                const SizedBox(height: 12),
              ],
            ],
          );
        }
        Widget col(int parity) => Expanded(
              child: Column(
                children: [
                  for (var i = parity; i < series.length; i += 2) ...[
                    series[i],
                    const SizedBox(height: 12),
                  ],
                ],
              ),
            );
        return Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [col(0), const SizedBox(width: 12), col(1)],
            ),
            branch,
          ],
        );
      },
    );
  }

  int get _days {
    final r = _range;
    return _d(r.to).difference(_d(r.from)).inDays + 1;
  }

  // ── overview ──────────────────────────────────────────────────────────────

  Widget _overviewCard(AnalyticsView v) {
    if (v == AnalyticsView.branches) {
      final b = _branchData;
      return AnalyticsCard(
        title: v.title,
        subtitle: v.subtitle,
        color: v.color,
        icon: v.icon,
        loading: b == null || b.loading,
        error: b?.error ?? false,
        empty: b != null && !b.loading && !b.error && b.current.isEmpty,
        emptyText: 'No branch data for this period.',
        onRetry: _loadBranches,
        trailing: AnalyticsDeepDive(label: v.title, onTap: () => _setView(v)),
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
    return AnalyticsCard(
      title: v.title,
      subtitle: v.subtitle,
      color: v.color,
      icon: v.icon,
      loading: loading,
      error: s?.error ?? false,
      empty: !loading && !s.error && s.rows.isEmpty,
      onRetry: () => _loadSeries(v),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_compare && stats != null) ...[
            AnalyticsDeltaChip(value: basis, previous: prevBasis),
            const SizedBox(width: 6),
          ],
          AnalyticsDeepDive(label: v.title, onTap: () => _setView(v)),
        ],
      ),
      child: _chart(v, s?.rows ?? const [], 190),
    );
  }

  Widget _chart(AnalyticsView v, List<AnalyticsRow> rows, double height) {
    final dual = v.dual;
    return AnalyticsTrendChart(
      rows: rows,
      format: v.format,
      color: v.color,
      labelA: dual?.$1 ?? v.seriesLabel,
      colorB: dual == null
          ? null
          : (v == AnalyticsView.collection
              ? TeamColors.amber
              : TeamColors.rose),
      labelB: dual?.$2,
      compare: _compare,
      lineOnly: v.lineOnly,
      height: height,
    );
  }

  // ── focus ─────────────────────────────────────────────────────────────────

  Widget _focus(AnalyticsView v) {
    final r = _range;
    if (v == AnalyticsView.branches) {
      final b = _branchData;
      return AnalyticsCard(
        title: v.title,
        subtitle: '${r.from} – ${r.to}',
        color: v.color,
        icon: v.icon,
        loading: b == null || b.loading,
        error: b?.error ?? false,
        empty: b != null && !b.loading && !b.error && b.current.isEmpty,
        emptyText: 'No branch data for this period.',
        onRetry: _loadBranches,
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
          _statTiles(v, stats),
          const SizedBox(height: 12),
        ],
        AnalyticsCard(
          title: v.title,
          subtitle: '${r.from} – ${r.to}',
          color: v.color,
          icon: v.icon,
          loading: loading,
          error: failed,
          empty: !loading && !failed && s.rows.isEmpty,
          onRetry: () => _loadSeries(v),
          child: _chart(v, s?.rows ?? const [], 260),
        ),
      ],
    );
  }

  /// Web's `ViewStatsRow`: four tiles — total/latest, average, peak day and
  /// the change vs previous (or the span when not comparing).
  Widget _statTiles(AnalyticsView v, AnalyticsStats st) {
    final f = v.format;
    final money = f == AnalyticsFormat.money;
    final c = v.color;
    final tiles = <Widget>[];
    final dual = v.dual;
    if (dual != null) {
      final isRate = v == AnalyticsView.collection;
      final tb = st.totalB ?? 0;
      final rate = tb == 0 ? 0.0 : st.total / tb * 100;
      final prevRate = st.prevTotal != null && (st.prevTotalB ?? 0) != 0
          ? st.prevTotal! / st.prevTotalB! * 100
          : null;
      tiles.addAll([
        AnalyticsStatTile(
          label: 'Total ${dual.$1.toLowerCase()}',
          value: st.total,
          format: f,
          previous: st.prevTotal,
          icon: Icons.functions_rounded,
          color: c,
          compact: true,
        ),
        AnalyticsStatTile(
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
          AnalyticsStatTile(
            label: 'Collection rate',
            value: rate,
            format: AnalyticsFormat.percent,
            previous: prevRate,
            icon: Icons.speed_rounded,
            color: c,
            hint: 'collected / invoiced',
          )
        else
          AnalyticsStatTile(
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
        AnalyticsStatTile(
          label: 'Peak ${dual.$1.toLowerCase()} day',
          value: st.peak,
          format: f,
          icon: Icons.trending_up_rounded,
          color: c,
          compact: true,
          hint: st.peakDate.isEmpty ? null : analyticsShortDate(st.peakDate),
        ),
      ]);
    } else {
      final snap = v.isSnapshot;
      tiles.addAll([
        AnalyticsStatTile(
          label: snap ? 'Latest' : 'Total',
          value: snap ? st.latest : st.total,
          format: f,
          previous: snap ? st.prevLatest : st.prevTotal,
          icon: Icons.functions_rounded,
          color: c,
          compact: money,
        ),
        AnalyticsStatTile(
          label: 'Daily average',
          value: st.average,
          format: f,
          previous: st.prevAverage,
          icon: Icons.show_chart_rounded,
          color: c,
          compact: money,
        ),
        AnalyticsStatTile(
          label: 'Peak day',
          value: st.peak,
          format: f,
          icon: Icons.trending_up_rounded,
          color: c,
          compact: money,
          hint: st.peakDate.isEmpty ? null : analyticsShortDate(st.peakDate),
        ),
        if (_compare && st.change != null)
          AnalyticsStatTile(
            label: 'Change vs previous',
            value: st.change!,
            format: AnalyticsFormat.percent,
            icon: Icons.speed_rounded,
            color: c,
            hint: snap ? 'latest vs latest' : 'total vs total',
          )
        else
          AnalyticsStatTile(
            label: 'Days in range',
            value: _days.toDouble(),
            format: AnalyticsFormat.number,
            icon: Icons.calendar_today_rounded,
            color: c,
            hint: _compare ? 'no previous data' : null,
          ),
      ]);
    }
    return LayoutBuilder(
      builder: (context, box) {
        final cols = box.maxWidth >= 700 ? 4 : 2;
        const gap = 10.0;
        final w = (box.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final t in tiles) SizedBox(width: w, height: 118, child: t),
          ],
        );
      },
    );
  }
}
