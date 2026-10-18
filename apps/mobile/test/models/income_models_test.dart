import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/income/presentation/income_charts.dart';
import 'package:gym_saas_mobile/features/income/presentation/income_ui.dart';
import 'package:gym_saas_mobile/models/income_entry.dart';
import 'package:gym_saas_mobile/models/ledger_analytics.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/income_repository.dart';

Map<String, dynamic> _json({Map<String, dynamic> extra = const {}}) => {
      'id': 'i1',
      'category': 'PERSONAL_TRAINING',
      // DECIMALs arrive as strings.
      'amount': '2500.50',
      'incomeDate': '2026-10-18T00:00:00.000Z',
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'description': 'PT package',
      'sourcePaymentId': null,
      'recordedBy': {'id': 'u1', 'name': 'Asha'},
      'createdAt': '2026-10-18T10:00:00.000Z',
      'updatedAt': '2026-10-18T10:00:00.000Z',
      'deletedAt': null,
      ...extra,
    };

UserProfile _user(List<String> perms) => UserProfile(
      id: 'me',
      tenantId: 't',
      name: 'Me',
      email: 'me@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['MANAGER'],
      permissions: perms,
    );

LedgerDay _day(String date, double total, double prev, [int count = 1]) =>
    LedgerDay(date: date, total: total, count: count, previousTotal: prev);

