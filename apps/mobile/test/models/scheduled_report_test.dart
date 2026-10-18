import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/reports/presentation/scheduled/scheduled_ui.dart';
import 'package:gym_saas_mobile/models/scheduled_report.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/scheduled_report_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Dio extends Mock implements Dio {}

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['OWNER'],
      permissions: perms,
    );

void main() {
  group('ScheduledReport model', () {
    test('parses the DTO incl. branch and nullable lastRunAt', () {
      final r = ScheduledReport.fromJson({
        'id': 's1',
        'name': 'Weekly revenue',
        'reportType': 'analytics-retention',
        'frequency': 'MONTHLY',
        'recipientEmails': ['a@x.test', 'b@x.test'],
        'isActive': false,
        'lastRunAt': '2026-10-01T09:00:00.000Z',
        'nextRunAt': '2026-11-01T09:00:00.000Z',
        'branch': {'id': 'b1', 'name': 'Main'},
      });
      expect(r.frequency, ReportFrequency.monthly);
      expect(r.isActive, isFalse);
      expect(r.branchName, 'Main');
      expect(r.lastRunAt, isNotNull);
      expect(r.recipientEmails.length, 2);
      final bare = ScheduledReport.fromJson({
        'id': 's2',
        'name': 'x',
        'reportType': 'revenue',
        'frequency': 'DAILY',
        'recipientEmails': <String>[],
        'nextRunAt': '2026-11-01T09:00:00.000Z',
        'branch': null,
      });
      expect(bare.branchName, isNull);
      expect(bare.isActive, isTrue);
      expect(bare.lastRunAt, isNull);
    });

    test('all 18 backend report types round-trip through apiValue', () {
      expect(ScheduledReportType.values.length, 18);
      for (final t in ScheduledReportType.values) {
        expect(ScheduledReportTypeX.fromApi(t.apiValue), t);
      }
      expect(ScheduledReportTypeX.fromApi('nope'), isNull);
      expect(
        ScheduledReportType.values.where((t) => t.isAnalytics).length,
        7,
      );
    });

    test('labels follow web; unknown types fall back to the raw value', () {
      expect(scheduledReportTypeLabel('payments'), 'Payment Report');
      expect(
        scheduledReportTypeLabel('trainer-performance'),
        'Trainer Performance',
      );
      expect(
        scheduledReportTypeLabel('analytics-branch-comparison'),
        'Analytics: Branch Comparison',
      );
      expect(scheduledReportTypeLabel('mystery'), 'mystery');
    });

    test('frequency wire values', () {
      expect(ReportFrequency.daily.apiValue, 'DAILY');
      expect(ReportFrequencyX.fromApi('MONTHLY'), ReportFrequency.monthly);
      expect(ReportFrequencyX.fromApi('???'), ReportFrequency.weekly);
    });
  });

  group('form rules', () {
    test('recipients are split on comma / semicolon / newline', () {
      expect(
        parseRecipients(' a@x.test, b@x.test;c@x.test\n\n d@x.test ,'),
        ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test'],
      );
      expect(parseRecipients('  '), isEmpty);
    });

    test('validation mirrors the API', () {
      expect(validateSchedule(name: '', emails: ['a@x.test']), isNotNull);
      expect(
        validateSchedule(name: 'n', emails: const []),
        contains('at least one'),
      );
      expect(
        validateSchedule(name: 'n', emails: ['not-an-email']),
        contains('not a valid'),
      );
      expect(
        validateSchedule(name: 'x' * 151, emails: ['a@x.test']),
        contains('150'),
      );
      expect(
        validateSchedule(
          name: 'n',
          emails: [for (var i = 0; i < 21; i++) 'a$i@x.test'],
        ),
        contains('20'),
      );
      expect(validateSchedule(name: 'n', emails: ['a@x.test']), isNull);
    });
  });

  group('gating matrix', () {
    test('listing needs reports:view; managing needs reports:export', () {
      final none = ScheduledAccess(_user(const []));
      expect(none.canView, isFalse);
      expect(none.canManage, isFalse);
      final view = ScheduledAccess(_user(const ['reports:view']));
      expect(view.canView, isTrue);
      expect(view.canManage, isFalse);
      final all =
          ScheduledAccess(_user(const ['reports:view', 'reports:export']));
      expect(all.canManage, isTrue);
      expect(const ScheduledAccess(null).canManage, isFalse);
    });
  });

  group('repository', () {
    test('setActive PATCHes only isActive and parses the echo', () async {
      final dio = _Dio();
      when(
        () => dio.patch<Map<String, dynamic>>(
          any(),
          data: any(named: 'data'),
        ),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(),
          data: {
            'data': {
              'id': 's1',
              'name': 'n',
              'reportType': 'revenue',
              'frequency': 'DAILY',
              'recipientEmails': ['a@x.test'],
              'isActive': false,
              'nextRunAt': '2026-11-01T09:00:00.000Z',
            },
          },
        ),
      );
      final r = await ScheduledReportRepository(dio).setActive(
        's1',
        isActive: false,
      );
      expect(r.isActive, isFalse);
      verify(
        () => dio.patch<Map<String, dynamic>>(
          '/reports/scheduled/s1',
          data: {'isActive': false},
        ),
      ).called(1);
    });

    test('create sends the wire enums', () async {
      final dio = _Dio();
      when(
        () => dio.post<Map<String, dynamic>>(any(), data: any(named: 'data')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(),
          data: {
            'data': {
              'id': 's1',
              'name': 'n',
              'reportType': 'analytics-retention',
              'frequency': 'MONTHLY',
              'recipientEmails': ['a@x.test'],
              'nextRunAt': '2026-11-01T09:00:00.000Z',
            },
          },
        ),
      );
      await ScheduledReportRepository(dio).create(
        name: 'n',
        reportType: ScheduledReportType.analyticsRetention,
        frequency: ReportFrequency.monthly,
        recipientEmails: const ['a@x.test'],
      );
      verify(
        () => dio.post<Map<String, dynamic>>(
          '/reports/scheduled',
          data: {
            'name': 'n',
            'reportType': 'analytics-retention',
            'frequency': 'MONTHLY',
            'recipientEmails': ['a@x.test'],
          },
        ),
      ).called(1);
    });
  });
}
