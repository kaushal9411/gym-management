import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/utils/app_clock.dart';

void main() {
  group('AppClock (Indian Standard Time)', () {
    test('now() is UTC + 5:30 wall-clock, whatever zone the phone is in', () {
      final utc = DateTime.now().toUtc();
      final ist = AppClock.now();
      final expected = utc.add(const Duration(hours: 5, minutes: 30));
      final asWall = DateTime.utc(
        ist.year,
        ist.month,
        ist.day,
        ist.hour,
        ist.minute,
        ist.second,
      );
      expect(asWall.difference(expected).inSeconds.abs(), lessThan(3));
    });

    test('today() is midnight of India\'s calendar day', () {
      final t = AppClock.today();
      expect([t.hour, t.minute, t.second], [0, 0, 0]);
      final n = AppClock.now();
      expect([t.year, t.month, t.day], [n.year, n.month, n.day]);
    });

    test('defaults are Asia/Kolkata and India', () {
      expect(AppClock.timezone, 'Asia/Kolkata');
      expect(AppClock.country, 'India');
    });
  });
}
