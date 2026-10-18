import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';

void main() {
  test('parses a freshly created member with string height/weight', () {
    final m = GymMember.fromJson({
      'id': 'a',
      'memberId': 'MEM-0001',
      'firstName': 'A',
      'lastName': 'B',
      'name': 'A B',
      'profilePhotoUrl': null,
      'email': null,
      'phone': '9876543210',
      'status': 'ACTIVE',
      'branch': {'id': 'b', 'name': 'Main'},
      'trainer': null,
      'currentMembership': null,
      'joiningDate': '2026-10-17T00:00:00.000Z',
      'createdAt': '2026-10-17T10:00:00.000Z',
      'outstandingAmount': '0',
      'deletedAt': null,
      'height': '175',
      'weight': '70.5',
      'registrationFee': '500',
      'healthHeartCondition': true,
      'referredByMember': {'id': 'x', 'memberId': 'MEM-0009', 'name': 'R'},
    });
    expect(m.height, 175);
    expect(m.weight, 70.5);
    expect(m.registrationFee, '500');
    expect(m.healthFlags['Heart condition'], true);
    expect(m.referredByName, 'R');
  });
}
