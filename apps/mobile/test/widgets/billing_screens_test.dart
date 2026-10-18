import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/platform/platform_config_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_address_screen.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_history_screen.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_invoices_screen.dart';
import 'package:gym_saas_mobile/features/billing/presentation/billing_screen.dart';
import 'package:gym_saas_mobile/models/billing_address.dart';
import 'package:gym_saas_mobile/models/billing_payment.dart';
import 'package:gym_saas_mobile/models/branch.dart';
import 'package:gym_saas_mobile/models/checkout_result.dart';
import 'package:gym_saas_mobile/models/fitcloud_invoice.dart';
import 'package:gym_saas_mobile/models/gym_member.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/staff_member.dart';
import 'package:gym_saas_mobile/models/subscription_plan_info.dart';
import 'package:gym_saas_mobile/models/subscription_plan_option.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/billing_repository.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/member_repository.dart';
import 'package:gym_saas_mobile/repositories/staff_repository.dart';
import 'package:mocktail/mocktail.dart';

class _MockSession extends MockCubit<SessionState> implements SessionCubit {}

class _MockPlatform extends MockCubit<PlatformConfigState>
    implements PlatformConfigCubit {}

Map<String, dynamic> _planJson(
  String slug,
  String name,
  int order,
  String monthly,
  String yearly,
) =>
    {
      'slug': slug,
      'name': name,
      'description': '$name plan blurb',
      'sortOrder': order,
      'priceMonthly': monthly,
      'priceYearly': yearly,
      'currency': 'INR',
      'maxBranches': 3,
      'maxStaff': 20,
      'maxMembers': 500,
    };

Map<String, dynamic> _optionJson(
  String slug,
  String name,
  int order,
  num monthly,
  num yearly,
) =>
    {
      'id': 'id-$slug',
      'slug': slug,
      'name': name,
      'description': '$name plan blurb',
      'priceMonthly': monthly,
      'priceYearly': yearly,
      'currency': 'INR',
      'trialDays': 14,
      'sortOrder': order,
      'limits': {
        'maxBranches': 3,
        'maxManagers': 3,
        'maxTrainers': 3,
        'maxReceptionists': 3,
        'maxStaff': 20,
        'maxMembers': 500,
        'maxStorageMb': 1000,
      },
      'features': [
        {'key': 'a', 'label': '$name feature one', 'included': true},
        {'key': 'b', 'label': '$name excluded feature', 'included': false},
      ],
    };

TenantSubscription _sub({
  String status = 'ACTIVE',
  bool cancelAtPeriodEnd = false,
  String cycle = 'MONTHLY',
  bool grace = false,
}) {
  final now = DateTime.now().toUtc();
  String iso(DateTime d) => d.toIso8601String();
  return TenantSubscription.fromJson({
    'status': status,
    'billingCycle': cycle,
    'trialEndsAt':
        status == 'TRIALING' ? iso(now.add(const Duration(days: 5))) : null,
    'currentPeriodStart': iso(now.subtract(const Duration(days: 10))),
    'currentPeriodEnd': iso(now.add(const Duration(days: 20))),
    'graceEndsAt': grace ? iso(now.add(const Duration(days: 3))) : null,
    'cancelAtPeriodEnd': cancelAtPeriodEnd,
    'plan': _planJson('pro', 'Professional', 2, '1499.00', '14990.00'),
  });
}

class _BillingRepo extends Fake implements BillingRepository {
  TenantSubscription? subscription = _sub();
  ApiException? subscriptionError;
  ApiException? cancelError;
  ApiException? checkoutError;
  ApiException? saveError;
  ApiException? paymentsError;
  ApiException? invoicesError;
  BillingAddress? address;
  List<BillingPayment> payments = [];
  List<FitCloudInvoice> invoiceList = [];
  final cancels = <bool>[];
  final checkouts = <Map<String, Object?>>[];
  final coupons = <String>[];
  final saved = <Map<String, Object?>>[];
  int subscriptionCalls = 0;

  @override
  Future<TenantSubscription?> currentSubscription() async {
    subscriptionCalls++;
    if (subscriptionError != null) throw subscriptionError!;
    return subscription;
  }

  @override
  Future<List<SubscriptionPlanOption>> listPlans() async => [
        SubscriptionPlanOption.fromJson(
          _optionJson('starter', 'Starter', 1, 499, 4790),
        ),
        SubscriptionPlanOption.fromJson(
          _optionJson('pro', 'Professional', 2, 1499, 14990),
        ),
        SubscriptionPlanOption.fromJson(
          _optionJson('elite', 'Elite', 3, 2999, 29990),
        ),
      ];

