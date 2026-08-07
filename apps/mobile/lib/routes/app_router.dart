import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../bloc/session/session_cubit.dart';
import '../bloc/session/session_state.dart';
import '../features/attendance/presentation/pages/qr_checkin_page.dart';
import '../features/auth/presentation/pages/login_page.dart';
import '../features/auth/presentation/pages/otp_page.dart';
import '../features/auth/presentation/pages/tenant_resolve_page.dart';
import '../features/dashboard/presentation/pages/dashboard_page.dart';
import '../features/members/presentation/pages/member_detail_page.dart';
import '../features/members/presentation/pages/member_list_page.dart';
import '../widgets/coming_soon_page.dart';
import 'app_shell.dart';
import 'go_router_refresh_stream.dart';

/// Route gating mirrors tenant-web's RequireAuth/RequireActiveTenant guards:
/// SessionCubit's state decides which of tenant-resolve / login / the app
/// shell is reachable, re-evaluated on every state change via refreshListenable.
/// The four shell branches (Home/Members/Scan/Reports) reproduce the design's
/// persistent bottom nav — see AppShell.
GoRouter buildRouter(SessionCubit sessionCubit) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: GoRouterRefreshStream(sessionCubit.stream),
    redirect: (context, state) {
      final session = sessionCubit.state;
      final path = state.matchedLocation;

      if (session is SessionBooting) return null;

      if (session is SessionNeedsTenant) {
        return path == '/' ? null : '/';
      }
      if (session is SessionNeedsLogin) {
        if (path == '/login' || path == '/otp') return null;
        return '/login';
      }
      if (session is SessionAuthenticated) {
        if (path == '/' || path == '/login' || path == '/otp') {
          return '/dashboard';
        }
        return null;
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const TenantResolvePage(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(
        path: '/otp',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>;
          return OtpPage(
            email: extra['email'] as String,
            purpose: extra['purpose'] as String,
            tenantSlug: extra['tenantSlug'] as String,
          );
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const DashboardPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/members',
                builder: (context, state) => const MemberListPage(),
                routes: [
                  GoRoute(
                    path: ':memberId',
                    builder: (context, state) => MemberDetailPage(
                      memberId: state.pathParameters['memberId']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/attendance/scan',
                builder: (context, state) => const QrCheckInPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                builder: (context, state) => const ComingSoonPage(
                  title: 'Reports',
                  icon: Icons.bar_chart_outlined,
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
