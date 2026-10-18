import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/network/api_exception.dart';
import '../../../../models/paginated_result.dart';
import '../../../../models/report_summary.dart';
import '../kit/kit.dart';
import 'people_ui.dart';

/// What the screen is currently scoped to (branch + the period bar's range).
/// `from` / `to` are local midnight `DateTime`s of the selected days (null on
/// point-in-time reports); the repository writes them as `YYYY-MM-DD`.
class PeopleQuery {
  const PeopleQuery({this.branchId, this.from, this.to});

  final String? branchId;
  final DateTime? from;
  final DateTime? to;
}

typedef PeopleFetch<T> = Future<PaginatedResult<T>> Function(
  PeopleQuery query,
  int page,
  int limit,
);

/// A one-column "list + load more" controller for a report endpoint:
/// stale responses are dropped, the first page and the next page have their
/// own loading flags, and every failure (typed or not) ends in a message.
class PagedReport<T> extends ChangeNotifier {
  PagedReport(this._fetch, {this.pageSize = 20});

  final Future<PaginatedResult<T>> Function(int page, int limit) _fetch;
  final int pageSize;

  List<T> items = const [];
  int total = 0;
  int page = 0;
  int totalPages = 1;
  bool loading = true;
  bool loadingMore = false;
  String? error;
  int _gen = 0;
  bool _disposed = false;

  bool get hasMore => page < totalPages;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _emit() {
    if (!_disposed) notifyListeners();
  }

  /// Empties the list without a request (invalid range: nothing to ask for).
  void clear() {
    _gen++;
    items = const [];
    total = 0;
    page = 0;
    totalPages = 1;
    loading = false;
    loadingMore = false;
    error = null;
    _emit();
  }

  /// (Re)loads page 1. Keeps nothing from a previous scope.
  Future<void> load() async {
    final gen = ++_gen;
    loading = true;
    loadingMore = false;
    error = null;
    items = const [];
    total = 0;
    page = 0;
    totalPages = 1;
    _emit();
    try {
      final r = await _fetch(1, pageSize);
      if (gen != _gen) return;
      items = r.items;
      total = r.total;
      page = r.page;
      totalPages = r.totalPages;
    } on ApiException catch (e) {
      if (gen != _gen) return;
      error = e.detailedMessage;
    } catch (_) {
      if (gen != _gen) return;
      error = 'Something went wrong loading this report.';
    } finally {
      if (gen == _gen) {
        loading = false;
        _emit();
      }
    }
  }

  /// Appends the next page; returns an error message (for a SnackBar) or null.
  Future<String?> loadMore() async {
    if (loading || loadingMore || !hasMore) return null;
    final gen = _gen;
    loadingMore = true;
    _emit();
    String? failure;
    try {
      final r = await _fetch(page + 1, pageSize);
      if (gen != _gen) return null;
      items = [...items, ...r.items];
      page = r.page;
      totalPages = r.totalPages;
      total = r.total;
    } on ApiException catch (e) {
      failure = e.detailedMessage;
    } catch (_) {
      failure = 'Could not load more rows.';
    } finally {
      if (gen == _gen) {
        loadingMore = false;
        _emit();
      }
    }
    return gen == _gen ? failure : null;
  }
}

/// The shared frame of the people report screens: owns the branch / period
/// controller, the paged rows, the summary hand-off for the hero chips and
/// the pull-to-refresh, and renders it all through [RptViewerScaffold].
///
/// A screen supplies its report [type] (the `/reports/:type` path segment —
/// the summary and the export, `RptExportSpec`, both use it), the [fetch]
/// closure for its rows and an [itemBuilder]. When the screen's own filters change it rebuilds the page
/// with a different [extraKey], which reloads the rows (the summary reloads
/// through [summaryFilters]).
class PeopleReportPage<T> extends StatefulWidget {
  const PeopleReportPage({
    super.key,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.fetch,
    required this.itemBuilder,
    this.showPeriod = false,
    this.extraKey = '',
    this.extraFilters,
    this.summaryFilters,
    this.resultsTitle = 'Results',
    this.resultsAction,
    this.noun = 'results',
    this.emptyTitle = 'Nothing to show',
    this.emptyMessage = 'Try a different branch or filter.',
    this.emptyIcon = Icons.inbox_outlined,
    this.heroActions = const [],
    this.pageSize = 20,
    this.summaryLabelFor = peopleBreakdownLabel,
    this.summaryColorFor = peopleBreakdownColor,
    this.topInset,
  });

  /// Report path segment (`membership`, `trainer-performance`, ...) — the
  /// summary route and the export route both use it.
  final String type;
  final String title;
  final String subtitle;
  final RptAccent accent;
  final PeopleFetch<T> fetch;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;

  /// Date-ranged report (period chips + compare) vs point-in-time snapshot
  /// (branch only).
  final bool showPeriod;

