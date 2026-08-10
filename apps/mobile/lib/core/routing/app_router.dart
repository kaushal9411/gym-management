import 'package:go_router/go_router.dart';

import '../../bloc/session/session_cubit.dart';
import '../../bloc/session/session_state.dart';
import '../../features/auth/presentation/find_gym_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/staff_mfa_setup_screen.dart';
import '../../features/auth/presentation/staff_otp_screen.dart';
import '../../features/branches/presentation/branch_detail_screen.dart';
import '../../features/branches/presentation/branch_form_screen.dart';
import '../../features/branches/presentation/branches_list_screen.dart';
import '../../features/catalog/presentation/diet_plans_screen.dart';
import '../../features/catalog/presentation/membership_plan_form_screen.dart';
import '../../features/catalog/presentation/membership_plans_screen.dart';
import '../../features/catalog/presentation/workout_plans_screen.dart';
import '../../features/finance/presentation/expense_form_screen.dart';
import '../../features/finance/presentation/expense_list_screen.dart';
import '../../features/finance/presentation/income_form_screen.dart';
import '../../features/finance/presentation/income_list_screen.dart';
import '../../features/finance/presentation/record_payment_screen.dart';
import '../../features/home/presentation/home_router_screen.dart';
import '../../features/reports/presentation/analytics_screen.dart';
import '../../features/reports/presentation/attendance_report_screen.dart';
import '../../features/reports/presentation/churn_report_screen.dart';
import '../../features/reports/presentation/membership_report_screen.dart';
import '../../features/reports/presentation/revenue_report_screen.dart';
import '../../features/reports/presentation/scheduled_report_form_screen.dart';
import '../../features/reports/presentation/scheduled_reports_screen.dart';
import '../../features/reports/presentation/staff_performance_screen.dart';
import '../../models/branch.dart';
import 'app_routes.dart';
import 'go_router_refresh_stream.dart';

/// Paths reachable while signed out — anything else redirects here-or-home
/// depending on session state.
const _signedOutPaths = {
  AppRoutes.splash,
  AppRoutes.findGym,
  AppRoutes.login,
  AppRoutes.otp,
  AppRoutes.mfaSetup,
  AppRoutes.forgotPassword,
};

GoRouter buildAppRouter(SessionCubit sessionCubit) {
  return GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: GoRouterRefreshStream(sessionCubit.stream),
    redirect: (context, state) {
      final session = sessionCubit.state;
      final path = state.matchedLocation;

      if (session is SessionUnknown) {
        return path == AppRoutes.splash ? null : AppRoutes.splash;
      }
      if (session is SessionUnauthenticated) {
        return _signedOutPaths.contains(path) && path != AppRoutes.splash
            ? null
            : AppRoutes.findGym;
      }
      // Authenticated (staff or member) — keep out of the signed-out flow.
      return _signedOutPaths.contains(path) ? AppRoutes.home : null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.findGym,
        builder: (context, state) => const FindGymScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) =>
            LoginScreen(args: state.extra as LoginScreenArgs),
      ),
      GoRoute(
        path: AppRoutes.otp,
        builder: (context, state) =>
            StaffOtpScreen(args: state.extra as StaffOtpScreenArgs),
      ),
      GoRoute(
        path: AppRoutes.mfaSetup,
        builder: (context, state) =>
            StaffMfaSetupScreen(args: state.extra as StaffMfaSetupScreenArgs),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        builder: (context, state) =>
            ForgotPasswordScreen(args: state.extra as ForgotPasswordScreenArgs),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeRouterScreen(),
      ),
      GoRoute(
        path: AppRoutes.branches,
        builder: (context, state) => const BranchesListScreen(),
      ),
      GoRoute(
        path: AppRoutes.branchDetail,
        builder: (context, state) =>
            BranchDetailScreen(branchId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.branchForm,
        builder: (context, state) =>
            BranchFormScreen(existing: state.extra as Branch?),
      ),
      GoRoute(
        path: AppRoutes.income,
        builder: (context, state) => const IncomeListScreen(),
      ),
      GoRoute(
        path: AppRoutes.incomeForm,
        builder: (context, state) => const IncomeFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.expenses,
        builder: (context, state) => const ExpenseListScreen(),
      ),
      GoRoute(
        path: AppRoutes.expenseForm,
        builder: (context, state) => const ExpenseFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.recordPayment,
        builder: (context, state) => const RecordPaymentScreen(),
      ),
      GoRoute(
        path: AppRoutes.membershipPlans,
        builder: (context, state) => const MembershipPlansScreen(),
      ),
      GoRoute(
        path: AppRoutes.membershipPlanForm,
        builder: (context, state) => const MembershipPlanFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.workoutPlans,
        builder: (context, state) => const WorkoutPlansScreen(),
      ),
      GoRoute(
        path: AppRoutes.dietPlans,
        builder: (context, state) => const DietPlansScreen(),
      ),
      GoRoute(
        path: AppRoutes.revenueReport,
        builder: (context, state) => const RevenueReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.membershipReport,
        builder: (context, state) => const MembershipReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.attendanceReport,
        builder: (context, state) => const AttendanceReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.analytics,
        builder: (context, state) => const AnalyticsScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffPerformanceReport,
        builder: (context, state) => const StaffPerformanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.churnReport,
        builder: (context, state) => const ChurnReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.scheduledReports,
        builder: (context, state) => const ScheduledReportsScreen(),
      ),
      GoRoute(
        path: AppRoutes.scheduledReportForm,
        builder: (context, state) => const ScheduledReportFormScreen(),
      ),
    ],
  );
}
