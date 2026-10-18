import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/business_hours.dart';
import 'package:gym_saas_mobile/models/gym_branding.dart';
import 'package:gym_saas_mobile/models/gym_business_settings.dart';
import 'package:gym_saas_mobile/models/gym_email_notification_settings.dart';
import 'package:gym_saas_mobile/models/gym_profile.dart';
import 'package:gym_saas_mobile/models/tenant_ai_settings.dart';

void main() {
  group('BusinessHours', () {
    test('parses per-day hours and round-trips to the API shape', () {
      final h = BusinessHours.fromJson({
        'monday': {'open': '06:00', 'close': '22:00', 'closed': false},
        'sunday': {'open': null, 'close': null, 'closed': true},
        'junk': 1,
      });
      expect(h['monday']!.open, '06:00');
      expect(h['sunday']!.closed, isTrue);
      expect(h.openDays, 1);
      expect(
          h.toJson()['sunday'], {'open': null, 'close': null, 'closed': true},);
      expect(BusinessHours.fromJson(h.toJson()), h);
    });

    test('tolerates a missing or malformed payload', () {
      expect(BusinessHours.fromJson(null).days, isEmpty);
      expect(BusinessHours.fromJson('x').days, isEmpty);
    });

    test('hours per day: closed, incomplete and inverted days count 0', () {
      expect(const BusinessHoursDay(open: '06:00', close: '22:30').hours, 16.5);
      expect(
          const BusinessHoursDay(open: '06:00', close: '22:00', closed: true)
              .hours,
          0,);
      expect(const BusinessHoursDay(open: '06:00').hours, 0);
      expect(const BusinessHoursDay(open: '22:00', close: '06:00').hours, 0);
    });

    test('withDay replaces one day and keeps the others', () {
      final h = const BusinessHours().withDay(
        'friday',
        const BusinessHoursDay(open: '07:00', close: '20:00'),
      );
      expect(h['friday']!.close, '20:00');
      expect(
          h.withDay('monday', const BusinessHoursDay(closed: true)).days.length,
          2,);
    });
  });

  test('GymProfile parses every web field incl. decimal coordinates', () {
    final p = GymProfile.fromJson({
      'gymName': 'Iron Forge',
      'legalBusinessName': 'Iron Forge LLP',
      'registrationNumber': 'REG1',
      'gstVatNumber': 'GST1',
      'businessType': 'Fitness Center',
      'description': 'd',
      'email': 'a@b.test',
      'phone': '1',
      'alternatePhone': '2',
      'website': 'https://x.test',
      'addressLine': 'a',
      'city': 'c',
      'state': 's',
      'country': 'IN',
      'postalCode': '560001',
      'latitude': '12.9716',
      'longitude': 77.5946,
      'businessHours': {
        'monday': {'open': '06:00', 'close': '22:00', 'closed': false},
      },
      'socialLinks': {'instagram': 'https://i.test'},
    });
    expect(p.latitude, 12.9716);
    expect(p.longitude, 77.5946);
    expect(p.alternatePhone, '2');
    expect(p.businessHours.openDays, 1);
    expect(p.socialLinks!.instagram, 'https://i.test');
  });

  test('GymProfile still parses the minimal payload the old screen used', () {
    final p = GymProfile.fromJson({'gymName': 'G'});
    expect(p.gymName, 'G');
    expect(p.businessHours.days, isEmpty);
    expect(p.latitude, isNull);
  });

  test('GymBranding counts uploaded images (setup progress)', () {
    final b = GymBranding.fromJson({
      'logoUrl': 'u',
      'faviconUrl': '',
      'loginBackgroundUrl': 'u',
      'dashboardBannerUrl': null,
      'emailLogoUrl': 'u',
      'primaryColor': '#4f46e5',
      'theme': 'DARK',
    });
    expect(b.imageCount, 3);
    expect(b.theme, 'DARK');
  });

  test('GymBusinessSettings gained week start and locale with safe defaults',
      () {
    final b = GymBusinessSettings.fromJson({
      'currency': 'INR',
      'currencySymbol': '₹',
      'timezone': 'Asia/Kolkata',
      'dateFormat': 'DD/MM/YYYY',
      'timeFormat': '12h',
      'measurementUnit': 'METRIC',
    });
    expect(b.weekStartDay, 0);
    expect(b.locale, 'en');
    final c = GymBusinessSettings.fromJson({
      'currency': 'USD',
      'currencySymbol': r'$',
      'timezone': 'UTC',
      'dateFormat': 'MM/DD/YYYY',
      'timeFormat': '24h',
      'measurementUnit': 'IMPERIAL',
      'weekStartDay': 1,
      'locale': 'en-US',
    });
    expect(c.weekStartDay, 1);
    expect(c.measurementUnit, MeasurementUnit.imperial);
  });

  test('notification settings keep smsProviderConfig when saved back', () {
    final n = GymNotificationSettings.fromJson({
      'emailNotificationsEnabled': true,
      'pushNotificationsEnabled': false,
      'smsNotificationsEnabled': true,
      'whatsappNotificationsEnabled': false,
      'smsProviderConfig': {'sender': 'GYM'},
    });
    final toggled = n.copyWith(push: true);
    expect(toggled.toJson()['smsProviderConfig'], {'sender': 'GYM'});
    expect(toggled.toJson()['pushNotificationsEnabled'], isTrue);
    expect(toggled == n, isFalse);
    expect(n.copyWith() == n, isTrue);
  });

  test('email settings and AI settings parse', () {
    expect(
      GymEmailSettings.fromJson(
          {'emailFromName': 'Gym', 'emailFromAddress': null},).emailFromName,
      'Gym',
    );
    final ai = TenantAiSettings.fromJson({
      'provider': 'openai',
      'model': 'gpt',
      'temperature': 1,
      'maxTokens': 800,
      'hasApiKey': true,
      'apiKeyMasked': 'sk-…abcd',
      'usingPlatformDefault': false,
    });
    expect(ai.temperature, 1.0);
    expect(ai.hasApiKey, isTrue);
    expect(ai.usingPlatformDefault, isFalse);
    expect(TenantAiSettings.fromJson({}).usingPlatformDefault, isTrue);
  });
}