  /// Changes whenever the screen's own filters change -> rows reload.
  final String extraKey;
  final Widget? extraFilters;
  final ReportSummaryFilters Function(PeopleQuery query)? summaryFilters;
  final String resultsTitle;
  final Widget? resultsAction;
  final String noun;
  final String emptyTitle;
  final String emptyMessage;
  final IconData emptyIcon;
  final List<Widget> heroActions;
  final int pageSize;
  final String Function(String breakdownKey, String label)? summaryLabelFor;
  final Color? Function(String breakdownKey, String label)? summaryColorFor;
  final double? topInset;

  @override
  State<PeopleReportPage<T>> createState() => _PeopleReportPageState<T>();
}

class _PeopleReportPageState<T> extends State<PeopleReportPage<T>> {
  late final RptPeriodController _controls;
  late final PagedReport<T> _paged;
  ReportSummary? _summary;
  int _tick = 0;
  String _scope = '';

  PeopleQuery get _query {
    if (!widget.showPeriod) return PeopleQuery(branchId: _controls.branchId);
    final r = _controls.range;
    return PeopleQuery(
      branchId: _controls.branchId,
      from: DateTime.parse(r.from),
      to: DateTime.parse(r.to),
    );
  }

  bool get _ready => !widget.showPeriod || _controls.rangeReady;

  @override
  void initState() {
    super.initState();
    _controls = RptPeriodController()..addListener(_onControls);
    _scope = _controls.scope;
    _paged = PagedReport<T>(
      (page, limit) => widget.fetch(_query, page, limit),
      pageSize: widget.pageSize,
    )..addListener(_rebuild);
    unawaited(_controls.loadBranches());
    unawaited(_reload());
  }

  @override
  void didUpdateWidget(PeopleReportPage<T> old) {
    super.didUpdateWidget(old);
    if (old.extraKey != widget.extraKey) unawaited(_reload());
  }

  @override
  void dispose() {
    // The controller is not disposed: `loadBranches()` may still resolve and
    // notify after this screen is gone (the hub does the same).
    _controls.removeListener(_onControls);
    _paged.dispose();
    super.dispose();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  void _onControls() {
    // Compare / branch-list changes only repaint; a new range or branch
    // reloads the rows (the summary panel reloads from its own filters).
    if (_controls.scope != _scope) {
      _scope = _controls.scope;
      unawaited(_reload());
    }
    _rebuild();
  }

  Future<void> _reload() async {
    if (!_ready) {
      // An inverted / > 366-day custom range: the period bar explains why;
      // no request is made.
      _paged.clear();
      return;
    }
    await _paged.load();
  }

  Future<void> _refresh() async {
    setState(() => _tick++);
    await _reload();
  }

  Future<void> _more() async {
    final msg = await _paged.loadMore();
    if (msg != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  ReportSummaryFilters _summaryFilters() {
    final q = _query;
    final custom = widget.summaryFilters;
    if (custom != null) return custom(q);
    return ReportSummaryFilters(from: q.from, to: q.to, branchId: q.branchId);
  }

  @override
  Widget build(BuildContext context) {
    return RptViewerScaffold<T>(
      title: widget.title,
      subtitle: widget.subtitle,
      topInset: widget.topInset,
      heroActions: widget.heroActions,
      heroChips: peopleHeroChips(
        _summary,
        total: _paged.loading || _paged.error != null ? null : _paged.total,
        noun: widget.noun,
      ),
      filters: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          RptPeriodBar(
            controller: _controls,
            showPeriod: widget.showPeriod,
            accent: widget.accent.color,
          ),
          if (widget.extraFilters != null) ...[
            const SizedBox(height: 12),
            widget.extraFilters!,
          ],
        ],
      ),
      summary: _ready
          ? RptSummaryPanel(
              key: ValueKey('summary-$_tick'),
              type: widget.type,
              filters: _summaryFilters(),
              accent: widget.accent,
              compare: widget.showPeriod && _controls.compare,
              labelFor: widget.summaryLabelFor,
              colorFor: widget.summaryColorFor,
              onLoaded: (s) {
                if (mounted) setState(() => _summary = s);
              },
            )
          : null,
      items: _paged.items,
      itemBuilder: widget.itemBuilder,
      total: _paged.total,
      loading: _paged.loading,
      error: _paged.error,
      onRetry: () => unawaited(_reload()),
      hasMore: _paged.hasMore,
      loadingMore: _paged.loadingMore,
      onLoadMore: () => unawaited(_more()),
      onRefresh: _refresh,
      resultsTitle: widget.resultsTitle,
      resultsAction: widget.resultsAction,
      // The export matches what is on screen: the same filters the summary
      // panel sends (range, branch, status, plan ...).
      exportSpec: RptExportSpec(
        reportType: widget.type,
        title: widget.title,
        filters: _summaryFilters,
        enabled: _ready,
      ),
      emptyTitle: widget.emptyTitle,
      emptyMessage: _ready
          ? widget.emptyMessage
          : 'Pick a valid date range to see this report.',
      emptyIcon: widget.emptyIcon,
    );
  }
}
