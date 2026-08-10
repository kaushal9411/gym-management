import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import '../../bloc/branches/branch_list_cubit.dart';
import '../../bloc/dashboard/dashboard_cubit.dart';
import '../../bloc/finance/finance_summary_cubit.dart';
import '../../bloc/session/session_cubit.dart';
import '../../repositories/analytics_repository.dart';
import '../../repositories/auth_repository.dart';
import '../../repositories/branch_repository.dart';
import '../../repositories/dashboard_repository.dart';
import '../../repositories/diet_plan_repository.dart';
import '../../repositories/expense_repository.dart';
import '../../repositories/finance_repository.dart';
import '../../repositories/income_repository.dart';
import '../../repositories/member_auth_repository.dart';
import '../../repositories/membership_plan_repository.dart';
import '../../repositories/public_tenant_repository.dart';
import '../../repositories/reports_repository.dart';
import '../../repositories/scheduled_report_repository.dart';
import '../../repositories/workout_plan_repository.dart';
import '../network/auth_event_bus.dart';
import '../network/dio_client.dart';
import '../storage/secure_storage.dart';

final getIt = GetIt.instance;

/// Wires the whole dependency graph once, at app start — see `main.dart`.
/// Everything here is a singleton; there is exactly one Dio client, one
/// secure-storage box, and one `SessionCubit` for the app's lifetime.
void setupServiceLocator() {
  getIt.registerLazySingleton<FlutterSecureStorage>(
    () => const FlutterSecureStorage(),
  );
  getIt.registerLazySingleton<SecureStorage>(() => SecureStorage(getIt()));
  getIt.registerLazySingleton<AuthEventBus>(() => AuthEventBus());

  getIt.registerLazySingleton<DioClient>(() => DioClient(getIt(), getIt()));
  getIt.registerLazySingleton<Dio>(() => getIt<DioClient>().dio);

  getIt.registerLazySingleton<PublicTenantRepository>(
    () => PublicTenantRepository(getIt(), getIt()),
  );
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepository(getIt(), getIt()),
  );
  getIt.registerLazySingleton<MemberAuthRepository>(
    () => MemberAuthRepository(getIt(), getIt()),
  );
  getIt.registerLazySingleton<DashboardRepository>(
    () => DashboardRepository(getIt()),
  );
  getIt.registerLazySingleton<BranchRepository>(
    () => BranchRepository(getIt()),
  );
  getIt.registerLazySingleton<IncomeRepository>(
    () => IncomeRepository(getIt()),
  );
  getIt.registerLazySingleton<ExpenseRepository>(
    () => ExpenseRepository(getIt()),
  );
  getIt.registerLazySingleton<FinanceRepository>(
    () => FinanceRepository(getIt()),
  );
  getIt.registerLazySingleton<MembershipPlanRepository>(
    () => MembershipPlanRepository(getIt()),
  );
  getIt.registerLazySingleton<WorkoutPlanRepository>(
    () => WorkoutPlanRepository(getIt()),
  );
  getIt.registerLazySingleton<DietPlanRepository>(
    () => DietPlanRepository(getIt()),
  );
  getIt.registerLazySingleton<AnalyticsRepository>(
    () => AnalyticsRepository(getIt()),
  );
  getIt.registerLazySingleton<ReportsRepository>(
    () => ReportsRepository(getIt()),
  );
  getIt.registerLazySingleton<ScheduledReportRepository>(
    () => ScheduledReportRepository(getIt()),
  );

  // Screen-scoped cubits — a fresh instance per screen, not app-wide state.
  getIt.registerFactory<DashboardCubit>(() => DashboardCubit(getIt()));
  getIt.registerFactory<BranchListCubit>(() => BranchListCubit(getIt()));
  getIt
      .registerFactory<FinanceSummaryCubit>(() => FinanceSummaryCubit(getIt()));

  getIt.registerLazySingleton<SessionCubit>(
    () => SessionCubit(
      authRepository: getIt(),
      memberAuthRepository: getIt(),
      publicTenantRepository: getIt(),
      storage: getIt(),
      authEventBus: getIt(),
    ),
  );
}
