import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/features/member/presentation/widgets/member_plan_benefits.dart';
import 'package:gym_saas_mobile/models/member_plan.dart';
import 'package:gym_saas_mobile/repositories/member_portal_repository.dart';

import '../fixtures/member_plan_fixtures.dart';

class _Repo extends Fake implements MemberPortalRepository {
  _Repo(this.responses);

  /// One entry per call; a Future-returning closure so failures can throw.
  final List<Future<MemberPlan?> Function()> responses;
  int calls = 0;

  @override
  Future<MemberPlan?> plan() {
    final i = calls < responses.length ? calls : responses.length - 1;
    calls++;
    return responses[i]();
  }
}

MemberPlan _plan([Map<String, dynamic>? json]) =>
    MemberPlan.fromJson(json ?? planJson());

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  Future<void> pump(
    WidgetTester t,
    Widget child, {
    Size size = const Size(360, 740),
    bool reduced = false,
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(
      MaterialApp(
        builder: (context, c) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
          child: c!,
        ),
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(18),
            child: child,
          ),
        ),
      ),
    );
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  group('MemberPlanBenefitsCard', () {
    testWidgets('360dp: header, every benefit, quotas and branch chips',
        (t) async {
      await pump(t, MemberPlanBenefitsCard(plan: _plan()));
      expect(t.takeException(), isNull);
      expect(find.text('Quarterly Pro'), findsOneWidget);
      expect(find.text('PLAN-0002'), findsOneWidget);
      expect(find.text('Premium'), findsOneWidget);
      expect(find.text('3 Months'), findsOneWidget);
      expect(find.text('Active'), findsOneWidget);
      expect(find.text('61 days left'), findsOneWidget);
      expect(find.text('What’s included'), findsOneWidget);
      expect(find.text('6 of 7'), findsOneWidget);

      for (final l in [
        'Gym access',
        'Personal training',
        'Group classes',
        'Diet consultation',
        'Locker',
        'Guest passes',
        'Membership freeze',
      ]) {
        expect(find.text(l), findsOneWidget, reason: l);
      }
      // 6 included (check) + 1 not included (Locker).
      expect(find.text('Included'), findsNWidgets(6));
      expect(find.text('Not included'), findsOneWidget);
      // Gym access: branch-name chips.
      expect(find.text('Bandra'), findsOneWidget);
      expect(find.text('Thane'), findsOneWidget);
      expect(find.text('2 branches'), findsOneWidget);
      // Quotas: remaining count-up and "x of y unit used".
      expect(find.text('3'), findsOneWidget);
      expect(find.text('1 of 4 sessions used'), findsOneWidget);
      expect(find.text('10 of 10 classes used'), findsOneWidget);
      expect(find.text('0 of 2 passes used'), findsOneWidget);
      // Uncapped freeze reads "No limit", not a number.
      expect(find.text('No limit'), findsOneWidget);
    });

    testWidgets('a bare plan only includes gym access', (t) async {
      await pump(t, MemberPlanBenefitsCard(plan: _plan(barePlanJson())));
      expect(t.takeException(), isNull);
      expect(find.text('Walk-in'), findsOneWidget);
      expect(find.text('1 of 7'), findsOneWidget);
      expect(find.text('Included'), findsOneWidget);
      expect(find.text('Not included'), findsNWidgets(6));
      expect(find.text('All branches'), findsOneWidget);
      expect(find.textContaining(' used'), findsNothing);
    });

    testWidgets('expired and pending status chips', (t) async {
      await pump(
        t,
        MemberPlanBenefitsCard(
          plan: _plan(planJson(status: 'EXPIRED', daysLeft: 0, expired: true)),
        ),
      );
      expect(find.text('Expired'), findsOneWidget);
      expect(find.text('Ended'), findsOneWidget);

      await pump(
        t,
        MemberPlanBenefitsCard(plan: _plan(planJson(status: 'PENDING'))),
      );
      expect(find.text('Starts soon'), findsOneWidget);
      expect(find.text('Starts 1 Oct 2026'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300 lays out without overflow', (t) async {
      await pump(
        t,
        MemberPlanBenefitsCard(plan: _plan()),
        size: const Size(1500, 1300),
      );
      expect(t.takeException(), isNull);
      expect(find.text('Personal training'), findsOneWidget);
    });

    testWidgets('long names and many branches stay inside 360dp', (t) async {
      final j = planJson(
        name: 'The Ultimate Annual Elite All-Access Transformation Package',
        description:
            'A very long description that goes on and on so that it has to '
            'be clipped to two lines in the header of the card.',
      );
      final gym = (j['benefits'] as List).first as Map<String, dynamic>;
      gym['items'] = [
        'Kaushal Fitness Studio — Bandra West Flagship Branch',
        'Powai',
        'Thane',
        'Navi Mumbai Vashi Sector 17',
      ];
      gym['note'] = '4 branches';
      await pump(t, MemberPlanBenefitsCard(plan: _plan(j)));
      expect(t.takeException(), isNull);
    });

    testWidgets('reduced motion renders the final state at once', (t) async {
      await pump(
        t,
        MemberPlanBenefitsCard(plan: _plan()),
        reduced: true,
      );
      expect(t.takeException(), isNull);
      expect(find.text('3'), findsOneWidget);
      expect(find.text('1 of 4 sessions used'), findsOneWidget);
    });
  });

  group('MemberPlanBenefitsSection', () {
    late GetIt g;

    void register(_Repo repo) {
      g = GetIt.instance;
      if (g.isRegistered<MemberPortalRepository>()) {
        g.unregister<MemberPortalRepository>();
      }
      g.registerSingleton<MemberPortalRepository>(repo);
    }

    testWidgets('loads and shows the card', (t) async {
      final repo = _Repo([() async => _plan()]);
      register(repo);
      await pump(t, const MemberPlanBenefitsSection());
      expect(repo.calls, 1);
      expect(find.text('What’s included'), findsOneWidget);
    });

    testWidgets('no membership renders nothing', (t) async {
      register(_Repo([() async => null]));
      await pump(t, const MemberPlanBenefitsSection());
      expect(find.text('What’s included'), findsNothing);
      expect(find.text('YOUR PLAN'), findsNothing);
    });

    testWidgets('failure shows a retry line, tap refetches', (t) async {
      final repo = _Repo([
        () async => throw ApiException.network(),
        () async => _plan(),
      ]);
      register(repo);
      await pump(t, const MemberPlanBenefitsSection());
      expect(find.textContaining('tap to retry'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.tap(find.textContaining('tap to retry'));
      await t.pump();
      await t.pump(const Duration(seconds: 3));
      expect(repo.calls, 2);
      expect(find.text('What’s included'), findsOneWidget);
    });

    testWidgets('a new reloadToken refetches', (t) async {
      final repo = _Repo([() async => _plan()]);
      register(repo);
      final token = ValueNotifier<int>(0);
      addTearDown(token.dispose);
      await pump(
        t,
        ValueListenableBuilder<int>(
          valueListenable: token,
          builder: (_, v, __) => MemberPlanBenefitsSection(reloadToken: v),
        ),
      );
      expect(repo.calls, 1);
      token.value = 1;
      await t.pump();
      await t.pump(const Duration(seconds: 3));
      expect(repo.calls, 2);
      expect(find.text('What’s included'), findsOneWidget);
    });
  });
}
