import 'dart:async';
import 'dart:developer' as developer;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../repositories/device_token_repository.dart';
import '../routing/app_routes.dart';
import '../storage/secure_storage.dart';

/// FCM requires this handler be a top-level or static function (never a
/// closure/instance method) so it can be spawned on its own isolate when a
/// push arrives while the app is fully backgrounded/terminated. It has no
/// UI to show — the OS already renders the system tray notification from
/// the message's `notification` block on its own in that state; this hook
/// exists only for messages that need data-only background processing,
/// which this app doesn't currently need, so it's intentionally a no-op.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

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

  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
      GlobalKey<ScaffoldMessengerState>();

  GoRouter? _router;
  bool _listenersAttached = false;

  /// Called once from `main.dart` after the router is built — lets a
  /// notification tap (background or cold-start) actually navigate.
  void attachRouter(GoRouter router) {
    _router = router;
    _attachListenersOnce();
    unawaited(_consumeInitialMessage());
  }

  void _attachListenersOnce() {
    if (_listenersAttached) return;
    _listenersAttached = true;

    // App open + foreground: the OS does NOT show a tray banner on its own
    // in this state, so surface it ourselves via the shared snackbar key —
    // same "inline ScaffoldMessenger" convention every screen already uses,
    // just routed through a key since there's no screen-local context here.
    FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(
            notification.title == null
                ? notification.body ?? ''
                : '${notification.title}: ${notification.body ?? ''}',
          ),
          action: SnackBarAction(
            label: 'View',
            onPressed: () => _navigateFor(message),
          ),
        ),
      );
    });

    // Background tap (app was alive but not foreground).
    FirebaseMessaging.onMessageOpenedApp.listen(_navigateFor);
  }

  /// Cold-start tap (app was fully terminated) — only resolvable once, after
  /// the router exists.
  Future<void> _consumeInitialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    if (message != null) _navigateFor(message);
  }

  /// This app has no per-member or per-category notification-history
  /// screen to deep-link into (see docs/MOBILE-GUIDE.md — mobile only ever
  /// renders real backend data, and no such endpoint exists), so a tap
  /// opens a real, always-correct destination: staff go to the existing
  /// Notification Center list, everyone else lands on their home shell.
  Future<void> _navigateFor(RemoteMessage message) async {
    final actorType = await _storage.readActorType();
    final destination = actorType == ActorType.staff
        ? AppRoutes.notifications
        : AppRoutes.home;
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
