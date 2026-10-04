import 'dart:typed_data';

import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/profile_failure.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_edit_profile_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_profile_screen.dart';
import 'package:gym_saas_mobile/features/member/presentation/widgets/member_photo_sheet.dart';
import 'package:gym_saas_mobile/models/member_self_profile.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../models/member_self_profile_test.dart' show dtoFixture, realFixture;

class _MockRepo extends Mock implements MemberPortalRepository {}

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

void main() {
  late _MockRepo repo;
  late _MockSession session;

  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    repo = _MockRepo();
    session = _MockSession();
    when(
      () => session.memberProfileChanged(
        name: any(named: 'name'),
        email: any(named: 'email'),
        profilePhotoUrl: any(named: 'profilePhotoUrl'),
        clearPhoto: any(named: 'clearPhoto'),
      ),
    ).thenAnswer((_) async {});
    final g = GetIt.instance;
    if (g.isRegistered<MemberPortalRepository>()) {
      g.unregister<MemberPortalRepository>();
    }
    g.registerSingleton<MemberPortalRepository>(repo);
  });

  Future<void> pump(WidgetTester t, Widget child) async {
    t.view.physicalSize = const Size(360 * 3, 740 * 3);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
    await t.pump(const Duration(seconds: 1));
  }

  Finder field(String label) => find
      .ancestor(
        of: find.text(label),
        matching: find.byType(Column),
      )
      .first;

  Finder inputFor(String label) => find.descendant(
        of: field(label),
        matching: find.byType(TextField),
      );

  testWidgets('edit form: Save disabled until dirty, sends only changed keys',
      (t) async {
    final profile = MemberSelfProfile.fromJson(dtoFixture());
    when(() => repo.updateProfile(any())).thenAnswer(
      (_) async => MemberSelfProfile.fromJson(
        {
          ...dtoFixture(),
          'city': 'x',
          'address': {'city': 'Mumbai'},
        },
      ),
    );
    await pump(t, MemberEditProfileScreen(profile: profile));

    // Not dirty: tapping Save does nothing.
    await t.tap(find.text('Save changes'));
    await t.pump();
    verifyNever(() => repo.updateProfile(any()));

    await t.scrollUntilVisible(find.text('City'), 300,
        scrollable: find.byType(Scrollable).first,);
    await t.enterText(inputFor('City'), 'Mumbai');
    await t.pump();
    await t.tap(find.text('Save changes'));
    await t.pump();
    await t.pump(const Duration(seconds: 1));

    final captured =
        verify(() => repo.updateProfile(captureAny())).captured.single as Map;
    expect(captured, {'city': 'Mumbai'});
  });

  testWidgets('email change reveals current password and requires it',
      (t) async {
    final profile = MemberSelfProfile.fromJson(dtoFixture());
    when(() => repo.updateProfile(any())).thenThrow(
      const ProfileFailure(
        kind: ProfileFailureKind.validation,
        statusCode: 422,
        message: 'Incorrect password',
        fieldErrors: [
          FieldError(field: 'currentPassword', message: 'Incorrect password'),
        ],
      ),
    );
    await pump(t, MemberEditProfileScreen(profile: profile));
    expect(find.text('Current password'), findsNothing);

    await t.scrollUntilVisible(find.text('Email'), 300,
        scrollable: find.byType(Scrollable).first,);
    await t.enterText(inputFor('Email'), 'new@example.com');
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
    expect(find.text('Current password'), findsOneWidget);

    // Missing password -> client validation, no request.
    await t.tap(find.text('Save changes'));
    await t.pump();
    verifyNever(() => repo.updateProfile(any()));
    expect(find.textContaining('current password'), findsWidgets);

    await t.enterText(inputFor('Current password'), 'secret');
    await t.pump();
    await t.tap(find.text('Save changes'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 300));
    final body =
        verify(() => repo.updateProfile(captureAny())).captured.single as Map;
    expect(body, {'email': 'new@example.com', 'currentPassword': 'secret'});
    // Server field error is shown inline.
    expect(find.text('Incorrect password'), findsOneWidget);
  });

  testWidgets('blank first name shows inline error and sends nothing',
      (t) async {
    await pump(
      t,
      MemberEditProfileScreen(
          profile: MemberSelfProfile.fromJson(realFixture()),),
    );
    await t.enterText(inputFor('First name'), '');
    await t.pump();
    await t.tap(find.text('Save changes'));
    await t.pump();
    expect(find.text('First name is required'), findsOneWidget);
    verifyNever(() => repo.updateProfile(any()));
  });

  testWidgets('photo sheet: remove only when a photo exists', (t) async {
    MemberPhotoAction? result;
    Future<void> open(bool has) async {
      await pump(
        t,
        Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: TextButton(
                onPressed: () async =>
                    result = await showMemberPhotoSheet(context, hasPhoto: has),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('open'));
      await t.pumpAndSettle();
    }

    await open(false);
    expect(find.text('Take photo'), findsOneWidget);
    expect(find.text('Choose from gallery'), findsOneWidget);
    expect(find.text('Remove photo'), findsNothing);
    await t.tap(find.text('Choose from gallery'));
    await t.pumpAndSettle();
    expect(result, MemberPhotoAction.gallery);

    await open(true);
    expect(find.text('Remove photo'), findsOneWidget);
    // 48dp minimum tap target.
    expect(t.getSize(find.text('Remove photo')).height, lessThan(48));
    final row = find
        .ancestor(
          of: find.text('Remove photo'),
          matching: find.byType(ConstrainedBox),
        )
        .first;
    expect(t.getSize(row).height, greaterThanOrEqualTo(48));
  });

  testWidgets('profile screen: renders locked card, uploads a picked photo',
      (t) async {
    when(() => repo.selfProfile()).thenAnswer(
      (_) async => MemberSelfProfile.fromJson(realFixture()),
    );
    when(() => repo.uploadPhoto(any(), onProgress: any(named: 'onProgress')))
        .thenAnswer((_) async => 'http://x/new.jpg');
    await pump(
      t,
      MemberProfileScreen(
        photoPicker: (_) async =>
            Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0, 0, 1, 2]),
      ),
    );
    expect(find.text('Test Member'), findsOneWidget);
    expect(find.text('Edit profile'), findsOneWidget);
    await t.tap(find.byIcon(Icons.photo_camera_rounded));
    await t.pumpAndSettle();
    await t.tap(find.text('Choose from gallery'));
    await t.pump();
    await t.pump(const Duration(seconds: 1));
    final url = verify(
      () =>
          repo.uploadPhoto(captureAny(), onProgress: any(named: 'onProgress')),
    ).captured.single as String;
    expect(url, startsWith('data:image/jpeg;base64,'));
    verify(
      () => session.memberProfileChanged(
        name: any(named: 'name'),
        email: any(named: 'email'),
        profilePhotoUrl: any(named: 'profilePhotoUrl'),
        clearPhoto: any(named: 'clearPhoto'),
      ),
    ).called(greaterThanOrEqualTo(1));

    await t.scrollUntilVisible(
      find.text('Ask the front desk to change these.'),
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Managed by your gym'), findsOneWidget);
  });
}
