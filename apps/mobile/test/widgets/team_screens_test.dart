import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/manager/presentation/staff_detail_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/staff_edit_employment_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/staff_edit_personal_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/staff_form_screen.dart';
import 'package:gym_saas_mobile/features/manager/presentation/team_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/invite_user_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/role_detail_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/role_form_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/roles_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_detail_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_edit_branches_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_edit_permissions_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_edit_profile_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_edit_roles_screen.dart';
import 'package:gym_saas_mobile/features/roles/presentation/user_form_screen.dart';
import 'package:gym_saas_mobile/features/team/presentation/staff_edit_branches_screen.dart';
import 'package:gym_saas_mobile/models/branch_option.dart';
import 'package:gym_saas_mobile/models/iam_user.dart';
import 'package:gym_saas_mobile/models/iam_user_stats.dart';
import 'package:gym_saas_mobile/models/invitation.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/permission_group.dart';
import 'package:gym_saas_mobile/models/permission_matrix.dart';
import 'package:gym_saas_mobile/models/staff_member.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/tenant_role.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/iam_user_repository.dart';
import 'package:gym_saas_mobile/repositories/invitation_repository.dart';
import 'package:gym_saas_mobile/repositories/staff_repository.dart';
import 'package:gym_saas_mobile/repositories/tenant_role_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

class _StaffRepo extends Fake implements StaffRepository {
  _StaffRepo(this.rows);

  final List<StaffMember> rows;

  PaginatedResult<StaffMember> get _page => PaginatedResult(
        items: rows,
        total: rows.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      );

  @override
  Future<PaginatedResult<StaffMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    StaffRole? role,
    String? status,
    String? workStatus,
    String? employmentType,
    String? branchId,
    bool includeDeleted = false,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async =>
      _page;

  @override
  Future<List<StaffMember>> listAll({
    String? branchId,
    bool includeDeleted = true,
    int maxPages = 10,
  }) async =>
      rows;

  @override
  Future<StaffMember> getById(String staffId) async => rows.first;
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<List<BranchOption>> assignable() async => const [
        BranchOption(id: 'b1', name: 'Main'),
        BranchOption(id: 'b2', name: 'East'),
      ];
}

IamUser _iamUser({String id = 'u1', String status = 'ACTIVE'}) =>
    IamUser.fromJson({
      'id': id,
      'name': 'Priya Sharma',
      'email': 'priya@x.test',
      'phone': '9876543210',
      'status': status,
      'roles': [
        {'id': 'r1', 'name': 'MANAGER', 'isSystem': true},
      ],
      'allBranches': false,
      'branches': [
        {'branchId': 'b1', 'branchName': 'Main', 'isPrimary': true},
      ],
      'mfaEnabled': false,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'permissionOverrides': [
        {'key': 'members:delete', 'mode': 'DENY'},
        {'key': 'reports:view', 'mode': 'GRANT'},
      ],
      'effectivePermissions': [
        'members:view',
        'members:create',
        'reports:view',
      ],
    });

final _roles = [
  TenantRole.fromJson({
    'id': 'r1',
    'name': 'MANAGER',
    'isSystem': true,
    'userCount': 2,
    'permissions': ['members:view', 'members:create'],
  }),
  TenantRole.fromJson({
    'id': 'r2',
    'name': 'Shift Supervisor',
    'isSystem': false,
    'userCount': 0,
    'priority': 10,
    'permissions': ['members:view'],
  }),
];

