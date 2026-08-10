/// Central path constants — avoids typo'd route strings scattered across screens.
class AppRoutes {
  AppRoutes._();

  static const splash = '/splash';
  static const findGym = '/find-gym';
  static const login = '/login';
  static const otp = '/otp';
  static const mfaSetup = '/mfa-setup';
  static const forgotPassword = '/forgot-password';
  static const home = '/home';

  static const branches = '/branches';
  static const branchDetail = '/branches/detail';
  static const branchForm = '/branches/form';

  static const income = '/finance/income';
  static const incomeForm = '/finance/income/form';
  static const expenses = '/finance/expenses';
  static const expenseForm = '/finance/expenses/form';
  static const recordPayment = '/finance/record-payment';

  static const membershipPlans = '/catalog/membership-plans';
  static const membershipPlanForm = '/catalog/membership-plans/form';
  static const workoutPlans = '/catalog/workout-plans';
  static const dietPlans = '/catalog/diet-plans';

  static const revenueReport = '/reports/revenue';
  static const membershipReport = '/reports/membership';
  static const attendanceReport = '/reports/attendance';
  static const analytics = '/reports/analytics';
  static const staffPerformanceReport = '/reports/staff-performance';
  static const churnReport = '/reports/churn';
  static const scheduledReports = '/reports/scheduled';
  static const scheduledReportForm = '/reports/scheduled/form';
}
