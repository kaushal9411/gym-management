import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/features/auth/presentation/login_screen.dart';

Future<void> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(1080, 2200);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
  // Let the entrance animation play, but not the endless aurora/shimmer loops.
  await tester.pump(const Duration(milliseconds: 1600));
}

/// Lets an AnimatedSwitcher finish AND drop its outgoing child (needs a frame after it ends).
Future<void> _settle(WidgetTester tester) async {
  // Several short frames: the outgoing child is removed on the frame AFTER its animation ends.
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('LoginScreen — one screen for staff and members', () {
    testWidgets('has a single identifier field and no Staff/Member toggle',
        (tester) async {
      await _pump(tester);
      expect(find.text('Staff'), findsNothing);
      expect(find.text('Member'), findsNothing);
      expect(find.text('EMAIL OR MEMBER ID'), findsOneWidget);
      expect(find.text('PASSWORD'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(2));
      expect(
          find.text('Staff use email · Members use Member ID'), findsOneWidget,);
    });

    testWidgets('detects staff from an email and members from a Member ID',
        (tester) async {
      await _pump(tester);
      final identifier = find.byType(TextField).first;

      await tester.enterText(identifier, 'coach@gym.com');
      await _settle(tester);
      expect(find.text('Staff sign-in · work email'), findsOneWidget);
      expect(find.text('Member sign-in · Member ID'), findsNothing);

      await tester.enterText(identifier, 'MEM-0007');
      await _settle(tester);
      expect(find.text('Member sign-in · Member ID'), findsOneWidget);
      expect(find.text('Staff sign-in · work email'), findsNothing);

      await tester.enterText(identifier, '');
      await _settle(tester);
      expect(
          find.text('Staff use email · Members use Member ID'), findsOneWidget,);
    });

    testWidgets('empty submit shows inline errors without any network call',
        (tester) async {
      await _pump(tester);
      await tester.tap(find.text('Sign in'));
      await _settle(tester);
      expect(find.text('Enter your email or Member ID'), findsOneWidget);
      expect(find.text('Enter your password'), findsOneWidget);
    });

    testWidgets('password can be revealed and hidden again', (tester) async {
      await _pump(tester);
      TextField password() =>
          tester.widget<TextField>(find.byType(TextField).last);
      expect(password().obscureText, isTrue);
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pump(const Duration(milliseconds: 300));
      expect(password().obscureText, isFalse);
    });
  });
}
