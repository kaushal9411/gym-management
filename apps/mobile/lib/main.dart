import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'bloc/session/session_cubit.dart';
import 'core/di/service_locator.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

void main() {
  setupServiceLocator();
  runApp(const FitCloudApp());
}

class FitCloudApp extends StatelessWidget {
  const FitCloudApp({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SessionCubit>.value(
      value: getIt<SessionCubit>(),
      child: Builder(
        builder: (context) {
          final GoRouter router = buildAppRouter(context.read<SessionCubit>());
          return MaterialApp.router(
            title: 'FitCloud',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.dark,
            darkTheme: AppTheme.dark,
            themeMode: ThemeMode.dark,
            routerConfig: router,
          );
        },
      ),
    );
  }
}
