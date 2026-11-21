import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/core/theme/app_colors.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/auth/presentation/forgot_password_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/login_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/phone_login_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/phone_otp_screen.dart';
import 'package:gym_saas_mobile/models/member_auth_success.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/staff_login_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/auth_repository.dart';
import 'package:gym_saas_mobile/repositories/member_auth_repository.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Public extends Mock implements PublicTenantRepository {}

class _Auth extends Mock implements AuthRepository {}

class _MemberAuth extends Mock implements MemberAuthRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

const _tenant = TenantBranding(
  slug: 'alpha-fit',
  name: 'Alpha Fit',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

const _user = UserProfile(
  id: 'u1',
  tenantId: 't1',
  name: 'Coach',
  email: 'coach@gym.com',
  phone: null,
  status: 'ACTIVE',
  roles: ['TRAINER'],
  permissions: [],
);

const _member = MemberProfile(
  id: 'm1',
  memberId: 'MEM-0007',
  name: 'Mia Member',
  email: null,
  status: 'ACTIVE',
);

void _bigView(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2200);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);
}

/// Lets screens finish route/entrance animations without waiting on the
/// endless aurora loops [LoginScreen] runs.
Future<void> _frames(WidgetTester tester, [int n = 12]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  late _Public public;
  late _Auth auth;
  late _MemberAuth memberAuth;
  late _Session session;

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(ActorType.staff);
  });

  setUp(() {
    public = _Public();
    auth = _Auth();
    memberAuth = _MemberAuth();
    session = _Session();
    when(() => session.state).thenReturn(const SessionUnauthenticated());
    GetIt.instance
      ..registerSingleton<PublicTenantRepository>(public)
      ..registerSingleton<AuthRepository>(auth)
      ..registerSingleton<MemberAuthRepository>(memberAuth);
  });

  tearDown(() => GetIt.instance.reset());

  Widget app({required String initial, Object? extra}) {
    final router = GoRouter(
      initialLocation: initial,
      initialExtra: extra,
      routes: [
        GoRoute(path: AppRoutes.login, builder: (_, __) => const LoginScreen()),
        GoRoute(
          path: AppRoutes.forgotPassword,
          builder: (_, s) => ForgotPasswordScreen(
            args: s.extra as ForgotPasswordScreenArgs,
          ),
        ),
        GoRoute(
          path: AppRoutes.phoneLogin,
          builder: (_, s) =>
              PhoneLoginScreen(args: s.extra as PhoneLoginScreenArgs),
        ),
        GoRoute(
          path: AppRoutes.phoneOtp,
          builder: (_, s) =>
              PhoneOtpScreen(args: s.extra as PhoneOtpScreenArgs),
        ),
      ],
    );
    return BlocProvider<SessionCubit>.value(
      value: session,
      child: MaterialApp.router(routerConfig: router),
    );
  }

  Future<void> enterCode(WidgetTester tester) async {
    final boxes = find.byType(TextField);
    for (var i = 0; i < 6; i++) {
      await tester.enterText(boxes.at(i), '${i + 1}');
    }
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }

  group('forgot password — no gym involved', () {
    testWidgets('login link opens the screen directly (no gym sheet)',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Forgot password?'));
      await _frames(tester);

      expect(find.text('Reset password'), findsOneWidget);
      expect(find.text('Choose your gym'), findsNothing);
    });

    testWidgets('submits the identifier to the public endpoint, then confirms',
        (tester) async {
      _bigView(tester);
      when(() => public.forgotPassword(identifier: any(named: 'identifier')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(
            role: AppRole.staff,
            prefill: 'coach@gym.com',
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Send reset link'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      verify(() => public.forgotPassword(identifier: 'coach@gym.com'))
          .called(1);
      verifyNever(() => public.resolve(any()));
      expect(find.text('Check your email'), findsOneWidget);
      expect(find.text('Choose your gym'), findsNothing);
    });

    testWidgets('a Member ID goes through the same single endpoint',
        (tester) async {
      _bigView(tester);
      when(() => public.forgotPassword(identifier: any(named: 'identifier')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(
            role: AppRole.member,
            prefill: 'MEM-0007',
          ),
        ),
      );
      await tester.pump();
      await tester.tap(find.text('Send reset link'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      verify(() => public.forgotPassword(identifier: 'MEM-0007')).called(1);
      expect(find.text('Check your email'), findsOneWidget);
    });
  });

  group('phone login — gym learnt from the verified code', () {
    testWidgets('login link opens phone login directly (no gym sheet)',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Use phone number'));
      await _frames(tester);

      expect(find.text('Log in with phone'), findsOneWidget);
      expect(find.text('Choose your gym'), findsNothing);
    });

    testWidgets('request code uses the RoleToggle role as actorType',
        (tester) async {
      _bigView(tester);
      when(
        () => public.requestPhoneOtp(
          actorType: any(named: 'actorType'),
          phone: any(named: 'phone'),
        ),
      ).thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.phoneLogin,
          extra: const PhoneLoginScreenArgs(role: AppRole.staff),
        ),
      );
      await tester.pump();

      // Switch to Member, then send.
      await tester.tap(find.text('Member'));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.enterText(find.byType(TextField), '9876543210');
      await tester.tap(find.text('Send code'));
      await _frames(tester, 6);

      verify(
        () => public.requestPhoneOtp(
          actorType: ActorType.member,
          phone: '9876543210',
        ),
      ).called(1);
      expect(find.text('Enter verification code'), findsOneWidget);
    });

    testWidgets('staff verify: reads tenantSlug, resolves it, signs in',
        (tester) async {
      _bigView(tester);
      when(
        () => auth.verifyPublicPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenAnswer(
        (_) async => (
          result: const StaffLoginSuccess(
            user: _user,
            accessToken: 'a',
            accessTokenExpiresAt: 'x',
            refreshToken: 'r',
          ) as StaffLoginResult,
          tenantSlug: 'alpha-fit',
        ),
      );
      when(() => public.resolve('alpha-fit')).thenAnswer((_) async => _tenant);
      await tester.pumpWidget(
        app(
          initial: AppRoutes.phoneOtp,
          extra: const PhoneOtpScreenArgs(
            phone: '9876543210',
            role: AppRole.staff,
          ),
        ),
      );
      await tester.pump();

      await enterCode(tester);

      verify(
        () => auth.verifyPublicPhoneOtp(phone: '9876543210', code: '123456'),
      ).called(1);
      verify(() => public.resolve('alpha-fit')).called(1);
      verify(() => session.staffSignedIn(_user, _tenant)).called(1);
    });

    testWidgets('member verify: resolves tenantSlug, signs the member in',
        (tester) async {
      _bigView(tester);
      when(
        () => memberAuth.verifyPublicPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenAnswer(
        (_) async => (
          result: const MemberAuthSuccess(
            member: _member,
            accessToken: 'a',
            accessTokenExpiresAt: 'x',
            refreshToken: 'r',
          ),
          tenantSlug: 'alpha-fit',
        ),
      );
      when(() => public.resolve('alpha-fit')).thenAnswer((_) async => _tenant);
      await tester.pumpWidget(
        app(
          initial: AppRoutes.phoneOtp,
          extra: const PhoneOtpScreenArgs(
            phone: '9876543210',
            role: AppRole.member,
          ),
        ),
      );
      await tester.pump();

      await enterCode(tester);

      verify(() => public.resolve('alpha-fit')).called(1);
      verify(() => session.memberSignedIn(_member, _tenant)).called(1);
    });

    testWidgets('resend hits the public request endpoint with the role',
        (tester) async {
      _bigView(tester);
      when(
        () => public.requestPhoneOtp(
          actorType: any(named: 'actorType'),
          phone: any(named: 'phone'),
        ),
      ).thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.phoneOtp,
          extra: const PhoneOtpScreenArgs(
            phone: '9876543210',
            role: AppRole.staff,
          ),
        ),
      );
      await tester.pump();

      await tester.tap(find.text('Resend code'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      verify(
        () => public.requestPhoneOtp(
          actorType: ActorType.staff,
          phone: '9876543210',
        ),
      ).called(1);
      expect(find.text('Resend code in 30s'), findsOneWidget);
      // Cancel the 30s cooldown timer so the test ends clean.
      await tester.pumpWidget(const SizedBox());
    });
  });
}
