import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../repositories/device_token_repository.dart';
import '../routing/app_routes.dart';
import '../storage/secure_storage.dart';
import 'local_notifications.dart';

/// FCM requires this handler be a top-level or static function (never a
/// closure/instance method) so it can be spawned on its own isolate when a
/// push arrives while the app is fully backgrounded/terminated. Backend
/// pushes are data-only (see `fcm.client.ts`) specifically so Android never
/// auto-displays anything on its own — this is the ONE place a background
/// push becomes a real notification, via `showPushNotification`.
/// `ensureInitialized()` is required here because a background push spawns
/// a brand new isolate with no binding/plugin state inherited from `main()`.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  await initLocalNotifications();
  await showPushNotification(message);
}

/// Owns FCM registration + foreground/tap handling for both auth planes.
/// Registration itself (asking for the `POST_NOTIFICATIONS` permission,
/// fetching + POSTing the token) is deferred until [registerForSession] is
/// called from [SessionCubit] post-login/restore — never at cold start,
/// since there's nothing to register the token against yet and asking
/// before the user has a reason tanks opt-in.
class PushNotificationService {
  PushNotificationService(this._deviceTokenRepository, this._storage);

  final DeviceTokenRepository _deviceTokenRepository;
  final SecureStorage _storage;

  GoRouter? _router;
  bool _listenersAttached = false;

  /// Called once from `main.dart` after the router is built — lets a
  /// notification tap actually navigate.
  void attachRouter(GoRouter router) {
    _router = router;
    _attachListenersOnce();
  }

  void _attachListenersOnce() {
    if (_listenersAttached) return;
    _listenersAttached = true;

    // Tap handling for the notifications WE post below — fires whenever the
    // Dart engine is already alive to receive it (app foreground or
    // just-minimized). A cold-start tap (app fully terminated) still
    // reopens the app regardless via Android's own default launch behavior,
    // it just lands on the normal start route rather than deep-linking
    // straight to Notifications — real extra scope, deliberately left for
    // later rather than attempted here.
    unawaited(initLocalNotifications(onTap: (_) => _navigateFor()));

    // App open + foreground: Android never auto-shows a tray banner in this
    // state for ANY app (by design), so this is the one path that makes a
    // foreground push visible — same `showPushNotification` the background
    // isolate uses, so foreground and background look identical.
    FirebaseMessaging.onMessage.listen(showPushNotification);
  }

  /// No per-category deep link (e.g. straight to a specific payment) — a
  /// tap opens the right notification LIST for whichever plane the signed-in
  /// user is on: staff go to the existing Notification Center, members go
  /// to their own history (`MemberNotificationsScreen`, `/portal/notifications`
  /// on the backend — this used to fall through to the home shell before
  /// that endpoint/screen existed).
  Future<void> _navigateFor() async {
    final actorType = await _storage.readActorType();
    final destination = actorType == ActorType.staff
        ? AppRoutes.notifications
        : AppRoutes.memberNotifications;
    _router?.go(destination);
  }

  Future<void> registerForSession(ActorType actorType) async {
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      await _deviceTokenRepository.register(actorType, token);

      // Re-register under the CURRENT session's actor type whenever FCM
      // rotates the token — reading `actorType` fresh from storage each
      // time (not the closed-over parameter) so a sign-out+different-role
      // sign-in on the same device doesn't keep re-registering the old role.
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
        final currentActor = await _storage.readActorType();
        if (currentActor == null) return;
        await _deviceTokenRepository.register(currentActor, newToken);
      });
    } catch (e) {
      // Push registration is a best-effort enhancement — never block login
      // or crash the session flow over it (e.g. permission denied, no
      // Google Play Services on this device/emulator).
      developer.log('Push registration failed', name: 'PushNotificationService', error: e);
    }
  }

  Future<void> unregister(ActorType actorType) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) {
        await _deviceTokenRepository.unregister(actorType, token);
      }
      await FirebaseMessaging.instance.deleteToken();
    } catch (e) {
      developer.log('Push unregistration failed', name: 'PushNotificationService', error: e);
    }
  }
}
