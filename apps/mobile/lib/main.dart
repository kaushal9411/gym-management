import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'bloc/session/session_cubit.dart';
import 'core/di/service_locator.dart';
import 'core/push/push_notification_service.dart';
import 'core/routing/app_router.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  // Must be registered before `runApp` — FCM requires the background
  // handler to be a top-level function known at this point so it can be
  // spawned on its own isolate for a push received while backgrounded.
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

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
          final pushService = getIt<PushNotificationService>();
          pushService.attachRouter(router);
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
