import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'bloc/session/session_cubit.dart';
import 'core/di.dart';
import 'features/attendance/data/attendance_repository.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/dashboard/data/dashboard_repository.dart';
import 'features/members/data/member_repository.dart';
import 'routes/app_router.dart';
import 'theme/app_theme.dart';

void main() {
  setupDependencies();
  runApp(const FitCloudApp());
}

class FitCloudApp extends StatelessWidget {
  const FitCloudApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<Dio>.value(value: di<Dio>()),
        RepositoryProvider<AuthRepository>.value(value: di<AuthRepository>()),
        RepositoryProvider<DashboardRepository>.value(
          value: di<DashboardRepository>(),
        ),
        RepositoryProvider<MemberRepository>.value(
          value: di<MemberRepository>(),
        ),
        RepositoryProvider<AttendanceRepository>.value(
          value: di<AttendanceRepository>(),
        ),
      ],
      child: BlocProvider<SessionCubit>(
        create: (_) => di<SessionCubit>()..boot(),
        child: Builder(
          builder: (context) {
            final router = buildRouter(context.read<SessionCubit>());
            return MaterialApp.router(
              title: 'FitCloud',
              debugShowCheckedModeBanner: false,
              theme: AppTheme.staff,
              routerConfig: router,
            );
          },
        ),
      ),
    );
  }
}
