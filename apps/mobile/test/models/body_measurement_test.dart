import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/measurement_form.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/measurement_ui.dart';
import 'package:gym_saas_mobile/features/measurements/presentation/member_progress.dart';
import 'package:gym_saas_mobile/models/body_measurement.dart';

Map<String, dynamic> _json({
  String id = 'e1',
  String recordedAt = '2026-09-01T00:00:00.000Z',
  Object? weight = '78.50',
  Object? height,
  Object? fat,
  Object? waist,
  String? notes,
}) =>
    {
      'id': id,
      'memberId': 'm1',
      'recordedAt': recordedAt,
      'weightKg': weight,
      'heightCm': height,
      'bodyFatPercent': fat,
      'chestCm': null,
      'waistCm': waist,
      'hipsCm': null,
      'bicepsCm': null,
      'thighsCm': null,
      'notes': notes,
      'recordedBy': {'id': 'u1', 'name': 'Coach Ravi'},
      'createdAt': '2026-09-01T10:00:00.000Z',
      'updatedAt': '2026-09-01T10:00:00.000Z',
    };

BodyMeasurement _bm(
  String id,
  String day, {
  Object? weight,
  Object? height,
  Object? fat,
  Object? waist,
}) =>
    BodyMeasurement.fromJson(
      _json(
        id: id,
        recordedAt: '${day}T00:00:00.000Z',
        weight: weight,
        height: height,
        fat: fat,
        waist: waist,
      ),
    );

