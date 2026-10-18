/// # Report chart & viewer kit (`features/reports/presentation/kit/`)
///
/// Everything the Reports hub, Analytics, Scheduled Reports and the
/// individual report screens share. Mirrors web's `features/reports/charts`
/// + `components/ui` + `components/viewer`. `import 'kit/kit.dart';` gives you
/// all of it.
///
/// Rules baked into every widget:
///  * **Units travel with the data** (`RptFormat`): money uses the gym's
///    currency (`AppCurrency`), a count never shows a symbol, a percent is a
///    0..100 value.
///  * Colours come from `AppColors` getters / `RptColors`, so dark + light
///    both work; never cache a neutral in a `static final`.
///  * Charts are single `CustomPainter`s that repaint from the animation
///    only (draw-in 900 ms; bars grow staggered, lines wipe, rings fill).
///    All animation collapses under the OS reduce-motion setting. Nothing
///    loops forever except `RptSkeleton` — in tests pump fixed durations,
///    never `pumpAndSettle` while a skeleton is on screen.
///  * Charts never decide their own loading / error / empty chrome — wrap
///    them in `RptChartCard`. Inside a card they handle "no signal" with
///    `RptChartEmpty`.
///  * Do not put these charts inside `IntrinsicHeight` / `TeamAdaptive`
///    (they contain a `LayoutBuilder`); use `RptPanelGrid`.
///
/// ## Formatting — `rpt_format.dart`
///  * `enum RptFormat { number, money, percent }`
///  * `rptFormatValue(RptFormat f, double v, {bool compact})`
///  * `rptPctChange(value, previous)` -> `double?` (null = "New", no baseline)
///  * `rptShortDate('2026-10-18')` -> `18 Oct` (no timezone maths)
///  * `rptHourLabel(h)` / `rptHourTick(h)`, `kRptWeekdays`,
///    `rptWeekdayIndex(apiWeekday)`, `rptTitleCase(s)`
///
/// ## Theme — `rpt_theme.dart`
///  * `RptColors.{indigo,violet,teal,amber,rose,green,fuchsia,sky,slate}`,
///    `RptColors.series`, `rptSeriesColor(i)`, theme-aware
///    `RptColors.previous / grid / track / axis`, `RptColors.good / bad`
///  * `enum RptAccent { members, finance, attendance, staff, operations,
///    analytics }` with `.color` / `.label` (pass `accent.color` as a
///    chart's `color`)
///
/// ## Data helpers — `rpt_chart_math.dart` (pure, unit-tested)
///  * `RptPoint(label, value, previous?, tip?)` — one x position, this vs
///    previous period
///  * `rptBuildTrend(points, RptTrendMode.{daily,weekly,cumulative})`
///  * `rptNiceAxis(max)`, `rptShares(values)`
///  * `rptHourMatrix(List<double> byHour24)`, `rptCalendarMatrix([(date,
///    value)])` -> `RptHeatMatrix`
///
/// ## Charts
///  * `RptTrendChart(points, format, color, showPrevious, currentLabel,
///    previousLabel, lineOnly, modes, mode/onMode, height, showLegend)` —
///    area/line this-vs-previous with a toggleable legend, Daily / Weekly /
///    Cumulative switch, tap/drag inspect with a crosshair.
///  * `RptMultiSeriesChart(rows: [RptMultiRow(label, values: {key: v})],
///    series: [RptSeriesDef(key, label, type: bar|line|area, color?,
///    dashed)], format, height)` — bars + lines + areas, legend toggles.
///  * `RptGroupedBarChart(data: [RptPoint], format, color, currentLabel,
///    previousLabel, height)` — this vs previous columns per category.
///  * `RptCartesianChart(labels, series: [RptSeries], format, height)` — the
///    low-level engine behind the three above (use it for anything custom,
///    e.g. two areas + two dashed previous lines).
///  * `RptDonut(data: [RptDonutDatum(label, value, color?)], format,
///    centerLabel, centerValue, size, maxLegend)` — tap a slice / legend row.
///  * `RptHBarChart(data: [RptHBarDatum(label, value, previous?, hint?,
///    color?)], format, color, limit, sort, rankBadges, onTap)` — ranked
///    bars, previous-period ticks.
///  * `RptHeatmap(matrix, format, color, cellHeight, labelEvery)` — hours or
///    calendar grid, tap to inspect, Less -> More ramp.
///  * `RptRadialGauge(value, max, size, thickness, color, label, child)`
///  * `RptSparkArea(values, color, height)` — KPI sparkline.
///
/// ## Cards, tiles, controls
///  * `RptChartCard(title, subtitle, icon, color, actions, legend, footer,
///    loading, error, errorText, empty, emptyText, onRetry, onTap,
///    minHeight, child)` — the panel shell with loading/error/empty states.
///  * `RptKpi(label, value, format, previous, invert, icon, color, sparkline,
///    hint, text, compact, onTap)` + `RptKpiTile(kpi, loading, height)` +
///    `RptKpiGrid(kpis, loading, columns)` (2/3/4/5 columns by width).
///  * `RptDeltaBadge(value, previous, invert)`
///  * `RptSegmented(options: [RptSegment(value,label,icon)], value,
///    onChanged, color)`, `RptFilterChips(chips: [RptChip(value,label,
///    count,dot)], value, onChanged, color)`, `RptStatPill(value, label,
///    icon, color)`, `RptLegend(items: [RptLegendItem], hidden, onToggle)`
///  * `RptPanelGrid(panels: [RptPanel(child, full)])` — 1 column on phones,
///    2 masonry columns from 700 dp.
///  * `RptReveal(index, child)` — staggered fade-up entrance.
///  * `RptSkeleton(height, width)`, `RptChartEmpty(height, message)`.
///
/// ## Period / filters
///  * `RptPeriodController` (ChangeNotifier): `period`, `range`
///    (`YYYY-MM-DD` local days), `previousRange`, `compare`, `branchId`,
///    `rangeReady` (false for inverted or > 366-day ranges), `scope`
///    (changes when the data to fetch changes), `loadBranches()`,
///    `pickCustom(context)`, `pickBranch(context)`.
///  * `RptPeriodBar(controller, showPeriod, showCompare, showBranch,
///    accent)` — web's PeriodBar; `showPeriod: false` is the branch-only
///    bar for point-in-time reports.
///  * `showRptFilterSheet(context, title:, builder:, onReset:)` +
///    `RptFilterGroup(label, child)` — extra-filter bottom sheet.
///
/// ## Viewer scaffold
///  * `RptViewerScaffold(title, subtitle, heroChips, heroActions,
///    filters, summary, panels, items, itemBuilder, total, loading, error,
///    onRetry, hasMore, loadingMore, onLoadMore, onRefresh, resultsTitle,
///    resultsAction, emptyTitle, emptyMessage, topInset)` — ListHero +
///    filters + summary + panels + results list (two-up on tablets) with
///    Load more.
///  * `RptSummaryPanel(type, filters: ReportSummaryFilters, accent,
///    compare, invertDeltas)` — loads `GET /reports/:type/summary` and
///    renders it (replaces the old `ReportSummaryHeader`); hidden without
///    `reports:view` / on 403. `RptSummarySection(type, summary, ...)`
///    renders an already-loaded `ReportSummary`.
///  * `RptLoadMore(shown, total, loading, onPressed)`.
///
/// ## Export (PDF / Excel / CSV / Print) — `rpt_export.dart`
///  * `RptExportSpec(reportType, title, filters: () => ReportSummaryFilters,
///    enabled)` — pass it as `RptViewerScaffold.exportSpec` (adds the hero
///    "Export" pill + the results-header icon) or drop a `RptExportButton`
///    into any hero. Needs `reports:export` (`rptCanExport`); the files come
///    from `ReportsRepository.exportReport` and leave through the `ExportSink`
///    in `get_it` (`core/export/export_sink.dart`).
library;

export 'rpt_bars.dart';
export 'rpt_cartesian_chart.dart';
export 'rpt_chart_card.dart';
export 'rpt_chart_math.dart';
export 'rpt_controls.dart';
export 'rpt_donut.dart';
export 'rpt_export.dart';
export 'rpt_filter_sheet.dart';
export 'rpt_format.dart';
export 'rpt_gauge.dart';
export 'rpt_heatmap.dart';
export 'rpt_kpi.dart';
export 'rpt_layout.dart';
export 'rpt_line_charts.dart';
export 'rpt_period.dart';
export 'rpt_summary.dart';
export 'rpt_theme.dart';
export 'rpt_viewer_scaffold.dart';
