import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/utils/app_currency.dart';
import 'package:gym_saas_mobile/features/income/presentation/income_ui.dart';
import 'package:gym_saas_mobile/features/reports/presentation/kit/kit.dart';

void main() {
  tearDown(AppCurrency.reset);

  group('rptNiceAxis', () {
    test('rounds up to a nice step', () {
      final a = rptNiceAxis(870);
      expect(a.max, 1000);
      expect(a.ticks, [0, 250, 500, 750, 1000]);
    });

    test('small counts stay integers', () {
      final a = rptNiceAxis(3, integers: true);
      expect(a.ticks.every((t) => t == t.roundToDouble()), isTrue);
      expect(a.max, greaterThanOrEqualTo(3));
    });

    test('empty / invalid data gives a unit axis', () {
      expect(rptNiceAxis(0).max, 1);
      expect(rptNiceAxis(double.nan).max, 1);
      expect(rptNiceAxis(-5).ticks.first, 0);
    });

    test('always covers the data max', () {
      for (final m in [0.4, 1, 7, 99, 1234, 56789, 2.5e6]) {
        expect(rptNiceAxis(m.toDouble()).max, greaterThanOrEqualTo(m));
      }
    });
  });

  group('rptBuildTrend', () {
    final daily = [
      for (var i = 1; i <= 10; i++)
        RptPoint(
          label: 'd$i',
          tip: 'D$i',
          value: i.toDouble(),
          previous: i * 2.0,
        ),
    ];

    test('daily is untouched', () {
      expect(rptBuildTrend(daily, RptTrendMode.daily), same(daily));
    });

    test('weekly sums chunks of 7 and labels the range', () {
      final w = rptBuildTrend(daily, RptTrendMode.weekly);
      expect(w.length, 2);
      expect(w[0].label, 'Wk 1');
      expect(w[0].value, 28); // 1..7
      expect(w[0].previous, 56);
      expect(w[0].tip, 'D1 – D7');
      expect(w[1].value, 27); // 8+9+10
      expect(w[1].tip, 'D8 – D10');
    });

    test('cumulative is a running total, previous stays null if unknown', () {
      final c = rptBuildTrend(daily, RptTrendMode.cumulative);
      expect(c.last.value, 55);
      expect(c.last.previous, 110);
      final noPrev = rptBuildTrend(
        const [
          RptPoint(label: 'a', value: 2),
          RptPoint(label: 'b', value: 3),
        ],
        RptTrendMode.cumulative,
      );
      expect(noPrev.map((p) => p.value), [2, 5]);
      expect(noPrev.every((p) => p.previous == null), isTrue);
    });

    test('weekly previous is null when no point had one', () {
      final w = rptBuildTrend(
        const [RptPoint(label: 'a', value: 1)],
        RptTrendMode.weekly,
      );
      expect(w.single.previous, isNull);
      expect(w.single.tip, 'a');
    });
  });

  group('shares, picking, stagger', () {
    test('rptShares', () {
      expect(rptShares([1, 1, 2]), [0.25, 0.25, 0.5]);
      expect(rptShares([0, 0]), [0, 0]);
      expect(rptShares([-3, 3]), [0, 1]);
    });

    test('line index picks the nearest point and clamps', () {
      int pick(double dx) =>
          rptPickLineIndex(dx, left: 40, right: 10, width: 250, n: 5);
      expect(pick(0), 0);
      expect(pick(40), 0);
      expect(pick(145), 2);
      expect(pick(999), 4);
      expect(
        rptPickLineIndex(5, left: 0, right: 0, width: 100, n: 1),
        0,
      );
    });

    test('band index picks the containing band', () {
      int pick(double dx) =>
          rptPickBandIndex(dx, left: 0, right: 0, width: 100, n: 4);
      expect(pick(0), 0);
      expect(pick(26), 1);
      expect(pick(99.9), 3);
      expect(pick(500), 3);
    });

    test('stagger grows the first bar before the last', () {
      expect(rptStagger(0, 0, 5), 0);
      expect(rptStagger(1, 4, 5), 1);
      expect(rptStagger(0.3, 0, 5), greaterThan(rptStagger(0.3, 4, 5)));
    });
  });

  group('heatmap matrices', () {
    test('hour matrix: one row of 24, pads short input', () {
      final m = rptHourMatrix([0, 0, 3]);
      expect(m.rows, ['Check-ins']);
      expect(m.values.single.length, 24);
      expect(m.values.single[2], 3);
      expect(m.cols[0], '12a');
      expect(m.cols[13], '1p');
      expect(m.titles.single[18], '6 PM');
      expect(m.max, 3);
    });

    test('calendar matrix is Monday-first with week columns', () {
      // 2026-10-05 is a Monday; 2026-10-18 a Sunday.
      final m = rptCalendarMatrix([
        (date: '2026-10-05', value: 4),
        (date: '2026-10-07', value: 2),
        (date: '2026-10-18', value: 9),
      ]);
      expect(m.rows, kRptWeekdays);
      expect(m.cols.length, 2);
      expect(m.values[0][0], 4); // Mon wk1
      expect(m.values[2][0], 2); // Wed wk1
      expect(m.values[6][1], 9); // Sun wk2
      expect(m.values[1][0], 0);
      expect(m.titles[0][0], 'Mon 5 Oct');
    });

    test('calendar matrix starts the week before a mid-week first date', () {
      final m = rptCalendarMatrix([(date: '2026-10-07', value: 1)]); // Wed
      expect(m.cols.single, '5 Oct');
      expect(m.values[2].single, 1);
    });

    test('empty input', () {
      final m = rptCalendarMatrix(const []);
      expect(m.cols, isEmpty);
      expect(m.max, 0);
    });

    test('heat alpha', () {
      expect(rptHeatAlpha(0, 10), 0);
      expect(rptHeatAlpha(10, 10), closeTo(0.94, 1e-9));
      expect(rptHeatAlpha(5, 10), closeTo(0.54, 1e-9));
    });
  });

  group('donut geometry', () {
    test('slices are consecutive fractions of a turn', () {
      final s = rptDonutSlices([1, 1, 2]);
      expect(s[0].start, 0);
      expect(s[0].sweep, 0.25);
      expect(s[2].start, 0.5);
      expect(s[2].sweep, 0.5);
    });

    test('hit test maps an angle to its slice', () {
      final s = rptDonutSlices([1, 1]);
      // size 100: right of centre is 90deg clockwise from the top = slice 0.
      expect(rptDonutHit(const Offset(90, 50), 100, s), 0);
      expect(rptDonutHit(const Offset(10, 50), 100, s), 1);
      // the hole and outside miss
      expect(rptDonutHit(const Offset(50, 50), 100, s), isNull);
      expect(rptDonutHit(const Offset(200, 50), 100, s), isNull);
    });
  });

  group('formatting', () {
    test('a count never carries a currency symbol', () {
      expect(rptFormatValue(RptFormat.number, 1240), '1,240');
      expect(rptFormatValue(RptFormat.number, 12500, compact: true), '13k');
      expect(rptFormatValue(RptFormat.number, 1500, compact: true), '1.5k');
      expect(rptFormatValue(RptFormat.number, 1000, compact: true), '1k');
      expect(rptFormatValue(RptFormat.number, 12), '12');
      expect(rptFormatValue(RptFormat.number, 12).contains('₹'), isFalse);
    });

    test('money follows the gym currency', () {
      expect(rptFormatValue(RptFormat.money, 85000), '₹85,000');
      expect(rptFormatValue(RptFormat.money, 120000), '₹1.20L');
      expect(rptFormatValue(RptFormat.money, 1500, compact: true), '₹1.5k');
      expect(rptFormatValue(RptFormat.money, -4200), '-₹4,200');
      // The symbol always comes from AppCurrency (never hardcoded).
      expect(
        rptFormatValue(RptFormat.money, 85000),
        startsWith(AppCurrency.symbol),
      );
    });

    test('percent keeps one decimal only when needed', () {
      expect(rptFormatValue(RptFormat.percent, 42), '42%');
      expect(rptFormatValue(RptFormat.percent, 42.5), '42.5%');
    });

    test('pct change: null without baseline, never an invented +100%', () {
      expect(rptPctChange(10, null), isNull);
      expect(rptPctChange(10, 0), isNull);
      expect(rptPctChange(0, 0), 0);
      expect(rptPctChange(150, 100), 50);
      expect(rptPctChange(50, 100), -50);
    });

    test('weekday / hour / title helpers', () {
      expect(rptWeekdayIndex(0), 6); // Sunday last
      expect(rptWeekdayIndex(1), 0);
      expect(rptWeekdayIndex(7), 6);
      expect(rptHourLabel(0), '12 AM');
      expect(rptHourLabel(13), '1 PM');
      expect(rptTitleCase('BANK_TRANSFER'), 'Bank Transfer');
      expect(rptTitleCase('credit-card'), 'Credit Card');
    });

    test('short date does no timezone maths', () {
      expect(rptShortDate('2026-10-18'), '18 Oct');
      expect(rptShortDate('2026-01-01T00:00:00.000Z'), '1 Jan');
    });
  });

  group('previous range / period controller', () {
    test('equal length ending the day before, across a year boundary', () {
      final p = rptPreviousRange('2026-01-01', '2026-01-10');
      expect(p.from, '2025-12-22');
      expect(p.to, '2025-12-31');
    });

    test('controller range, scope and limits', () {
      final c = RptPeriodController(period: IncomePeriod.today);
      final now = DateTime.now();
      expect(c.range.from, c.range.to);
      expect(c.days, 1);
      expect(c.rangeReady, isTrue);
      final before = c.scope;
      c.setBranch('b1');
      expect(c.scope, isNot(before));
      var notified = 0;
      c.addListener(() => notified++);
      c.setCompare(c.compare); // no change -> no notification
      expect(notified, 0);
      c.setCompare(!c.compare);
      expect(notified, 1);
      c.setCustom(
        DateTimeRange(
          start: DateTime(now.year - 2),
          end: DateTime(now.year),
        ),
      );
      expect(c.period, IncomePeriod.custom);
      expect(c.rangeTooLong, isTrue);
      expect(c.rangeReady, isFalse);
      c.setCustom(
        DateTimeRange(
            start: DateTime(2026, 10, 1), end: DateTime(2026, 10, 18),),
      );
      expect(c.rangeReady, isTrue);
      expect(c.days, 18);
      expect(c.previousRange.to, '2026-09-30');
      expect(c.customLabel, '1 Oct – 18 Oct');
      c.dispose();
    });

    test('branch label falls back to All branches / Branch', () {
      final c = RptPeriodController();
      expect(c.branchLabel, 'All branches');
      c.setBranch('x');
      expect(c.branchLabel, 'Branch');
      c.dispose();
    });
  });
}