  @override
  Future<void> cancel({required bool immediate}) async {
    if (cancelError != null) throw cancelError!;
    cancels.add(immediate);
  }

  @override
  Future<double> validateCoupon(String code, double amount) async {
    coupons.add(code);
    return amount / 2;
  }

  @override
  Future<CheckoutResult> checkout({
    required String kind,
    required String planSlug,
    required String billingCycle,
    String? couponCode,
  }) async {
    if (checkoutError != null) throw checkoutError!;
    checkouts.add({
      'kind': kind,
      'planSlug': planSlug,
      'billingCycle': billingCycle,
      'couponCode': couponCode,
    });
    return const CheckoutResult(requiresPayment: false);
  }

  @override
  Future<List<BillingPayment>> paymentHistory() async {
    if (paymentsError != null) throw paymentsError!;
    return payments;
  }

  @override
  Future<List<FitCloudInvoice>> invoices() async {
    if (invoicesError != null) throw invoicesError!;
    return invoiceList;
  }

  @override
  Future<BillingAddress?> getAddress() async => address;

  @override
  Future<BillingAddress> saveAddress({
    String? legalName,
    required String line1,
    String? line2,
    required String city,
    required String state,
    required String postalCode,
    required String country,
    String? taxId,
  }) async {
    if (saveError != null) throw saveError!;
    saved.add({
      'legalName': legalName,
      'line1': line1,
      'line2': line2,
      'city': city,
      'state': state,
      'postalCode': postalCode,
      'country': country,
      'taxId': taxId,
    });
    return BillingAddress(
      legalName: legalName,
      line1: line1,
      line2: line2,
      city: city,
      state: state,
      postalCode: postalCode,
      country: country,
      taxId: taxId,
    );
  }
}

class _BranchRepo extends Fake implements BranchRepository {
  @override
  Future<PaginatedResult<Branch>> list({
    int page = 1,
    int limit = 20,
    String? search,
    bool includeDeleted = false,
    String? sortBy,
    String? sortDir,
  }) async =>
      const PaginatedResult(
        items: [],
        total: 2,
        page: 1,
        limit: 1,
        totalPages: 2,
      );
}

class _StaffRepo extends Fake implements StaffRepository {
  @override
  Future<PaginatedResult<StaffMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    StaffRole? role,
    String? status,
    String? workStatus,
    String? employmentType,
    String? branchId,
    bool includeDeleted = false,
    String sortBy = 'createdAt',
    String sortDir = 'desc',
  }) async =>
      const PaginatedResult(
        items: [],
        total: 17,
        page: 1,
        limit: 20,
        totalPages: 1,
      );
}

class _MemberRepo extends Fake implements MemberRepository {
  @override
  Future<PaginatedResult<GymMember>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? status,
    String? trainerId,
    String? branchId,
    String? sortBy,
    String? sortDir,
  }) async =>
      const PaginatedResult(
        items: [],
        total: 500,
        page: 1,
        limit: 20,
        totalPages: 25,
      );
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
  featureFlags: [],
);

late _BillingRepo _repo;

Map<String, dynamic> _pay(
  String id,
  String status,
  String amount,
  String createdAt, {
  String? failure,
}) =>
    {
      'id': id,
      'provider': 'razorpay',
      'status': status,
      'amount': amount,
      'currency': 'INR',
      'gatewayReference': null,
      'failureReason': failure,
      'createdAt': createdAt,
    };