class _IamRepo extends Fake implements IamUserRepository {
  @override
  Future<PaginatedResult<IamUser>> list({
    int page = 1,
    String? search,
    String? status,
    String? roleId,
    String? branchId,
    bool includeDeleted = false,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async =>
      PaginatedResult(
        items: [_iamUser()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      );

  @override
  Future<IamUserStats> stats({String? branchId}) async =>
      IamUserStats.fromJson({
        'total': 3,
        'byStatus': {'ACTIVE': 2, 'LOCKED': 1},
        'mfaEnabled': 1,
        'signedInThisWeek': 2,
        'pendingInvitations': 1,
        'byRole': [
          {'name': 'MANAGER', 'count': 2},
        ],
        'lastSignIn': {
          'today': 1,
          'thisWeek': 1,
          'thisMonth': 0,
          'older': 0,
          'never': 1,
        },
        'locked': [
          {'id': 'u9', 'name': 'Locked Lou', 'detail': 'Too many attempts'},
        ],
        'pendingVerification': <dynamic>[],
        'dormant': <dynamic>[],
      });

  @override
  Future<IamUser> getById(String userId) async => _iamUser();
}

class _RoleRepo extends Fake implements TenantRoleRepository {
  @override
  Future<List<TenantRole>> list() async => _roles;

  @override
  Future<TenantRole> getById(String roleId) async => _roles.first;

  @override
  Future<List<PermissionGroup>> listPermissions() async => [
        PermissionGroup.fromJson({
          'resource': 'members',
          'permissions': [
            {'id': '1', 'key': 'members:view', 'description': 'View members'},
            {'id': '2', 'key': 'members:create', 'description': 'Add members'},
            {'id': '3', 'key': 'members:delete', 'description': 'Delete'},
          ],
        }),
        PermissionGroup.fromJson({
          'resource': 'reports',
          'permissions': [
            {'id': '4', 'key': 'reports:view', 'description': 'View reports'},
          ],
        }),
      ];

  @override
  Future<PermissionMatrix> matrix() async => PermissionMatrix.fromJson({
        'permissions': [
          {'key': 'members:view', 'description': 'v', 'resource': 'members'},
          {'key': 'members:create', 'description': 'c', 'resource': 'members'},
        ],
        'roles': [
          {
            'id': 'r1',
            'name': 'MANAGER',
            'isSystem': true,
            'permissionKeys': ['members:view'],
          },
        ],
      });
}

class _InviteRepo extends Fake implements InvitationRepository {
  @override
  Future<PaginatedResult<Invitation>> list({
    int page = 1,
    String? status,
  }) async =>
      PaginatedResult(
        items: [
          Invitation.fromJson({
            'id': 'i1',
            'email': 'new@x.test',
            'role': {'id': 'r1', 'name': 'TRAINER'},
            'invitedBy': 'Owner',
            'status': 'PENDING',
            'expiresAt':
                DateTime.now().add(const Duration(hours: 20)).toIso8601String(),
            'acceptedAt': null,
            'createdAt': DateTime.now().toIso8601String(),
          }),
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      );
}

Map<String, dynamic> _rawStaff({String status = 'ACTIVE'}) => {
      'id': 's1',
      'employeeId': 'EMP-0001',
      'firstName': 'Dana',
      'lastName': 'Lee',
      'name': 'Dana Lee',
      'email': 'dana@example.com',
      'phone': '9876543210',
      'status': status,
      'role': 'TRAINER',
      'branches': [
        {'branchId': 'b1', 'branchName': 'Main', 'isPrimary': true},
      ],
      'primaryBranch': {
        'branchId': 'b1',
        'branchName': 'Main',
        'isPrimary': true,
      },
      'employmentType': 'FULL_TIME',
      'workStatus': 'WORKING',
      'joiningDate': '2024-01-05T00:00:00.000Z',
      'createdAt': '2024-01-05T10:00:00.000Z',
      'updatedAt': '2024-02-05T10:00:00.000Z',
      'salaryType': 'MONTHLY',
      'salaryAmount': '25000.00',
      'weeklyOff': 'SUNDAY',
      'gender': 'FEMALE',
    };

StaffMember _staffMember({String status = 'ACTIVE'}) =>
    StaffMember.fromJson(_rawStaff(status: status));

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _allPerms = [
  'staff:view',
  'staff:create',
  'staff:update',
  'staff:activate',
  'staff:delete',
  'staff:restore',
  'staff:invite',
  'staff:assign-branch',
  'staff:assign-role',
  'users:read',
  'users:manage',
  'users:invite',
  'roles:read',
  'roles:manage-custom',
  'permissions:read',
];

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    void put<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    put<StaffRepository>(_StaffRepo([_staffMember()]));
    put<BranchRepository>(_BranchRepo());
    put<IamUserRepository>(_IamRepo());
    put<TenantRoleRepository>(_RoleRepo());
    put<InvitationRepository>(_InviteRepo());
  });

  Future<void> pumpApp(
    WidgetTester t,
    Widget child, {
    List<String> perms = _allPerms,
    Size size = const Size(560, 900),
  }) async {
    // Wider than a phone: flutter_test renders every glyph in the square Ahem
    // font (~2x wider than the real fonts), so a real 360dp layout is
    // approximated by a wider viewport.
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: 'me',
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  // The redesigned screens contain looping animations (hero mesh, pulse
  // dots), so pumpAndSettle would never return — pump fixed time instead.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  testWidgets('roster: KPIs, insight panels and a staff card render',
      (t) async {
    await pumpApp(t, const TeamScreen(standalone: true));
    await settle(t);
    expect(find.text('Staff directory'), findsOneWidget);
    expect(find.text('Total staff'), findsOneWidget);
    expect(find.text('Status mix'), findsOneWidget);
    expect(find.text('Needs attention'), findsOneWidget);
    await t.scrollUntilVisible(
      find.text('Dana Lee'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Dana Lee'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('roster: long-press enters multi-select with a bulk bar',
      (t) async {
    await pumpApp(t, const TeamScreen(standalone: true));
    await settle(t);
    await t.scrollUntilVisible(
      find.text('Dana Lee'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await t.longPress(find.text('Dana Lee'));
    await t.pump(const Duration(milliseconds: 400));
    expect(find.text('1 selected'), findsOneWidget);
    expect(find.text('Activate'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('staff profile: hero, tiles and all three tabs render',
      (t) async {
    await pumpApp(t, const StaffDetailScreen(staffId: 's1'));
    await settle(t);
    expect(find.text('Dana Lee'), findsWidgets);
    expect(find.text('Overview'), findsOneWidget);
    for (final tab in ['Employment', 'Access', 'Overview', 'Access']) {
      await t.tap(find.text(tab));
      await t.pump(const Duration(milliseconds: 500));
    }
    await t.scrollUntilVisible(
      find.text('Assigned branches'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Assigned branches'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('add staff wizard: step 1 validates, step 2 shows branches',
      (t) async {
    await pumpApp(t, const StaffFormScreen());
    await settle(t);
    expect(find.text('Account details'), findsOneWidget);
    await t.tap(find.text('Next'));
    await t.pump(const Duration(milliseconds: 400));
    expect(find.text('Enter first and last name'), findsOneWidget);

    await t.enterText(find.byType(TextField).at(0), 'Dana');
    await t.enterText(find.byType(TextField).at(1), 'Lee');
    await t.enterText(find.byType(TextField).at(2), 'dana@example.com');
    await t.tap(find.text('Next'));
    await t.pump(const Duration(milliseconds: 500));
    expect(find.text('Branch access'), findsOneWidget);
    expect(find.text('Main'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('Team & Access hub: users tab, then roles / matrix / invites',
      (t) async {
    await pumpApp(t, const RolesScreen());
    await settle(t);
    expect(find.text('Staff & access'), findsOneWidget);
    expect(find.text('Total people'), findsOneWidget);
    expect(find.text('Staff directory'), findsOneWidget);

    await t.ensureVisible(find.text('Roles'));
    await t.tap(find.text('Roles'));
    await settle(t);
    expect(find.text('People assigned'), findsOneWidget);
    expect(find.text('Shift Supervisor'), findsOneWidget);

    await t.ensureVisible(find.text('Matrix'));
    await t.tap(find.text('Matrix'));
    await settle(t);
    expect(find.text('Compare all roles side by side'), findsOneWidget);

    await t.ensureVisible(find.text('Permissions'));
    await t.tap(find.text('Permissions'));
    await settle(t);
    expect(find.text('members'), findsWidgets);

    await t.ensureVisible(find.text('Invites'));
    await t.tap(find.text('Invites'));
    await settle(t);
    expect(find.text('new@x.test'), findsOneWidget);
    expect(find.text('Resend'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('hub hides tabs the viewer has no permission for', (t) async {
    await pumpApp(
      t,
      const RolesScreen(),
      perms: const ['users:read'],
    );
    await settle(t);
    expect(find.text('Users'), findsOneWidget);
    expect(find.text('Roles'), findsNothing);
    expect(find.text('Invites'), findsNothing);
    expect(find.text('Matrix'), findsNothing);
    expect(t.takeException(), isNull);
  });

  testWidgets('user profile: hero and the three tabs render', (t) async {
    await pumpApp(t, const UserDetailScreen(userId: 'u1'));
    await settle(t);
    expect(find.text('Priya Sharma'), findsWidgets);
    for (final tab in ['Access', 'Permissions', 'Profile']) {
      await t.tap(find.text(tab));
      await t.pump(const Duration(milliseconds: 500));
    }
    expect(find.text('Account details'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('role profile and role form render', (t) async {
    await pumpApp(t, const RoleDetailScreen(roleId: 'r1'));
    await settle(t);
    expect(find.text('Manager'), findsWidgets);
    expect(find.text('PERMISSIONS BY RESOURCE'), findsOneWidget);
    expect(t.takeException(), isNull);

    await pumpApp(t, RoleFormScreen(existing: _roles[1]));
    await settle(t);
    expect(find.text('Role details'), findsOneWidget);
    expect(find.text('Save changes'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
  testWidgets('every edit / add form renders without layout errors', (t) async {
    final forms = <String, Widget>{
      'Personal info': StaffEditPersonalScreen(staff: _staffMember()),
      'Employment': StaffEditEmploymentScreen(staff: _staffMember()),
      'Branch access': StaffEditBranchesScreen(staff: _staffMember()),
      'Account details': UserEditProfileScreen(user: _iamUser()),
      'Roles': UserEditRolesScreen(user: _iamUser()),
      'Permission overrides': UserEditPermissionsScreen(user: _iamUser()),
      'New user': UserFormScreen(roles: _roles),
      'Invite by email': InviteUserScreen(roles: _roles),
    };
    // The branch screen for users shares its title with the staff one.
    for (final e in forms.entries) {
      await pumpApp(t, e.value);
      await settle(t);
      expect(find.text(e.key), findsWidgets, reason: e.key);
      expect(t.takeException(), isNull, reason: e.key);
    }
    await pumpApp(t, UserEditBranchesScreen(user: _iamUser()));
    await settle(t);
    expect(find.text('All branches'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('KPI tile opens its detail sheet', (t) async {
    await pumpApp(t, const TeamScreen(standalone: true));
    await settle(t);
    await t.tap(find.text('Total staff'));
    await t.pump(const Duration(milliseconds: 600));
    expect(find.text('Show everyone in the main list'), findsOneWidget);
    expect(find.text('Dana Lee'), findsWidgets);
    expect(t.takeException(), isNull);
  });

  testWidgets('user form: password policy checklist reacts to typing',
      (t) async {
    await pumpApp(t, UserFormScreen(roles: _roles));
    await settle(t);
    expect(find.text('Ready to create'), findsOneWidget);
    await t.enterText(find.byType(TextField).at(3), 'Abcdef1!');
    await t.pump(const Duration(milliseconds: 400));
    expect(find.text('Password meets policy'), findsOneWidget);
    expect(t.takeException(), isNull);
  });
  group('tablet (wide) layouts', () {
    const tablet = Size(1500, 1300);

    testWidgets('roster: content is capped + centred, cards go two-up',
        (t) async {
      GetIt.instance.unregister<StaffRepository>();
      GetIt.instance.registerSingleton<StaffRepository>(
        _StaffRepo([
          _staffMember(),
          StaffMember.fromJson({..._rawStaff(), 'id': 's2', 'name': 'Sam Roe'}),
        ]),
      );
      await pumpApp(t, const TeamScreen(standalone: true), size: tablet);
      await settle(t);
      final title = t.getTopLeft(find.text('Staff directory'));
      // Capped: header starts at the (1500-1280)/2 = 110 inset, not at the edge.
      expect(title.dx, greaterThan(110));
      await t.scrollUntilVisible(
        find.text('Sam Roe'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      final a = t.getTopLeft(find.text('Dana Lee'));
      final b = t.getTopLeft(find.text('Sam Roe'));
      expect(b.dx, greaterThan(a.dx + 200)); // side by side
      expect((b.dy - a.dy).abs(), lessThan(5));
      expect(t.takeException(), isNull);
    });

    testWidgets('hub, profiles and forms render on a tablet', (t) async {
      for (final w in <Widget>[
        const RolesScreen(),
        const StaffDetailScreen(staffId: 's1'),
        const UserDetailScreen(userId: 'u1'),
        const RoleDetailScreen(roleId: 'r1'),
        const StaffFormScreen(),
        StaffEditPersonalScreen(staff: _staffMember()),
        UserFormScreen(roles: _roles),
        RoleFormScreen(existing: _roles[1]),
      ]) {
        await pumpApp(t, w, size: tablet);
        await settle(t);
        expect(t.takeException(), isNull, reason: w.runtimeType.toString());
      }
    });

    testWidgets('form fields sit two per row on a tablet', (t) async {
      await pumpApp(
        t,
        StaffEditPersonalScreen(staff: _staffMember()),
        size: tablet,
      );
      await settle(t);
      final first = t.getTopLeft(find.byType(TextField).at(0));
      final second = t.getTopLeft(find.byType(TextField).at(1));
      expect((first.dy - second.dy).abs(), lessThan(5));
      expect(second.dx, greaterThan(first.dx + 200));
      expect(t.takeException(), isNull);
    });
  });
}
