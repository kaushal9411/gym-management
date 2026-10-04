import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/profile_failure.dart';
import 'package:gym_saas_mobile/core/utils/profile_photo.dart';
import 'package:gym_saas_mobile/models/member_profile_form.dart';
import 'package:gym_saas_mobile/models/member_self_profile.dart';

/// Derived from the backend DTO (every field populated).
Map<String, dynamic> dtoFixture() => {
      'id': 'm-1',
      'memberId': 'MEM-0042',
      'firstName': 'Asha',
      'lastName': 'Rao',
      'name': 'Asha Rao',
      'email': 'asha@example.com',
      'phone': '9876543210',
      'profilePhotoUrl': 'http://x/uploads/a.jpg',
      'qrCodeImageUrl': 'http://x/uploads/q.png',
      'dateOfBirth': '1994-05-17',
      'gender': 'FEMALE',
      'address': {
        'addressLine': '12 MG Road',
        'city': 'Pune',
        'state': 'MH',
        'country': 'India',
        'postalCode': '411001',
      },
      'emergencyContact': {
        'name': 'Ravi',
        'phone': '9000000001',
        'relation': 'Spouse',
      },
      'occupation': 'Engineer',
      'height': 172.5,
      'weight': '64',
      'bloodGroup': 'O_POSITIVE',
      'maritalStatus': 'MARRIED',
      'anniversary': '2020-02-02',
      'goal': 'MUSCLE_BUILDING',
      'bodyType': 'AVERAGE',
      'foodPreference': 'VEGAN',
      'fitnessGoals': 'Run a 10K',
      'locked': {
        'branch': {'id': 'b1', 'name': 'Main'},
        'trainer': {'id': 't1', 'name': 'Tina'},
        'status': 'ACTIVE',
        'joiningDate': '2026-01-01',
        'membership': {
          'planName': 'Gold',
          'status': 'ACTIVE',
          'endDate': '2026-12-31',
        },
      },
      'editable': ['firstName', 'lastName', 'email'],
    };

/// Shape of a REAL `GET /portal/profile` response (sanitised: dummy
/// identity/URLs; mostly-null optional fields exactly as the server sent).
Map<String, dynamic> realFixture() => {
      'id': '00000000-0000-4000-8000-000000000001',
      'memberId': 'MEM-0001',
      'firstName': 'Test',
      'lastName': 'Member',
      'name': 'Test Member',
      'email': 'test.member@example.com',
      'phone': '9000000000',
      'profilePhotoUrl':
          'http://localhost:4000/uploads/public/member-photos/x.jpg',
      'qrCodeImageUrl': 'http://localhost:4000/uploads/public/qr-codes/x.png',
      'dateOfBirth': null,
      'gender': 'MALE',
      'address': {
        'addressLine': null,
        'city': null,
        'state': null,
        'country': 'India',
        'postalCode': null,
      },
      'emergencyContact': {'name': null, 'phone': null, 'relation': null},
      'occupation': null,
      'height': null,
      'weight': null,
      'bloodGroup': null,
      'maritalStatus': null,
      'anniversary': null,
      'goal': null,
      'bodyType': null,
      'foodPreference': null,
      'fitnessGoals': null,
      'locked': {
        'branch': {'id': 'b', 'name': 'Demo Gym - Main Branch'},
        'trainer': null,
        'status': 'ACTIVE',
        'joiningDate': '2026-10-03',
        'membership': {
          'planName': 'Monthly Plan',
          'status': 'ACTIVE',
          'endDate': '2026-11-03',
        },
      },
      'editable': ['firstName', 'lastName'],
    };