Map<String, dynamic> _inv(String id, String status, String total) => {
      'id': id,
      'invoiceNumber': 'INV-$id',
      'status': status,
      'total': total,
      'currency': 'INR',
      'dueDate': null,
      'paidAt': null,
      'createdAt': '2026-10-05T10:00:00.000Z',
    };

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  setUp(() {
    final g = GetIt.instance;
    _repo = _BillingRepo();
    void reg<T extends Object>(T v) {
      if (g.isRegistered<T>()) g.unregister<T>();
      g.registerSingleton<T>(v);
    }

    reg<BillingRepository>(_repo);
    reg<BranchRepository>(_BranchRepo());
    reg<StaffRepository>(_StaffRepo());
    reg<MemberRepository>(_MemberRepo());
  });

  Future<GoRouter> pumpApp(
    WidgetTester t,
    Widget screen, {
    List<String> perms = const ['billing:read', 'billing:manage'],
    Size size = const Size(560, 900),
  }) async {
    t.view.physicalSize = size * 3;
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);
    final session = _MockSession();
    when(() => session.state).thenReturn(
      SessionAuthenticatedStaff(
        UserProfile(
          id: 'me',
          tenantId: 't',
          name: 'Me',
          email: 'me@x.test',
          phone: null,
          status: 'ACTIVE',
          roles: const ['OWNER'],
          permissions: perms,
        ),
        _tenant,
      ),
    );
    final platform = _MockPlatform();
    when(() => platform.state)
        .thenReturn(const PlatformConfigState('Acme Fit'));
    Widget stub(String name) => Scaffold(body: Center(child: Text(name)));
    final router = GoRouter(
      initialLocation: '/start',
      routes: [
        GoRoute(path: '/', builder: (_, __) => stub('root')),
        GoRoute(path: '/start', builder: (_, __) => screen),
        GoRoute(
          path: AppRoutes.billingHistory,
          builder: (_, __) => stub('history-stub'),
        ),
        GoRoute(
          path: AppRoutes.billingInvoices,
          builder: (_, __) => stub('invoices-stub'),
        ),
        GoRoute(
          path: AppRoutes.billingAddress,
          builder: (_, __) => stub('address-stub'),
        ),
      ],
    );
    await t.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<SessionCubit>.value(value: session),
          BlocProvider<PlatformConfigCubit>.value(value: platform),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    return router;
  }

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> step(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
  }

  Future<void> scrollTo(WidgetTester t, Finder f) async {
    await t.scrollUntilVisible(
      f,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await t.ensureVisible(f);
    await t.pump();
  }

  group('narrow phone (360 dp)', () {
    const phone = Size(360, 780);

    testWidgets('hub, checkout sheet and cancel sheet do not overflow',
        (t) async {
      _repo.subscription = _sub(status: 'PAST_DUE', grace: true);
      await pumpApp(t, const BillingScreen(), size: phone);
      await settle(t);
      await scrollTo(t, find.text('Upgrade to Elite'));
      await t.tap(find.byKey(const ValueKey('plan-action-elite')));
      await step(t);
      expect(find.text('Switch to Elite'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.tapAt(const Offset(10, 10));
      await step(t);
      await t.drag(find.byType(Scrollable).first, const Offset(0, 4000));
      await t.pump();
      await t.tap(find.byKey(const ValueKey('billing-cancel')));
      await step(t);
      expect(find.text('Cancel immediately'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('lists and the address form do not overflow', (t) async {
      _repo.payments = [
        BillingPayment.fromJson(
          _pay(
            '1',
            'FAILED',
            '1499.00',
            '2026-10-10T12:00:00Z',
            failure: 'Card declined by the issuing bank, please contact them',
          ),
        ),
        BillingPayment.fromJson(
          _pay('2', 'SUCCEEDED', '1499.00', '2026-09-10T12:00:00Z'),
        ),
      ];
      _repo.invoiceList = [
        FitCloudInvoice.fromJson(_inv('1', 'UNCOLLECTIBLE', '123456.00')),
      ];
      for (final screen in const [
        BillingHistoryScreen(),
        BillingInvoicesScreen(),
        BillingAddressScreen(),
      ]) {
        await pumpApp(t, screen, size: phone);
        await settle(t);
        await t.drag(find.byType(Scrollable).first, const Offset(0, -3000));
        await t.pump();
        expect(t.takeException(), isNull);
        await t.pumpWidget(const SizedBox());
      }
    });
  });

  group('overview hub', () {
    testWidgets('hero, summary, details, usage, tiles and plans render',
        (t) async {
      await pumpApp(t, const BillingScreen());
      await settle(t);
      expect(find.text('Billing & Subscription'), findsOneWidget);
      // Dynamic platform name, never hard-coded.
      expect(
        find.text('Manage your Acme Fit plan, payment, and invoices.'),
        findsOneWidget,
      );
      expect(find.text('Current plan'), findsWidgets);
      expect(find.text('Status'), findsOneWidget);
      expect(find.text('Renews on'), findsWidgets);
      expect(find.text('Next amount'), findsOneWidget);
      expect(find.text('Change plan'), findsWidgets);
      expect(find.byKey(const ValueKey('billing-cancel')), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('billing-price')));
      expect(find.text('₹1,499'), findsWidgets);
      expect(find.text('/ month'), findsOneWidget);
      expect(find.textContaining('days remaining'), findsOneWidget);
      expect(find.textContaining('% of period used'), findsOneWidget);
      await scrollTo(t, find.text('Billing cycle'));
      expect(find.text('Monthly'), findsOneWidget);
      expect(find.text('Period started'), findsOneWidget);
      expect(find.text('Trial ends'), findsNothing);
      await scrollTo(t, find.text('Usage this cycle'));
      expect(find.text('2 / 3'), findsOneWidget);
      expect(find.text('17 / 20'), findsOneWidget);
      expect(find.text('500 / 500'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('billing-nav-address')));
      expect(find.text('Payment history'), findsOneWidget);
      expect(find.text('Invoices'), findsOneWidget);
      expect(find.text('Billing address'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('plan-starter')));
      expect(
        find.text('Tax is calculated at checkout from your billing address.'),
        findsOneWidget,
      );
      // Current plan has no action; others are Upgrade / Downgrade.
      expect(find.byKey(const ValueKey('plan-action-pro')), findsNothing);
      expect(find.text('Downgrade to Starter'), findsOneWidget);
      await scrollTo(t, find.text('Upgrade to Elite'));
      expect(find.textContaining('Save 17% billed yearly'), findsWidgets);
      expect(find.text('Elite excluded feature'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('gating is permission-independent, as before and as on web',
        (t) async {
      for (final perms in [
        const ['billing:read'],
        const ['billing:read', 'billing:manage'],
        const <String>[],
      ]) {
        await pumpApp(t, const BillingScreen(), perms: perms);
        await settle(t);
        expect(
          find.byKey(const ValueKey('billing-change-plan')),
          findsOneWidget,
        );
        expect(find.byKey(const ValueKey('billing-cancel')), findsOneWidget);
        await scrollTo(t, find.byKey(const ValueKey('billing-nav-address')));
        expect(
          find.byKey(const ValueKey('billing-nav-history')),
          findsOneWidget,
        );
        expect(
          find.byKey(const ValueKey('billing-nav-invoices')),
          findsOneWidget,
        );
        await scrollTo(t, find.text('Upgrade to Elite'));
        expect(find.byKey(const ValueKey('plan-action-elite')), findsOneWidget);
        expect(
          find.byKey(const ValueKey('plan-action-starter')),
          findsOneWidget,
        );
        await t.pumpWidget(const SizedBox());
      }
    });

    testWidgets('no subscription: empty state, Choose a plan, no hero actions',
        (t) async {
      _repo.subscription = null;
      await pumpApp(t, const BillingScreen());
      await settle(t);
      expect(find.text('No subscription yet'), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-cancel')), findsNothing);
      expect(find.byKey(const ValueKey('billing-change-plan')), findsNothing);
      await scrollTo(t, find.text('Choose a plan'));
      await scrollTo(t, find.text('Choose Elite'));
      expect(find.text('Choose Starter'), findsOneWidget);
    });

    testWidgets('cancel-at-period-end shows the notice and hides Next amount',
        (t) async {
      _repo.subscription = _sub(cancelAtPeriodEnd: true, grace: true);
      await pumpApp(t, const BillingScreen());
      await settle(t);
      expect(
        find.textContaining('This subscription will cancel on'),
        findsOneWidget,
      );
      expect(find.text('Ends on'), findsWidgets);
      expect(find.text('Next amount'), findsNothing);
      await scrollTo(t, find.text('Grace period ends'));
    });

    testWidgets('an ended subscription cannot be cancelled', (t) async {
      _repo.subscription = _sub(status: 'EXPIRED');
      await pumpApp(t, const BillingScreen());
      await settle(t);
      expect(find.byKey(const ValueKey('billing-change-plan')), findsOneWidget);
      expect(find.byKey(const ValueKey('billing-cancel')), findsNothing);
    });

    testWidgets('trial shows its end date', (t) async {
      _repo.subscription = _sub(status: 'TRIALING');
      await pumpApp(t, const BillingScreen());
      await settle(t);
      await scrollTo(t, find.text('Trial ends'));
    });

    testWidgets('load error shows the retry view', (t) async {
      _repo.subscriptionError = const ApiException(message: 'Boom');
      await pumpApp(t, const BillingScreen());
      await settle(t);
      expect(find.text('Boom'), findsOneWidget);
      _repo.subscriptionError = null;
      await t.tap(find.text('Try again'));
      await settle(t);
      expect(find.text('Boom'), findsNothing);
      expect(find.text('Billing & Subscription'), findsOneWidget);
    });

    testWidgets('section tiles navigate to the three sub-screens', (t) async {
      await pumpApp(t, const BillingScreen());
      await settle(t);
      for (final (key, stub) in [
        ('billing-nav-history', 'history-stub'),
        ('billing-nav-invoices', 'invoices-stub'),
        ('billing-nav-address', 'address-stub'),
      ]) {
        await scrollTo(t, find.byKey(ValueKey(key)));
        await t.tap(find.byKey(ValueKey(key)));
        await step(t);
        expect(find.text(stub), findsOneWidget);
        // Back to the hub.
        final nav = GoRouter.of(t.element(find.text(stub)));
        nav.pop();
        await step(t);
      }
    });

    testWidgets('cancel at period end calls the API and reloads', (t) async {
      await pumpApp(t, const BillingScreen());
      await settle(t);
      final before = _repo.subscriptionCalls;
      await t.tap(find.byKey(const ValueKey('billing-cancel')));
      await step(t);
      expect(find.text('Cancel at period end'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('cancel-period-end')));
      await step(t);
      expect(_repo.cancels, [false]);
      expect(
        find.text('Subscription will cancel at period end'),
        findsOneWidget,
      );
      expect(_repo.subscriptionCalls, before + 1);
    });

    testWidgets('cancel immediately, keep, and a server error', (t) async {
      await pumpApp(t, const BillingScreen());
      await settle(t);
      // Keep subscription: nothing happens.
      await t.tap(find.byKey(const ValueKey('billing-cancel')));
      await step(t);
      await t.tap(find.byKey(const ValueKey('cancel-keep')));
      await step(t);
      expect(_repo.cancels, isEmpty);

      _repo.cancelError = const ApiException(message: 'Not allowed');
      await t.tap(find.byKey(const ValueKey('billing-cancel')));
      await step(t);
      await t.tap(find.byKey(const ValueKey('cancel-now')));
      await step(t);
      expect(find.text('Cancel immediately?'), findsOneWidget);
      await t.tap(find.text('Yes, cancel now'));
      await step(t);
      expect(find.text('Not allowed'), findsOneWidget);
      expect(_repo.cancels, isEmpty);

      _repo.cancelError = null;
      await t.tap(find.byKey(const ValueKey('cancel-now')));
      await step(t);
      // Declining the confirmation sends nothing.
      await t.tap(find.text('Cancel').last);
      await step(t);
      expect(_repo.cancels, isEmpty);
      await t.tap(find.byKey(const ValueKey('cancel-now')));
      await step(t);
      await t.tap(find.text('Yes, cancel now'));
      await step(t);
      expect(_repo.cancels, [true]);
      expect(find.text('Subscription cancelled'), findsOneWidget);
    });

    testWidgets('checkout: cycle, coupon, confirm activates immediately',
        (t) async {
      await pumpApp(t, const BillingScreen());
      await settle(t);
      await scrollTo(t, find.text('Upgrade to Elite'));
      await t.tap(find.byKey(const ValueKey('plan-action-elite')));
      await step(t);
      expect(find.text('Switch to Elite'), findsOneWidget);
      expect(
        find.text(
          'Tax is calculated automatically from your billing address.',
        ),
        findsOneWidget,
      );
      expect(find.text('₹2,999.00'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('cycle-YEARLY')));
      await step(t);
      expect(find.text('₹29,990.00'), findsOneWidget);
      await t.enterText(find.byType(TextField), 'SAVE50');
      await step(t);
      await t.tap(find.byKey(const ValueKey('coupon-apply')));
      await step(t);
      expect(_repo.coupons, ['SAVE50']);
      expect(find.byKey(const ValueKey('checkout-discounted')), findsOneWidget);
      expect(find.text('₹14,995.00'), findsOneWidget);
      // Switching the cycle clears the stale discount.
      await t.tap(find.byKey(const ValueKey('cycle-MONTHLY')));
      await step(t);
      expect(find.byKey(const ValueKey('checkout-discounted')), findsNothing);
      await t.tap(find.byKey(const ValueKey('cycle-YEARLY')));
      await step(t);
      final before = _repo.subscriptionCalls;
      await t.tap(find.byKey(const ValueKey('checkout-confirm')));
      await step(t);
      expect(_repo.checkouts, [
        {
          'kind': 'upgrade',
          'planSlug': 'elite',
          'billingCycle': 'YEARLY',
          'couponCode': 'SAVE50',
        },
      ]);
      expect(find.text('Elite plan is now active'), findsOneWidget);
      expect(find.text('Switch to Elite'), findsNothing);
      expect(_repo.subscriptionCalls, before + 1);
    });

    testWidgets('checkout downgrade kind and a server error stay in the sheet',
        (t) async {
      _repo.checkoutError = const ApiException(message: 'Plan unavailable');
      await pumpApp(t, const BillingScreen());
      await settle(t);
      await scrollTo(t, find.text('Downgrade to Starter'));
      await t.tap(find.byKey(const ValueKey('plan-action-starter')));
      await step(t);
      expect(find.text('Confirm downgrade'), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('checkout-confirm')));
      await step(t);
      expect(find.text('Plan unavailable'), findsOneWidget);
      expect(find.text('Switch to Starter'), findsOneWidget);
    });

    testWidgets('tablet: full-bleed hero, three plan columns, no overflow',
        (t) async {
      await pumpApp(t, const BillingScreen(), size: const Size(1500, 1300));
      await settle(t);
      expect(find.text('Billing & Subscription'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('plan-starter')));
      final a = t.getTopLeft(find.byKey(const ValueKey('plan-starter')));
      final b = t.getTopLeft(find.byKey(const ValueKey('plan-pro')));
      final c = t.getTopLeft(find.byKey(const ValueKey('plan-elite')));
      expect(a.dy, b.dy);
      expect(b.dy, c.dy);
      expect(a.dx < b.dx && b.dx < c.dx, isTrue);
      // Content is capped and centred, not edge to edge.
      expect(a.dx, greaterThan(100));
      expect(t.takeException(), isNull);
    });
  });

  group('payment history', () {
    void seed() {
      _repo.payments = [
        BillingPayment.fromJson(
          _pay('3', 'SUCCEEDED', '1499.00', '2026-10-15T12:00:00Z'),
        ),
        BillingPayment.fromJson(
          _pay(
            '2',
            'FAILED',
            '1499.00',
            '2026-10-10T12:00:00Z',
            failure: 'Card declined',
          ),
        ),
        BillingPayment.fromJson(
          _pay('1', 'SUCCEEDED', '999.00', '2026-09-15T12:00:00Z'),
        ),
        BillingPayment.fromJson(
          _pay('0', 'PARTIALLY_REFUNDED', '100.00', '2026-08-15T12:00:00Z'),
        ),
      ];
    }

    testWidgets('hero, KPIs, chart, chips and cards render', (t) async {
      seed();
      await pumpApp(t, const BillingHistoryScreen());
      await settle(t);
      expect(find.text('Billing History'), findsOneWidget);
      expect(
        find.text('Every payment attempt for your Acme Fit subscription.'),
        findsOneWidget,
      );
      expect(find.text('₹2,498 paid'), findsOneWidget);
      expect(find.text('4 payments'), findsOneWidget);
      expect(find.text('Total paid'), findsOneWidget);
      expect(find.text('2 successful'), findsOneWidget);
      expect(find.text('Last payment'), findsOneWidget);
      expect(find.text('Failed attempts'), findsOneWidget);
      await scrollTo(t, find.text('Spend over time'));
      expect(find.text('Tap a bar for the exact amount'), findsOneWidget);
      await scrollTo(t, find.text('Payment attempts'));
      expect(find.text('All · 4'), findsOneWidget);
      expect(find.text('Succeeded · 2'), findsOneWidget);
      expect(find.text('Failed · 1'), findsOneWidget);
      expect(find.text('Refunded · 1'), findsOneWidget);
      expect(find.text('Pending · 0'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('payment-2')));
      expect(find.text('Card declined'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('filter chips narrow the list; refunded includes partial',
        (t) async {
      seed();
      await pumpApp(t, const BillingHistoryScreen());
      await settle(t);
      await scrollTo(t, find.text('Failed · 1'));
      await t.tap(find.text('Failed · 1'));
      await step(t);
      expect(find.byKey(const ValueKey('payment-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('payment-3')), findsNothing);
      await t.tap(find.text('Refunded · 1'));
      await step(t);
      expect(find.byKey(const ValueKey('payment-0')), findsOneWidget);
      await t.tap(find.text('Pending · 0'));
      await step(t);
      expect(find.text('No payments match this filter.'), findsOneWidget);
    });

    testWidgets('chart bar tap shows the exact amount', (t) async {
      seed();
      await pumpApp(t, const BillingHistoryScreen());
      await settle(t);
      await scrollTo(t, find.text('Spend over time'));
      await t.tap(find.text("Sep '26"));
      await step(t);
      expect(find.text("Sep '26 · Paid ₹999.00"), findsOneWidget);
    });

    testWidgets('empty and error states', (t) async {
      await pumpApp(t, const BillingHistoryScreen());
      await settle(t);
      expect(find.text('No payment attempts yet'), findsOneWidget);
      expect(find.text('No successful payments to chart yet.'), findsOneWidget);
      await t.pumpWidget(const SizedBox());

      _repo.paymentsError = const ApiException(message: 'Server down');
      await pumpApp(t, const BillingHistoryScreen());
      await settle(t);
      expect(find.text('Server down'), findsOneWidget);
    });

    testWidgets('tablet: two card columns, no overflow', (t) async {
      seed();
      await pumpApp(
        t,
        const BillingHistoryScreen(),
        size: const Size(1500, 1300),
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('payment-3')));
      final a = t.getTopLeft(find.byKey(const ValueKey('payment-3')));
      final b = t.getTopLeft(find.byKey(const ValueKey('payment-2')));
      expect(a.dy, b.dy);
      expect(a.dx < b.dx, isTrue);
      expect(t.takeException(), isNull);
    });
  });

  group('invoices', () {
    void seed() {
      _repo.invoiceList = [
        FitCloudInvoice.fromJson(_inv('1', 'PAID', '1499.00')),
        FitCloudInvoice.fromJson(_inv('2', 'OPEN', '999.00')),
        FitCloudInvoice.fromJson(_inv('3', 'VOID', '50.00')),
      ];
    }

    testWidgets('hero, KPIs, chips (only existing statuses) and cards',
        (t) async {
      seed();
      await pumpApp(t, const BillingInvoicesScreen());
      await settle(t);
      expect(find.text('Invoices'), findsWidgets);
      expect(find.text('Your Acme Fit subscription invoices.'), findsOneWidget);
      expect(find.text('3 invoices'), findsOneWidget);
      expect(find.text('₹999 outstanding'), findsOneWidget);
      expect(find.text('Total invoiced'), findsOneWidget);
      expect(find.text('Excludes draft & void'), findsOneWidget);
      expect(find.text('1 open'), findsOneWidget);
      await scrollTo(t, find.text('All · 3'));
      expect(find.text('Paid · 1'), findsOneWidget);
      expect(find.text('Open · 1'), findsOneWidget);
      expect(find.text('Void · 1'), findsOneWidget);
      // No chip for statuses that do not exist.
      expect(find.textContaining('Draft'), findsNothing);
      expect(find.textContaining('Uncollectible'), findsNothing);
      await scrollTo(t, find.byKey(const ValueKey('invoice-1')));
      expect(find.text('INV-1'), findsOneWidget);
      // Web's Download is dropped on mobile (no file-saving package).
      expect(find.text('Download'), findsNothing);
      await t.tap(find.text('Open · 1'));
      await step(t);
      expect(find.byKey(const ValueKey('invoice-2')), findsOneWidget);
      expect(find.byKey(const ValueKey('invoice-1')), findsNothing);
    });

    testWidgets('empty and error states', (t) async {
      await pumpApp(t, const BillingInvoicesScreen());
      await settle(t);
      expect(find.text('No invoices yet'), findsOneWidget);
      expect(
        find.text('They appear here after your first charge.'),
        findsOneWidget,
      );
      await t.pumpWidget(const SizedBox());

      _repo.invoicesError = const ApiException(message: 'Nope');
      await pumpApp(t, const BillingInvoicesScreen());
      await settle(t);
      expect(find.text('Nope'), findsOneWidget);
    });

    testWidgets('tablet: two card columns, no overflow', (t) async {
      seed();
      await pumpApp(
        t,
        const BillingInvoicesScreen(),
        size: const Size(1500, 1300),
      );
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('invoice-1')));
      final a = t.getTopLeft(find.byKey(const ValueKey('invoice-1')));
      final b = t.getTopLeft(find.byKey(const ValueKey('invoice-2')));
      expect(a.dy, b.dy);
      expect(t.takeException(), isNull);
    });
  });

  group('billing address', () {
    Finder field(String name) => find.descendant(
          of: find.byKey(ValueKey('address-$name')),
          matching: find.byType(TextField),
        );

    Future<void> fillValid(WidgetTester t) async {
      await t.enterText(field('line1'), '12 MG Road');
      await t.enterText(field('city'), 'Mumbai');
      await t.enterText(field('state'), 'Maharashtra');
      await t.enterText(field('postalCode'), '400001');
      await t.enterText(field('country'), 'in');
      await t.pump();
    }

    testWidgets('null address shows an empty form and the preview hint',
        (t) async {
      await pumpApp(t, const BillingAddressScreen());
      await settle(t);
      expect(find.text('Billing address'), findsWidgets);
      expect(
        find.text('The address and tax ID printed on your Acme Fit invoices.'),
        findsOneWidget,
      );
      await scrollTo(
        t,
        find.text('Start typing to preview your invoice address.'),
      );
      expect(t.takeException(), isNull);
    });

    testWidgets('required-field messages match web; nothing is sent',
        (t) async {
      await pumpApp(t, const BillingAddressScreen());
      await settle(t);
      await scrollTo(t, find.byKey(const ValueKey('address-save')));
      await t.tap(find.byKey(const ValueKey('address-save')));
      await step(t);
      expect(find.text('Address line 1 is required'), findsOneWidget);
      expect(find.text('City is required'), findsOneWidget);
      expect(find.text('State is required'), findsOneWidget);
      expect(find.text('Postal code is required'), findsOneWidget);
      expect(
        find.text('Use a 2-letter country code (e.g. US, IN, GB)'),
        findsOneWidget,
      );
      expect(_repo.saved, isEmpty);
    });

    testWidgets('saves a trimmed, upper-cased payload and shows the preview',
        (t) async {
      await pumpApp(t, const BillingAddressScreen());
      await settle(t);
      await fillValid(t);
      await t.enterText(field('legalName'), '  Kaushal Fitness  ');
      await t.enterText(field('taxId'), '27ABCDE1234F1Z5');
      await t.pump();
      await scrollTo(t, find.byKey(const ValueKey('address-preview')));
      expect(find.text('Kaushal Fitness'), findsWidgets);
      expect(find.text('Mumbai, Maharashtra 400001'), findsOneWidget);
      expect(find.text('Tax ID: 27ABCDE1234F1Z5'), findsOneWidget);
      await scrollTo(t, find.byKey(const ValueKey('address-save')));
      await t.tap(find.byKey(const ValueKey('address-save')));
      await step(t);
      expect(_repo.saved, [
        {
          'legalName': 'Kaushal Fitness',
          'line1': '12 MG Road',
          'line2': '',
          'city': 'Mumbai',
          'state': 'Maharashtra',
          'postalCode': '400001',
          'country': 'in',
          'taxId': '27ABCDE1234F1Z5',
        },
      ]);
      expect(find.text('Billing address saved'), findsOneWidget);
    });

    testWidgets('an existing address is prefilled; server error is shown',
        (t) async {
      _repo.address = const BillingAddress(
        legalName: 'Acme Gym LLP',
        line1: '1 Main St',
        line2: null,
        city: 'Pune',
        state: 'MH',
        postalCode: '411001',
        country: 'IN',
        taxId: null,
      );
      _repo.saveError = const ApiException(message: 'Invalid tax id');
      await pumpApp(t, const BillingAddressScreen());
      await settle(t);
      expect(find.text('Acme Gym LLP'), findsWidgets);
      await scrollTo(t, find.byKey(const ValueKey('address-save')));
      await t.tap(find.byKey(const ValueKey('address-save')));
      await step(t);
      expect(find.text('Invalid tax id'), findsOneWidget);
    });

    testWidgets('tablet: form and preview sit side by side', (t) async {
      await pumpApp(
        t,
        const BillingAddressScreen(),
        size: const Size(1500, 1300),
      );
      await settle(t);
      final form = t.getTopLeft(find.byKey(const ValueKey('address-line1')));
      final preview =
          t.getTopLeft(find.byKey(const ValueKey('address-preview')));
      expect(preview.dx, greaterThan(form.dx + 300));
      expect(t.takeException(), isNull);
    });
  });
}
