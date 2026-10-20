import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/profile_failure.dart';
import 'package:gym_saas_mobile/features/communications/presentation/widgets/comm_widgets.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_notification_settings_screen.dart';
import 'package:gym_saas_mobile/models/comm_channel.dart';
import 'package:gym_saas_mobile/models/member_notification_preferences.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements MemberPortalRepository {}

MemberNotificationPreferences _prefs({bool smsOptOut = true}) =>
    MemberNotificationPreferences.fromJson({
      'channels': [
        {'channel': 'PUSH', 'label': 'Push notifications', 'promotionalOptOut': false},
        {'channel': 'EMAIL', 'label': 'Email', 'promotionalOptOut': false},
        {'channel': 'SMS', 'label': 'SMS', 'promotionalOptOut': smsOptOut},
        {'channel': 'WHATSAPP', 'label': 'WhatsApp', 'promotionalOptOut': false},
      ],
      'nonBlockable': [
        {'key': 'MEMBERSHIP_REMINDERS', 'label': 'Membership expiry reminders'},
        {'key': 'PAYMENT_REMINDERS', 'label': 'Invoice and payment reminders'},
        {'key': 'CLASS_UPDATES', 'label': 'Reminders and changes for classes you booked'},
        {'key': 'ACCOUNT_MESSAGES', 'label': 'Account, security and receipt messages'},
      ],
      'note': 'Opting out stops promotional and general announcements on that channel.',
    });

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  late _Repo repo;

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) g.unregister<MemberPortalRepository>();
    g.registerSingleton<MemberPortalRepository>(repo);
    when(() => repo.notificationPreferences()).thenAnswer((_) async => _prefs());
  });

  Future<void> pump(WidgetTester t, {Size size = const Size(360, 740)}) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(const MaterialApp(home: MemberNotificationSettingsScreen()));
    await t.pump();
    await t.pump(const Duration(seconds: 2));
  }

  testWidgets('360: channel switches reflect the opt-outs; non-blockable listed', (t) async {
    await pump(t);
    expect(t.takeException(), isNull);
    expect(find.text('Notification settings'), findsOneWidget);
    expect(find.text('Push notifications'), findsOneWidget);
    expect(find.text('You get offers here'), findsNWidgets(3));
    expect(find.text('Offers are off here'), findsOneWidget); // SMS
    expect(find.text('Always delivered'), findsOneWidget);
    await t.drag(find.byType(Scrollable).first, const Offset(0, -500));
    await t.pump();
    expect(find.text('Membership expiry reminders'), findsOneWidget);
    expect(find.textContaining('Opting out stops promotional'), findsOneWidget);
  });

  testWidgets('tablet 1500x1300 renders without overflow', (t) async {
    await pump(t, size: const Size(1500, 1300));
    expect(t.takeException(), isNull);
    expect(find.text('WhatsApp'), findsOneWidget);
  });

  testWidgets('switching a channel off saves promotionalOptOut: true and shows the server result', (t) async {
    when(() => repo.updateNotificationPreferences(any())).thenAnswer((_) async {
      final p = _prefs(smsOptOut: true);
      return p.withChannel(p.channels.first.withOptOut(true));
    });
    await pump(t);
    await t.tap(find.byType(CommSwitch).first);
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    final cap = verify(() => repo.updateNotificationPreferences(captureAny())).captured.single
        as Map<CommChannel, bool>;
    expect(cap, {CommChannel.push: true});
    expect(find.text('Offers are off here'), findsNWidgets(2));
  });

  testWidgets('a rate-limit failure shows a banner and leaves the switch unchanged', (t) async {
    when(() => repo.updateNotificationPreferences(any())).thenAnswer(
      (_) async => throw ProfileFailure.from(const ApiException(message: 'x', statusCode: 429)),
    );
    await pump(t);
    await t.tap(find.byType(CommSwitch).first);
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    expect(find.textContaining('too quickly'), findsOneWidget);
    expect(find.text('You get offers here'), findsNWidgets(3));
  });

  testWidgets('a network failure while loading shows retry', (t) async {
    when(() => repo.notificationPreferences()).thenAnswer((_) async => throw ApiException.network());
    await pump(t);
    expect(find.text('Try again'), findsOneWidget);
    when(() => repo.notificationPreferences()).thenAnswer((_) async => _prefs());
    await t.tap(find.text('Try again'));
    await t.pump();
    await t.pump(const Duration(seconds: 1));
    expect(find.text('Push notifications'), findsOneWidget);
  });
}
