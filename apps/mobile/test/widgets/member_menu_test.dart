import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_menu_screen.dart';
import 'package:gym_saas_mobile/models/member_profile.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:mocktail/mocktail.dart';

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Platform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(WidgetTester t) async {
    t.view.physicalSize = const Size(360 * 2, 800 * 2);
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state).thenReturn(
      const SessionAuthenticatedMember(
        MemberProfile(
          id: 'm',
          memberId: 'MEM-1',
          name: 'Asha Rao',
          email: null,
          status: 'ACTIVE',
        ),
        TenantBranding(
          slug: 't',
          name: 'T',
          status: 'ACTIVE',
          maintenanceMode: false,
          primaryColor: '',
        ),
      ),
    );
    final platform = _Platform();
    when(() => platform.state).thenReturn(const PlatformConfigState('FitCloud'));
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: MemberMenuScreen()),
        ),
        GoRoute(
          path: '/member/profile',
          builder: (_, __) => const Text('PROFILE PAGE'),
        ),
      ],
    );
    await t.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await t.pump();
  }

  testWidgets('the menu no longer lists Profile', (t) async {
    await pump(t);
    expect(find.text('My Attendance'), findsOneWidget);
    expect(find.text('Gym info'), findsOneWidget);
    expect(find.text('Profile'), findsNothing);
  });

  testWidgets('tapping the header name opens My Profile', (t) async {
    await pump(t);
    await t.tap(find.text('Asha Rao'));
    await t.pump();
    await t.pump(const Duration(seconds: 1));
    expect(find.text('PROFILE PAGE'), findsOneWidget);
  });
}
