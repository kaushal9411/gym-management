import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/network/comm_failure.dart';
import 'package:gym_saas_mobile/core/routing/app_routes.dart';
import 'package:gym_saas_mobile/features/communications/presentation/automations_screen.dart';
import 'package:gym_saas_mobile/features/communications/presentation/communications_hub_screen.dart';
import 'package:gym_saas_mobile/features/communications/presentation/history_detail_screen.dart';
import 'package:gym_saas_mobile/features/communications/presentation/history_screen.dart';
import 'package:gym_saas_mobile/features/communications/presentation/send/send_flow_screen.dart';
import 'package:gym_saas_mobile/features/communications/presentation/widgets/comm_widgets.dart';
import 'package:gym_saas_mobile/models/comm_audience.dart';
import 'package:gym_saas_mobile/models/comm_automation.dart';
import 'package:gym_saas_mobile/models/comm_campaign.dart';
import 'package:gym_saas_mobile/models/comm_channel.dart';
import 'package:gym_saas_mobile/models/comm_overview.dart';
import 'package:gym_saas_mobile/models/comm_request.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';
import 'package:gym_saas_mobile/repositories/communications_repository.dart';
import 'package:gym_saas_mobile/repositories/membership_plan_repository.dart';
import 'package:mocktail/mocktail.dart';

import '../fixtures/comm_fixtures.dart';

class _Repo extends Mock implements CommunicationsRepository {}

class _Plans extends Mock implements MembershipPlanRepository {}

class _Branches extends Mock implements BranchRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _FakeRequest extends Fake implements CampaignRequest {}

const _tenant = TenantBranding(
  slug: 't',
  name: 'Kaushal Fitness',
  status: 'ACTIVE',
  maintenanceMode: false,
  primaryColor: '',
);

UserProfile _user(List<String> perms) => UserProfile(
      id: 'u',
      tenantId: 't',
      name: 'U',
      email: 'u@x.test',
      phone: null,
      status: 'ACTIVE',
      roles: const ['MANAGER'],
      permissions: perms,
    );

const _view = ['notifications:view'];
const _send = ['notifications:view', 'notifications:send'];
const _all = [
  'notifications:view',
  'notifications:send',
  'notifications:manage',
];

PaginatedResult<T> _page<T>(List<T> items, {int totalPages = 1, int total = -1}) =>
    PaginatedResult<T>(
      items: items,
      total: total < 0 ? items.length : total,
      page: 1,
      limit: 20,
      totalPages: totalPages,
    );

