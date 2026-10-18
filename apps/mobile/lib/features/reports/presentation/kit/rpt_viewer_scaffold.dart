import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'rpt_chart_card.dart';
import 'rpt_export.dart';
import 'rpt_layout.dart';

/// Page frame for one report ("viewer"): gradient [ListHero], then the
/// content column — [filters] (a [RptPeriodBar], filter chips), the
/// [summary] (KPI strip + charts, e.g. `RptSummaryPanel`), extra [panels] —
/// and finally the **results list** with its own loading / error / empty
/// states and a Load more footer. Pull-to-refresh when [onRefresh] is set.
///
/// ```dart
/// RptViewerScaffold<RevenueRow>(
///   title: 'Revenue Report',
///   subtitle: 'Successful payments over time',
///   heroChips: [ListHeroChip(icon: Icons.payments_rounded, label: '₹1.2L')],
///   filters: RptPeriodBar(controller: controls),
///   summary: RptSummaryPanel(type: 'revenue', filters: summaryFilters),
///   items: rows, total: total, hasMore: hasMore, loadingMore: loadingMore,
///   onLoadMore: _more, loading: loading, error: error, onRetry: _load,
///   itemBuilder: (context, row, i) => RevenueCard(row),
/// )
/// ```
///
/// Layout: the hero is full-bleed, the content is capped at 1280 dp
/// ([TeamCenter]) and the result cards go two-up from 600 dp. [topInset]
/// defaults to the status-bar height (pushed routes have no SafeArea above);
/// pass 0 inside a shell that already has one.
class RptViewerScaffold<T> extends StatelessWidget {
  const RptViewerScaffold({
    super.key,
    required this.title,
    required this.items,
    required this.itemBuilder,
    this.subtitle,
    this.leading,
    this.heroActions = const [],
    this.heroChips = const [],
    this.filters,
    this.summary,
    this.panels = const [],
    this.total,
    this.loading = false,
    this.error,
    this.onRetry,
    this.hasMore = false,
    this.loadingMore = false,
    this.onLoadMore,
    this.onRefresh,
    this.resultsTitle = 'Results',
    this.resultsAction,
    this.exportSpec,
    this.emptyTitle = 'Nothing to show',
    this.emptyMessage,
    this.emptyIcon = Icons.inbox_outlined,
    this.topInset,
  });

  final String title;
  final String? subtitle;

  /// Hero's left button (default: a back arrow that pops the route).
  final Widget? leading;

  /// Hero's right-hand round buttons (filters, "Schedule").
  final List<Widget> heroActions;

  /// Hero's bottom chips (`ListHeroChip`) — headline figures.
  final List<Widget> heroChips;
  final Widget? filters;
  final Widget? summary;
  final List<RptPanel> panels;

  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;

  /// Total rows on the server (for "N results" / "Showing x of y").
  final int? total;
  final bool loading;

  /// Error message of the first page load (shows the retry view).
  final String? error;
  final VoidCallback? onRetry;
  final bool hasMore;
  final bool loadingMore;
  final VoidCallback? onLoadMore;
  final Future<void> Function()? onRefresh;
  final String resultsTitle;

  /// Right-hand control of the results header (a filter button).
  final Widget? resultsAction;

  /// Report export (PDF / Excel / CSV / Print, perm `reports:export`): adds
  /// an "Export" pill to the hero and a compact icon to the results header,
  /// both opening the same sheet. Null = the report is not exportable.
  final RptExportSpec? exportSpec;
  final String emptyTitle;
  final String? emptyMessage;
  final IconData emptyIcon;
  final double? topInset;

  @override
  Widget build(BuildContext context) {
    final inset = topInset ?? MediaQuery.paddingOf(context).top;
    final side = 18 + teamSideInset(context);
    final export =
        exportSpec != null && rptCanExport(context) ? exportSpec : null;
    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: ListHero(
            title: title,
            subtitle: subtitle,
            topInset: inset,
            side: side,
            leading: leading ??
                ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
            trailing: [
              ...heroActions,
              if (export != null) RptExportButton(spec: export),
            ],
            chips: heroChips,
          ),
        ),
        SliverToBoxAdapter(
          child: TeamCenter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (filters != null) ...[
                    RptReveal(child: filters!),
                    const SizedBox(height: 12),
                  ],
                  if (summary != null) ...[
                    summary!,
                    const SizedBox(height: 12),
                  ],
                  if (panels.isNotEmpty) ...[
                    RptPanelGrid(panels: panels),
                    const SizedBox(height: 12),
                  ],
                  _resultsHeader(export),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ),
        ),
        ..._results(context),
        const SliverToBoxAdapter(child: SizedBox(height: 24)),
      ],
    );
    final body = onRefresh == null
        ? scroll
        : RefreshIndicator(
            color: AppColors.staffB,
            backgroundColor: AppColors.surface2,
            onRefresh: onRefresh!,
            child: scroll,
          );
    return Scaffold(backgroundColor: AppColors.bg, body: body);
  }

  Widget _resultsHeader(RptExportSpec? export) {
    final n = total ?? items.length;
    return Row(
      children: [
        Expanded(
          child: Text.rich(
            TextSpan(
              text: resultsTitle,
              style: AppText.display(size: 17),
              children: [
                if (!loading && error == null)
                  TextSpan(
                    text: '  ·  $n',
                    style: AppText.body(
                      size: 13,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (export != null) RptExportButton(spec: export, compact: true),
        if (export != null && resultsAction != null) const SizedBox(width: 8),
        if (resultsAction != null) resultsAction!,
      ],
    );
  }

  List<Widget> _results(BuildContext context) {
    if (loading && items.isEmpty) {
      return const [
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: AppLoadingView(),
          ),
        ),
      ];
    }
    if (error != null && items.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: SizedBox(
            height: 260,
            child: AppErrorView(message: error!, onRetry: onRetry),
          ),
        ),
      ];
    }
    if (items.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: SizedBox(
            height: 240,
            child: AppEmptyState(
              title: emptyTitle,
              message: emptyMessage,
              icon: emptyIcon,
            ),
          ),
        ),
      ];
    }
    return [
      teamCardSliver<T>(
        context,
        items: items,
        builder: (item, i) => Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: itemBuilder(context, item, i),
        ),
        footer: hasMore && onLoadMore != null
            ? RptLoadMore(
                shown: items.length,
                total: total ?? items.length,
                loading: loadingMore,
                onPressed: onLoadMore!,
              )
            : null,
      ),
    ];
  }
}
