import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/iam_user.dart';
import 'package:gym_saas_mobile/models/iam_user_stats.dart';
import 'package:gym_saas_mobile/models/permission_matrix.dart';
import 'package:gym_saas_mobile/models/staff_member.dart';
import 'package:gym_saas_mobile/models/staff_stats.dart';
import 'package:gym_saas_mobile/models/tenant_role.dart';
import 'package:gym_saas_mobile/repositories/staff_repository.dart';

Map<String, dynamic> _staff({
  String id = 's1',
  String status = 'ACTIVE',
  String role = 'TRAINER',
  String workStatus = 'WORKING',
  String? deletedAt,
}) =>
    {
      'id': id,
      'employeeId': 'EMP-0001',
      'firstName': 'Dana',
      'lastName': 'Lee',
      'name': 'Dana Lee',
      'email': 'dana@example.com',
      'phone': null,
      'avatarUrl': null,
      'status': status,
      'role': role,
      'branches': [
        {'branchId': 'b1', 'branchName': 'Main', 'isPrimary': true},
        {'branchId': 'b2', 'branchName': 'East', 'isPrimary': false},
      ],
      'primaryBranch': {
        'branchId': 'b1',
        'branchName': 'Main',
        'isPrimary': true,
      },
      'employmentType': 'FULL_TIME',
      'workStatus': workStatus,
      'joiningDate': '2026-01-05T00:00:00.000Z',
      'lastLoginAt': null,
      'createdAt': '2026-01-05T10:00:00.000Z',
      'deletedAt': deletedAt,
    };