ApiException _api(int status, String code, String msg,
        {Map<String, dynamic>? data, String permission = 'notifications:send',}) =>
    CommFailure.from(
      ApiException.fromResponseData({
        'message': msg,
        'errors': [
          {'code': code, 'message': msg},
        ],
        'data': data,
      }, status,),
      permission: permission,
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(_FakeRequest());
    registerFallbackValue(AudienceMode.filters);
    registerFallbackValue(AudienceFilter.empty);
    registerFallbackValue(CampaignStatus.sent);
  });

  late _Repo repo;

  setUp(() {
    repo = _Repo();
    final g = GetIt.instance;
    if (g.isRegistered<CommunicationsRepository>()) g.unregister<CommunicationsRepository>();
    g.registerSingleton<CommunicationsRepository>(repo);
    if (g.isRegistered<MembershipPlanRepository>()) g.unregister<MembershipPlanRepository>();
    if (g.isRegistered<BranchRepository>()) g.unregister<BranchRepository>();
    final plans = _Plans();
    when(() => plans.listAll(includeDeleted: any(named: 'includeDeleted')))
        .thenAnswer((_) async => []);
    g.registerSingleton<MembershipPlanRepository>(plans);
    final branches = _Branches();
    when(branches.assignable).thenAnswer((_) async => []);
    g.registerSingleton<BranchRepository>(branches);

    when(() => repo.overview()).thenAnswer((_) async => overview());
    when(
      () => repo.previewAudience(
        mode: any(named: 'mode'),
        filter: any(named: 'filter'),
        pickedMemberIds: any(named: 'pickedMemberIds'),
        channels: any(named: 'channels'),
        title: any(named: 'title'),
        body: any(named: 'body'),
      ),
    ).thenAnswer((_) async => preview());
    when(
      () => repo.pickerMembers(
        search: any(named: 'search'),
        branchId: any(named: 'branchId'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => _page([
        PickerMember.fromJson(pickerJson('1', 'Aarav Kapoor')),
        PickerMember.fromJson(pickerJson('2', 'Diya Anand')),
      ]),
    );
    when(
      () => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey')),
    ).thenAnswer((_) async => CommCampaign.fromJson(campaignJson(id: 'new', status: 'SENDING', recipients: 412)));
    when(() => repo.automations()).thenAnswer((_) async => automations());
    when(
      () => repo.campaigns(
        status: any(named: 'status'),
        search: any(named: 'search'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer(
      (_) async => (
        page: _page([
          campaign(status: 'PARTIAL'),
          CommCampaign.fromJson(campaignJson(id: 'z', name: 'Open day', status: 'SENT', recipients: 20, sent: 20, failed: 0, skipped: 0, messages: 20)),
        ]),
        counts: const CampaignCounts(all: 2, sent: 1, partial: 1),
      ),
    );
    when(() => repo.campaign(any())).thenAnswer((_) async => CampaignDetail.fromJson(detailJson()));
    when(
      () => repo.recipients(
        any(),
        status: any(named: 'status'),
        channel: any(named: 'channel'),
        page: any(named: 'page'),
        limit: any(named: 'limit'),
      ),
    ).thenAnswer((i) async {
      final status = i.namedArguments[#status] as String?;
      return _page([
        if (status == null || status == 'FAILED') ...[
          CampaignRecipient.fromJson(recipientJson('1', 'Rohan T.')),
          CampaignRecipient.fromJson(recipientJson('2', 'Neha P.', channel: 'EMAIL', error: 'Mailbox full')),
        ],
        if (status == null || status == 'SKIPPED_OPTED_OUT')
          CampaignRecipient.fromJson(recipientJson('3', 'Kabir S.', status: 'SKIPPED_OPTED_OUT', error: 'Member opted out of SMS promotions')),
      ]);
    });
    when(() => repo.retryFailed(any())).thenAnswer(
      (_) async => (retried: 2, campaign: CommCampaign.fromJson(campaignJson(status: 'SENDING'))),
    );
    when(() => repo.cancelCampaign(any())).thenAnswer((_) async => campaign(status: 'CANCELLED'));
    when(
      () => repo.updateAutomation(
        any(),
        enabled: any(named: 'enabled'),
        channels: any(named: 'channels'),
        offsets: any(named: 'offsets'),
      ),
    ).thenAnswer((i) async => AutomationRule.fromJson(
          automationJson(
            i.positionalArguments.first as String,
            enabled: i.namedArguments[#enabled] as bool,
            offsets: (i.namedArguments[#offsets] as List<int>?) ?? const [],
            channels: [for (final c in i.namedArguments[#channels] as List<CommChannel>) c.api],
          ),
        ),);
    when(() => repo.testAutomation(any(), channels: any(named: 'channels'))).thenAnswer(
      (_) async => [
        const TestSendResult(channel: CommChannel.email, status: 'QUEUED', message: 'Queued to a***@x.com'),
      ],
    );
  });

  Future<void> pump(
    WidgetTester t,
    Widget child,
    List<String> perms, {
    Size size = const Size(360, 740),
    List<GoRoute> extraRoutes = const [],
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state).thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => child),
        GoRoute(
          path: AppRoutes.communicationsHistoryDetail,
          builder: (_, s) => Scaffold(body: Text('DETAIL ${s.extra}')),
        ),
        ...extraRoutes,
      ],
    );
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
  }

  // Looping hero/skeleton animations: pumpAndSettle would hang.
  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(milliseconds: 600));
    await t.pump(const Duration(seconds: 2));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 30 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  Future<void> tapText(WidgetTester t, String text) async {
    final f = find.text(text);
    await show(t, f);
    await t.tap(f.first);
    await t.pump();
    await t.pump(const Duration(milliseconds: 400));
  }

  // ── hub ──────────────────────────────────────────────────────────────

  group('hub', () {
    testWidgets('phone 360: quota header, three doors, recent sends', (t) async {
      await pump(t, const CommunicationsHubScreen(), _all);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Communications'), findsOneWidget);
      expect(find.text('SMS LEFT'), findsOneWidget);
      expect(find.text('240'), findsOneWidget);
      expect(find.text('3,790'), findsOneWidget);
      expect(find.text('Off'), findsOneWidget); // WhatsApp not on the plan
      expect(find.text('Send message'), findsOneWidget);
      expect(find.text('9 reminders · 8 on'), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
      await show(t, find.text('Extended closing time'));
      expect(find.text('Sending'), findsOneWidget);
      expect(find.text('2 failed'), findsOneWidget);
      expect(find.text('Sent'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(t, const CommunicationsHubScreen(), _all, size: const Size(1500, 1300));
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Renew before 31 Oct'), findsOneWidget);
    });

    testWidgets('view-only: send door is dimmed with a reason and does not open',
        (t) async {
      await pump(t, const CommunicationsHubScreen(), _view);
      await settle(t);
      expect(find.text('You need permission to send'), findsOneWidget);
      expect(find.text('Automations'), findsOneWidget);
      await t.tap(find.text('Send message'));
      await t.pump();
      expect(find.textContaining('notifications:send'), findsOneWidget);
    });

    testWidgets('without notifications:view: explains and makes no request', (t) async {
      await pump(t, const CommunicationsHubScreen(), const []);
      await settle(t);
      expect(find.text('No access to Communications'), findsOneWidget);
      verifyNever(() => repo.overview());
    });

    testWidgets('a failing overview shows a retry and the doors still work', (t) async {
      var fail = true;
      when(() => repo.overview()).thenAnswer((_) async {
        if (fail) throw ApiException.network();
        return overview();
      });
      await pump(t, const CommunicationsHubScreen(), _all);
      await settle(t);
      expect(find.textContaining("Can't reach the server"), findsOneWidget);
      expect(find.text('History'), findsOneWidget);
      fail = false;
      await t.tap(find.text('Retry'));
      await settle(t);
      expect(find.text('9 reminders · 8 on'), findsOneWidget);
    });

    testWidgets('empty recent list', (t) async {
      when(() => repo.overview()).thenAnswer(
        (_) async => CommOverview.fromJson(overviewJson(recent: [])),
      );
      await pump(t, const CommunicationsHubScreen(), _all);
      await settle(t);
      await show(t, find.text('No messages sent yet'));
      expect(find.text('No messages sent yet'), findsOneWidget);
    });
  });

  // ── send flow ────────────────────────────────────────────────────────

  group('send flow', () {
    Future<void> openFlow(WidgetTester t, {List<String> perms = _send, Size size = const Size(360, 740), SendFlowArgs? args}) async {
      await pump(t, SendFlowScreen(args: args), perms, size: size);
      await settle(t);
    }

    Future<void> next(WidgetTester t, String label) async {
      await t.tap(find.text(label));
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
    }

    Future<void> toMessage(WidgetTester t) async {
      await next(t, 'Next: Message');
    }

    Future<void> fillMessage(WidgetTester t) async {
      await t.enterText(find.byType(TextField).first, 'Hi {{firstName}}');
      await t.enterText(find.byType(TextField).at(1), 'We are open late.');
      await t.pump();
    }

    testWidgets('audience step at 360 and on a tablet, count in the dock', (t) async {
      await openFlow(t);
      expect(t.takeException(), isNull);
      expect(find.text('Who should get it?'), findsOneWidget);
      expect(find.text('By filters'), findsOneWidget);
      expect(find.text('Expiring in 7 days'), findsOneWidget);
      expect(find.text('412'), findsOneWidget);
      expect(find.text('Aarav K., Diya A. and 410 more'), findsOneWidget);
      expect(find.text('Next: Message'), findsOneWidget);
    });

    testWidgets('tablet 1500x1300 audience + review render without overflow', (t) async {
      await openFlow(t, size: const Size(1500, 1300));
      expect(t.takeException(), isNull);
      await toMessage(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('tapping a filter re-counts with that filter', (t) async {
      await openFlow(t);
      await t.tap(find.text('Overdue invoice'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      final f = verify(
        () => repo.previewAudience(
          mode: AudienceMode.filters,
          filter: captureAny(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      ).captured;
      expect((f.last as AudienceFilter).hasOverdueInvoice, isTrue);
    });

    testWidgets('hand-pick mode: search list, pick, select shown, clear', (t) async {
      await openFlow(t);
      await t.tap(find.text('Pick members'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump();
      expect(find.text('Aarav Kapoor'), findsOneWidget);
      expect(find.text('Diya Anand'), findsOneWidget);
      expect(find.text('Nobody picked yet. Tap members above.'), findsOneWidget);
      await t.tap(find.text('Aarav Kapoor'));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('PICKED'), findsOneWidget);
      await t.tap(find.text('Select shown'));
      await t.pump(const Duration(milliseconds: 500));
      // chips for both picked members
      expect(find.byIcon(Icons.close_rounded), findsWidgets);
      await t.tap(find.text('Clear'));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('Nobody picked yet. Tap members above.'), findsOneWidget);
      // Next with nobody picked explains instead of moving on.
      await t.tap(find.text('Next: Message'));
      await t.pump();
      expect(find.text('Pick at least one member.'), findsOneWidget);
      expect(find.text('What do you want to say?'), findsNothing);
    });

    testWidgets('search sends the typed text after the debounce', (t) async {
      await openFlow(t);
      await t.tap(find.text('Pick members'));
      await t.pump(const Duration(milliseconds: 500));
      await t.enterText(find.byType(TextField).first, 'aar');
      await t.pump(const Duration(milliseconds: 500));
      verify(
        () => repo.pickerMembers(
          search: 'aar',
          branchId: any(named: 'branchId'),
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).called(1);
    });

    testWidgets('a seeded member opens in pick mode (member screen action)', (t) async {
      await openFlow(t, args: SendFlowArgs(member: PickerMember.fromJson(pickerJson('9', 'Meera Rao'))));
      expect(find.text('Pick members'), findsOneWidget);
      expect(find.text('Meera Rao'), findsWidgets);
    });

    testWidgets('message step: required fields, unknown placeholder flagged inline', (t) async {
      await openFlow(t);
      await toMessage(t);
      expect(find.text('What do you want to say?'), findsOneWidget);
      await t.tap(find.text('Next: Channels'));
      await t.pump();
      expect(find.text('Add a title.'), findsOneWidget);
      expect(find.text('Write the message.'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'Hi {{nickname}}');
      await t.pump();
      expect(find.textContaining('Unknown placeholder {{nickname}}'), findsOneWidget);
      await t.enterText(find.byType(TextField).at(1), 'Body');
      await t.tap(find.text('Next: Channels'));
      await t.pump();
      expect(find.text('Where should it go?'), findsNothing);
      await t.enterText(find.byType(TextField).first, 'Hi {{firstName}}');
      await t.pump();
      expect(find.textContaining('Unknown placeholder'), findsNothing);
    });

    testWidgets('message step: placeholder chip inserts at the cursor, preview fills it', (t) async {
      await openFlow(t);
      await toMessage(t);
      await show(t, find.byType(TextField).first);
      await t.tap(find.byType(TextField).first);
      await t.pump();
      await show(t, find.text('{{firstName}}'));
      await t.tap(find.text('{{firstName}}'));
      await t.pump();
      expect((t.widget<TextField>(find.byType(TextField).first).controller!.text), '{{firstName}}');
      await show(t, find.text('PREVIEW'));
      expect(find.text('Aarav'), findsOneWidget); // first real sample member
    });

    testWidgets('message step: title over 200 characters is refused', (t) async {
      await openFlow(t);
      await toMessage(t);
      await t.enterText(find.byType(TextField).first, 'a' * 201);
      await t.pump();
      expect(find.textContaining('at most 200'), findsOneWidget);
    });

    testWidgets('channels step: over-limit SMS turns red and blocks Next', (t) async {
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      expect(find.text('Where should it go?'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.tap(find.text('SMS'));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('Only 240 left, you need 380'), findsOneWidget);
      expect(find.textContaining('SMS would go over the limit'), findsOneWidget);
      await t.tap(find.text('Next: Review'));
      await t.pump();
      expect(find.text('Ready to send?'), findsNothing);
      // The plan has WhatsApp off: locked, with the reason.
      expect(find.textContaining('Not available: not included in your plan'), findsOneWidget);
      await t.tap(find.text('SMS'));
      await t.pump(const Duration(milliseconds: 500));
      await next(t, 'Next: Review');
      expect(find.text('Ready to send?'), findsOneWidget);
    });

    testWidgets('channels step shows who will actually receive it', (t) async {
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      await t.tap(find.text('Email'));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.textContaining('388 will receive · 12 opted out'), findsOneWidget);
    });

    testWidgets('review: large send needs the confirm box; then one request', (t) async {
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      await next(t, 'Next: Review');
      expect(find.text('Ready to send?'), findsOneWidget);
      expect(find.text('Send to 412'), findsOneWidget);
      expect(find.text('All active members'), findsOneWidget);
      expect(find.text('Push and In-app'), findsOneWidget);
      expect(find.textContaining('More than 100 people'), findsOneWidget);
      // Without the tick nothing is sent.
      await t.tap(find.text('Send to 412'));
      await t.pump();
      expect(find.text('Tick the box to confirm this large send.'), findsOneWidget);
      verifyNever(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey')));
      await t.tap(find.text('I checked the audience and message'));
      await t.pump();
      await t.tap(find.text('Send to 412'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      final cap = verify(() => repo.createCampaign(captureAny(), idempotencyKey: captureAny(named: 'idempotencyKey'))).captured;
      expect((cap[0] as CampaignRequest).confirmLargeSend, isTrue);
      expect(cap[1], isNotNull);
      // Success replaces the flow with the campaign detail.
      expect(find.text('DETAIL new'), findsOneWidget);
    });

    testWidgets('review: API quota error comes back as a specific message on Channels', (t) async {
      when(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey'))).thenAnswer(
        (_) async => throw _api(409, 'QUOTA_EXCEEDED', 'x', data: {
          'shortChannels': [
            {'channel': 'PUSH', 'remaining': 10, 'wouldUse': 390, 'shortBy': 380},
          ],
        },),
      );
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      await next(t, 'Next: Review');
      await t.tap(find.text('I checked the audience and message'));
      await t.pump();
      await t.tap(find.text('Send to 412'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(find.text('Where should it go?'), findsOneWidget);
      expect(find.textContaining('Push: only 10 left this month'), findsWidgets);
    });

    testWidgets('review: a network failure keeps the message and says it will not double send', (t) async {
      when(() => repo.createCampaign(any(), idempotencyKey: any(named: 'idempotencyKey')))
          .thenAnswer((_) async => throw ApiException.network());
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      await next(t, 'Next: Review');
      await t.tap(find.text('I checked the audience and message'));
      await t.pump();
      await t.tap(find.text('Send to 412'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 600));
      expect(find.textContaining("Can't reach the server"), findsOneWidget);
      expect(find.textContaining('will not be sent twice'), findsOneWidget);
      expect(find.text('Ready to send?'), findsOneWidget);
      // Button is usable again (loading flag reset).
      expect(find.text('Send to 412'), findsOneWidget);
    });

    testWidgets('review: schedule shows the picked time in the button', (t) async {
      await openFlow(t);
      await toMessage(t);
      await fillMessage(t);
      await next(t, 'Next: Channels');
      await next(t, 'Next: Review');
      expect(find.text('Choose date and time'), findsOneWidget);
    });

    testWidgets('leaving with a written message asks first', (t) async {
      await openFlow(t);
      await toMessage(t);
      await t.enterText(find.byType(TextField).first, 'Draft title');
      await t.pump();
      // Go back to step 1 then leave.
      await t.tap(find.text('Back').last);
      await t.pump(const Duration(milliseconds: 400));
      await t.tap(find.byTooltip('Back'));
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Discard this message?'), findsOneWidget);
      await t.tap(find.text('Cancel'));
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('Who should get it?'), findsOneWidget);
    });

    testWidgets('without notifications:send the flow explains instead of opening', (t) async {
      await openFlow(t, perms: _view);
      expect(find.text("You can't send messages"), findsOneWidget);
      verifyNever(
        () => repo.previewAudience(
          mode: any(named: 'mode'),
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      );
    });

    testWidgets('a failed audience count shows Retry on the audience step', (t) async {
      when(
        () => repo.previewAudience(
          mode: any(named: 'mode'),
          filter: any(named: 'filter'),
          pickedMemberIds: any(named: 'pickedMemberIds'),
          channels: any(named: 'channels'),
          title: any(named: 'title'),
          body: any(named: 'body'),
        ),
      ).thenAnswer((_) async => throw _api(429, 'RATE_LIMITED', 'Too many requests.'));
      await openFlow(t);
      expect(find.textContaining('too quickly'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });

  // ── automations ──────────────────────────────────────────────────────

  group('automations', () {
    testWidgets('360: rules, timing summary, switches', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Automations'), findsOneWidget);
      expect(find.text('Membership expiring'), findsOneWidget);
      expect(find.text('7, 3, 1 days before'), findsOneWidget);
      expect(find.text('4 reminders · 3 on'), findsOneWidget);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(t, const AutomationsScreen(), _all, size: const Size(1500, 1300));
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Birthday'), findsOneWidget);
    });

    testWidgets('a switch saves immediately with the rule\'s own timing and channels', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.bySemanticsLabel('Membership expiring on or off'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 300));
      final cap = verify(
        () => repo.updateAutomation(
          'MEMBERSHIP_EXPIRING',
          enabled: captureAny(named: 'enabled'),
          channels: captureAny(named: 'channels'),
          offsets: captureAny(named: 'offsets'),
        ),
      ).captured;
      expect(cap[0], false);
      expect(cap[1], [CommChannel.push, CommChannel.email]);
      expect(cap[2], [7, 3, 1]);
    });

    testWidgets('a failing switch tells why and leaves the switch alone', (t) async {
      when(
        () => repo.updateAutomation(any(),
            enabled: any(named: 'enabled'), channels: any(named: 'channels'), offsets: any(named: 'offsets'),),
      ).thenAnswer((_) async => throw _api(403, 'FORBIDDEN', 'x', permission: 'notifications:manage'));
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.bySemanticsLabel('Membership expiring on or off'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('notifications:manage'), findsOneWidget);
    });

    testWidgets('view-only: note shown, switches locked, sheet read-only', (t) async {
      await pump(t, const AutomationsScreen(), _view);
      await settle(t);
      expect(find.textContaining('You can view automations but not change them'), findsOneWidget);
      await t.tap(find.byType(CommSwitch).first);
      await t.pump();
      verifyNever(
        () => repo.updateAutomation(any(),
            enabled: any(named: 'enabled'), channels: any(named: 'channels'), offsets: any(named: 'offsets'),),
      );
      // The tap on a locked switch falls through to the card: details open.
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('Save'), findsNothing);
      expect(find.text('Send test to me'), findsNothing);
      expect(find.text('7 days before'), findsOneWidget);
    });

    testWidgets('edit sheet: toggle timing and channel, Save sends sorted offsets', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.text('Membership expiring'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.text('7 days before'), findsOneWidget);
      expect(find.text('+ Add'), findsOneWidget);
      await t.tap(find.text('3 days')); // turn 3 off
      await t.tap(find.text('SMS')); // add SMS
      await t.pump();
      await t.ensureVisible(find.text('Save'));
      await t.tap(find.text('Save'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 500));
      final cap = verify(
        () => repo.updateAutomation(
          'MEMBERSHIP_EXPIRING',
          enabled: true,
          channels: captureAny(named: 'channels'),
          offsets: captureAny(named: 'offsets'),
        ),
      ).captured;
      expect(cap[0], [CommChannel.push, CommChannel.email, CommChannel.sms]);
      expect(cap[1], [1, 7]);
      expect(find.text('Membership expiring saved.'), findsOneWidget);
    });

    testWidgets('edit sheet: no timing selected is refused before the request', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.text('Membership expiring'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      await t.tap(find.text('7 days before'));
      await t.tap(find.text('3 days'));
      await t.tap(find.text('1 day'));
      await t.pump();
      await t.ensureVisible(find.text('Save'));
      await t.tap(find.text('Save'));
      await t.pump();
      expect(find.text('Choose when to send (at least one timing).'), findsOneWidget);
      verifyNever(
        () => repo.updateAutomation(any(),
            enabled: any(named: 'enabled'), channels: any(named: 'channels'), offsets: any(named: 'offsets'),),
      );
    });

    testWidgets('edit sheet: server field error shows under the group', (t) async {
      when(
        () => repo.updateAutomation(any(),
            enabled: any(named: 'enabled'), channels: any(named: 'channels'), offsets: any(named: 'offsets'),),
      ).thenAnswer((_) async => throw CommFailure.from(ApiException.fromResponseData({
            'message': 'Request Validation Failed',
            'errors': [
              {'field': 'offsets', 'code': 'VALIDATION_ERROR', 'message': 'Timings must be between 1 and 60.'},
            ],
          }, 422,),),);
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.text('Membership expiring'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      await t.ensureVisible(find.text('Save'));
      await t.tap(find.text('Save'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 300));
      expect(find.text('Timings must be between 1 and 60.'), findsOneWidget);
    });

    testWidgets('edit sheet: Send test shows the masked destination', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await t.tap(find.text('Membership expiring'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      await t.ensureVisible(find.text('Send test to me'));
      await t.tap(find.text('Send test to me'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 300));
      expect(find.textContaining('Queued to a***@x.com'), findsOneWidget);
      final cap = verify(() => repo.testAutomation('MEMBERSHIP_EXPIRING', channels: captureAny(named: 'channels'))).captured;
      expect(cap.single, [CommChannel.push, CommChannel.email]);
    });

    testWidgets('fixed-timing rule shows its timing as text; unavailable channel warns', (t) async {
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      await show(t, find.text('Birthday'));
      await t.tap(find.text('Birthday'));
      await t.pump(const Duration(milliseconds: 500));
      await t.pump(const Duration(milliseconds: 500));
      expect(find.textContaining('This timing is fixed'), findsOneWidget);
      expect(find.textContaining('SMS is not included in your plan'), findsOneWidget);
    });

    testWidgets('load failure shows retry', (t) async {
      when(() => repo.automations()).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const AutomationsScreen(), _all);
      await settle(t);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  // ── history ──────────────────────────────────────────────────────────

  group('history', () {
    testWidgets('list: hero, status chips with counts, cards', (t) async {
      await pump(t, const HistoryScreen(), _view);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('History'), findsOneWidget);
      expect(find.text('2 sends'), findsOneWidget);
      expect(find.text('Diwali timings'), findsOneWidget);
      expect(find.text('Open day'), findsOneWidget);
      expect(find.text('All · 2'), findsOneWidget);
    });

    testWidgets('tablet', (t) async {
      await pump(t, const HistoryScreen(), _view, size: const Size(1500, 1300));
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('status chip filters on the server', (t) async {
      await pump(t, const HistoryScreen(), _view);
      await settle(t);
      await t.tap(find.text('Sending · 0'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 300));
      verify(
        () => repo.campaigns(
          status: CampaignStatus.sending,
          search: any(named: 'search'),
          page: any(named: 'page'),
          limit: any(named: 'limit'),
        ),
      ).called(1);
    });

    testWidgets('empty and error states', (t) async {
      when(
        () => repo.campaigns(status: any(named: 'status'), search: any(named: 'search'), page: any(named: 'page'), limit: any(named: 'limit')),
      ).thenAnswer((_) async => (page: _page<CommCampaign>([]), counts: const CampaignCounts()));
      await pump(t, const HistoryScreen(), _view);
      await settle(t);
      expect(find.text('No messages sent yet'), findsOneWidget);
    });

    testWidgets('error shows retry', (t) async {
      when(
        () => repo.campaigns(status: any(named: 'status'), search: any(named: 'search'), page: any(named: 'page'), limit: any(named: 'limit')),
      ).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const HistoryScreen(), _view);
      await settle(t);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('no permission: explains, no request', (t) async {
      await pump(t, const HistoryScreen(), const []);
      await settle(t);
      expect(find.text('No access to History'), findsOneWidget);
      verifyNever(() => repo.campaigns(status: any(named: 'status'), search: any(named: 'search'), page: any(named: 'page'), limit: any(named: 'limit')));
    });
  });

  group('history detail', () {
    testWidgets('360: delivered summary, legend, channel breakdown, recipients', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('34'), findsOneWidget);
      expect(find.textContaining('of 38 delivered'), findsOneWidget);
      expect(find.text('failed'), findsOneWidget);
      await show(t, find.text('Rohan T.'));
      expect(find.text('SMS · Phone number is not valid'), findsOneWidget);
      expect(t.takeException(), isNull);
    });

    testWidgets('tablet', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all, size: const Size(1500, 1300));
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('Failed filter asks the server for FAILED only', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      await tapText(t, 'Failed');
      verify(
        () => repo.recipients('c1', status: 'FAILED', channel: any(named: 'channel'), page: any(named: 'page'), limit: any(named: 'limit')),
      ).called(1);
      expect(find.text('Kabir S.'), findsNothing);
    });

    testWidgets('Skipped filter uses the reason', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      await tapText(t, 'Skipped');
      verify(
        () => repo.recipients('c1', status: 'SKIPPED_OPTED_OUT', channel: any(named: 'channel'), page: any(named: 'page'), limit: any(named: 'limit')),
      ).called(1);
    });

    testWidgets('Send again to failed only: confirm, then one request', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      await tapText(t, 'Send again to failed only');
      expect(find.text('Send again to failed only?'), findsOneWidget);
      await t.tap(find.text('Send again'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      verify(() => repo.retryFailed('c1')).called(1);
      expect(find.text('Retrying 2 messages.'), findsOneWidget);
    });

    testWidgets('a 409 on retry shows the server wording', (t) async {
      when(() => repo.retryFailed(any())).thenAnswer((_) async => throw _api(409, 'INVALID_STATE', 'Nothing failed to retry.'));
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      await tapText(t, 'Send again to failed only');
      await t.tap(find.text('Send again'));
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      expect(find.textContaining('Nothing failed to retry.'), findsOneWidget);
    });

    testWidgets('view-only: no retry or cancel buttons', (t) async {
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _view);
      await settle(t);
      expect(find.text('Send again to failed only'), findsNothing);
      expect(find.text('Cancel send'), findsNothing);
    });

    testWidgets('a scheduled campaign can be cancelled', (t) async {
      when(() => repo.campaign(any())).thenAnswer((_) async => CampaignDetail.fromJson(detailJson(status: 'SCHEDULED')));
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      await tapText(t, 'Cancel send');
      await t.tap(find.text('Cancel send').last);
      await t.pump();
      await t.pump(const Duration(milliseconds: 400));
      verify(() => repo.cancelCampaign('c1')).called(1);
    });

    testWidgets('load failure shows retry', (t) async {
      when(() => repo.campaign(any())).thenAnswer((_) async => throw ApiException.network());
      await pump(t, const HistoryDetailScreen(campaignId: 'c1'), _all);
      await settle(t);
      expect(find.text('Try again'), findsOneWidget);
    });
  });
}
