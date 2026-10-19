import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';

class _Adapter implements HttpClientAdapter {
  _Adapter(this.respond);

  final ResponseBody Function(RequestOptions options) respond;
  RequestOptions? last;
  String? lastBody;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    if (requestStream != null) {
      final chunks = await requestStream.toList();
      lastBody = utf8.decode(chunks.expand((c) => c).toList());
    }
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody _json(Object body, int status) => ResponseBody.fromBytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json; charset=utf-8'],
      },
    );

Map<String, Object?> _row({String id = 'e1', String source = 'MEMBER'}) => {
      'id': id,
      'memberId': 'm1',
      'recordedAt': '2026-10-19T00:00:00.000Z',
      'weightKg': '71.50',
      'heightCm': null,
      'bodyFatPercent': null,
      'chestCm': null,
      'waistCm': null,
      'hipsCm': null,
      'bicepsCm': null,
      'thighsCm': null,
      'notes': null,
      'recordedBy': null,
      'source': source,
      'createdAt': '2026-10-19T08:00:00.000Z',
      'updatedAt': '2026-10-19T08:00:00.000Z',
    };

(MemberPortalRepository, _Adapter) _repo(
  ResponseBody Function(RequestOptions) respond,
) {
  final adapter = _Adapter(respond);
  final dio = Dio(BaseOptions(baseUrl: 'http://api.test'))
    ..httpClientAdapter = adapter;
  return (MemberPortalRepository(dio), adapter);
}

void main() {
  group('logMeasurement', () {
    test('POSTs the quick-log body (UTC midnight day, only the weight)',
        () async {
      final (repo, adapter) = _repo(
        (_) => _json({'success': true, 'data': _row()}, 201),
      );
      final r = await repo.logMeasurement(
        BodyMeasurementFormInput(
          recordedAt: DateTime.utc(2026, 10, 19),
          weightKg: 71.5,
        ),
      );
      expect(adapter.last!.method, 'POST');
      expect(adapter.last!.path, '/portal/measurements');
      expect(jsonDecode(adapter.lastBody!), {
        'recordedAt': '2026-10-19T00:00:00.000Z',
        'weightKg': 71.5,
      });
      expect(r.created, isTrue);
      expect(r.entry.weightKg, 71.5);
      expect(r.entry.isMemberLogged, isTrue);
    });

    test('200 means an existing same-day entry was updated (created false)',
        () async {
      final (repo, _) = _repo(
        (_) => _json({'success': true, 'data': _row()}, 200),
      );
      final r = await repo.logMeasurement(
        const BodyMeasurementFormInput(weightKg: 71),
      );
      expect(r.created, isFalse);
    });

    test('maps a 422 envelope to an ApiException with field details', () async {
      final (repo, _) = _repo(
        (_) => _json(
          {
            'success': false,
            'message': 'Request validation failed',
            'errors': [
              {
                'field': 'weightKg',
                'code': 'VALIDATION_ERROR',
                'message': 'Number must be less than or equal to 500',
              },
            ],
          },
          422,
        ),
      );
      await expectLater(
        repo.logMeasurement(const BodyMeasurementFormInput(weightKg: 900)),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'status', 422).having(
                (e) => e.detailedMessage,
                'detailed',
                contains('Number must be less than or equal to 500'),
              ),
        ),
      );
    });
  });

  group('updateMeasurement / deleteMeasurement', () {
    test('PATCH /portal/measurements/:id with the edited values', () async {
      final (repo, adapter) = _repo(
        (_) => _json({'success': true, 'data': _row(id: 'abc')}, 200),
      );
      final e = await repo.updateMeasurement(
        'abc',
        const BodyMeasurementFormInput(weightKg: 70.2, notes: 'edited'),
      );
      expect(adapter.last!.method, 'PATCH');
      expect(adapter.last!.path, '/portal/measurements/abc');
      expect(jsonDecode(adapter.lastBody!), {
        'weightKg': 70.2,
        'notes': 'edited',
      });
      expect(e.id, 'abc');
    });

    test('DELETE /portal/measurements/:id', () async {
      final (repo, adapter) = _repo(
        (_) => _json({'success': true, 'data': null}, 200),
      );
      await repo.deleteMeasurement('abc');
      expect(adapter.last!.method, 'DELETE');
      expect(adapter.last!.path, '/portal/measurements/abc');
    });

    test('a staff entry (403) surfaces the server message', () async {
      final (repo, _) = _repo(
        (_) => _json(
          {
            'success': false,
            'message': 'This entry was recorded by your gym staff.',
          },
          403,
        ),
      );
      await expectLater(
        repo.deleteMeasurement('staff-entry'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.statusCode, 'status', 403)
              .having((e) => e.message, 'message', contains('gym staff')),
        ),
      );
    });
  });

  test('measurements() parses id and source on every row', () async {
    final (repo, adapter) = _repo(
      (_) => _json(
        {
          'success': true,
          'data': [_row(), _row(id: 'e2', source: 'STAFF')],
        },
        200,
      ),
    );
    final rows = await repo.measurements();
    expect(adapter.last!.path, '/portal/measurements');
    expect(rows.map((r) => r.id), ['e1', 'e2']);
    expect(
      rows.map((r) => r.source),
      [MeasurementSource.member, MeasurementSource.staff],
    );
  });
}
