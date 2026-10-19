import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/gym_info.dart';

void main() {
  test('parses branch holidays as plain calendar days, sorted, skipping junk', () {
    final info = GymInfo.fromJson({
      'name': 'Gym',
      'branch': {
        'name': 'Main',
        'holidays': [
          {'date': '2026-10-24', 'label': ' Diwali '},
          {'date': '2026-10-17', 'label': null},
          {'date': 'bad', 'label': 'x'},
          'junk',
        ],
      },
    });
    final h = info.branch!.holidays;
    expect(h.length, 2);
    expect(h.first.date, DateTime(2026, 10, 17));
    expect(h.first.label, isNull);
    expect(h.last.date, DateTime(2026, 10, 24));
    expect(h.last.label, 'Diwali');
  });

  test('missing holidays defaults to an empty list', () {
    final info = GymInfo.fromJson({
      'name': 'Gym',
      'branch': {'name': 'Main'},
    });
    expect(info.branch!.holidays, isEmpty);
  });
}
