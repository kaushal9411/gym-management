import 'package:go_router/go_router.dart';

import '../../bloc/session/session_cubit.dart';
import '../../bloc/session/session_state.dart';
import '../../features/announcements/presentation/announcement_form_screen.dart';
import '../../features/announcements/presentation/schedule_announcement_screen.dart';
import '../../features/announcements/presentation/announcements_screen.dart';
import '../../features/auth/presentation/find_gym_screen.dart';
import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/auth/presentation/staff_mfa_setup_screen.dart';
import '../../features/auth/presentation/staff_otp_screen.dart';
import '../../features/billing/presentation/billing_address_screen.dart';
import '../../features/billing/presentation/billing_history_screen.dart';
import '../../features/billing/presentation/billing_screen.dart';
import '../../features/branches/presentation/branch_detail_screen.dart';
import '../../features/branches/presentation/branch_form_screen.dart';
import '../../features/branches/presentation/branch_holidays_screen.dart';
import '../../features/branches/presentation/branch_hours_screen.dart';
import '../../features/branches/presentation/branches_list_screen.dart';
import '../../features/catalog/presentation/classes_screen.dart';
import '../../features/catalog/presentation/diet_plan_form_screen.dart';
import '../../features/catalog/presentation/diet_plans_screen.dart';
import '../../features/catalog/presentation/membership_plan_form_screen.dart';
import '../../features/catalog/presentation/membership_plans_screen.dart';
import '../../features/catalog/presentation/workout_plan_form_screen.dart';
import '../../features/catalog/presentation/workout_plans_screen.dart';
import '../../features/finance/presentation/expense_form_screen.dart';
import '../../features/finance/presentation/expense_list_screen.dart';
import '../../features/finance/presentation/finance_screen.dart';
import '../../features/finance/presentation/income_form_screen.dart';
import '../../features/finance/presentation/income_list_screen.dart';
import '../../features/finance/presentation/invoice_detail_screen.dart';
import '../../features/finance/presentation/invoices_screen.dart';
import '../../features/finance/presentation/payment_detail_screen.dart';
import '../../features/finance/presentation/payments_screen.dart';
import '../../features/finance/presentation/record_payment_screen.dart';
import '../../features/home/presentation/home_router_screen.dart';
import '../../features/manager/presentation/member_detail_screen.dart';
import '../../features/member/presentation/member_attendance_screen.dart';
import '../../features/member/presentation/member_class_booked_screen.dart';
import '../../features/member/presentation/member_data_export_screen.dart';
import '../../features/member/presentation/member_invoice_detail_screen.dart';
import '../../features/member/presentation/member_invoices_screen.dart';
import '../../features/member/presentation/member_change_password_screen.dart';
import '../../features/member/presentation/member_profile_screen.dart';
import '../../features/member/presentation/member_visit_detail_screen.dart';
import '../../features/manager/presentation/member_form_screen.dart';
import '../../features/manager/presentation/member_freeze_screen.dart';
import '../../features/manager/presentation/member_renew_screen.dart';
import '../../features/manager/presentation/member_edit_address_screen.dart';
import '../../features/manager/presentation/member_edit_health_screen.dart';
import '../../features/manager/presentation/member_edit_personal_screen.dart';
import '../../features/manager/presentation/member_downgrade_screen.dart';
import '../../features/manager/presentation/member_gdpr_export_screen.dart';
import '../../features/manager/presentation/member_upgrade_screen.dart';
import '../../features/manager/presentation/staff_detail_screen.dart';
import '../../features/manager/presentation/staff_edit_employment_screen.dart';
import '../../features/manager/presentation/staff_edit_personal_screen.dart';
import '../../features/manager/presentation/staff_form_screen.dart';
import '../../features/notifications/presentation/notification_template_form_screen.dart';
import '../../features/notifications/presentation/notification_templates_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/profile/presentation/change_password_screen.dart';
import '../../features/profile/presentation/emergency_contact_screen.dart';
import '../../features/profile/presentation/my_permissions_screen.dart';
import '../../features/profile/presentation/my_profile_screen.dart';
import '../../features/profile/presentation/notification_preferences_screen.dart';
import '../../features/profile/presentation/profile_data_screen.dart';
import '../../features/receptionist/presentation/checked_in_screen.dart';
import '../../features/receptionist/presentation/class_add_attendee_screen.dart';
import '../../features/receptionist/presentation/class_form_screen.dart';
import '../../features/receptionist/presentation/class_schedule_screen.dart';
import '../../features/receptionist/presentation/class_session_detail_screen.dart';
import '../../features/receptionist/presentation/receptionist_reports_screen.dart';
import '../../features/receptionist/presentation/search_members_screen.dart';
import '../../features/reports/presentation/analytics_screen.dart';
import '../../features/reports/presentation/attendance_dashboard_screen.dart';
import '../../features/reports/presentation/attendance_history_screen.dart';
import '../../features/reports/presentation/attendance_report_screen.dart';
import '../../features/reports/presentation/branch_performance_screen.dart';
import '../../features/reports/presentation/churn_report_screen.dart';
import '../../features/reports/presentation/expense_report_screen.dart';
import '../../features/reports/presentation/expiring_memberships_screen.dart';
import '../../features/reports/presentation/member_progress_report_screen.dart';
import '../../features/reports/presentation/membership_report_screen.dart';
import '../../features/reports/presentation/payment_report_screen.dart';
import '../../features/reports/presentation/revenue_report_screen.dart';
import '../../features/reports/presentation/scheduled_report_form_screen.dart';
import '../../features/reports/presentation/scheduled_reports_screen.dart';
import '../../features/reports/presentation/staff_performance_screen.dart';
import '../../features/reports/presentation/staff_report_screen.dart';
import '../../features/roles/presentation/invite_user_screen.dart';
import '../../features/roles/presentation/role_detail_screen.dart';
import '../../features/roles/presentation/role_form_screen.dart';
import '../../features/roles/presentation/roles_screen.dart';
import '../../features/roles/presentation/user_detail_screen.dart';
import '../../features/roles/presentation/user_edit_branches_screen.dart';
import '../../features/roles/presentation/user_edit_permissions_screen.dart';
import '../../features/roles/presentation/user_edit_roles_screen.dart';
import '../../features/roles/presentation/user_form_screen.dart';
import '../../features/search/presentation/global_search_screen.dart';
import '../../features/settings/presentation/branding_settings_screen.dart';
import '../../features/settings/presentation/gym_profile_settings_screen.dart';
import '../../features/settings/presentation/gym_social_screen.dart';
import '../../features/settings/presentation/gym_settings_screen.dart';
import '../../features/settings/presentation/invoice_settings_screen.dart';
import '../../features/settings/presentation/security_policy_screen.dart';
import '../../features/settings/presentation/sessions_screen.dart';
import '../../features/support/presentation/support_ticket_detail_screen.dart';
import '../../features/support/presentation/support_ticket_form_screen.dart';
import '../../features/support/presentation/support_tickets_screen.dart';
import '../../features/trainer/presentation/add_to_meal_screen.dart';
import '../../features/trainer/presentation/assign_plan_screen.dart';
import '../../features/trainer/presentation/client_progress_screen.dart';
import '../../features/trainer/presentation/day_editor_screen.dart';
import '../../features/trainer/presentation/diet_plan_form_screen.dart';
import '../../features/trainer/presentation/exercise_detail_screen.dart';
import '../../features/trainer/presentation/exercise_form_screen.dart';
import '../../features/trainer/presentation/food_detail_screen.dart';
import '../../features/trainer/presentation/food_form_screen.dart';
import '../../features/trainer/presentation/meal_builder_screen.dart';
import '../../features/trainer/presentation/trainer_diet_plans_screen.dart';
import '../../features/trainer/presentation/trainer_workout_plans_screen.dart';
import '../../features/trainer/presentation/workout_log_screen.dart';
import '../../features/trainer/presentation/workout_plan_detail_screen.dart';
import '../../features/trainer/presentation/workout_plan_form_screen.dart';
import '../../models/announcement.dart';
import '../../models/branch.dart';
import '../../models/class_session.dart';
import '../../models/diet_plan.dart';
import '../../models/exercise.dart';
import '../../models/food.dart';
import '../../models/group_class.dart';
import '../../models/gym_member.dart';
import '../../models/gym_profile.dart';
import '../../models/iam_user.dart';
import '../../models/member_invoice.dart';
import '../../models/member_visit.dart';
import '../../models/membership_plan.dart';
import '../../models/notification_template.dart';
import '../../models/staff_member.dart';
import '../../models/tenant_role.dart';
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
        if (_signedOutPaths.contains(path) && path != AppRoutes.splash) {
          return null;
        }
        // No page-specific destination (fresh launch, or a stale `/home`
        // hit while signed out) — a remembered gym+role sends the user
        // straight to Login; otherwise Find Gym, same as before.
        final hasRememberedGym =
            session.rememberedRole != null && session.rememberedTenant != null;
        return hasRememberedGym ? AppRoutes.login : AppRoutes.findGym;
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
        builder: (context, state) {
          final extra = state.extra as LoginScreenArgs?;
          if (extra != null) return LoginScreen(args: extra);
          // Reached via the redirect's remembered-gym path (no `extra`
          // passed) — rebuild the same args from session state instead.
          final session = sessionCubit.state;
          if (session is SessionUnauthenticated &&
              session.rememberedRole != null &&
              session.rememberedTenant != null) {
            return LoginScreen(
              args: LoginScreenArgs(
                role: session.rememberedRole!,
                tenant: session.rememberedTenant!,
              ),
            );
          }
          return const FindGymScreen();
        },
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
        path: AppRoutes.myProfile,
        builder: (context, state) => const MyProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileData,
        builder: (context, state) => const ProfileDataScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileEmergencyContact,
        builder: (context, state) => const EmergencyContactScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileNotifications,
        builder: (context, state) => const NotificationPreferencesScreen(),
      ),
      GoRoute(
        path: AppRoutes.profileChangePassword,
        builder: (context, state) => const ChangePasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.profilePermissions,
        builder: (context, state) => const MyPermissionsScreen(),
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
        path: AppRoutes.branchHours,
        builder: (context, state) =>
            BranchHoursScreen(branch: state.extra as Branch),
      ),
      GoRoute(
        path: AppRoutes.branchHolidays,
        builder: (context, state) =>
            BranchHolidaysScreen(branch: state.extra as Branch),
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
        builder: (context, state) => MembershipPlanFormScreen(
          plan: state.extra as MembershipPlan?,
        ),
      ),
      GoRoute(
        path: AppRoutes.workoutPlans,
        builder: (context, state) => const WorkoutPlansScreen(),
      ),
      GoRoute(
        path: AppRoutes.workoutPlanForm,
        builder: (context, state) => WorkoutPlanCatalogFormScreen(
          planId: state.extra as String?,
        ),
      ),
      GoRoute(
        path: AppRoutes.dietPlans,
        builder: (context, state) => const DietPlansScreen(),
      ),
      GoRoute(
        path: AppRoutes.dietPlanForm,
        builder: (context, state) => DietPlanCatalogFormScreen(
          planId: state.extra as String?,
        ),
      ),
      GoRoute(
        path: AppRoutes.classes,
        builder: (context, state) => const ClassesScreen(),
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
        path: AppRoutes.expenseReport,
        builder: (context, state) => const ExpenseReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.paymentReport,
        builder: (context, state) => const PaymentReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffReport,
        builder: (context, state) => const StaffReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberProgressReport,
        builder: (context, state) => const MemberProgressReportScreen(),
      ),
      GoRoute(
        path: AppRoutes.branchPerformanceReport,
        builder: (context, state) => const BranchPerformanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.expiringMembershipsReport,
        builder: (context, state) => const ExpiringMembershipsScreen(),
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
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: AppRoutes.notificationTemplates,
        builder: (context, state) => const NotificationTemplatesScreen(),
      ),
      GoRoute(
        path: AppRoutes.editNotificationTemplate,
        builder: (context, state) => NotificationTemplateFormScreen(
          template: state.extra as NotificationTemplate,
        ),
      ),
      GoRoute(
        path: AppRoutes.announcements,
        builder: (context, state) => const AnnouncementsScreen(),
      ),
      GoRoute(
        path: AppRoutes.announcementForm,
        builder: (context, state) => const AnnouncementFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.scheduleAnnouncement,
        builder: (context, state) => ScheduleAnnouncementScreen(
          announcement: state.extra as Announcement,
        ),
      ),
      GoRoute(
        path: AppRoutes.support,
        builder: (context, state) => const SupportTicketsScreen(),
      ),
      GoRoute(
        path: AppRoutes.supportTicketForm,
        builder: (context, state) => const SupportTicketFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.supportTicketDetail,
        builder: (context, state) =>
            SupportTicketDetailScreen(ticketId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.roles,
        builder: (context, state) => const RolesScreen(),
      ),
      GoRoute(
        path: AppRoutes.roleDetail,
        builder: (context, state) =>
            RoleDetailScreen(roleId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.roleForm,
        builder: (context, state) =>
            RoleFormScreen(existing: state.extra as TenantRole?),
      ),
      GoRoute(
        path: AppRoutes.userDetail,
        builder: (context, state) =>
            UserDetailScreen(userId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.userForm,
        builder: (context, state) =>
            UserFormScreen(roles: state.extra as List<TenantRole>),
      ),
      GoRoute(
        path: AppRoutes.userEditRoles,
        builder: (context, state) =>
            UserEditRolesScreen(user: state.extra as IamUser),
      ),
      GoRoute(
        path: AppRoutes.userEditBranches,
        builder: (context, state) =>
            UserEditBranchesScreen(user: state.extra as IamUser),
      ),
      GoRoute(
        path: AppRoutes.userEditPermissions,
        builder: (context, state) =>
            UserEditPermissionsScreen(user: state.extra as IamUser),
      ),
      GoRoute(
        path: AppRoutes.inviteUser,
        builder: (context, state) =>
            InviteUserScreen(roles: state.extra as List<TenantRole>),
      ),
      GoRoute(
        path: AppRoutes.globalSearch,
        builder: (context, state) => const GlobalSearchScreen(),
      ),
      GoRoute(
        path: AppRoutes.payments,
        builder: (context, state) => const PaymentsScreen(),
      ),
      GoRoute(
        path: AppRoutes.paymentDetail,
        builder: (context, state) =>
            PaymentDetailScreen(paymentId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.billing,
        builder: (context, state) => const BillingScreen(),
      ),
      GoRoute(
        path: AppRoutes.billingHistory,
        builder: (context, state) => const BillingHistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.billingAddress,
        builder: (context, state) => const BillingAddressScreen(),
      ),
      GoRoute(
        path: AppRoutes.gymSettings,
        builder: (context, state) => const GymSettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.gymProfileSettings,
        builder: (context, state) => const GymProfileSettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.gymSocialSettings,
        builder: (context, state) =>
            GymSocialScreen(socialLinks: state.extra as SocialLinks?),
      ),
      GoRoute(
        path: AppRoutes.brandingSettings,
        builder: (context, state) => const BrandingSettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.invoiceSettings,
        builder: (context, state) => const InvoiceSettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.securityPolicySettings,
        builder: (context, state) => const SecurityPolicyScreen(),
      ),
      GoRoute(
        path: AppRoutes.sessions,
        builder: (context, state) => const SessionsScreen(),
      ),
      GoRoute(
        path: AppRoutes.finance,
        builder: (context, state) => const FinanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffForm,
        builder: (context, state) => const StaffFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.staffDetail,
        builder: (context, state) =>
            StaffDetailScreen(staffId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.staffEditPersonal,
        builder: (context, state) =>
            StaffEditPersonalScreen(staff: state.extra as StaffMember),
      ),
      GoRoute(
        path: AppRoutes.staffEditEmployment,
        builder: (context, state) =>
            StaffEditEmploymentScreen(staff: state.extra as StaffMember),
      ),
      GoRoute(
        path: AppRoutes.memberForm,
        builder: (context, state) => const MemberFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberDetail,
        builder: (context, state) =>
            MemberDetailScreen(memberId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.memberRenew,
        builder: (context, state) =>
            MemberRenewScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.memberFreeze,
        builder: (context, state) =>
            MemberFreezeScreen(memberId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.memberUpgrade,
        builder: (context, state) =>
            MemberUpgradeScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.memberDowngrade,
        builder: (context, state) =>
            MemberDowngradeScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.memberGdprExport,
        builder: (context, state) {
          final member = state.extra as GymMember;
          return MemberGdprExportScreen(
            memberId: member.id,
            memberName: member.name,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.memberEditPersonal,
        builder: (context, state) =>
            MemberEditPersonalScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.memberEditAddress,
        builder: (context, state) =>
            MemberEditAddressScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.memberEditHealth,
        builder: (context, state) =>
            MemberEditHealthScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.checkedIn,
        builder: (context, state) =>
            CheckedInScreen(memberName: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.searchMembers,
        builder: (context, state) => const SearchMembersScreen(),
      ),
      GoRoute(
        path: AppRoutes.attendance,
        builder: (context, state) => const AttendanceDashboardScreen(),
      ),
      GoRoute(
        path: AppRoutes.attendanceHistory,
        builder: (context, state) => const AttendanceHistoryScreen(),
      ),
      GoRoute(
        path: AppRoutes.invoices,
        builder: (context, state) => const InvoicesScreen(),
      ),
      GoRoute(
        path: AppRoutes.invoiceDetail,
        builder: (context, state) =>
            InvoiceDetailScreen(invoiceId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.classSessionDetail,
        builder: (context, state) =>
            ClassSessionDetailScreen(sessionId: state.extra as String),
      ),
      GoRoute(
        path: AppRoutes.classAddAttendee,
        builder: (context, state) =>
            ClassAddAttendeeScreen(session: state.extra as ClassSession),
      ),
      GoRoute(
        path: AppRoutes.classForm,
        builder: (context, state) =>
            ClassFormScreen(classId: state.extra as String?),
      ),
      GoRoute(
        path: AppRoutes.classSchedule,
        builder: (context, state) =>
            ClassScheduleScreen(groupClass: state.extra as GroupClass),
      ),
      GoRoute(
        path: AppRoutes.receptionistReports,
        builder: (context, state) => const ReceptionistReportsScreen(),
      ),
      GoRoute(
        path: AppRoutes.assignPlan,
        builder: (context, state) =>
            AssignPlanScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.exerciseDetail,
        builder: (context, state) =>
            ExerciseDetailScreen(exercise: state.extra as Exercise),
      ),
      GoRoute(
        path: AppRoutes.exerciseForm,
        builder: (context, state) => const ExerciseFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.foodDetail,
        builder: (context, state) =>
            FoodDetailScreen(food: state.extra as Food),
      ),
      GoRoute(
        path: AppRoutes.foodForm,
        builder: (context, state) => const FoodFormScreen(),
      ),
      GoRoute(
        path: AppRoutes.trainerWorkoutPlans,
        builder: (context, state) =>
            TrainerWorkoutPlansScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.trainerWorkoutPlanForm,
        builder: (context, state) => WorkoutPlanFormScreen(
          member: (state.extra as WorkoutPlanFormArgs).member,
        ),
      ),
      GoRoute(
        path: AppRoutes.trainerWorkoutPlanDetail,
        builder: (context, state) {
          final args = state.extra as WorkoutPlanDetailArgs;
          return WorkoutPlanDetailScreen(
            planId: args.planId,
            member: args.member,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.trainerDayEditor,
        builder: (context, state) =>
            DayEditorScreen(args: state.extra as DayEditorArgs),
      ),
      GoRoute(
        path: AppRoutes.trainerDietPlans,
        builder: (context, state) =>
            TrainerDietPlansScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.trainerDietPlanForm,
        builder: (context, state) => DietPlanFormScreen(
          member: (state.extra as DietPlanFormArgs).member,
        ),
      ),
      GoRoute(
        path: AppRoutes.trainerDietPlanDetail,
        builder: (context, state) {
          final args = state.extra as MealBuilderArgs;
          return MealBuilderScreen(planId: args.planId, member: args.member);
        },
      ),
      GoRoute(
        path: AppRoutes.trainerAddToMeal,
        builder: (context, state) =>
            AddToMealScreen(mealType: state.extra as MealType),
      ),
      GoRoute(
        path: AppRoutes.clientProgress,
        builder: (context, state) =>
            ClientProgressScreen(member: state.extra as GymMember),
      ),
      GoRoute(
        path: AppRoutes.workoutLog,
        builder: (context, state) =>
            WorkoutLogScreen(args: state.extra as WorkoutLogArgs),
      ),
      GoRoute(
        path: AppRoutes.memberAttendance,
        builder: (context, state) => const MemberAttendanceScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberVisitDetail,
        builder: (context, state) =>
            MemberVisitDetailScreen(visit: state.extra as MemberVisit),
      ),
      GoRoute(
        path: AppRoutes.memberInvoices,
        builder: (context, state) => const MemberInvoicesScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberInvoiceDetail,
        builder: (context, state) =>
            MemberInvoiceDetailScreen(invoice: state.extra as MemberInvoice),
      ),
      GoRoute(
        path: AppRoutes.memberProfile,
        builder: (context, state) => const MemberProfileScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberChangePassword,
        builder: (context, state) => const MemberChangePasswordScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberDataExport,
        builder: (context, state) => const MemberDataExportScreen(),
      ),
      GoRoute(
        path: AppRoutes.memberClassBooked,
        builder: (context, state) =>
            MemberClassBookedScreen(args: state.extra as ClassBookedArgs),
      ),
    ],
  );
}
