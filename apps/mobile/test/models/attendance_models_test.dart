import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_access.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_member_card.dart';
import 'package:gym_saas_mobile/features/attendance/presentation/attendance_ui.dart';
import 'package:gym_saas_mobile/models/attendance_summary.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/qr_validation_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';

Map<String, dynamic> _rec({
  String id = 'a1',
  String? checkOut,
  String status = 'CHECKED_IN',
  String method = 'QR_CODE',
}) =>
    {
      'id': id,
      'member': {
        'id': 'm1',
        'memberId': 'MEM-0001',
        'name': 'Asha Rao',
        'profilePhotoUrl': 'https://x.test/a.png',
      },
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'checkInTime': '2026-10-17T04:30:00.000Z',
      'checkOutTime': checkOut,
      'attendanceDate': '2026-10-17',
      'method': method,
      'deviceName': 'Gate 1',
      'deviceId': null,
      'status': status,
      'notes': 'Late shift',
      'checkedInBy': {'id': 'u1', 'name': 'Rita'},
      'checkedOutBy': null,
      'createdAt': '2026-10-17T04:30:00.000Z',
      'updatedAt': '2026-10-17T04:30:00.000Z',
      'deletedAt': null,
    };

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['STAFF'],
      permissions: perms,
    );

TenantBranding _tenant(List<String> flags) => TenantBranding(
      slug: 't',
      name: 'T',
      status: 'ACTIVE',
      maintenanceMode: false,
      primaryColor: '',
      featureFlags: flags,
    );

