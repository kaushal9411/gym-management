import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/reports/presentation/finance/fin_report_parts.dart';
import 'package:gym_saas_mobile/models/branch_performance_row.dart';
import 'package:gym_saas_mobile/models/expense_report_row.dart';
import 'package:gym_saas_mobile/models/payment_report_row.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/models/revenue_report_row.dart';

FinPage<int> _page(List<int> items, {int page = 1, int pages = 1}) => FinPage(
      items: items,
      page: page,
      total: items.length * pages,
      totalPages: pages,
    );

void main() {
  group('report row models parse DECIMAL strings and numbers', () {
    test('revenue', () {
      final a = RevenueReportRow.fromJson({
        'date': '2026-10-04',
        'branch': 'Main',
        'method': 'UPI',
        'amount': '2500.50',
      });
      final b = RevenueReportRow.fromJson({
        'date': '2026-10-04',
        'branch': 'Main',
        'method': 'UPI',
        'amount': 2500,
      });
      expect(a.amount, 2500.5);
      expect(b.amount, 2500);
    });

    test('expense keeps a null description', () {
      final e = ExpenseReportRow.fromJson({
        'date': '2026-10-04',
        'branch': 'Main',
        'category': 'RENT',
        'amount': '10.00',
        'description': null,
      });
      expect(e.amount, 10);
      expect(e.description, isNull);
    });

    test('payment', () {
      final p = PaymentReportRow.fromJson({
        'paymentNumber': 'PAY-1',
        'memberCode': 'M-1',
        'name': 'Asha',
        'branch': 'Main',
        'finalAmount': '99.99',
        'method': 'CASH',
        'status': 'SUCCESS',
        'paymentDate': '2026-10-01',
      });
      expect(p.finalAmount, 99.99);
      expect(p.status, 'SUCCESS');
    });

    test('branch performance tolerates string counts and missing fields', () {
      final r = BranchPerformanceRow.fromJson({
        'branchId': 'b',
        'branch': 'Main',
        'totalMembers': '12',
        'monthlyRevenue': '1000.00',
      });
      expect(r.totalMembers, 12);
      expect(r.activeMembers, 0);
      expect(r.staffCount, 0);
      expect(r.monthlyRevenue, 1000);
    });
  });

  group('summary breakdown mappers', () {
    test('labels use the same names as web badges', () {
      expect(
        finBreakdownLabel('by-method', 'ONLINE_GATEWAY'),
        'Online Gateway',
      );
      expect(finBreakdownLabel('by-method', 'UPI'), 'UPI');
      expect(
        finBreakdownLabel('by-status', 'PARTIALLY_REFUNDED'),
        'Partially refunded',
      );
      expect(
        finBreakdownLabel('by-category', 'OFFICE_SUPPLIES'),
        'Office Supplies',
      );
      // Branch / plan names are never title-cased.
      expect(finBreakdownLabel('revenue-per-branch', 'GYM one'), 'GYM one');
    });

    test('colours only for enum breakdowns', () {
      expect(finBreakdownColor('by-status', 'FAILED'), isNotNull);
      expect(finBreakdownColor('by-method', 'CASH'), isNotNull);
      expect(finBreakdownColor('by-category', 'RENT'), isNotNull);
      expect(finBreakdownColor('revenue-per-branch', 'Main'), isNull);
    });

    test('finDate keeps the calendar day', () {
      expect(finDate('2026-10-04'), '4 Oct 2026');
      expect(finDate('2026-10-04T23:59:59.000Z'), '4 Oct 2026');
      expect(finDate('nonsense'), 'nonsense');
    });
  });

  group('finHeroChips', () {
    ReportSummary summary() => ReportSummary.fromJson({
          'kpis': [
            {
              'key': 'a',
              'label': 'Total',
              'value': '150000.00',
              'format': 'money',
            },
            {'key': 'b', 'label': 'Top', 'value': 'Gold', 'format': 'text'},
            {'key': 'c', 'label': 'Payments', 'value': 30, 'format': 'number'},
            {
              'key': 'success-rate',
              'label': 'Success rate',
              'value': 0.9,
              'format': 'percent',
            },
            {'key': 'd', 'label': 'Fourth', 'value': 4, 'format': 'number'},
          ],
          'breakdowns': <Object>[],
        });

    test('falls back before the summary loads', () {
      const fb = [SizedBox()];
      expect(finHeroChips(null, fb), same(fb));
    });

    test('takes the first three numeric KPIs, skipping text', () {
      expect(finHeroChips(summary(), const []), hasLength(3));
    });

    test('no numeric KPIs -> fallback', () {
      final s = ReportSummary.fromJson({
        'kpis': [
          {'key': 'b', 'label': 'Top', 'value': 'Gold', 'format': 'text'},
        ],
      });
      const fb = [SizedBox()];
      expect(finHeroChips(s, fb), same(fb));
    });
  });

  group('FinRowsLoader', () {
    test('loads, pages and reports hasMore', () async {
      final l = FinRowsLoader<int>(
        (p) async => _page([p * 10, p * 10 + 1], page: p, pages: 2),
      );
      expect(l.loading, isTrue);
      await l.reload();
      expect(l.items, [10, 11]);
      expect(l.hasMore, isTrue);
      expect(l.loading, isFalse);
      await l.more();
      expect(l.items, [10, 11, 20, 21]);
      expect(l.hasMore, isFalse);
      l.dispose();
    });

    test('a superseded response is dropped', () async {
      final slow = Completer<FinPage<int>>();
      var calls = 0;
      final l = FinRowsLoader<int>((p) {
        calls++;
        return calls == 1 ? slow.future : Future.value(_page([2]));
      });
      final first = l.reload();
      await l.reload();
      slow.complete(_page([1]));
      await first;
      expect(l.items, [2]);
      expect(l.loading, isFalse);
      l.dispose();
    });

    test('errors reset loading and expose a message; more() failure is kept',
        () async {
      var fail = true;
      final l = FinRowsLoader<int>((p) async {
        if (fail) throw const ApiException(message: 'Nope');
        if (p == 2) throw StateError('x');
        return _page([1], pages: 2);
      });
      await l.reload();
      expect(l.error, 'Nope');
      expect(l.loading, isFalse);
      fail = false;
      await l.reload();
      expect(l.error, isNull);
      await l.more();
      expect(l.moreError, isNotNull);
      expect(l.loadingMore, isFalse);
      expect(l.items, [1]);
      l.dispose();
    });

    test('clear() stops loading and empties the list', () async {
      final l = FinRowsLoader<int>((p) async => _page([1]));
      await l.reload();
      l.clear();
      expect(l.items, isEmpty);
      expect(l.loading, isFalse);
      l.dispose();
    });
  });
}