void main() {
  group('IncomeEntry', () {
    test('parses decimal strings, branch, recorder and the auto flag', () {
      final e = IncomeEntry.fromJson(_json());
      expect(e.amount, 2500.5);
      expect(e.category, IncomeCategory.personalTraining);
      expect(e.category.webLabel, 'Personal Training');
      expect(e.branchName, 'Bandra');
      expect(e.recordedByName, 'Asha');
      expect(e.isAuto, isFalse);
      // `@db.Date` = UTC midnight: the calendar day must not shift.
      expect(incomeDay(e.incomeDate), '18 Oct 2026');
    });

    test('tolerates nulls and payment-sourced rows', () {
      final e = IncomeEntry.fromJson(
        _json(
          extra: {
            'branch': null,
            'recordedBy': null,
            'description': null,
            'amount': 100, // a number instead of a string
            'sourcePaymentId': 'p1',
          },
        ),
      );
      expect(e.amount, 100);
      expect(e.branchName, isNull);
      expect(e.recordedByName, isNull);
      expect(e.description, isNull);
      expect(e.isAuto, isTrue);
    });

    test('category api values round-trip and unknown falls back to Other', () {
      for (final c in IncomeCategory.values) {
        expect(IncomeCategoryX.fromApi(c.apiValue), c);
      }
      expect(IncomeCategoryX.fromApi('???'), IncomeCategory.other);
      expect(kIncomeCategoryOptions.map((o) => o.$1), [
        'MEMBERSHIP_FEE',
        'PERSONAL_TRAINING',
        'PRODUCT_SALES',
        'OTHER',
      ]);
    });
  });

  group('period maths (web computeRange, local days)', () {
    final now = DateTime(2026, 10, 18, 15, 30);
    test('presets', () {
      expect(incomeRange(IncomePeriod.today, null, now).from, '2026-10-18');
      final week = incomeRange(IncomePeriod.days7, null, now);
      expect((week.from, week.to), ('2026-10-12', '2026-10-18'));
      final month = incomeRange(IncomePeriod.thisMonth, null, now);
      expect((month.from, month.to), ('2026-10-01', '2026-10-18'));
      final last = incomeRange(IncomePeriod.lastMonth, null, now);
      expect((last.from, last.to), ('2026-09-01', '2026-09-30'));
      final d90 = incomeRange(IncomePeriod.days90, null, now);
      expect((d90.from, d90.to), ('2026-07-21', '2026-10-18'));
    });

    test('custom uses the picked range; January rolls back a year', () {
      final c = incomeRange(
        IncomePeriod.custom,
        DateTimeRange(start: DateTime(2026, 3, 2), end: DateTime(2026, 3, 9)),
        now,
      );
      expect((c.from, c.to), ('2026-03-02', '2026-03-09'));
      final jan = incomeRange(
        IncomePeriod.lastMonth,
        null,
        DateTime(2026, 1, 5),
      );
      expect((jan.from, jan.to), ('2025-12-01', '2025-12-31'));
    });

    test('labels', () {
      expect(IncomePeriod.thisMonth.previousLabel, 'Last month');
      expect(IncomePeriod.lastMonth.previousLabel, 'Month before');
      expect(IncomePeriod.days7.previousLabel, 'Previous period');
      expect(IncomePeriod.thisMonth.noun, 'this month');
    });
  });

  test('pctChange mirrors web (no baseline -> null, nothing -> 0)', () {
    expect(pctChange(150, 100), 50);
    expect(pctChange(50, 100), -50);
    expect(pctChange(10, 0), isNull);
    expect(pctChange(0, 0), 0);
  });

  group('trend series (web buildSeries)', () {
    final daily = [
      for (var i = 1; i <= 9; i++)
        _day('2026-10-${i.toString().padLeft(2, '0')}', i * 10.0, i * 5.0),
    ];
    test('daily keeps one point per day', () {
      final p = buildTrendSeries(daily, IncomeTrendMode.daily);
      expect(p.length, 9);
      expect(p.first.label, '1 Oct');
      expect(p[2].current, 30);
      expect(p[2].previous, 15);
    });

    test('weekly sums chunks of 7 days', () {
      final p = buildTrendSeries(daily, IncomeTrendMode.weekly);
      expect(p.length, 2);
      expect(p[0].label, 'Wk 1');
      expect(p[0].current, 280); // 10+...+70
      expect(p[1].current, 170); // 80+90
      expect(p[1].tip, '8 Oct – 9 Oct');
    });

    test('cumulative is a running total', () {
      final p = buildTrendSeries(daily, IncomeTrendMode.cumulative);
      expect(p[0].current, 10);
      expect(p[2].current, 60);
      expect(p.last.current, 450);
      expect(p.last.previous, 225);
    });
  });

  group('IncomeAccess (gating matrix)', () {
    test('analytics need finance:view only', () {
      expect(IncomeAccess(_user(['finance:view'])).canViewAnalytics, isTrue);
      expect(
        IncomeAccess(_user(['finance:income-manage'])).canViewAnalytics,
        isFalse,
      );
      expect(const IncomeAccess(null).canViewAnalytics, isFalse);
    });

    test('add / delete need finance:income-manage', () {
      final viewer = IncomeAccess(_user(['finance:view']));
      final manager =
          IncomeAccess(_user(['finance:view', 'finance:income-manage']));
      final manual = IncomeEntry.fromJson(_json());
      final auto = IncomeEntry.fromJson(_json(extra: {'sourcePaymentId': 'p'}));
      expect(viewer.canManage, isFalse);
      expect(viewer.canDelete(manual), isFalse);
      expect(manager.canManage, isTrue);
      expect(manager.canDelete(manual), isTrue);
      // Auto-created entries never offer Delete (the API refuses them).
      expect(manager.canDelete(auto), isFalse);
      expect(const IncomeAccess(null).canManage, isFalse);
    });
  });

  group('IncomeRepository wire format', () {
    Dio dioCapturing(List<RequestOptions> seen, {Object? data}) {
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen.add(options);
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: data ??
                    {
                      'data': {
                        'items': [_json()],
                        'total': 1,
                        'page': 1,
                        'limit': 20,
                        'totalPages': 1,
                        'summary': {
                          'total': '2500.50',
                          'count': 1,
                          'average': '2500.50',
                        },
                      },
                    },
              ),
            );
          },
        ),
      );
      return dio;
    }

    test('list sends every web filter and parses the summary', () async {
      final seen = <RequestOptions>[];
      final r = await IncomeRepository(dioCapturing(seen)).listWithSummary(
        page: 2,
        search: 'pt',
        category: 'PERSONAL_TRAINING',
        branchId: 'b1',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-18',
        sortBy: 'amount',
        sortDir: 'asc',
      );
      expect(seen.single.path, '/income');
      expect(seen.single.queryParameters, {
        'page': 2,
        'limit': 20,
        'search': 'pt',
        'category': 'PERSONAL_TRAINING',
        'branchId': 'b1',
        'dateFrom': '2026-10-01',
        'dateTo': '2026-10-18',
        'sortBy': 'amount',
        'sortDir': 'asc',
      });
      expect(r.page.items.single.amount, 2500.5);
      expect(r.summary!.total, 2500.5);
      expect(r.summary!.count, 1);
    });

    test('list omits empty filters (no search/category/branch)', () async {
      final seen = <RequestOptions>[];
      await IncomeRepository(dioCapturing(seen)).listWithSummary(
        search: '',
        category: '',
      );
      expect(seen.single.queryParameters, {'page': 1, 'limit': 20});
    });

    test('create sends a date-only incomeDate and omits an empty note',
        () async {
      final seen = <RequestOptions>[];
      await IncomeRepository(dioCapturing(seen, data: {'data': _json()}))
          .create(
        category: IncomeCategory.productSales,
        amount: 99.5,
        incomeDate: DateTime(2026, 1, 5, 23, 59),
        description: '',
      );
      expect(seen.single.method, 'POST');
      expect(seen.single.data, {
        'category': 'PRODUCT_SALES',
        'amount': 99.5,
        'incomeDate': '2026-01-05',
      });
    });

    test('delete hits DELETE /income/:id', () async {
      final seen = <RequestOptions>[];
      await IncomeRepository(dioCapturing(seen, data: {'data': null}))
          .delete('i9');
      expect(seen.single.method, 'DELETE');
      expect(seen.single.path, '/income/i9');
    });
  });
}
