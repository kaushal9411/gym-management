import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'bloc/platform/platform_config_cubit.dart';
import 'bloc/session/session_cubit.dart';
import 'core/di/service_locator.dart';
import 'core/push/push_notification_service.dart';
import 'core/routing/app_router.dart';
import 'core/storage/secure_storage.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  // Must be registered before `runApp` — FCM requires the background
  // handler to be a top-level function known at this point so it can be
  // spawned on its own isolate for a push received while backgrounded.
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  setupServiceLocator();

  // Resolved (or timed out/failed back to the default) before the first
  // frame, so the app title and every in-app mention of the platform name
  // are correct from the very first paint — never a visible relabel.
  // Cached to on-device storage too: `local_notifications.dart`'s FCM
  // background isolate has no access to this cubit (or any DI container)
  // and reads the cached value directly instead.
  final platformConfigCubit = getIt<PlatformConfigCubit>();
  await platformConfigCubit.load();
  await getIt<SecureStorage>().saveAppName(platformConfigCubit.state.appName);

  runApp(FitCloudApp(platformConfigCubit: platformConfigCubit));
}

class FitCloudApp extends StatelessWidget {
  const FitCloudApp({super.key, required this.platformConfigCubit});

  final PlatformConfigCubit platformConfigCubit;

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<SessionCubit>.value(value: getIt<SessionCubit>()),
        BlocProvider<PlatformConfigCubit>.value(value: platformConfigCubit),
      ],
      child: Builder(
        builder: (context) {
          final GoRouter router = buildAppRouter(context.read<SessionCubit>());
          final pushService = getIt<PushNotificationService>();
          pushService.attachRouter(router);
          final appName = context.watch<PlatformConfigCubit>().state.appName;
          return MaterialApp.router(
            title: appName,
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