void main() {
  group('StaffMember', () {
    test('parses a list row (detail-only fields stay null)', () {
      final s = StaffMember.fromJson(_staff());
      expect(s.name, 'Dana Lee');
      expect(s.firstName, 'Dana');
      expect(s.role, StaffRole.trainer);
      expect(s.branches.length, 2);
      expect(s.primaryBranch?.branchName, 'Main');
      expect(s.salaryAmount, isNull);
      expect(s.isDeleted, isFalse);
      expect(s.initials, 'DL');
    });

    test('parses salaryAmount arriving as a Decimal STRING', () {
      final s = StaffMember.fromJson({
        ..._staff(),
        'salaryAmount': '25000.50',
        'salaryType': 'MONTHLY',
        'weeklyOff': 'SUNDAY,MONDAY',
      });
      expect(s.salaryAmount, 25000.5);
      expect(s.weeklyOffDays.toSet(), {'Mon', 'Sun'});
    });

    test('deleted and suspended accounts count as inactive', () {
      expect(
        StaffMember.fromJson(_staff(deletedAt: '2026-02-01T00:00:00.000Z'))
            .isInactive,
        isTrue,
      );
      expect(
        StaffMember.fromJson(_staff(status: 'SUSPENDED')).isInactive,
        isTrue,
      );
      expect(StaffMember.fromJson(_staff()).isInactive, isFalse);
    });

    test('weeklyOff round-trips in the format web writes', () {
      expect(parseWeeklyOff('Mon, Tue'), ['Mon', 'Tue']);
      expect(parseWeeklyOff('MONDAY,SATURDAY'), ['Mon', 'Sat']);
      expect(parseWeeklyOff(null), isEmpty);
      expect(encodeWeeklyOff(['Sat', 'Mon']), 'MONDAY,SATURDAY');
      expect(encodeWeeklyOff(<String>[]), isNull);
    });
  });

  group('StaffStats', () {
    test('buckets by status / role / work status; total includes deleted', () {
      final stats = StaffStats.from([
        StaffMember.fromJson(_staff(id: 'a')),
        StaffMember.fromJson(_staff(id: 'b', status: 'PENDING_VERIFICATION')),
        StaffMember.fromJson(
          _staff(id: 'c', status: 'LOCKED', role: 'MANAGER'),
        ),
        StaffMember.fromJson(_staff(id: 'd', workStatus: 'ON_LEAVE')),
        StaffMember.fromJson(
          _staff(id: 'e', deletedAt: '2026-02-01T00:00:00.000Z'),
        ),
      ]);
      expect(stats.total, 5);
      expect(stats.live.length, 4);
      expect(stats.deleted, 1);
      expect(stats.count('ACTIVE'), 2);
      expect(stats.count('PENDING_VERIFICATION'), 1);
      expect(stats.lockedOrSuspended.length, 1);
      expect(stats.roleCount(StaffRole.manager), 1);
      expect(stats.roleCount(StaffRole.trainer), 3);
      expect(stats.workCount('ON_LEAVE'), 1);
    });
  });

  test('StaffBulkResult parses succeeded and failed', () {
    final r = StaffBulkResult.fromJson({
      'succeeded': ['a', 'b'],
      'failed': [
        {'userId': 'c', 'reason': 'Cannot delete yourself'},
      ],
    });
    expect(r.succeeded, ['a', 'b']);
    expect(r.failed['c'], 'Cannot delete yourself');
  });

  group('IamUser', () {
    test('parses a list row and a detail row', () {
      final u = IamUser.fromJson({
        'id': 'u1',
        'name': 'Priya Sharma',
        'email': 'p@x.com',
        'phone': null,
        'status': 'ACTIVE',
        'avatarUrl': null,
        'roles': [
          {'id': 'r1', 'name': 'MANAGER', 'isSystem': true},
        ],
        'allBranches': false,
        'branches': [
          {
            'branchId': 'b1',
            'branchName': 'Main',
            'isPrimary': true,
            'expiresAt': '2026-12-31T23:59:59.000Z',
          },
        ],
        'lastLoginAt': null,
        'mfaEnabled': true,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'deletedAt': null,
        'permissionOverrides': [
          {'key': 'members:delete', 'mode': 'DENY'},
        ],
        'effectivePermissions': ['members:view'],
      });
      expect(u.initials, 'PS');
      expect(u.mfaEnabled, isTrue);
      expect(u.branches.single.expiresAt, isNotNull);
      expect(u.permissionOverrides.single.mode, 'DENY');
      expect(u.effectivePermissions, ['members:view']);
      expect(u.needsRestore, isFalse);
    });

    test('tolerates missing optional blocks', () {
      final u = IamUser.fromJson({
        'id': 'u2',
        'name': 'X',
        'email': 'x@x.com',
        'status': 'SUSPENDED',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });
      expect(u.roles, isEmpty);
      expect(u.branches, isEmpty);
      expect(u.needsRestore, isTrue);
    });
  });

  test('IamUserStats parses counts, role breakdown and flagged people', () {
    final s = IamUserStats.fromJson({
      'total': 6,
      'byStatus': {'ACTIVE': 4, 'LOCKED': 1, 'SUSPENDED': 1},
      'mfaEnabled': 2,
      'signedInThisWeek': 3,
      'pendingInvitations': 1,
      'byRole': [
        {'name': 'OWNER', 'count': 1},
        {'name': 'TRAINER', 'count': 3},
      ],
      'lastSignIn': {
        'today': 1,
        'thisWeek': 2,
        'thisMonth': 1,
        'older': 1,
        'never': 1,
      },
      'locked': [
        {'id': 'u1', 'name': 'Locked One', 'detail': 'Too many attempts'},
      ],
      'pendingVerification': <dynamic>[],
      'dormant': <dynamic>[],
    });
    expect(s.total, 6);
    expect(s.status('LOCKED'), 1);
    expect(s.status('DEACTIVATED'), 0);
    expect(s.signIn('never'), 1);
    expect(s.byRole.last.count, 3);
    expect(s.locked.single.name, 'Locked One');
    expect(s.nothingToFlag, isFalse);
  });

  test('PermissionMatrix groups by resource and parses role key sets', () {
    final m = PermissionMatrix.fromJson({
      'permissions': [
        {'key': 'members:view', 'description': 'View', 'resource': 'members'},
        {'key': 'members:create', 'description': null, 'resource': 'members'},
        {'key': 'staff:view', 'description': 'x', 'resource': 'staff'},
      ],
      'roles': [
        {
          'id': 'r1',
          'name': 'OWNER',
          'isSystem': true,
          'permissionKeys': ['members:view', 'staff:view'],
        },
      ],
    });
    expect(m.byResource.keys, ['members', 'staff']);
    expect(m.byResource['members']!.length, 2);
    expect(m.roles.single.permissionKeys.contains('staff:view'), isTrue);
  });

  group('TenantRole', () {
    test('parses priority / isDefault and tolerates their absence', () {
      final r = TenantRole.fromJson({
        'id': 'r',
        'name': 'Shift Supervisor',
        'description': 'Floor lead',
        'isSystem': false,
        'isActive': true,
        'userCount': 2,
        'permissions': ['members:view'],
        'priority': 20,
        'isDefault': true,
      });
      expect(r.priority, 20);
      expect(r.isDefault, isTrue);
      expect(roleBlurb(r), 'Floor lead');
      final bare = TenantRole.fromJson({'id': 'x', 'name': 'Y'});
      expect(bare.priority, 0);
      expect(bare.permissions, isEmpty);
      expect(roleBlurb(bare), 'No description.');
    });

    test('displayRoleName prettifies system identifiers only', () {
      expect(displayRoleName('SUPER_ADMIN'), 'Super admin');
      expect(displayRoleName('RECEPTIONIST'), 'Receptionist');
      expect(displayRoleName('Shift Supervisor'), 'Shift Supervisor');
    });
  });

  group('team_ui helpers', () {
    test('PasswordRules mirrors the server password policy', () {
      expect(PasswordRules.isValid('weak'), isFalse);
      expect(PasswordRules.isValid('Abcdefg1'), isFalse); // no special char
      expect(PasswordRules.isValid('Abcdef1!'), isTrue);
      expect(
        PasswordRules.evaluate('abc').where((r) => r.$2).length,
        1, // only the lowercase rule
      );
    });

    test('prettyEnum / isoDate / parseIsoDate', () {
      expect(prettyEnum('PENDING_VERIFICATION'), 'Pending verification');
      expect(prettyEnum(null), '');
      expect(isoDate(DateTime(2026, 3, 5)), '2026-03-05');
      expect(parseIsoDate('2026-03-05T00:00:00.000Z')?.day, 5);
      expect(parseIsoDate(''), isNull);
    });

    test('fmtDate keeps the calendar day of UTC-midnight date columns', () {
      expect(fmtDate(DateTime.utc(2026, 1, 5)), '05/01/2026');
      expect(fmtDate(null), '—');
    });
  });
}
