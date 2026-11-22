import '../../bloc/session/session_state.dart';
import '../../models/tenant_branding.dart';

/// The one place a "is this module on for the gym?" question is answered.
/// `TenantBranding.featureFlags` (from `GET /public/tenants/resolve`) is the
/// source of truth: a key the plan lacks or the platform switched off is
/// ABSENT, and an absent key means hidden (fail closed).
///
/// [flag] must be present; when [anyOf] is non-empty at least one of its keys
/// must be present too (the web nav's "any of" rule, e.g. Finance = payments /
/// income / expenses). Both empty = ungated.
bool tenantAllows(
  TenantBranding tenant, {
  String? flag,
  List<String> anyOf = const [],
}) {
  if (flag != null && !tenant.featureFlags.contains(flag)) return false;
  if (anyOf.isNotEmpty && !anyOf.any(tenant.featureFlags.contains)) {
    return false;
  }
  return true;
}

/// The signed-in session's gym, or null while signed out / still restoring.
TenantBranding? tenantOfSession(SessionState session) => switch (session) {
      SessionAuthenticatedStaff(:final tenant) => tenant,
      SessionAuthenticatedMember(:final tenant) => tenant,
      _ => null,
    };

/// Module keys the mobile UI gates on (the platform kill switches).
abstract final class Feature {
  static const attendance = 'attendance';
  static const workoutPlans = 'workout_plans';
  static const dietPlans = 'diet_plans';
  static const liveClasses = 'live_classes';
  static const payments = 'payments';
  static const income = 'income';
  static const expenses = 'expenses';
  static const reports = 'reports';
  static const notifications = 'notifications';
  static const aiCoach = 'ai_coach';
  static const hr = 'hr';

  /// Finance is on when ANY of its three modules is.
  static const finance = [payments, income, expenses];
}

/// Message the API answers (HTTP 403) when a module is switched off.
const kModuleUnavailableMessage = 'This module is currently unavailable.';
