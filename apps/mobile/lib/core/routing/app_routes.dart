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
  static const branchHours = '/branches/hours';
  static const branchHolidays = '/branches/holidays';

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

  static const notifications = '/notifications';
  static const notificationTemplates = '/notifications/templates';
  static const editNotificationTemplate = '/notifications/templates/edit';
  static const announcements = '/announcements';
  static const announcementForm = '/announcements/form';
  static const scheduleAnnouncement = '/announcements/schedule';
  static const support = '/support';
  static const supportTicketForm = '/support/form';
  static const supportTicketDetail = '/support/detail';
  static const roles = '/roles';
  static const roleDetail = '/roles/detail';
  static const roleForm = '/roles/form';
  static const billing = '/billing';
  static const billingHistory = '/billing/history';
  static const gymSettings = '/settings';
  static const gymProfileSettings = '/settings/profile';
  static const gymSocialSettings = '/settings/profile/social';
  static const brandingSettings = '/settings/branding';
  static const invoiceSettings = '/settings/invoice';
  static const securityPolicySettings = '/settings/security';
  static const sessions = '/settings/sessions';

  static const finance = '/finance';

  static const staffForm = '/staff/form';
  static const staffDetail = '/staff/detail';
  static const staffEditPersonal = '/staff/edit-personal';
  static const staffEditEmployment = '/staff/edit-employment';

  static const memberForm = '/members/manage/form';
  static const memberDetail = '/members/manage/detail';
  static const memberRenew = '/members/manage/renew';
  static const memberFreeze = '/members/manage/freeze';
  static const memberUpgrade = '/members/manage/upgrade';
  static const memberEditPersonal = '/members/manage/edit-personal';
  static const memberEditAddress = '/members/manage/edit-address';
  static const memberEditHealth = '/members/manage/edit-health';

  static const checkedIn = '/attendance/checked-in';
  static const searchMembers = '/attendance/search';
  static const invoices = '/invoices';
  static const invoiceDetail = '/invoices/detail';
  static const classSessionDetail = '/classes/detail';
  static const classAddAttendee = '/classes/add-attendee';
  static const classForm = '/classes/form';
  static const classSchedule = '/classes/schedule';
  static const receptionistReports = '/reports/receptionist';

  // Trainer module (Chunk 4)
  static const assignPlan = '/trainer/clients/assign';
  static const clientProgress = '/trainer/clients/progress';
  static const workoutLog = '/trainer/clients/workout-log';
  static const exerciseDetail = '/trainer/exercises/detail';
  static const exerciseForm = '/trainer/exercises/form';
  static const foodDetail = '/trainer/foods/detail';
  static const foodForm = '/trainer/foods/form';
  static const trainerWorkoutPlans = '/trainer/workout-plans';
  static const trainerWorkoutPlanForm = '/trainer/workout-plans/form';
  static const trainerWorkoutPlanDetail = '/trainer/workout-plans/detail';
  static const trainerDayEditor = '/trainer/workout-plans/day';
  static const trainerDietPlans = '/trainer/diet-plans';
  static const trainerDietPlanForm = '/trainer/diet-plans/form';
  static const trainerDietPlanDetail = '/trainer/diet-plans/detail';
  static const trainerAddToMeal = '/trainer/diet-plans/add-to-meal';

  // Member plane (Chunk 6)
  static const memberAttendance = '/member/attendance';
  static const memberVisitDetail = '/member/attendance/detail';
  static const memberInvoices = '/member/invoices';
  static const memberInvoiceDetail = '/member/invoices/detail';
  static const memberProfile = '/member/profile';
  static const memberDataExport = '/member/data-export';
  static const memberClassBooked = '/member/classes/booked';
}
