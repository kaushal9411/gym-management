import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/features/auth/presentation/gym_picker_sheet.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/tenant_summary.dart';
import 'package:gym_saas_mobile/repositories/public_tenant_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements PublicTenantRepository {}

const _alpha = TenantSummary(slug: 'alpha-fit', name: 'Alpha Fit');
const _beta = TenantSummary(slug: 'beta-gym', name: 'Beta Gym');

TenantBranding _branding(String slug, String name) => TenantBranding(
      slug: slug,
      name: name,
      status: 'ACTIVE',
      maintenanceMode: false,
      primaryColor: '',
    );

/// Hosts a button that opens the picker and records what it returned.
Future<ValueNotifier<TenantBranding?>> _open(
  WidgetTester tester, {
  required List<TenantSummary> gyms,
}) async {
  tester.view.physicalSize = const Size(1080, 2200);
  tester.view.devicePixelRatio = 2.75;
  addTearDown(tester.view.reset);
  final picked = ValueNotifier<TenantBranding?>(null);
  await tester.pumpWidget(
    MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () async =>
                  picked.value = await showGymPicker(context, gyms: gyms),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return picked;
}

void main() {
  late _Repo repo;

  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<PublicTenantRepository>()) {
      g.unregister<PublicTenantRepository>();
    }
    g.registerSingleton<PublicTenantRepository>(repo);
  });

  tearDown(() => GetIt.instance.reset());

  group('showGymPicker — multi-gym login only', () {
    testWidgets('lists exactly the gyms given: short list, no search',
        (tester) async {
      await _open(tester, gyms: const [_alpha, _beta]);
      expect(find.text('Choose your gym'), findsOneWidget);
      expect(find.text('Alpha Fit'), findsOneWidget);
      expect(find.text('Beta Gym'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });

    testWidgets('tapping a gym resolves it and returns its branding',
        (tester) async {
      when(() => repo.resolve('beta-gym'))
          .thenAnswer((_) async => _branding('beta-gym', 'Beta Gym'));
      final picked = await _open(tester, gyms: const [_alpha, _beta]);
      await tester.tap(find.text('Beta Gym'));
      await tester.pumpAndSettle();
      expect(picked.value?.slug, 'beta-gym');
      expect(find.text('Choose your gym'), findsNothing);
    });
  });
}
