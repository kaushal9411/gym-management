import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/auth/presentation/auth_widgets.dart';
import 'package:gym_saas_mobile/features/auth/presentation/forgot_password_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/login_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/member_reset_password_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/phone_login_screen.dart';
import 'package:gym_saas_mobile/features/auth/presentation/phone_otp_screen.dart';
import 'package:gym_saas_mobile/models/member_auth_success.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/phone_login_result.dart';
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

const _staffSuccess = PhoneLoginStaff(
  StaffLoginSuccess(
    user: _user,
    accessToken: 'a',
    accessTokenExpiresAt: 'x',
    refreshToken: 'r',
  ),
  'alpha-fit',
);

const _memberSuccess = PhoneLoginMember(
  MemberAuthSuccess(
    member: _member,
    accessToken: 'a',
    accessTokenExpiresAt: 'x',
    refreshToken: 'r',
  ),
  'alpha-fit',
);

void _bigView(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2200);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);
}

/// Lets screens finish route/entrance animations without waiting on the
/// endless aurora/shimmer loops the auth screens run (`pumpAndSettle` would
/// never return).
Future<void> _frames(WidgetTester tester, [int n = 12]) async {
  for (var i = 0; i < n; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

/// Ends the test cleanly: disposes the screen (cancelling the resend timer).
Future<void> _teardownScreen(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
}

void main() {
  late _Public public;
  late _Auth auth;
  late _MemberAuth memberAuth;
  late _Session session;

  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(_user);
    registerFallbackValue(_member);
    registerFallbackValue(_tenant);
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
        GoRoute(
          path: AppRoutes.login,
          pageBuilder: (_, s) => authTransitionPage(s, const LoginScreen()),
        ),
        GoRoute(
          path: AppRoutes.forgotPassword,
          pageBuilder: (_, s) => authTransitionPage(
            s,
            ForgotPasswordScreen(args: s.extra as ForgotPasswordScreenArgs),
          ),
        ),
        GoRoute(
          path: AppRoutes.memberResetPassword,
          pageBuilder: (_, s) =>
              authTransitionPage(s, const MemberResetPasswordScreen()),
        ),
        GoRoute(
          path: AppRoutes.phoneLogin,
          pageBuilder: (_, s) =>
              authTransitionPage(s, const PhoneLoginScreen()),
        ),
        GoRoute(
          path: AppRoutes.phoneOtp,
          pageBuilder: (_, s) => authTransitionPage(
            s,
            PhoneOtpScreen(args: s.extra as PhoneOtpScreenArgs),
          ),
        ),
        // Stand-in for the staff 2FA screen a challenge pushes.
        GoRoute(
          path: AppRoutes.otp,
          builder: (_, __) => const Scaffold(body: Text('STAFF-OTP-SCREEN')),
        ),
      ],
    );
    return BlocProvider<SessionCubit>.value(
      value: session,
      child: MaterialApp.router(routerConfig: router),
    );
  }

  Future<void> enterCode(WidgetTester tester, [String code = '123456']) async {
    final boxes = find.byType(TextField);
    for (var i = 0; i < 6; i++) {
      await tester.enterText(boxes.at(i), code[i]);
    }
    await tester.pump();
  }

  /// Records `HapticFeedback` calls so "felt, not just seen" can be asserted.
  List<String> recordHaptics(WidgetTester tester) {
    final calls = <String>[];
    tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') {
        calls.add(call.arguments as String);
      }
      return null;
    });
    addTearDown(
      () => tester.binding.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );
    return calls;
  }

  group('forgot password — same look as login, no gym involved', () {
    testWidgets('login link opens the screen directly (no gym sheet)',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Forgot password?'));
      await _frames(tester);

      expect(find.text('Reset password'), findsOneWidget);
      expect(find.text('EMAIL OR MEMBER ID'), findsOneWidget);
      expect(find.text('Choose your gym'), findsNothing);
    });

    testWidgets('what was typed on login is carried over', (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.enterText(find.byType(TextField).first, 'coach@gym.com');
      await tester.pump();

      await tester.tap(find.text('Forgot password?'));
      await _frames(tester);

      expect(find.text('coach@gym.com'), findsOneWidget);
      expect(find.text('Staff sign-in · work email'), findsOneWidget);
    });

    testWidgets('empty submit: inline error, no request', (tester) async {
      _bigView(tester);
      final haptics = recordHaptics(tester);
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Send reset link'));
      await _frames(tester, 6);

      expect(find.text('Enter your email or Member ID'), findsOneWidget);
      expect(haptics, isNotEmpty);
      verifyNever(
        () => public.forgotPassword(identifier: any(named: 'identifier')),
      );
    });

    testWidgets('the role chip follows what is typed', (tester) async {
      _bigView(tester);
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1600));
      final field = find.byType(TextField);

      expect(
        find.text('Staff use email · Members use Member ID'),
        findsOneWidget,
      );
      await tester.enterText(field, 'MEM-0007');
      await _frames(tester);
      expect(find.text('Member sign-in · Member ID'), findsOneWidget);
      await tester.enterText(field, 'coach@gym.com');
      await _frames(tester);
      expect(find.text('Staff sign-in · work email'), findsOneWidget);
    });

    testWidgets('submits the identifier to the public endpoint, then confirms',
        (tester) async {
      _bigView(tester);
      when(() => public.forgotPassword(identifier: any(named: 'identifier')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(prefill: 'coach@gym.com'),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Send reset link'));
      await _frames(tester, 10);

      verify(() => public.forgotPassword(identifier: 'coach@gym.com'))
          .called(1);
      verifyNever(() => public.resolve(any()));
      expect(find.text('Check your email'), findsOneWidget);
      expect(
        find.text(
          'If an account exists for that email, a reset link is on its way.',
        ),
        findsOneWidget,
      );
      expect(find.text('Send reset link'), findsNothing);
      expect(find.text('Choose your gym'), findsNothing);
      expect(find.text('Have a reset code? Enter it here'), findsNothing);
    });

    testWidgets('a Member ID goes through the same endpoint, offers the code',
        (tester) async {
      _bigView(tester);
      when(() => public.forgotPassword(identifier: any(named: 'identifier')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(prefill: 'MEM-0007'),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.tap(find.text('Send reset link'));
      await _frames(tester, 10);

      verify(() => public.forgotPassword(identifier: 'MEM-0007')).called(1);
      expect(find.text('Check your email'), findsOneWidget);
      expect(
        find.text(
          'If a portal account exists for that Member ID, a reset link has '
          'been sent.',
        ),
        findsOneWidget,
      );

      await tester.tap(find.text('Have a reset code? Enter it here'));
      await _frames(tester);
      expect(find.text('New password'), findsWidgets);
      expect(find.text('RESET CODE'), findsOneWidget);
    });

    testWidgets('a failed request shows a banner and keeps the form',
        (tester) async {
      _bigView(tester);
      when(() => public.forgotPassword(identifier: any(named: 'identifier')))
          .thenThrow(const ApiException(message: 'Too many attempts'));
      await tester.pumpWidget(
        app(
          initial: AppRoutes.forgotPassword,
          extra: const ForgotPasswordScreenArgs(prefill: 'coach@gym.com'),
        ),
      );
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.tap(find.text('Send reset link'));
      await _frames(tester, 6);

      expect(find.text('Too many attempts'), findsOneWidget);
      expect(find.text('Check your email'), findsNothing);
    });
  });

  group('phone login — ONE screen, no staff/member tabs', () {
    testWidgets('login link opens the single phone screen (no gym sheet)',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Use phone number'));
      await _frames(tester);

      expect(find.text('Use your phone'), findsOneWidget);
      expect(find.text('MOBILE NUMBER'), findsOneWidget);
      expect(find.text('+91'), findsOneWidget);
      expect(find.text('Choose your gym'), findsNothing);
      // The old Staff | Member switcher is gone.
      expect(find.text('Staff'), findsNothing);
      expect(find.text('Member'), findsNothing);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('"Sign in with email or Member ID instead" goes back to login',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.login));
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.tap(find.text('Use phone number'));
      await _frames(tester);

      await tester.tap(find.text('Sign in with email or Member ID instead'));
      await _frames(tester);

      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('invalid numbers: inline error, haptic, no request',
        (tester) async {
      _bigView(tester);
      final haptics = recordHaptics(tester);
      await tester.pumpWidget(app(initial: AppRoutes.phoneLogin));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.tap(find.text('Send code'));
      await _frames(tester, 6);
      expect(find.text('Enter your mobile number'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '98765');
      await tester.tap(find.text('Send code'));
      await _frames(tester, 6);
      expect(find.text('Enter a valid 10-digit mobile number'), findsOneWidget);
      expect(haptics, isNotEmpty);
      verifyNever(() => public.requestPhoneOtp(phone: any(named: 'phone')));
    });

    testWidgets('only digits, at most 10, are accepted', (tester) async {
      _bigView(tester);
      await tester.pumpWidget(app(initial: AppRoutes.phoneLogin));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.enterText(find.byType(TextField), '98a76-54321099');
      await tester.pump();

      expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text,
        '9876543210',
      );
    });

    testWidgets('a valid number requests the code once (no actorType) and '
        'moves on to the code screen', (tester) async {
      _bigView(tester);
      when(() => public.requestPhoneOtp(phone: any(named: 'phone')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(app(initial: AppRoutes.phoneLogin));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.enterText(find.byType(TextField), '9876543210');
      await tester.tap(find.text('Send code'));
      await _frames(tester);

      verify(() => public.requestPhoneOtp(phone: '9876543210')).called(1);
      expect(find.text('Enter your code'), findsOneWidget);
      expect(find.textContaining('+91 98765 43210'), findsOneWidget);
      await _teardownScreen(tester);
    });

    testWidgets('a failed request shows a banner and stays on the screen',
        (tester) async {
      _bigView(tester);
      when(() => public.requestPhoneOtp(phone: any(named: 'phone')))
          .thenThrow(const ApiException(message: 'Slow down'));
      await tester.pumpWidget(app(initial: AppRoutes.phoneLogin));
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.enterText(find.byType(TextField), '9876543210');
      await tester.tap(find.text('Send code'));
      await _frames(tester, 6);

      expect(find.text('Slow down'), findsOneWidget);
      expect(find.text('Enter your code'), findsNothing);
    });
  });

  group('phone code screen — the server says who you are', () {
    Widget otpApp() => app(
          initial: AppRoutes.phoneOtp,
          extra: const PhoneOtpScreenArgs(phone: '9876543210'),
        );

    testWidgets('has six code boxes and no role switcher', (tester) async {
      _bigView(tester);
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      expect(find.byType(TextField), findsNWidgets(6));
      expect(find.text('Staff'), findsNothing);
      expect(find.text('Member'), findsNothing);
      expect(find.text('Change number'), findsOneWidget);
      expect(find.textContaining('Resend code in'), findsOneWidget);
      await _teardownScreen(tester);
    });

    testWidgets('staff result: resolves the gym, builds a STAFF session',
        (tester) async {
      _bigView(tester);
      when(
        () => public.verifyPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenAnswer((_) async => _staffSuccess);
      when(() => public.resolve('alpha-fit')).thenAnswer((_) async => _tenant);
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      await enterCode(tester);
      await _frames(tester, 12); // success hold (750 ms) included

      verify(
        () => public.verifyPhoneOtp(phone: '9876543210', code: '123456'),
      ).called(1);
      verify(() => public.resolve('alpha-fit')).called(1);
      verify(() => session.staffSignedIn(_user, _tenant)).called(1);
      verifyNever(() => session.memberSignedIn(any(), any()));
      expect(find.text('Verified'), findsOneWidget);
      await _teardownScreen(tester);
    });

    testWidgets('member result: resolves the gym, builds a MEMBER session',
        (tester) async {
      _bigView(tester);
      when(
        () => public.verifyPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenAnswer((_) async => _memberSuccess);
      when(() => public.resolve('alpha-fit')).thenAnswer((_) async => _tenant);
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      await enterCode(tester);
      await _frames(tester, 12);

      verify(() => public.resolve('alpha-fit')).called(1);
      verify(() => session.memberSignedIn(_member, _tenant)).called(1);
      verifyNever(() => session.staffSignedIn(any(), any()));
      await _teardownScreen(tester);
    });

    testWidgets('a staff 2FA challenge continues to the staff code screen',
        (tester) async {
      _bigView(tester);
      when(
        () => public.verifyPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenAnswer(
        (_) async => const PhoneLoginStaff(
          StaffOtpRequired(
            email: 'coach@gym.com',
            purpose: '2fa',
            expiresInSeconds: 300,
          ),
          'alpha-fit',
        ),
      );
      when(() => public.resolve('alpha-fit')).thenAnswer((_) async => _tenant);
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      await enterCode(tester);
      await _frames(tester);

      expect(find.text('STAFF-OTP-SCREEN'), findsOneWidget);
      verifyNever(() => session.staffSignedIn(any(), any()));
      await _teardownScreen(tester);
    });

    testWidgets('a wrong code: banner, boxes cleared, shake + haptic',
        (tester) async {
      _bigView(tester);
      final haptics = recordHaptics(tester);
      when(
        () => public.verifyPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      ).thenThrow(
        const ApiException(
          message: 'Incorrect code. Check and try again.',
          statusCode: 401,
        ),
      );
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      await enterCode(tester);
      await tester.pump(const Duration(milliseconds: 120));

      expect(find.text('Incorrect code. Check and try again.'), findsOneWidget);
      expect(haptics, isNotEmpty);
      // Mid-shake the card is offset sideways.
      final shaken = tester
          .widgetList<Transform>(find.byType(Transform))
          .any((t) => t.transform.getTranslation().x.abs() > 0.5);
      expect(shaken, isTrue);
      for (var i = 0; i < 6; i++) {
        expect(
          tester.widget<TextField>(find.byType(TextField).at(i)).controller!.text,
          isEmpty,
        );
      }
      verifyNever(() => public.resolve(any()));
      verifyNever(() => session.staffSignedIn(any(), any()));
      await _frames(tester);
      await _teardownScreen(tester);
    });

    testWidgets('the verify button with an incomplete code asks for 6 digits',
        (tester) async {
      _bigView(tester);
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      await tester.enterText(find.byType(TextField).at(0), '1');
      await tester.tap(find.text('Verify & sign in'));
      await _frames(tester, 4);

      expect(
        find.text('Enter the 6-digit code from your email'),
        findsOneWidget,
      );
      verifyNever(
        () => public.verifyPhoneOtp(
          phone: any(named: 'phone'),
          code: any(named: 'code'),
        ),
      );
      await _teardownScreen(tester);
    });

    testWidgets('resend: locked during the countdown, then asks again',
        (tester) async {
      _bigView(tester);
      when(() => public.requestPhoneOtp(phone: any(named: 'phone')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(otpApp());
      await tester.pump(const Duration(milliseconds: 1600));

      // Still counting down: tapping does nothing.
      await tester.tap(find.textContaining('Resend code in'));
      await tester.pump();
      verifyNever(() => public.requestPhoneOtp(phone: any(named: 'phone')));

      await tester.pump(const Duration(seconds: 31));
      expect(find.text('Resend code'), findsOneWidget);

      await tester.tap(find.text('Resend code'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      verify(() => public.requestPhoneOtp(phone: '9876543210')).called(1);
      expect(find.text('Resend code in 30s'), findsOneWidget);
      await _teardownScreen(tester);
    });

    testWidgets('"Change number" returns to the phone screen', (tester) async {
      _bigView(tester);
      when(() => public.requestPhoneOtp(phone: any(named: 'phone')))
          .thenAnswer((_) async {});
      await tester.pumpWidget(app(initial: AppRoutes.phoneLogin));
      await tester.pump(const Duration(milliseconds: 1600));
      await tester.enterText(find.byType(TextField), '9876543210');
      await tester.tap(find.text('Send code'));
      await _frames(tester);
      expect(find.text('Enter your code'), findsOneWidget);

      await tester.tap(find.text('Change number'));
      await _frames(tester);

      expect(find.text('Use your phone'), findsOneWidget);
      await _teardownScreen(tester);
    });
  });
}