void main() {
  group('AttendanceRecord.fromJson', () {
    test('parses every field of the DTO', () {
      final r = AttendanceRecord.fromJson(_rec());
      expect(r.id, 'a1');
      expect(r.memberUuid, 'm1');
      expect(r.memberCode, 'MEM-0001');
      expect(r.memberPhotoUrl, 'https://x.test/a.png');
      expect(r.branchId, 'b1');
      expect(r.branchName, 'Bandra');
      expect(r.deviceName, 'Gate 1');
      expect(r.notes, 'Late shift');
      expect(r.checkedInBy, 'Rita');
      expect(r.checkedOutBy, isNull);
      expect(r.isInside, isTrue);
    });

    test('a checked-out record is not inside', () {
      final r = AttendanceRecord.fromJson(
        _rec(checkOut: '2026-10-17T05:45:00.000Z', status: 'CHECKED_OUT'),
      );
      expect(r.isInside, isFalse);
      expect(r.checkOutTime, isNotNull);
      expect(visitDuration(r), const Duration(minutes: 75));
    });

    test('tolerates the slim shape older screens relied on', () {
      final r = AttendanceRecord.fromJson({
        'id': 'a2',
        'member': {'name': 'No Id'},
        'checkInTime': '2026-10-17T04:30:00.000Z',
      });
      expect(r.memberUuid, isNull);
      expect(r.status, isNull);
      // No status -> falls back to "no check-out time".
      expect(r.isInside, isTrue);
    });
  });

  test('AttendanceSummary parses the new fields and keeps old payloads', () {
    final s = AttendanceSummary.fromJson({
      'totalCheckInsToday': 12,
      'totalCheckOutsToday': 7,
      'currentlyInside': 5,
      'peakCheckInHour': 18,
      'trend': [
        {'date': '2026-10-16', 'count': 3},
        {'date': '2026-10-17', 'count': 4},
      ],
    });
    expect(s.totalCheckOutsToday, 7);
    expect(s.peakCheckInHour, 18);
    expect(s.trend.last.count, 4);

    final old = AttendanceSummary.fromJson({
      'totalCheckInsToday': 1,
      'currentlyInside': 1,
      'trend': <Object>[],
    });
    expect(old.totalCheckOutsToday, 0);
    expect(old.peakCheckInHour, isNull);
  });

  test('QrValidationMember keeps the optional photo', () {
    final r = QrValidationResult.fromJson({
      'valid': true,
      'reason': null,
      'alreadyCheckedIn': false,
      'member': {
        'id': 'm1',
        'memberId': 'MEM-1',
        'name': 'A',
        'status': 'ACTIVE',
        'profilePhotoUrl': 'https://x.test/p.png',
      },
    });
    expect(r.member!.profilePhotoUrl, 'https://x.test/p.png');
  });

  group('trend maths', () {
    List<AttendanceTrendDay> days(List<int> counts) => [
          for (var i = 0; i < counts.length; i++)
            AttendanceTrendDay(
              date: '2026-10-${(i + 1).toString().padLeft(2, '0')}',
              count: counts[i],
            ),
        ];

    test('week / day deltas like web', () {
      final m = computeAttendanceTrend(
        days([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 4]),
      );
      expect(m.today, 4);
      expect(m.yesterday, 2);
      expect(m.todayDeltaPct, 100);
      expect(m.lastWeekSum, 7);
      expect(m.thisWeekSum, 16);
      expect(m.weekdayPairs.length, 7);
      expect(m.weekdayPairs.last.$2, 4);
      expect(m.weekdayPairs.last.$3, 1);
    });

    test('empty / short series never throw', () {
      final empty = computeAttendanceTrend(const []);
      expect(empty.today, 0);
      expect(empty.weekDeltaPct, 0);
      final short = computeAttendanceTrend(days([2, 3]));
      expect(short.lastWeekSum, 0);
      expect(short.weekDeltaPct, 100);
    });

    test('formatters', () {
      expect(fmtDuration(const Duration(minutes: 135)), '2h 15m');
      expect(fmtDuration(const Duration(seconds: 20)), '<1m');
      expect(fmtHour(0), '12 AM');
      expect(fmtHour(13), '1 PM');
      expect(fmtHour(null), '—');
      expect(attendanceMethodLabel('FACE_RECOGNITION'), 'Face recognition');
      expect(attendanceMethodLabel('???'), 'Unknown');
    });

    test('groupRecordsByDay keeps order and splits on the local day', () {
      final a = AttendanceRecord.fromJson(_rec(id: 'a'));
      final b = AttendanceRecord.fromJson(_rec(id: 'b'));
      final far = AttendanceRecord(
        id: 'c',
        memberName: 'X',
        checkInTime: a.checkInTime.subtract(const Duration(days: 3)),
        checkOutTime: null,
      );
      final groups = groupRecordsByDay([a, b, far]);
      expect(groups.length, 2);
      expect(groups.first.$2.map((r) => r.id), ['a', 'b']);
      expect(groups.last.$2.single.id, 'c');
    });
  });

  group('memberIneligibleReason', () {
    GymMember member(String status, {Object? membership}) =>
        GymMember.fromJson({
          'id': 'm',
          'memberId': 'MEM-1',
          'firstName': 'A',
          'lastName': 'B',
          'name': 'A B',
          'status': status,
          'branch': {'id': 'b', 'name': 'Main'},
          'joiningDate': '2026-01-01',
          'createdAt': '2026-01-01T00:00:00.000Z',
          'currentMembership': membership,
        });

    Map<String, dynamic> ms(DateTime end) => {
          'planId': 'p',
          'planName': 'Gold',
          'startDate': '2026-01-01',
          'endDate': end.toIso8601String(),
          'status': 'ACTIVE',
        };

    test('active with a live plan is eligible', () {
      final m = member(
        'ACTIVE',
        membership: ms(DateTime.now().add(const Duration(days: 20))),
      );
      expect(memberIneligibleReason(m), isNull);
    });

    test('frozen / inactive / no plan / expired are not', () {
      expect(memberIneligibleReason(member('FROZEN')), contains('frozen'));
      expect(
        memberIneligibleReason(member('INACTIVE')),
        contains('not active'),
      );
      expect(
        memberIneligibleReason(member('ACTIVE')),
        contains('no active membership'),
      );
      expect(
        memberIneligibleReason(
          member(
            'ACTIVE',
            membership: ms(DateTime.now().subtract(const Duration(days: 3))),
          ),
        ),
        contains('expired'),
      );
    });
  });

  group('AttendanceAccess gating matrix', () {
    // Permission sets as seeded for the system roles (apps/api/prisma/seed.ts).
    const owner = [
      'attendance:view',
      'attendance:checkin',
      'attendance:checkout',
      'attendance:update',
      'attendance:delete',
      'attendance:export',
      'members:view',
    ];
    const receptionist = [
      'attendance:view',
      'attendance:checkin',
      'attendance:checkout',
    ];
    const viewOnly = ['attendance:view'];

    AttendanceAccess acc(List<String> perms, {List<String> flags = const []}) =>
        AttendanceAccess(_user(perms), _tenant(flags));

    test(
        'pushed Attendance dashboard: History + Check in/out are never gated '
        '(unchanged from before the redesign)', () {
      for (final perms in [owner, receptionist, viewOnly, <String>[]]) {
        expect(acc(perms).showHistory(asTab: false), isTrue);
        expect(acc(perms).showCheckIn(asTab: false), isTrue);
      }
    });

    test('Manager tab shortcuts mirror the menu tile / web key', () {
      expect(
        acc(viewOnly, flags: ['attendance']).showHistory(asTab: true),
        isTrue,
      );
      // Feature flag off -> hidden, like the menu tile.
      expect(acc(viewOnly).showHistory(asTab: true), isFalse);
      expect(
        acc(<String>[], flags: ['attendance']).showHistory(asTab: true),
        isFalse,
      );
      expect(acc(viewOnly).showCheckIn(asTab: true), isFalse);
      expect(acc(receptionist).showCheckIn(asTab: true), isTrue);
    });

    test('per-action keys are exactly the API route keys', () {
      expect(acc(viewOnly).canCheckOut, isFalse);
      expect(acc(viewOnly).canUpdate, isFalse);
      expect(acc(viewOnly).canDelete, isFalse);
      expect(acc(receptionist).canCheckOut, isTrue);
      expect(acc(receptionist).canUpdate, isFalse);
      expect(acc(receptionist).canDelete, isFalse);
      expect(acc(owner).canUpdate, isTrue);
      expect(acc(owner).canDelete, isTrue);
      expect(acc(owner).canViewMembers, isTrue);
      expect(acc(receptionist).canViewMembers, isFalse);
    });

    test('a non-staff session can do nothing', () {
      const none = AttendanceAccess(null, null);
      expect(none.canView, isFalse);
      expect(none.canCheckOut, isFalse);
      expect(none.showHistory(asTab: true), isFalse);
    });
  });
}
