import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/member_gym_info_screen.dart';
import 'package:gym_saas_mobile/models/gym_info.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements MemberPortalRepository {}

Map<String, dynamic> _full() => {
      'name': 'Kaushal Fitness',
      'logoUrl': null,
      'address': {
        'line1': '1 Road',
        'city': 'Pune',
        'state': 'MH',
        'postalCode': '411001',
        'country': 'India',
      },
      'phone': '+911234567890',
      'email': 'hello@gym.test',
      'website': 'https://gym.test',
      'businessHours': [
        {'day': 'monday', 'open': '06:00', 'close': '22:00'},
        {'day': 'tuesday', 'open': '06:00', 'close': '22:00'},
        {'day': 'sunday', 'closed': true},
      ],
      'social': {'instagram': 'https://instagram.com/gym', 'x': 'x.com/gym'},
      'branch': {'name': 'Main Branch'},
    };

// Monday 18 Jan 2027.
DateTime _at(int h, int m) => DateTime(2027, 1, 18, h, m);

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(
    WidgetTester t,
    Widget child, {
    Size size = const Size(360, 740),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(MaterialApp(home: Scaffold(body: child)));
    await t.pump(const Duration(seconds: 1));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  test('gymTime and open state', () {
    expect(gymTime('06:00'), '6:00 AM');
    expect(gymTime('13:30'), '1:30 PM');
    expect(gymTime('00:05'), '12:05 AM');
    final hours = GymInfo.fromJson(_full()).businessHours;
    expect(gymOpenState(hours, _at(9, 0))!.label, 'Open now · closes 10:00 PM');
    expect(gymOpenState(hours, _at(9, 0))!.open, isTrue);
    expect(gymOpenState(hours, _at(5, 0))!.label, 'Closed · opens 6:00 AM');
    expect(gymOpenState(hours, _at(23, 0))!.label, 'Closed for today');
    // Sunday is closed; Wednesday has no row → unknown.
    expect(
      gymOpenState(hours, DateTime(2027, 1, 24, 10))!.label,
      'Closed today',
    );
    expect(gymOpenState(hours, DateTime(2027, 1, 20, 10)), isNull);
    expect(gymOpenState(null, _at(9, 0)), isNull);
  });

  testWidgets('hero, open chip and every block at 360', (t) async {
    await pump(t, GymInfoBody(info: GymInfo.fromJson(_full()), now: _at(9, 0)));
    expect(t.takeException(), isNull);
    for (final l in [
      'MY GYM',
      'Kaushal Fitness',
      'Your branch: Main Branch',
      'Open now · closes 10:00 PM',
      'Call',
      'Directions',
      'Website',
      'Get in touch',
      '+911234567890',
      'hello@gym.test',
      'gym.test',
      'Address',
      '1 Road',
      'Pune, MH, 411001',
      'India',
      'Get directions',
      'Opening hours',
      'Monday',
      'Today',
      '6:00 AM – 10:00 PM',
      'Closed',
      'Follow us',
      'Instagram',
      'instagram.com/gym',
      'X',
    ]) {
      await show(t, find.text(l));
      expect(find.text(l), findsWidgets, reason: l);
    }
    expect(t.takeException(), isNull);
  });

  testWidgets('closed right now shows when it opens', (t) async {
    await pump(t, GymInfoBody(info: GymInfo.fromJson(_full()), now: _at(5, 0)));
    expect(find.text('Closed · opens 6:00 AM'), findsWidgets);
  });

  testWidgets('only what the gym filled in is shown', (t) async {
    await pump(
      t,
      GymInfoBody(
        info: GymInfo.fromJson({
          'name': 'Gym',
          'phone': '+911234567890',
          'branch': {'name': 'Main'},
        }),
        now: _at(9, 0),
      ),
    );
    expect(find.text('Get in touch'), findsOneWidget);
    expect(find.text('Address'), findsNothing);
    expect(find.text('Opening hours'), findsNothing);
    expect(find.text('Follow us'), findsNothing);
    expect(find.byKey(const ValueKey('gym-open-chip')), findsNothing);
    expect(find.text('Directions'), findsNothing);
  });

  testWidgets('branch contact wins over the gym\'s', (t) async {
    final j = _full()
      ..['branch'] = {
        'name': 'Main Branch',
        'phone': '+919999999999',
        'email': 'branch@gym.test',
      };
    await pump(t, GymInfoBody(info: GymInfo.fromJson(j), now: _at(9, 0)));
    await show(t, find.text('+919999999999'));
    expect(find.text('+919999999999'), findsOneWidget);
    expect(find.text('+911234567890'), findsNothing);
    expect(find.text('branch@gym.test'), findsOneWidget);
  });

  testWidgets('an all-empty gym shows the empty state', (t) async {
    await pump(
      t,
      GymInfoBody(info: GymInfo.fromJson({'name': 'Gym', 'branch': null})),
    );
    expect(find.text('No details shared yet'), findsOneWidget);
    expect(find.text('Get in touch'), findsNothing);
  });

  testWidgets('tablet 1500x1300 renders without overflow', (t) async {
    await pump(
      t,
      GymInfoBody(info: GymInfo.fromJson(_full()), now: _at(9, 0)),
      size: const Size(1500, 1300),
    );
    await show(t, find.text('Follow us'));
    expect(t.takeException(), isNull);
  });

  group('screen', () {
    late _Repo repo;

    setUp(() {
      repo = _Repo();
      final g = GetIt.instance;
      if (g.isRegistered<MemberPortalRepository>()) {
        g.unregister<MemberPortalRepository>();
      }
      g.registerSingleton<MemberPortalRepository>(repo);
    });

    testWidgets('loads and renders', (t) async {
      when(() => repo.gymInfo())
          .thenAnswer((_) async => GymInfo.fromJson(_full()));
      await pump(t, const MemberGymInfoScreen());
      expect(find.text('Kaushal Fitness'), findsWidgets);
    });

    testWidgets('a load error shows retry', (t) async {
      when(() => repo.gymInfo())
          .thenAnswer((_) async => throw ApiException.network());
      await pump(t, const MemberGymInfoScreen());
      expect(find.text('Try again'), findsOneWidget);
    });
  });
}
