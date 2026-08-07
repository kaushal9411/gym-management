import 'package:dio/dio.dart';
import 'package:get_it/get_it.dart';

import '../bloc/session/session_cubit.dart';
import '../features/attendance/data/attendance_repository.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/dashboard/data/dashboard_repository.dart';
import '../features/members/data/member_repository.dart';
import '../network/dio_client.dart';
import '../storage/secure_storage.dart';

final di = GetIt.instance;

void setupDependencies() {
  di.registerLazySingleton(() => SecureStorage());
  di.registerLazySingleton(() => DioClient(di<SecureStorage>()));
  di.registerLazySingleton<Dio>(() => di<DioClient>().dio);

  di.registerLazySingleton(
    () => AuthRepository(di<Dio>(), di<SecureStorage>()),
  );
  di.registerLazySingleton(() => DashboardRepository(di<Dio>()));
  di.registerLazySingleton(() => MemberRepository(di<Dio>()));
  di.registerLazySingleton(() => AttendanceRepository(di<Dio>()));

  di.registerLazySingleton(
    () => SessionCubit(di<AuthRepository>(), di<SecureStorage>()),
  );
}
