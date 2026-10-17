import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import 'bloc/platform/platform_config_cubit.dart';
import 'bloc/session/session_cubit.dart';
import 'bloc/theme/theme_cubit.dart';
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
  // Theme first: `AppColors.isLight` must be right before any widget builds.
  await getIt<ThemeCubit>().load();

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

class FitCloudApp extends StatefulWidget {
  const FitCloudApp({super.key, required this.platformConfigCubit});

  final PlatformConfigCubit platformConfigCubit;

  @override
  State<FitCloudApp> createState() => _FitCloudAppState();
}

class _FitCloudAppState extends State<FitCloudApp> with WidgetsBindingObserver {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _router = buildAppRouter(getIt<SessionCubit>());
    getIt<PushNotificationService>().attachRouter(_router);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    if (getIt<ThemeCubit>().onPlatformBrightnessChanged()) _repaintEverything();
  }

  /// `AppColors` neutrals are read at build time and many widgets are
  /// `const`, so a new theme needs every element rebuilt once — a plain
  /// `ThemeData` swap would only refresh widgets that read `Theme.of`.
  /// Routes and widget state are untouched; only `build` re-runs.
  void _repaintEverything() {
    void rebuild(Element element) {
      element.markNeedsBuild();
      element.visitChildren(rebuild);
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      (context as Element).visitChildren(rebuild);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<SessionCubit>.value(value: getIt<SessionCubit>()),
        BlocProvider<PlatformConfigCubit>.value(
          value: widget.platformConfigCubit,
        ),
        BlocProvider<ThemeCubit>.value(value: getIt<ThemeCubit>()),
      ],
      child: BlocListener<ThemeCubit, ThemeMode>(
        listener: (_, __) => _repaintEverything(),
        child: BlocBuilder<ThemeCubit, ThemeMode>(
          builder: (context, mode) => MaterialApp.router(
            title: context.watch<PlatformConfigCubit>().state.appName,
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: mode,
            routerConfig: _router,
          ),
        ),
      ),
    );
  }
}