void main() {
  group('BodyMeasurement.fromJson', () {
    test('DECIMAL strings parse to doubles; nulls stay null', () {
      final m = BodyMeasurement.fromJson(
        _json(weight: '78.50', fat: '18.20', height: '178'),
      );
      expect(m.weightKg, 78.5);
      expect(m.bodyFatPercent, 18.2);
      expect(m.heightCm, 178);
      expect(m.chestCm, isNull);
      expect(m.recordedBy!.name, 'Coach Ravi');
    });

    test('tolerates real JSON numbers as well as strings', () {
      final m = BodyMeasurement.fromJson(_json(weight: 80, fat: 12.5));
      expect(m.weightKg, 80);
      expect(m.bodyFatPercent, 12.5);
    });

    test('summary lists only the recorded values', () {
      final m = BodyMeasurement.fromJson(
        _json(weight: '78.50', waist: '84', fat: '18'),
      );
      expect(m.summary, '78.5 kg · 18% fat · Waist 84');
      expect(
        BodyMeasurement.fromJson(_json(weight: null)).summary,
        'No values recorded',
      );
    });
  });

  group('MeasuredMemberOption.fromJson', () {
    test('reads member, branch id, trainer, latest and count', () {
      final o = MeasuredMemberOption.fromJson({
        'member': {
          'id': 'm1',
          'name': 'Asha Rao',
          'memberId': 'MEM-0001',
          'profilePhotoUrl': null,
          'branch': {'id': 'b1', 'name': 'Bandra'},
          'trainer': {'id': 't1', 'name': 'Ravi'},
        },
        'latest': _json(),
        'count': 3,
      });
      expect(o.memberName, 'Asha Rao');
      expect(o.branchId, 'b1');
      expect(o.branchName, 'Bandra');
      expect(o.trainerName, 'Ravi');
      expect(o.count, 3);
      expect(o.latest.weightKg, 78.5);
    });

    test('no trainer and no branch id still parse', () {
      final o = MeasuredMemberOption.fromJson({
        'member': {
          'id': 'm2',
          'name': 'B',
          'memberId': 'MEM-2',
          'profilePhotoUrl': null,
          'branch': {'name': 'Andheri'},
          'trainer': null,
        },
        'latest': _json(),
        'count': 1,
      });
      expect(o.trainerName, isNull);
      expect(o.branchId, '');
    });
  });

  group('number helpers', () {
    test('parseMeasurementNumber accepts comma decimals', () {
      expect(parseMeasurementNumber('78,5'), 78.5);
      expect(parseMeasurementNumber(' 78.5 '), 78.5);
      expect(parseMeasurementNumber(''), isNull);
      expect(parseMeasurementNumber('abc'), isNull);
    });

    test('fmtNum trims trailing zeros', () {
      expect(fmtNum(78), '78');
      expect(fmtNum(78.5), '78.5');
      expect(fmtNum(78.25), '78.25');
    });
  });

  group('MeasurementFormController', () {
    late MeasurementFormController form;
    setUp(() => form = MeasurementFormController());
    tearDown(() => form.dispose());

    test('empty form is valid (every field optional) and sends no values', () {
      expect(form.validate(), isNull);
      final json = form.toInput().toJson();
      expect(json.keys, ['recordedAt']);
    });

    test('comma decimals are accepted and sent as numbers', () {
      form.of(MeasurementField.weight).text = '78,5';
      expect(form.validate(), isNull);
      expect(form.toInput().weightKg, 78.5);
    });

    test('bounds mirror the API validators', () {
      String? check(MeasurementField f, String v) {
        for (final x in MeasurementField.values) {
          form.of(x).text = '';
        }
        form.of(f).text = v;
        return form.validate();
      }

      expect(check(MeasurementField.weight, '500'), isNull);
      expect(check(MeasurementField.weight, '501'), contains('500'));
      expect(check(MeasurementField.weight, '0'), contains('greater than 0'));
      expect(check(MeasurementField.height, '301'), contains('300'));
      expect(check(MeasurementField.bodyFat, '0'), isNull);
      expect(check(MeasurementField.bodyFat, '80'), isNull);
      expect(check(MeasurementField.bodyFat, '81'), contains('80'));
      expect(check(MeasurementField.chest, '301'), contains('300'));
      expect(check(MeasurementField.waist, '301'), contains('300'));
      expect(check(MeasurementField.hips, '301'), contains('300'));
      expect(check(MeasurementField.biceps, '151'), contains('150'));
      expect(check(MeasurementField.biceps, '150'), isNull);
      expect(check(MeasurementField.thighs, '201'), contains('200'));
      expect(check(MeasurementField.thighs, '1.2.3'), contains('number'));
    });

    test('date is sent as a UTC calendar day', () {
      form.setDate(DateTime(2026, 9, 14, 17, 30));
      expect(
        form.toInput().recordedAt,
        DateTime.utc(2026, 9, 14),
      );
    });

    test('an existing entry pre-fills the fields', () {
      final f = MeasurementFormController(
        initial: BodyMeasurement.fromJson(
          _json(weight: '70.00', waist: '81.50', notes: 'ok'),
        ),
      );
      addTearDown(f.dispose);
      expect(f.of(MeasurementField.weight).text, '70');
      expect(f.of(MeasurementField.waist).text, '81.5');
      expect(f.notes.text, 'ok');
      expect(f.date, DateTime(2026, 9));
    });
  });

  group('MemberProgress', () {
    test('orders oldest first and ignores entries with no values', () {
      final p = MemberProgress([
        _bm('c', '2026-09-20', weight: '70'),
        _bm('a', '2026-09-01', weight: '74'),
        _bm('empty', '2026-09-10'),
        _bm('b', '2026-09-10', weight: '72'),
      ]);
      expect(p.asc.map((e) => e.id), ['a', 'empty', 'b', 'c']);
      expect(p.valued.map((e) => e.id), ['a', 'b', 'c']);
      expect(p.first!.id, 'a');
      expect(p.latest!.id, 'c');
      expect(p.previous!.id, 'b');
      expect(p.history.first.id, 'c');
    });

    test('empty input is empty', () {
      expect(MemberProgress(const []).isEmpty, isTrue);
      expect(MemberProgress([_bm('x', '2026-09-01')]).isEmpty, isTrue);
    });

    test('diff rounds to one decimal and needs both sides', () {
      final p = MemberProgress([
        _bm('a', '2026-09-01', weight: '74.25'),
        _bm('b', '2026-09-20', weight: '70'),
      ]);
      expect(p.diff(p.latest, p.first, MeasurementField.weight), -4.3);
      expect(p.diff(p.latest, p.first, MeasurementField.waist), isNull);
    });

    test('BMI uses the entry height, else the most recent recorded one', () {
      final p = MemberProgress([
        _bm('a', '2026-09-01', weight: '80', height: '180'),
        _bm('b', '2026-09-20', weight: '72.9'),
      ]);
      expect(p.bmiOf(p.first), 24.7);
      expect(p.bmiOf(p.latest), 22.5);
      expect(MemberProgress.bmiBand(17), 'Underweight');
      expect(MemberProgress.bmiBand(22), 'Healthy range');
      expect(MemberProgress.bmiBand(27), 'Overweight');
      expect(MemberProgress.bmiBand(31), 'Obese');
      final noHeight = MemberProgress([_bm('a', '2026-09-01', weight: '80')]);
      expect(noHeight.bmiOf(noHeight.first), isNull);
    });

    test('range filter keeps recent entries only', () {
      final now = DateTime.utc(2026, 10, 1);
      final p = MemberProgress([
        _bm('old', '2026-06-01', weight: '75'),
        _bm('new', '2026-09-25', weight: '72'),
      ]);
      expect(p.inRange(30, now: now).map((e) => e.id), ['new']);
      expect(p.inRange(null, now: now).length, 2);
    });

    test('waist and body fat: lower is better', () {
      expect(lowerIsBetter(MeasurementField.waist), isTrue);
      expect(lowerIsBetter(MeasurementField.bodyFat), isTrue);
      expect(lowerIsBetter(MeasurementField.weight), isNull);
    });
  });
}
