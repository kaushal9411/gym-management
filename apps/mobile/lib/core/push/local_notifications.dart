import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// One shared channel for every FCM push — Android requires every
/// notification belong to a channel (API 26+) or it's silently dropped, and
/// this app shipped with none configured, which is why nothing ever showed.
/// `Importance.high` + `playSound: true` is what actually produces a
/// heads-up banner with sound, not just a silent tray entry.
const _channel = AndroidNotificationChannel(
  'fitcloud_default',
  'FitCloud Notifications',
  description: 'Membership, payment, and activity alerts from FitCloud.',
  importance: Importance.high,
  playSound: true,
);

/// Plain top-level singleton (not `get_it`) — this must also work from
/// `firebaseMessagingBackgroundHandler`'s own isolate, which has no access
/// to the main isolate's DI container or any other app state.
final FlutterLocalNotificationsPlugin localNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

/// Idempotent — Android notification channel creation is a no-op if the
/// channel already exists, so calling this from both the main isolate (at
/// app start) and the background isolate (on first push while backgrounded)
/// is safe and necessary, since neither can assume the other already ran.
///
/// [onTap] fires when the Dart engine is already alive to receive it (app
/// foreground or just-minimized) — tapping while fully backgrounded/
/// terminated still reopens the app regardless (Android's own default
/// launch behavior for any notification), it just lands on the normal
/// start route rather than deep-linking straight to Notifications; wiring
/// that cold-start case too is real extra scope, not a quick addition, so
/// it's deliberately left for later rather than attempted here.
Future<void> initLocalNotifications({
  void Function(NotificationResponse)? onTap,
}) async {
  await localNotificationsPlugin.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
    onDidReceiveNotificationResponse: onTap,
  );
  await localNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_channel);
}

/// Posts one real system-tray notification (heads-up banner + sound) from
/// an FCM `RemoteMessage`. The backend sends data-only pushes (no
/// `notification` block — see `fcm.client.ts`) specifically so this is the
/// ONE place a notification gets constructed, for foreground AND
/// background alike; relying on Android's own auto-display would only ever
/// fire while backgrounded, never while the app is open, and would risk a
/// duplicate if both paths tried to show something.
Future<void> showPushNotification(RemoteMessage message) async {
  final title = message.data['title'] as String? ?? 'FitCloud';
  final body = message.data['body'] as String?;
  await localNotificationsPlugin.show(
    message.hashCode,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        _channel.id,
        _channel.name,
        channelDescription: _channel.description,
        importance: Importance.high,
        priority: Priority.high,
        playSound: true,
      ),
    ),
  );
}
