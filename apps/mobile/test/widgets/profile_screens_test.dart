import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/profile/presentation/change_password_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/emergency_contact_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/my_permissions_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/my_profile_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/notification_preferences_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/profile_data_screen.dart';
import 'package:gym_saas_mobile/features/profile/presentation/two_factor_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/sessions_screen.dart';
import 'package:gym_saas_mobile/models/login_history_entry.dart';
import 'package:gym_saas_mobile/models/mfa_setup.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/staff_profile.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/user_session.dart';
import 'package:gym_saas_mobile/repositories/auth_repository.dart';
import 'package:gym_saas_mobile/repositories/profile_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Profile extends Mock implements ProfileRepository {}

class _Auth extends Mock implements AuthRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'Kaushal Fitness',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

UserProfile _user() => const UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'Asha Rao',
      email: 'asha@gym.test',
      phone: null,
      status: 'ACTIVE',
      roles: ['OWNER'],
      permissions: ['members:view', 'members:create', 'support:view'],
    );

StaffProfile _profile({bool mfa = false, String? phone = '9876543210'}) =>
    StaffProfile.fromJson({
      'id': 'u',
      'name': 'Asha Rao',
      'email': 'asha@gym.test',
      'phone': phone,
      'avatarUrl': null,
      'roles': ['OWNER'],
      'emergencyContact': {'name': 'Ravi', 'phone': null, 'relation': null},
      'notificationPreferences': {
        'email_billing': true,
        'email_announcements': false,
      },
      'branchAccess': {
        'allBranches': false,
        'branches': [
          {'branchId': 'b1', 'branchName': 'Main', 'isPrimary': true},
        ],
      },
      'mfaEnabled': mfa,
      'emailVerifiedAt': '2026-01-01T00:00:00.000Z',
      'lastLoginAt': '2026-10-17T08:00:00.000Z',
      'createdAt': '2026-01-01T00:00:00.000Z',
    });

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(<String, bool>{});
  });

  late _Profile profile;
  late _Auth auth;
  late _Session session;

  setUp(() {
    profile = _Profile();
    auth = _Auth();
    session = _Session();
    final g = GetIt.instance;
    for (final r in [ProfileRepository, AuthRepository]) {
      if (r == ProfileRepository && g.isRegistered<ProfileRepository>()) {
        g.unregister<ProfileRepository>();
      }
      if (r == AuthRepository && g.isRegistered<AuthRepository>()) {
        g.unregister<AuthRepository>();
      }
    }
    g.registerSingleton<ProfileRepository>(profile);
    g.registerSingleton<AuthRepository>(auth);
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(), _tenant));
    when(() => session.refreshStaffUser()).thenAnswer((_) async {});
    when(() => session.signOut()).thenAnswer((_) async {});
    when(() => profile.getProfile()).thenAnswer((_) async => _profile());
  });

  Future<void> pump(
    WidgetTester t,
    Widget child, {
    Size size = const Size(360, 740),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SizedBox()),
        GoRoute(path: '/x', builder: (_, __) => child),
        GoRoute(
          path: '/profile/me/data',
          builder: (_, __) => const Text('DATA'),
        ),
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    router.push('/x');
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  group('hub', () {
    testWidgets('phone 360: header, stats, completeness, sections', (t) async {
      await pump(t, const MyProfileScreen());
      expect(t.takeException(), isNull);
      expect(find.text('Asha Rao'), findsWidgets);
      for (final label in [
        'PROFILE COMPLETE',
        'MEMBER SINCE',
        'LAST SIGN-IN',
        'TWO-FACTOR',
        'Completeness',
        'Personal details',
        'Emergency contact',
        'Notification preferences',
        'Change password',
        'Two-factor authentication',
        'Sessions & devices',
        'Check permissions',
        'Help Center',
        'Kaushal Fitness',
        'Log out',
      ]) {
        await show(t, find.text(label));
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('completeness shows the real checklist', (t) async {
      await pump(t, const MyProfileScreen());
      // name, phone, emergency name, verified e-mail = 4 of 8.
      await show(t, find.text('4 of 8 details filled in'));
      expect(find.text('4 of 8 details filled in'), findsOneWidget);
      expect(find.text('50%'), findsWidgets);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(t, const MyProfileScreen(), size: const Size(1500, 1300));
      await show(t, find.text('Log out'));
      expect(t.takeException(), isNull);
    });

    testWidgets('a load error shows retry', (t) async {
      when(() => profile.getProfile())
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MyProfileScreen());
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('personal details', () {
    testWidgets('saves only name and phone', (t) async {
      when(
        () => profile.updateBasicInfo(
          name: any(named: 'name'),
          phone: any(named: 'phone'),
        ),
      ).thenAnswer((_) async => _profile());
      await pump(t, const ProfileDataScreen());
      await t.enterText(find.byType(TextField).first, 'Asha R');
      await t.enterText(find.byType(TextField).last, '');
      await show(t, find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => profile.updateBasicInfo(name: 'Asha R', phone: null))
          .called(1);
      verify(() => session.refreshStaffUser()).called(1);
    });

    testWidgets('a one-letter name is rejected', (t) async {
      await pump(t, const ProfileDataScreen());
      await t.enterText(find.byType(TextField).first, 'A');
      await show(t, find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(find.text('Full name is required.'), findsOneWidget);
      verifyNever(
        () => profile.updateBasicInfo(
          name: any(named: 'name'),
          phone: any(named: 'phone'),
        ),
      );
    });
  });

  group('emergency contact', () {
    testWidgets('empty fields are sent as null', (t) async {
      when(
        () => profile.updateEmergencyContact(
          name: any(named: 'name'),
          phone: any(named: 'phone'),
          relation: any(named: 'relation'),
        ),
      ).thenAnswer((_) async => _profile());
      await pump(t, const EmergencyContactScreen());
      await t.enterText(find.byType(TextField).at(1), '9999999999');
      await show(t, find.text('Save changes'));
      await t.tap(find.text('Save changes'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(
        () => profile.updateEmergencyContact(
          name: 'Ravi',
          phone: '9999999999',
          relation: null,
        ),
      ).called(1);
    });
  });

  group('notification preferences', () {
    testWidgets('a switch saves immediately; a failure flips it back',
        (t) async {
      when(() => profile.updateNotificationPreferences(any()))
          .thenAnswer((_) async => _profile());
      await pump(t, const NotificationPreferencesScreen());
      expect(find.text('Billing & subscription emails'), findsOneWidget);
      await show(t, find.text('Platform announcements'));
      await t.tap(
        find.descendant(
          of: find.widgetWithText(TeamToggleRow, 'Platform announcements'),
          matching: find.byType(GestureDetector),
        ),
      );
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(
        () => profile.updateNotificationPreferences(
          {'email_billing': true, 'email_announcements': true},
        ),
      ).called(1);
    });
  });

  group('change password', () {
    testWidgets('validates policy and confirmation, then submits', (t) async {
      when(
        () => auth.changePassword(
          currentPassword: any(named: 'currentPassword'),
          newPassword: any(named: 'newPassword'),
        ),
      ).thenAnswer((_) async {});
      await pump(t, const ChangePasswordScreen());
      final fields = find.byType(TextField);
      await t.enterText(fields.at(0), 'Old@Pass1');
      await t.enterText(fields.at(1), 'weak');
      await show(t, find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.tap(find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.pump();
      expect(find.textContaining('does not meet every rule'), findsOneWidget);

      await t.enterText(fields.at(1), 'New@Pass123');
      await t.enterText(fields.at(2), 'Different@1');
      await show(t, find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.tap(find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.pump();
      expect(find.textContaining("don't match"), findsOneWidget);

      await t.enterText(fields.at(2), 'New@Pass123');
      await show(t, find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.tap(find.widgetWithText(TeamGradientButton, 'Change password'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(
        () => auth.changePassword(
          currentPassword: 'Old@Pass1',
          newPassword: 'New@Pass123',
        ),
      ).called(1);
    });
  });

  group('two-factor', () {
    final challenge = MfaSetupChallenge(
      secret: 'ABCD EFGH',
      otpauthUri: 'otpauth://x',
      // 1x1 transparent PNG.
      qrDataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    );

    testWidgets('off: enable → QR → code → backup codes', (t) async {
      when(() => profile.beginTwoFactorSetup())
          .thenAnswer((_) async => challenge);
      when(() => profile.confirmTwoFactorSetup(any()))
          .thenAnswer((_) async => ['AAAA-1111', 'BBBB-2222']);
      await pump(t, const TwoFactorScreen());
      expect(find.text('Disabled'), findsOneWidget);
      await show(t, find.text('Enable 2FA'));
      await t.tap(find.text('Enable 2FA'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(find.text('ABCD EFGH'), findsOneWidget);

      await show(t, find.text('Confirm and enable'));
      await t.enterText(find.byType(TextField), '12345');
      await t.pump();
      await t.tap(find.text('Confirm and enable'));
      await t.pump();
      verifyNever(() => profile.confirmTwoFactorSetup(any()));

      await t.enterText(find.byType(TextField), '123456');
      await t.pump();
      await t.tap(find.text('Confirm and enable'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => profile.confirmTwoFactorSetup('123456')).called(1);
      expect(find.text('AAAA-1111'), findsOneWidget);
      expect(find.text('Save your backup codes'), findsOneWidget);
    });

    testWidgets('on: disable asks for the password', (t) async {
      when(() => profile.getProfile())
          .thenAnswer((_) async => _profile(mfa: true));
      when(() => profile.disableTwoFactor(any())).thenAnswer((_) async {});
      await pump(t, const TwoFactorScreen());
      expect(find.text('Enabled'), findsOneWidget);
      await show(t, find.text('Disable 2FA'));
      await t.tap(find.text('Disable 2FA'));
      await t.pump();
      await t.enterText(find.byType(TextField), 'My@Pass123');
      await t.pump();
      await show(t, find.text('Disable 2FA').last);
      await t.tap(find.text('Disable 2FA').last);
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => profile.disableTwoFactor('My@Pass123')).called(1);
    });

    testWidgets('on: regenerate needs a 6-digit code', (t) async {
      when(() => profile.getProfile())
          .thenAnswer((_) async => _profile(mfa: true));
      when(() => profile.regenerateBackupCodes(any()))
          .thenAnswer((_) async => ['CCCC-3333']);
      await pump(t, const TwoFactorScreen());
      await show(t, find.text('Regenerate backup codes'));
      await t.tap(find.text('Regenerate backup codes'));
      await t.pump();
      await t.enterText(find.byType(TextField), '654321');
      await t.pump();
      await show(t, find.text('Regenerate').last);
      await t.tap(find.text('Regenerate').last);
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => profile.regenerateBackupCodes('654321')).called(1);
      expect(find.text('CCCC-3333'), findsOneWidget);
    });

    testWidgets('a wrong code shows the API error and stays', (t) async {
      when(() => profile.beginTwoFactorSetup())
          .thenAnswer((_) async => challenge);
      when(() => profile.confirmTwoFactorSetup(any()))
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const TwoFactorScreen());
      await show(t, find.text('Enable 2FA'));
      await t.tap(find.text('Enable 2FA'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      await show(t, find.text('Confirm and enable'));
      await t.enterText(find.byType(TextField), '123456');
      await t.pump();
      await t.tap(find.text('Confirm and enable'));
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      expect(find.text('Confirm and enable'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });

  group('sessions', () {
    UserSession s(String id, {bool current = false}) => UserSession(
          id: id,
          deviceLabel: 'Pixel $id',
          ipAddress: '1.1.1.1',
          userAgent: 'Android',
          lastActiveAt: DateTime.now(),
          isCurrent: current,
        );

    LoginHistoryEntry h(String id, bool ok) => LoginHistoryEntry(
          id: id,
          success: ok,
          reason: ok ? null : 'Bad password',
          ipAddress: '2.2.2.2',
          userAgent: null,
          createdAt: DateTime.now(),
        );

    setUp(() {
      when(() => auth.listSessions())
          .thenAnswer((_) async => [s('a', current: true), s('b')]);
      when(
        () => auth.loginHistory(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer(
        (_) async => PaginatedResult<LoginHistoryEntry>(
          items: [h('1', true), h('2', true), h('3', false)],
          total: 3,
          page: 1,
          limit: 10,
          totalPages: 1,
        ),
      );
    });

    testWidgets('KPIs, devices and login history at 360', (t) async {
      await pump(t, const SessionsScreen());
      expect(t.takeException(), isNull);
      for (final label in [
        'Active sessions',
        'Recent sign-ins',
        'Failed attempts',
        'This device',
        'Login history',
        'Failed sign-in',
        'Bad password',
        'Sign out everywhere',
      ]) {
        await show(t, find.text(label));
        expect(find.text(label), findsWidgets, reason: label);
      }
      expect(t.takeException(), isNull);
    });

    testWidgets('sign out everywhere confirms, calls the API, then signs out',
        (t) async {
      when(() => auth.logoutAllDevices()).thenAnswer((_) async {});
      await pump(t, const SessionsScreen());
      await show(t, find.text('Sign out everywhere'));
      await t.tap(find.text('Sign out everywhere'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 500));
      await t.tap(find.text('Sign out everywhere').last);
      await t.pump();
      await t.pump(const Duration(seconds: 1));
      verify(() => auth.logoutAllDevices()).called(1);
      verify(() => session.signOut()).called(1);
    });

    testWidgets('a failing history call keeps the devices', (t) async {
      when(
        () => auth.loginHistory(
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const SessionsScreen());
      await show(t, find.text('No login history yet.'));
      expect(find.text('This device'), findsWidgets);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(t, const SessionsScreen(), size: const Size(1500, 1300));
      await show(t, find.text('Login history'));
      expect(t.takeException(), isNull);
    });
  });

  group('permissions', () {
    testWidgets('groups the session permissions by resource', (t) async {
      await pump(t, const MyPermissionsScreen());
      expect(find.text('members'), findsOneWidget);
      expect(find.text('support'), findsOneWidget);
      expect(find.text('3 permissions · 2 areas'), findsOneWidget);
      expect(find.text('create'), findsOneWidget);
      expect(t.takeException(), isNull);
    });
  });
}
