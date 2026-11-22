import '../../models/tenant_branding.dart';
import '../utils/tenant_features.dart';
import 'app_routes.dart';

/// Which module a feature route belongs to. A route is blocked (the router
/// sends the user home) when the gym's module is off — direct navigation, a
/// stale back-stack entry or a link from another screen would otherwise open
/// a screen whose every API call answers 403.
///
/// [flag] must be on; when [anyOf] is set at least one of its modules must be.
class RouteFeatureRule {
  const RouteFeatureRule({this.flag, this.anyOf = const []});

  final String? flag;
  final List<String> anyOf;
}

const _attendance = RouteFeatureRule(flag: Feature.attendance);
const _workouts = RouteFeatureRule(flag: Feature.workoutPlans);
const _diet = RouteFeatureRule(flag: Feature.dietPlans);
const _classes = RouteFeatureRule(flag: Feature.liveClasses);
const _payments = RouteFeatureRule(flag: Feature.payments);
const _income = RouteFeatureRule(flag: Feature.income);
const _expenses = RouteFeatureRule(flag: Feature.expenses);
const _reports = RouteFeatureRule(flag: Feature.reports);
const _notifications = RouteFeatureRule(flag: Feature.notifications);
const _hr = RouteFeatureRule(flag: Feature.hr);

/// Exact path -> rule. Routes shared by several modules are absent (assign plan, client progress, the
/// Support screens, which gate themselves).
const Map<String, RouteFeatureRule> kRouteFeatureRules = {
  // attendance
  AppRoutes.attendance: _attendance,
  AppRoutes.attendanceHistory: _attendance,
  AppRoutes.checkedIn: _attendance,
  AppRoutes.searchMembers: _attendance,
  AppRoutes.memberAttendance: _attendance,
  AppRoutes.memberVisitDetail: _attendance,
  // workout plans (+ the exercise library they are built from)
  AppRoutes.workoutPlans: _workouts,
  AppRoutes.workoutPlanForm: _workouts,
  AppRoutes.workoutPlanDetail: _workouts,
  AppRoutes.workoutPlanSchedule: _workouts,
  AppRoutes.trainerWorkoutPlans: _workouts,
  AppRoutes.trainerWorkoutPlanForm: _workouts,
  AppRoutes.trainerWorkoutPlanDetail: _workouts,
  AppRoutes.trainerDayEditor: _workouts,
  AppRoutes.workoutLog: _workouts,
  AppRoutes.exerciseDetail: _workouts,
  AppRoutes.exerciseForm: _workouts,
  // diet plans (+ the food library)
  AppRoutes.dietPlans: _diet,
  AppRoutes.dietPlanForm: _diet,
  AppRoutes.dietPlanDetail: _diet,
  AppRoutes.dietPlanMeals: _diet,
  AppRoutes.smartDietPlan: _diet,
  AppRoutes.trainerDietPlans: _diet,
  AppRoutes.trainerDietPlanForm: _diet,
  AppRoutes.trainerDietPlanDetail: _diet,
  AppRoutes.trainerAddToMeal: _diet,
  AppRoutes.foodDetail: _diet,
  AppRoutes.foodForm: _diet,
  // live classes
  AppRoutes.classes: _classes,
  AppRoutes.classSessionDetail: _classes,
  AppRoutes.classAddAttendee: _classes,
  AppRoutes.classForm: _classes,
  AppRoutes.classSchedule: _classes,
  AppRoutes.classesCalendar: _classes,
  AppRoutes.memberClassBooked: _classes,
  // payments
  AppRoutes.payments: _payments,
  AppRoutes.paymentDetail: _payments,
  AppRoutes.recordPayment: _payments,
  AppRoutes.invoices: _payments,
  AppRoutes.invoiceDetail: _payments,
  AppRoutes.memberInvoices: _payments,
  AppRoutes.memberInvoiceDetail: _payments,
  AppRoutes.memberPayments: _payments,
  // income / expenses / the combined finance screen
  AppRoutes.income: _income,
  AppRoutes.incomeForm: _income,
  AppRoutes.expenses: _expenses,
  AppRoutes.expenseForm: _expenses,
  AppRoutes.finance: RouteFeatureRule(anyOf: Feature.finance),
  // reports (the receptionist/trainer reports page also runs on attendance)
  AppRoutes.revenueReport: _reports,
  AppRoutes.membershipReport: _reports,
  AppRoutes.attendanceReport: _reports,
  AppRoutes.expenseReport: _reports,
  AppRoutes.paymentReport: _reports,
  AppRoutes.staffReport: _reports,
  AppRoutes.memberProgressReport: _reports,
  AppRoutes.branchPerformanceReport: _reports,
  AppRoutes.expiringMembershipsReport: _reports,
  AppRoutes.analytics: _reports,
  AppRoutes.staffPerformanceReport: _reports,
  AppRoutes.churnReport: _reports,
  AppRoutes.scheduledReports: _reports,
  AppRoutes.scheduledReportForm: _reports,
  AppRoutes.receptionistReports:
      RouteFeatureRule(anyOf: [Feature.reports, Feature.attendance]),
  // notifications (the staff feed, templates, log, communications,
  // announcements and the member feed; HR notifications are gated by `hr`)
  AppRoutes.notifications: _notifications,
  AppRoutes.notificationTemplates: _notifications,
  AppRoutes.editNotificationTemplate: _notifications,
  AppRoutes.messageLog: _notifications,
  AppRoutes.communications: _notifications,
  AppRoutes.communicationsSend: _notifications,
  AppRoutes.communicationsAutomations: _notifications,
  AppRoutes.communicationsHistory: _notifications,
  AppRoutes.communicationsHistoryDetail: _notifications,
  AppRoutes.announcements: _notifications,
  AppRoutes.announcementForm: _notifications,
  AppRoutes.scheduleAnnouncement: _notifications,
  AppRoutes.memberNotifications: _notifications,
  // HR: every /hr/* API route answers 403 when the module is off, and the HR
  // push deep links land on these routes too.
  AppRoutes.hrMe: _hr,
  AppRoutes.hrApplyLeave: _hr,
  AppRoutes.hrMyLeaves: _hr,
  AppRoutes.hrPayslips: _hr,
  AppRoutes.hrPayslipDetail: _hr,
  AppRoutes.hrInbox: _hr,
  AppRoutes.hrOverview: _hr,
  AppRoutes.hrApprovals: _hr,
  AppRoutes.hrTeamAttendance: _hr,
  AppRoutes.hrEmployees: _hr,
  AppRoutes.hrEmployeeDetail: _hr,
  AppRoutes.hrPayroll: _hr,
  AppRoutes.hrPayrollRun: _hr,
  AppRoutes.hrSetup: _hr,
  // AI assistant
  AppRoutes.aiSettings: RouteFeatureRule(flag: Feature.aiCoach),
};

/// True when [path] belongs to a module [tenant] does not have on.
bool routeBlockedByFeatures(String path, TenantBranding tenant) {
  final rule = kRouteFeatureRules[path];
  if (rule == null) return false;
  return !tenantAllows(tenant, flag: rule.flag, anyOf: rule.anyOf);
}
