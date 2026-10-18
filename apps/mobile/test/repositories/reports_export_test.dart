import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/report_export.dart';
import 'package:gym_saas_mobile/models/report_summary.dart';
import 'package:gym_saas_mobile/repositories/reports_repository.dart';

/// Records the request and answers with whatever [respond] returns.
class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);

  final ResponseBody Function(RequestOptions options) respond;
  RequestOptions? last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _file(
  List<int> bytes, {
  String type = 'application/pdf',
  String? disposition,
  int status = 200,
}) =>
    ResponseBody.fromBytes(
      bytes,
      status,
      headers: {
        Headers.contentTypeHeader: [type],
        if (disposition != null) 'content-disposition': [disposition],
      },
    );

ResponseBody _json(Map<String, Object?> body, int status) =>
    ResponseBody.fromBytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );

(ReportsRepository, _Adapter) _repo(
  ResponseBody Function(RequestOptions) respond,
) {
  final adapter = _Adapter(respond);
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = adapter;
  return (ReportsRepository(dio), adapter);
}

void main() {
  group('ReportsRepository.exportReport request', () {
    test('GETs /reports/:type/export with format + the report filters',
        () async {
      final (repo, adapter) = _repo(
        (_) => _file(
          [1, 2, 3],
          type: ReportExportFormat.xlsx.mimeType,
          disposition: 'attachment; filename="membership-2026-10-18.xlsx"',
        ),
      );
      await repo.exportReport(
        'membership',
        ReportExportFormat.xlsx,
        ReportSummaryFilters(
          from: DateTime(2026, 10, 1),
          to: DateTime(2026, 10, 18),
          branchId: 'b1',
          planId: 'p1',
          trainerId: 't1',
          memberStatus: 'ACTIVE',
          paymentStatus: 'SUCCESS',
        ),
      );
      final o = adapter.last!;
      expect(o.method, 'GET');
      expect(o.path, '/reports/membership/export');
      expect(o.queryParameters, {
        'dateFrom': '2026-10-01',
        'dateTo': '2026-10-18',
        'branchId': 'b1',
        'planId': 'p1',
        'trainerId': 't1',
        'memberStatus': 'ACTIVE',
        'paymentStatus': 'SUCCESS',
        'format': 'xlsx',
      });
      expect(o.responseType, ResponseType.bytes);
      expect(
        o.receiveTimeout!.inSeconds,
        greaterThanOrEqualTo(120),
        reason: 'the server renders big PDFs / workbooks in a worker',
      );
      expect(o.headers['Accept'], contains(ReportExportFormat.xlsx.mimeType));
    });

    test('only sends the filters that are set (no paging, no empty keys)',
        () async {
      final (repo, adapter) = _repo((_) => _file([1]));
      await repo.exportReport('staff', ReportExportFormat.csv);
      expect(adapter.last!.queryParameters, {'format': 'csv'});

      await repo.exportReport(
        'analytics-revenue-trends',
        ReportExportFormat.pdf,
        ReportSummaryFilters(from: DateTime(2026, 1, 5), to: DateTime(2026, 2)),
      );
      expect(adapter.last!.path, '/reports/analytics-revenue-trends/export');
      expect(adapter.last!.queryParameters, {
        'dateFrom': '2026-01-05',
        'dateTo': '2026-02-01',
        'format': 'pdf',
      });
    });

    test('format api values and mime types match the server', () {
      expect(ReportExportFormat.pdf.apiValue, 'pdf');
      expect(ReportExportFormat.pdf.mimeType, 'application/pdf');
      expect(ReportExportFormat.xlsx.apiValue, 'xlsx');
      expect(ReportExportFormat.xlsx.label, 'Excel');
      expect(
        ReportExportFormat.xlsx.mimeType,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(ReportExportFormat.csv.apiValue, 'csv');
      expect(ReportExportFormat.csv.mimeType, 'text/csv');
    });
  });

  group('ReportsRepository.exportReport result', () {
    test('returns the bytes, the server filename and the format mime',
        () async {
      final bytes = List<int>.generate(2048, (i) => i % 251);
      final (repo, _) = _repo(
        (_) => _file(
          bytes,
          disposition: 'attachment; filename="revenue-2026-10-18.pdf"',
        ),
      );
      final file = await repo.exportReport('revenue', ReportExportFormat.pdf);
      expect(file.bytes, bytes);
      expect(file.filename, 'revenue-2026-10-18.pdf');
      expect(file.mimeType, 'application/pdf');
      expect(file.format, ReportExportFormat.pdf);
    });

    test('falls back to <type>-<YYYY-MM-DD>.<ext> without a header', () async {
      final (repo, _) = _repo((_) => _file([9, 9], type: 'text/csv'));
      final file = await repo.exportReport(
        'expiring-memberships',
        ReportExportFormat.csv,
      );
      expect(
        file.filename,
        matches(RegExp(r'^expiring-memberships-\d{4}-\d{2}-\d{2}\.csv$')),
      );
    });

    test('exportFilename sanitises a hostile or mismatched header', () {
      String name(String? h, [ReportExportFormat f = ReportExportFormat.pdf]) =>
          exportFilename(
            h,
            reportType: 'revenue',
            format: f,
            now: DateTime(2026, 10, 18),
          );
      expect(
        name('attachment; filename="revenue-2026-10-01.pdf"'),
        'revenue-2026-10-01.pdf',
      );
      expect(
        name('attachment; filename=revenue-2026-10-01.pdf'),
        'revenue-2026-10-01.pdf',
      );
      // Path parts are dropped, odd characters replaced.
      expect(
        name('attachment; filename="../../etc/pass wd.pdf"'),
        'pass_wd.pdf',
      );
      // Wrong extension / empty / hidden -> the local fallback.
      expect(name('attachment; filename="x.exe"'), 'revenue-2026-10-18.pdf');
      expect(name('attachment; filename=""'), 'revenue-2026-10-18.pdf');
      expect(name('attachment; filename=".pdf"'), 'revenue-2026-10-18.pdf');
      expect(name('inline'), 'revenue-2026-10-18.pdf');
      expect(name(null, ReportExportFormat.xlsx), 'revenue-2026-10-18.xlsx');
    });

    test('an empty 200 body is an error, not a 0-byte file', () async {
      final (repo, _) = _repo((_) => _file(const []));
      await expectLater(
        repo.exportReport('revenue', ReportExportFormat.pdf),
        throwsA(
          isA<ApiException>()
              .having((e) => e.message, 'message', contains('empty')),
        ),
      );
    });

    test('a 200 that is really a JSON envelope surfaces its message', () async {
      final (repo, _) = _repo(
        (_) => _json({'success': false, 'message': 'Gateway says no'}, 200),
      );
      await expectLater(
        repo.exportReport('revenue', ReportExportFormat.pdf),
        throwsA(
          isA<ApiException>()
              .having((e) => e.message, 'message', 'Gateway says no'),
        ),
      );
    });
  });

  group('ReportsRepository.exportReport errors', () {
    test('decodes the JSON error body that arrives as bytes', () async {
      final (repo, _) = _repo(
        (_) => _json(
          {
            'success': false,
            'message': 'You do not have permission to perform this action.',
          },
          403,
        ),
      );
      try {
        await repo.exportReport('revenue', ReportExportFormat.pdf);
        fail('should throw');
      } on ApiException catch (e) {
        expect(e.message, 'You do not have permission to perform this action.');
        expect(e.statusCode, 403);
      }
    });

    test('keeps the field errors for detailedMessage', () async {
      final (repo, _) = _repo(
        (_) => _json(
          {
            'success': false,
            'message': 'Request Validation Failed',
            'errors': [
              {'field': 'branchId', 'message': 'Invalid uuid'},
            ],
          },
          422,
        ),
      );
      try {
        await repo.exportReport(
          'revenue',
          ReportExportFormat.csv,
          const ReportSummaryFilters(branchId: 'nope'),
        );
        fail('should throw');
      } on ApiException catch (e) {
        expect(e.message, 'Request Validation Failed');
        expect(e.detailedMessage, 'branchId: Invalid uuid');
        expect(e.statusCode, 422);
      }
    });

    test('a non-JSON error body gets a generic message', () async {
      final (repo, _) = _repo(
        (_) => ResponseBody.fromBytes(
          utf8.encode('<html>Bad gateway</html>'),
          502,
          headers: {
            Headers.contentTypeHeader: ['text/html'],
          },
        ),
      );
      try {
        await repo.exportReport('revenue', ReportExportFormat.pdf);
        fail('should throw');
      } on ApiException catch (e) {
        expect(e.message, 'The export failed. Please try again.');
        expect(e.statusCode, 502);
      }
    });

    test('a non-JSON 403 explains the missing permission', () async {
      final (repo, _) = _repo(
        (_) => ResponseBody.fromBytes(const [], 403),
      );
      try {
        await repo.exportReport('revenue', ReportExportFormat.pdf);
        fail('should throw');
      } on ApiException catch (e) {
        expect(e.message, contains('permission'));
      }
    });

    test('a receive timeout says the export took too long', () async {
      final (repo, _) = _repo(
        (o) => throw DioException(
          requestOptions: o,
          type: DioExceptionType.receiveTimeout,
        ),
      );
      await expectLater(
        repo.exportReport('revenue', ReportExportFormat.pdf),
        throwsA(
          isA<ApiException>()
              .having((e) => e.message, 'message', contains('too long')),
        ),
      );
    });

    test('no connection maps to the network message', () async {
      final (repo, _) = _repo(
        (o) => throw DioException(
          requestOptions: o,
          type: DioExceptionType.connectionError,
        ),
      );
      await expectLater(
        repo.exportReport('revenue', ReportExportFormat.pdf),
        throwsA(
          isA<ApiException>()
              .having((e) => e.message, 'message', contains('connection')),
        ),
      );
    });
  });

  test('summary() still sends the same filters after the query refactor',
      () async {
    final (repo, adapter) = _repo(
      (_) => _json(
        {
          'success': true,
          'data': {
            'kpis': <Object>[],
            'breakdowns': <Object>[],
            'series': null,
          },
        },
        200,
      ),
    );
    await repo.summary(
      'payments',
      ReportSummaryFilters(
        from: DateTime(2026, 10, 1),
        to: DateTime(2026, 10, 5),
        branchId: 'b1',
        paymentStatus: 'SUCCESS',
      ),
    );
    expect(adapter.last!.path, '/reports/payments/summary');
    expect(adapter.last!.queryParameters, {
      'dateFrom': '2026-10-01',
      'dateTo': '2026-10-05',
      'branchId': 'b1',
      'paymentStatus': 'SUCCESS',
    });
  });
}
