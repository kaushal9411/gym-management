import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/theme/app_colors.dart';
import 'package:gym_saas_mobile/core/utils/app_currency.dart';
import 'package:gym_saas_mobile/features/income/presentation/income_ui.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';
import 'package:gym_saas_mobile/shared/widgets/list_hero.dart';

List<RptPoint> _daily({bool prev = true}) => [
      for (var i = 1; i <= 14; i++)
        RptPoint(
          label: '$i Oct',
          tip: '$i October',
          value: i * 100.0,
          previous: prev ? i * 60.0 : null,
        ),
    ];

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);
  tearDown(() {
    AppCurrency.reset();
    AppColors.isLight = false;
  });

  Future<void> pump(
    WidgetTester t,
    Widget child, {
    Size size = const Size(360, 740),
    bool scroll = true,
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: scroll
              ? SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: child,
                )
              : child,
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 2));
  }

  Future<void> tapChart(WidgetTester t, {double dx = 200}) async {
    final box = find.byType(RptCartesianChart);
    final tl = t.getTopLeft(box);
    await t.tapAt(tl + Offset(dx, 40 + 80));
    await t.pump();
  }

  group('RptTrendChart', () {
    testWidgets('renders legend + inspect readout, money has the symbol',
        (t) async {
      await pump(
        t,
        RptTrendChart(points: _daily(), format: RptFormat.money),
      );
      expect(find.text('This period'), findsOneWidget);
      expect(find.text('Previous period'), findsOneWidget);
      expect(find.text('Tap the chart to inspect'), findsOneWidget);
      await tapChart(t);
      expect(find.text('Tap the chart to inspect'), findsNothing);
      expect(find.textContaining('This period ₹'), findsOneWidget);
      expect(find.textContaining('Previous period ₹'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('a count chart never shows a currency symbol', (t) async {
      await pump(t, RptTrendChart(points: _daily()));
      await tapChart(t);
      expect(find.textContaining('₹'), findsNothing);
      expect(find.textContaining('This period '), findsOneWidget);
    });

    testWidgets('legend toggles a series off', (t) async {
      await pump(t, RptTrendChart(points: _daily()));
      await t.tap(find.text('Previous period'));
      await t.pump();
      await tapChart(t);
      expect(find.textContaining('Previous period '), findsNothing);
      expect(find.textContaining('This period '), findsOneWidget);
    });

    testWidgets('mode switch re-buckets (weekly -> Wk labels in readout)',
        (t) async {
      await pump(t, RptTrendChart(points: _daily()));
      await t.tap(find.text('Weekly'));
      await t.pump();
      await t.pump(const Duration(seconds: 2));
      await tapChart(t, dx: 100);
      expect(find.textContaining(' – '), findsWidgets);
      await t.tap(find.text('Cumulative'));
      await t.pump();
      await t.pump(const Duration(seconds: 2));
      expect(t.takeException(), isNull);
    });

    testWidgets('empty data shows the empty state', (t) async {
      await pump(t, const RptTrendChart(points: []));
      expect(find.text('No data for this period'), findsOneWidget);
      await pump(
        t,
        const RptTrendChart(
          points: [
            RptPoint(label: 'a', value: 0),
            RptPoint(label: 'b', value: 0)
          ,],
        ),
      );
      expect(find.text('No data for this period'), findsOneWidget);
    });

    testWidgets('single point and no previous do not crash', (t) async {
      await pump(
        t,
        const RptTrendChart(points: [RptPoint(label: 'a', value: 5)]),
      );
      await tapChart(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('light theme paints without errors', (t) async {
      AppColors.isLight = true;
      await pump(t, RptTrendChart(points: _daily()));
      expect(t.takeException(), isNull);
    });
  });

  group('RptMultiSeriesChart / RptGroupedBarChart', () {
    testWidgets('multi series: legend toggles, inspect lists every series',
        (t) async {
      await pump(
        t,
        RptMultiSeriesChart(
          rows: [
            for (var i = 1; i <= 7; i++)
              RptMultiRow(
                label: 'd$i',
                values: {'r': i * 100, 'e': i * 40, 'n': i * 60},
              ),
          ],
          series: const [
            RptSeriesDef(key: 'r', label: 'Revenue'),
            RptSeriesDef(key: 'e', label: 'Expenses'),
            RptSeriesDef(key: 'n', label: 'Net', type: RptSeriesType.line),
          ],
        ),
      );
      await tapChart(t);
      expect(find.textContaining('Revenue ₹'), findsOneWidget);
      expect(find.textContaining('Expenses ₹'), findsOneWidget);
      expect(find.textContaining('Net ₹'), findsOneWidget);
      await t.tap(find.text('Expenses'));
      await t.pump();
      await tapChart(t);
      expect(find.textContaining('Expenses ₹'), findsNothing);
    });

    testWidgets('grouped bars: this vs previous, tap a band', (t) async {
      await pump(
        t,
        RptGroupedBarChart(
          data: [
            for (final d in kRptWeekdays)
              RptPoint(label: d, value: 10, previous: 6),
          ],
        ),
      );
      await tapChart(t, dx: 60);
      expect(find.textContaining('This period 10'), findsOneWidget);
      expect(find.textContaining('Previous 6'), findsOneWidget);
    });

    testWidgets('bars only (no previous) and all-zero', (t) async {
      await pump(
        t,
        const RptGroupedBarChart(
          data: [
            RptPoint(label: 'Mon', value: 0),
            RptPoint(label: 'Tue', value: 0)
          ,],
        ),
      );
      expect(find.text('No data for this period'), findsOneWidget);
    });
  });

  group('RptDonut', () {
    const data = [
      RptDonutDatum(label: 'Active', value: 60),
      RptDonutDatum(label: 'Expired', value: 30),
      RptDonutDatum(label: 'Frozen', value: 10),
    ];

    testWidgets('centre shows the total, tapping a legend row inspects it',
        (t) async {
      await pump(t, const RptDonut(data: data, centerLabel: 'Members'));
      expect(find.text('Members'), findsOneWidget);
      expect(find.text('100'), findsOneWidget);
      expect(find.text('60%'), findsOneWidget);
      await t.tap(find.text('Expired'));
      await t.pump();
      expect(find.text('30.0%'), findsOneWidget);
      // second tap on the same row clears it
      await t.tap(find.text('Expired').last);
      await t.pump();
      expect(find.text('30.0%'), findsNothing);
    });

    testWidgets('money donut uses the currency, legend beside on wide',
        (t) async {
      await pump(
        t,
        const RptDonut(data: data, format: RptFormat.money),
        size: const Size(900, 700),
      );
      expect(find.textContaining('₹'), findsWidgets);
      expect(t.takeException(), isNull);
    });

    testWidgets('empty / all-zero shows the empty state', (t) async {
      await pump(t, const RptDonut(data: []));
      expect(find.text('No data for this period'), findsOneWidget);
    });

    testWidgets('many slices collapse into "+N more"', (t) async {
      await pump(
        t,
        RptDonut(
          maxLegend: 3,
          data: [
            for (var i = 0; i < 6; i++)
              RptDonutDatum(label: 'S$i', value: i + 1.0),
          ],
        ),
      );
      expect(find.text('+3 more'), findsOneWidget);
    });
  });

  group('RptHBarChart / RptHeatmap / RptRadialGauge / RptSparkArea', () {
    testWidgets('hbar sorts descending, numbers ranks and caps at limit',
        (t) async {
      await pump(
        t,
        const RptHBarChart(
          rankBadges: true,
          limit: 2,
          data: [
            RptHBarDatum(label: 'Low', value: 1),
            RptHBarDatum(label: 'High', value: 9, previous: 5),
            RptHBarDatum(label: 'Mid', value: 4, hint: 'x'),
          ],
        ),
      );
      expect(find.text('Low'), findsNothing);
      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(
        t.getTopLeft(find.text('High')).dy,
        lessThan(t.getTopLeft(find.textContaining('Mid')).dy),
      );
    });

    testWidgets('hbar sort:false keeps the order; empty state', (t) async {
      await pump(
        t,
        const RptHBarChart(
          sort: false,
          data: [
            RptHBarDatum(label: 'A', value: 1),
            RptHBarDatum(label: 'B', value: 9),
          ],
        ),
      );
      expect(
        t.getTopLeft(find.text('A')).dy,
        lessThan(t.getTopLeft(find.text('B')).dy),
      );
      await pump(t, const RptHBarChart(data: []));
      expect(find.text('No data for this period'), findsOneWidget);
    });

    testWidgets('heatmap: tap a cell shows its title and value', (t) async {
      final m = rptHourMatrix([for (var h = 0; h < 24; h++) h.toDouble()]);
      await pump(t, RptHeatmap(matrix: m, labelEvery: 3));
      expect(find.text('Tap a cell to inspect'), findsOneWidget);
      final tl = t.getTopLeft(find.byType(RptHeatmap));
      // last column (23 -> 11 PM)
      await t.tapAt(tl + const Offset(360 - 36 - 12, 24 + 14));
      await t.pump();
      expect(find.textContaining('11 PM: 23'), findsOneWidget);
    });

    testWidgets('heatmap with no signal is empty', (t) async {
      await pump(t, RptHeatmap(matrix: rptHourMatrix(const [])));
      expect(find.text('No data for this period'), findsOneWidget);
    });

    testWidgets('gauge shows the percentage and a label', (t) async {
      await pump(
        t,
        const RptRadialGauge(value: 42, label: 'Margin', size: 120),
      );
      expect(find.text('42%'), findsOneWidget);
      expect(find.text('MARGIN'), findsNothing); // eyebrow is not upper-cased
      expect(find.text('Margin'), findsOneWidget);
    });

    testWidgets('gauge clamps over/under range', (t) async {
      await pump(t, const RptRadialGauge(value: 250));
      expect(find.text('100%'), findsOneWidget);
      await pump(t, const RptRadialGauge(value: -5));
      expect(find.text('0%'), findsOneWidget);
    });

    testWidgets('spark area with <2 values renders blank space', (t) async {
      await pump(t, const RptSparkArea(values: [1]));
      expect(t.takeException(), isNull);
      await pump(t, const RptSparkArea(values: [1, 3, 2, 5]));
      expect(t.takeException(), isNull);
    });
  });

  group('KPI tiles', () {
    testWidgets('count-up lands on the formatted value, with delta and text',
        (t) async {
      await pump(
        t,
        RptKpiGrid(
          kpis: [
            const RptKpi(
              label: 'Revenue',
              value: 150000,
              previous: 100000,
              format: RptFormat.money,
              compact: true,
              sparkline: [1, 3, 2, 5],
            ),
            const RptKpi(label: 'New members', value: 12, previous: 24),
            const RptKpi(
              label: 'Churned',
              value: 2,
              previous: 5,
              invert: true,
            ),
            const RptKpi(label: 'Top plan', value: 0, text: 'Gold'),
            const RptKpi(
                label: 'Success', value: 91.5, format: RptFormat.percent,),
          ],
        ),
      );
      expect(find.text('₹1.50L'), findsOneWidget);
      expect(find.text('12'), findsOneWidget);
      expect(find.text('Gold'), findsOneWidget);
      expect(find.text('91.5%'), findsOneWidget);
      expect(find.text('50.0%'), findsNWidgets(2)); // +50% and -50%
      expect(find.text('REVENUE'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('delta colours invert for spend-style KPIs', (t) async {
      await pump(
        t,
        const Row(
          children: [
            RptDeltaBadge(value: 10, previous: 20, invert: true),
            RptDeltaBadge(value: 10, previous: 20),
            RptDeltaBadge(value: 5, previous: 0),
            RptDeltaBadge(value: 5, previous: null),
          ],
        ),
      );
      Color iconColor(int i) => t.widget<Icon>(find.byType(Icon).at(i)).color!;
      expect(iconColor(0), RptColors.good); // spend down = good
      expect(iconColor(1), RptColors.bad);
      expect(find.text('New'), findsOneWidget);
    });

    testWidgets('loading state shows skeletons instead of figures', (t) async {
      await pump(
        t,
        const RptKpiGrid(
          loading: true,
          kpis: [RptKpi(label: 'A', value: 5), RptKpi(label: 'B', value: 6)],
        ),
      );
      expect(find.text('5'), findsNothing);
      expect(find.byType(RptSkeleton), findsNWidgets(2));
    });

    test('kpi columns by width', () {
      expect(rptKpiColumns(360), 2);
      expect(rptKpiColumns(600), 3);
      expect(rptKpiColumns(900), 4);
      expect(rptKpiColumns(1280), 5);
    });

    testWidgets('lone last tile spans the row on phones', (t) async {
      await pump(
        t,
        const RptKpiGrid(
          kpis: [
            RptKpi(label: 'A', value: 1),
            RptKpi(label: 'B', value: 2),
            RptKpi(label: 'C', value: 3),
          ],
        ),
      );
      final a = t.getSize(find.byType(RptKpiTile).at(0)).width;
      final c = t.getSize(find.byType(RptKpiTile).at(2)).width;
      expect(c, greaterThan(a * 1.8));
    });
  });

  group('RptChartCard', () {
    testWidgets('loading, error (retry), empty and content', (t) async {
      var retried = 0;
      await pump(
        t,
        RptChartCard(title: 'T', loading: true, child: const Text('body')),
      );
      expect(find.text('body'), findsNothing);
      expect(find.byType(RptSkeleton), findsOneWidget);
      await pump(
        t,
        RptChartCard(
          title: 'T',
          error: true,
          onRetry: () => retried++,
          child: const Text('body'),
        ),
      );
      await t.tap(find.text('Retry'));
      expect(retried, 1);
      await pump(
        t,
        const RptChartCard(
          title: 'T',
          empty: true,
          emptyText: 'Nothing here',
          child: Text('body'),
        ),
      );
      expect(find.text('Nothing here'), findsOneWidget);
      await pump(
        t,
        const RptChartCard(
          title: 'T',
          subtitle: 'sub',
          legend: Text('legend'),
          footer: Text('foot'),
          actions: Text('act'),
          child: Text('body'),
        ),
      );
      for (final s in ['T', 'sub', 'legend', 'foot', 'act', 'body']) {
        expect(find.text(s), findsOneWidget, reason: s);
      }
    });
  });

  group('controls', () {
    testWidgets('segmented switches, chips show counts', (t) async {
      var seg = 'a';
      var chip = 1;
      await pump(
        t,
        StatefulBuilder(
          builder: (context, setState) => Column(
            children: [
              RptSegmented<String>(
                options: const [
                  RptSegment('a', 'Alpha'),
                  RptSegment('b', 'Beta')
                ,],
                value: seg,
                onChanged: (v) => setState(() => seg = v),
              ),
              RptFilterChips<int>(
                chips: const [RptChip(1, 'One', count: 3), RptChip(2, 'Two')],
                value: chip,
                onChanged: (v) => setState(() => chip = v),
              ),
            ],
          ),
        ),
      );
      await t.tap(find.text('Beta'));
      await t.pump();
      expect(seg, 'b');
      expect(find.text('3'), findsOneWidget);
      await t.tap(find.text('Two'));
      await t.pump();
      expect(chip, 2);
    });

    testWidgets('legend without onToggle is not tappable', (t) async {
      await pump(
        t,
        const RptLegend(
          items: [
            RptLegendItem(key: 'a', label: 'A', color: Colors.red, value: '9')
          ,],
        ),
      );
      expect(find.text('9'), findsOneWidget);
    });
  });

  group('RptPanelGrid', () {
    Widget panels() => RptPanelGrid(
          panels: [
            for (var i = 0; i < 4; i++) RptPanel(Text('p$i')),
            const RptPanel(Text('full'), full: true),
          ],
        );

    testWidgets('one column on phones', (t) async {
      await pump(t, panels());
      expect(
          t.getTopLeft(find.text('p0')).dx, t.getTopLeft(find.text('p1')).dx,);
      expect(t.getTopLeft(find.text('p1')).dy,
          greaterThan(t.getTopLeft(find.text('p0')).dy),);
    });

    testWidgets('two columns on tablets, full panel spans below', (t) async {
      await pump(t, panels(), size: const Size(1500, 1300));
      expect(t.getTopLeft(find.text('p1')).dx,
          greaterThan(t.getTopLeft(find.text('p0')).dx),);
      expect(t.getTopLeft(find.text('full')).dy,
          greaterThan(t.getTopLeft(find.text('p3')).dy),);
    });
  });

  group('RptPeriodBar', () {
    testWidgets('chips change the period; compare switch toggles', (t) async {
      final c = RptPeriodController();
      addTearDown(c.dispose);
      await pump(t, RptPeriodBar(controller: c));
      expect(find.text('This month'), findsOneWidget);
      await t.tap(find.text('7 days'));
      await t.pump();
      expect(c.period, IncomePeriod.days7);
      expect(c.days, 7);
      expect(find.textContaining('Previous period:'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('rpt-compare')));
      await t.pump();
      expect(c.compare, isFalse);
      expect(find.textContaining('Previous period:'), findsNothing);
    });

    testWidgets('branch-only bar hides period + compare', (t) async {
      final c = RptPeriodController();
      addTearDown(c.dispose);
      await pump(t, RptPeriodBar(controller: c, showPeriod: false));
      expect(find.text('This month'), findsNothing);
      expect(find.byKey(const ValueKey('rpt-compare')), findsNothing);
      expect(find.textContaining('current snapshot'), findsOneWidget);
      expect(find.text('All branches'), findsOneWidget);
    });

    testWidgets('an over-long custom range is flagged', (t) async {
      final c = RptPeriodController()
        ..setCustom(
          DateTimeRange(start: DateTime(2024), end: DateTime(2026)),
        );
      addTearDown(c.dispose);
      await pump(t, RptPeriodBar(controller: c));
      expect(find.textContaining('may not exceed'), findsOneWidget);
    });
  });

  group('RptViewerScaffold', () {
    Widget scaffold({
      required List<int> items,
      bool loading = false,
      String? error,
      bool hasMore = false,
      VoidCallback? onLoadMore,
    }) =>
        RptViewerScaffold<int>(
          title: 'Revenue Report',
          subtitle: 'Payments',
          heroChips: const [ListHeroChip(icon: Icons.payments, label: '₹1.2L')],
          filters: const Text('FILTERS'),
          summary: const Text('SUMMARY'),
          panels: const [RptPanel(Text('PANEL'))],
          items: items,
          total: 40,
          loading: loading,
          error: error,
          onRetry: () {},
          hasMore: hasMore,
          onLoadMore: onLoadMore,
          itemBuilder: (context, v, i) => Container(
            height: 60,
            color: Colors.blueGrey,
            child: Text('row $v'),
          ),
          emptyTitle: 'No rows',
        );

    testWidgets('phone: hero, filters, summary, rows, load more', (t) async {
      var more = 0;
      await pump(
        t,
        scaffold(
          items: [1, 2, 3],
          hasMore: true,
          onLoadMore: () => more++,
        ),
        scroll: false,
      );
      for (final s in [
        'Revenue Report',
        'FILTERS',
        'SUMMARY',
        'PANEL',
        'row 1'
      ,]) {
        expect(find.text(s), findsOneWidget, reason: s);
      }
      await t.drag(find.byType(CustomScrollView), const Offset(0, -600));
      await t.pump();
      await t.tap(find.text('Load more'));
      expect(more, 1);
      expect(find.text('Showing 3 of 40'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('loading / error / empty results states', (t) async {
      await pump(t, scaffold(items: const [], loading: true), scroll: false);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await pump(t, scaffold(items: const [], error: 'boom'), scroll: false);
      expect(find.text('boom'), findsOneWidget);
      await pump(t, scaffold(items: const []), scroll: false);
      expect(find.text('No rows'), findsOneWidget);
    });

    testWidgets('tablet: rows two-up, no overflow', (t) async {
      await pump(
        t,
        scaffold(items: [1, 2, 3, 4]),
        size: const Size(1500, 1300),
        scroll: false,
      );
      expect(t.getTopLeft(find.text('row 2')).dx,
          greaterThan(t.getTopLeft(find.text('row 1')).dx),);
      expect(t.takeException(), isNull);
    });
  });
}
