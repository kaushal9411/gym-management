import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/profile/presentation/profile_logic.dart';
import 'package:gym_saas_mobile/models/login_history_entry.dart';
import 'package:gym_saas_mobile/models/staff_profile.dart';

Map<String, dynamic> _json({
  String? phone = '9876543210',
  String? avatar = 'data:image/png;base64,x',
  Map<String, dynamic>? emergency,
  bool mfa = true,
  String? verified = '2026-01-01T00:00:00.000Z',
}) =>
    {
      'id': 'u1',
      'name': 'Asha Rao',
      'email': 'asha@gym.test',
      'phone': phone,
      'avatarUrl': avatar,
      'roles': ['OWNER'],
      'emergencyContact':
          emergency ?? {'name': 'Ravi', 'phone': '111', 'relation': 'Spouse'},
      'notificationPreferences': {'email_billing': true},
      'branchAccess': {'allBranches': true, 'branches': <dynamic>[]},
      'mfaEnabled': mfa,
      'emailVerifiedAt': verified,
      'lastLoginAt': '2026-10-17T08:00:00.000Z',
      'createdAt': '2026-01-01T00:00:00.000Z',
    };

void main() {
  group('StaffProfile', () {
    test('parses the verification and creation dates', () {
      final p = StaffProfile.fromJson(_json());
      expect(p.emailVerifiedAt, isNotNull);
      expect(p.createdAt, '2026-01-01T00:00:00.000Z');
    });

    test('older payloads without them still parse', () {
      final j = _json()
        ..remove('emailVerifiedAt')
        ..remove('createdAt');
      final p = StaffProfile.fromJson(j);
      expect(p.emailVerifiedAt, isNull);
      expect(p.createdAt, isNull);
    });
  });

  group('completeness', () {
    test('a full profile is 100%', () {
      final items = profileCompleteness(StaffProfile.fromJson(_json()));
      expect(items, hasLength(8));
      expect(completenessPercent(items), 100);
    });

    test('counts only real saved fields', () {
      final p = StaffProfile.fromJson(
        _json(
          phone: null,
          avatar: null,
          emergency: {'name': 'Ravi', 'phone': null, 'relation': '  '},
          mfa: false,
          verified: null,
        ),
      );
      final items = profileCompleteness(p);
      expect(items.where((i) => i.done).map((i) => i.label), [
        'Full name',
        'Emergency contact name',
      ]);
      expect(completenessPercent(items), 25);
    });
  });

  test('profileDate', () {
    expect(profileDate('2026-10-17T12:00:00.000Z'), contains('2026'));
    expect(profileDate(null), 'Never');
    expect(profileDate('nope', never: '—'), '—');
  });

  test('LoginHistoryEntry parses success and failure', () {
    final ok = LoginHistoryEntry.fromJson({
      'id': 'h1',
      'success': true,
      'reason': null,
      'ipAddress': '1.2.3.4',
      'userAgent': 'x',
      'createdAt': '2026-10-17T08:00:00.000Z',
    });
    final bad = LoginHistoryEntry.fromJson({
      'id': 'h2',
      'success': false,
      'reason': 'Bad password',
      'createdAt': '2026-10-17T08:00:00.000Z',
    });
    expect(ok.success, isTrue);
    expect(bad.reason, 'Bad password');
    expect(bad.ipAddress, isNull);
  });
}