void main() {
  group('MemberSelfProfile.fromJson', () {
    test('full DTO', () {
      final p = MemberSelfProfile.fromJson(dtoFixture());
      expect(p.name, 'Asha Rao');
      expect(p.initials, 'AR');
      expect(p.height, 172.5);
      expect(p.weight, 64.0); // numeric string tolerated
      expect(p.address.city, 'Pune');
      expect(p.emergencyContact.relation, 'Spouse');
      expect(p.locked.trainerName, 'Tina');
      expect(p.locked.planName, 'Gold');
      expect(p.editable, contains('email'));
      final v = p.toFormValues();
      expect(v['height'], '172.5');
      expect(v['weight'], '64');
      expect(v['dateOfBirth'], '1994-05-17');
    });

    test('real response shape: nulls stay null', () {
      final p = MemberSelfProfile.fromJson(realFixture());
      expect(p.dateOfBirth, isNull);
      expect(p.height, isNull);
      expect(p.locked.trainerName, isNull);
      expect(p.locked.branchName, 'Demo Gym - Main Branch');
      expect(p.address.country, 'India');
      expect(p.toFormValues()['city'], '');
    });

    test('missing blocks do not throw', () {
      final p = MemberSelfProfile.fromJson({'id': 'x', 'firstName': 'A'});
      expect(p.name, 'A');
      expect(p.locked.status, '');
      expect(p.editable, isEmpty);
    });
  });

  group('changedProfileFields', () {
    final initial = MemberSelfProfile.fromJson(dtoFixture()).toFormValues();

    test('no edits -> empty', () {
      expect(changedProfileFields(initial, Map.of(initial)), isEmpty);
    });

    test('only changed keys, trimmed; cleared -> null; numbers numeric', () {
      final cur = Map.of(initial)
        ..['firstName'] = '  Asha K '
        ..['city'] = ''
        ..['height'] = '173'
        ..['weight'] = '64.0' // equal to 64 -> unchanged
        ..['goal'] = 'ENDURANCE';
      expect(changedProfileFields(initial, cur), {
        'firstName': 'Asha K',
        'city': null,
        'height': 173,
        'goal': 'ENDURANCE',
      });
    });

    test('email case-only change is a no-op; real change is detected', () {
      final same = Map.of(initial)..['email'] = 'ASHA@example.com';
      expect(changedProfileFields(initial, same), isEmpty);
      expect(emailChanged(initial, same), isFalse);
      final diff = Map.of(initial)..['email'] = 'new@example.com';
      expect(changedProfileFields(initial, diff), {'email': 'new@example.com'});
      expect(emailChanged(initial, diff), isTrue);
    });
  });

  group('validateProfileValues', () {
    test('mirrors server rules', () {
      final e = validateProfileValues(
        {
          'firstName': ' ',
          'lastName': 'Rao',
          'email': 'nope',
          'phone': '12',
          'dateOfBirth': '2999-01-01',
          'height': '10',
          'weight': 'abc',
        },
        today: DateTime(2026, 10, 4),
      );
      expect(e['firstName'], 'First name is required');
      expect(e.containsKey('lastName'), isFalse);
      expect(e['email'], 'Enter a valid email address');
      expect(e['phone'], contains('valid phone'));
      expect(e['dateOfBirth'], contains('future'));
      expect(e['height'], contains('cm'));
      expect(e['weight'], contains('kg'));
    });

    test('valid values and password rule', () {
      final ok = {
        'firstName': 'A',
        'lastName': 'B',
        'email': 'a@b.co',
        'phone': '+91 98765-43210',
        'dateOfBirth': '1990-01-01',
      };
      expect(validateProfileValues(ok), isEmpty);
      expect(
        validateProfileValues(ok, emailIsChanging: true)['currentPassword'],
        isNotNull,
      );
      expect(
        validateProfileValues(ok, emailIsChanging: true, currentPassword: 'x'),
        isEmpty,
      );
    });
  });

  group('profile photo helpers', () {
    final jpeg = Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3]);
    test('sniffs mime from magic bytes', () {
      expect(sniffImageMime(jpeg), 'image/jpeg');
      expect(
        sniffImageMime(
            Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0]),),
        'image/png',
      );
      expect(
        sniffImageMime(
          Uint8List.fromList(
            [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
          ),
        ),
        'image/webp',
      );
      expect(sniffImageMime(Uint8List.fromList([1, 2, 3, 4])), isNull);
    });

    test('data url + rejections', () {
      expect(buildPhotoDataUrl(jpeg), startsWith('data:image/jpeg;base64,'));
      expect(
        () => buildPhotoDataUrl(Uint8List.fromList([1, 2, 3])),
        throwsA(isA<ProfilePhotoException>()),
      );
      final big = Uint8List(700000)
        ..[0] = 0xFF
        ..[1] = 0xD8
        ..[2] = 0xFF;
      expect(
          () => buildPhotoDataUrl(big), throwsA(isA<ProfilePhotoException>()),);
    });
  });

  group('ProfileFailure.from', () {
    ProfileFailure f(int? code, {List<FieldError> fe = const []}) =>
        ProfileFailure.from(
          ApiException(message: 'raw', statusCode: code, fieldErrors: fe),
        );
    test('maps statuses to kinds with friendly text', () {
      expect(f(409).kind, ProfileFailureKind.duplicate);
      expect(f(413).kind, ProfileFailureKind.tooLarge);
      expect(f(423).kind, ProfileFailureKind.accountLocked);
      expect(f(429).kind, ProfileFailureKind.rateLimited);
      expect(f(null).kind, ProfileFailureKind.network);
      expect(f(500).kind, ProfileFailureKind.other);
      expect(f(409).message, isNot('raw'));
    });
    test('422 keeps field errors', () {
      final x = f(422,
          fe: const [FieldError(field: 'currentPassword', message: 'Wrong')],);
      expect(x.kind, ProfileFailureKind.validation);
      expect(x.errorFor('currentPassword'), 'Wrong');
      expect(x.message, 'Wrong');
    });
  });
}
