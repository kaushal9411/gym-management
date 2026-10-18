import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/bloc/session/session_state.dart';
import 'package:gym_saas_mobile/bloc/theme/theme_cubit.dart';
import 'package:gym_saas_mobile/core/network/api_exception.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/features/settings/presentation/ai_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/appearance_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/branding_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/business_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/gym_profile_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/gym_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/invoice_settings_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/security_policy_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/sessions_screen.dart';
import 'package:gym_saas_mobile/features/settings/presentation/settings_ui.dart';
import 'package:gym_saas_mobile/features/team/presentation/widgets/team_ui.dart';
import 'package:gym_saas_mobile/models/business_hours.dart';
import 'package:gym_saas_mobile/models/gym_branding.dart';
import 'package:gym_saas_mobile/models/gym_business_settings.dart';
import 'package:gym_saas_mobile/models/gym_email_notification_settings.dart';
import 'package:gym_saas_mobile/models/gym_profile.dart';
import 'package:gym_saas_mobile/models/tenant_ai_settings.dart';
import 'package:gym_saas_mobile/models/tenant_branding.dart';
import 'package:gym_saas_mobile/models/user_profile.dart';
import 'package:gym_saas_mobile/models/user_session.dart';
import 'package:gym_saas_mobile/repositories/auth_repository.dart';
import 'package:gym_saas_mobile/repositories/gym_settings_repository.dart';
import 'package:mocktail/mocktail.dart';

class _Repo extends Mock implements GymSettingsRepository {}

class _Auth extends Mock implements AuthRepository {}

class _Session extends MockCubit<SessionState> implements SessionCubit {}

class _Storage implements SecureStorage {
  String? mode;

  @override
  Future<String?> readThemeMode() async => mode;

  @override
  Future<void> saveThemeMode(String value) async => mode = value;

  @override
  dynamic noSuchMethod(Invocation i) => super.noSuchMethod(i);
}

const _tenant = TenantBranding(
  slug: 't',
  name: 'T',
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
      roles: const ['OWNER'],
      permissions: perms,
    );

const _read = ['settings:read'];
const _manage = ['settings:read', 'settings:manage'];

GymProfile _profile() => GymProfile(
      gymName: 'Iron Forge',
      legalBusinessName: 'Iron Forge LLP',
      email: 'a@b.test',
      phone: '9999',
      website: null,
      addressLine: '1 Main St',
      city: 'Bengaluru',
      state: 'KA',
      country: 'India',
      postalCode: '560001',
      businessType: 'Fitness Center',
      latitude: 12.97,
      longitude: 77.59,
      businessHours: BusinessHours.fromJson({
        'monday': {'open': '06:00', 'close': '22:00', 'closed': false},
        'sunday': {'open': null, 'close': null, 'closed': true},
      }),
      socialLinks: const SocialLinks(instagram: 'https://i.test'),
    );

GymBusinessSettings _business() => const GymBusinessSettings(
      currency: 'INR',
      currencySymbol: '₹',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      measurementUnit: MeasurementUnit.metric,
      weekStartDay: 1,
      locale: 'en',
    );

GymBranding _branding() => const GymBranding(
      logoUrl: null,
      primaryColor: '#4f46e5',
      secondaryColor: '',
      theme: 'SYSTEM',
      welcomeMessage: 'Welcome',
    );

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    registerFallbackValue(const BusinessHours());
    registerFallbackValue(
      const GymNotificationSettings(
        email: false,
        push: false,
        sms: false,
        whatsapp: false,
      ),
    );
    registerFallbackValue(MeasurementUnit.metric);
  });

  late _Repo repo;
  late _Auth auth;

  setUp(() {
    invalidateSetupProgress();
    repo = _Repo();
    auth = _Auth();
    final g = GetIt.instance;
    if (g.isRegistered<GymSettingsRepository>()) {
      g.unregister<GymSettingsRepository>();
    }
    if (g.isRegistered<AuthRepository>()) g.unregister<AuthRepository>();
    g.registerSingleton<GymSettingsRepository>(repo);
    g.registerSingleton<AuthRepository>(auth);
    when(() => repo.getProfile()).thenAnswer((_) async => _profile());
    when(() => repo.getBusinessSettings()).thenAnswer((_) async => _business());
    when(() => repo.getBranding()).thenAnswer((_) async => _branding());
    when(() => repo.getInvoiceSettings()).thenAnswer(
      (_) async => const GymInvoiceSettings(
        invoicePrefix: 'INV',
        invoiceFooter: 'Thanks!',
        taxPercentage: 18,
        defaultPaymentTermsDays: 7,
      ),
    );
    when(() => repo.getSecuritySettings()).thenAnswer(
      (_) async => const GymSecuritySettings(mfaRequiredRoles: ['OWNER']),
    );
    when(() => repo.getEmailSettings()).thenAnswer(
      (_) async => const GymEmailSettings(
        emailFromName: 'Iron Forge',
        emailFromAddress: 'hi@forge.test',
      ),
    );
    when(() => repo.getNotificationSettings()).thenAnswer(
      (_) async => const GymNotificationSettings(
        email: true,
        push: false,
        sms: false,
        whatsapp: false,
      ),
    );
    when(() => repo.getAiSettings()).thenAnswer(
      (_) async => const TenantAiSettings(),
    );
    when(
      () => repo.updateProfile(
        gymName: any(named: 'gymName'),
        legalBusinessName: any(named: 'legalBusinessName'),
        registrationNumber: any(named: 'registrationNumber'),
        gstVatNumber: any(named: 'gstVatNumber'),
        businessType: any(named: 'businessType'),
        description: any(named: 'description'),
      ),
    ).thenAnswer((_) async => _profile());
    when(
      () => repo.updateContact(
        email: any(named: 'email'),
        phone: any(named: 'phone'),
        alternatePhone: any(named: 'alternatePhone'),
        website: any(named: 'website'),
        addressLine: any(named: 'addressLine'),
        city: any(named: 'city'),
        state: any(named: 'state'),
        country: any(named: 'country'),
        postalCode: any(named: 'postalCode'),
        latitude: any(named: 'latitude'),
        longitude: any(named: 'longitude'),
      ),
    ).thenAnswer((_) async => _profile());
    when(() => repo.updateBusinessHours(any()))
        .thenAnswer((_) async => _profile());
    when(
      () => repo.updateSocialLinks(
        facebook: any(named: 'facebook'),
        instagram: any(named: 'instagram'),
        twitter: any(named: 'twitter'),
        youtube: any(named: 'youtube'),
        linkedin: any(named: 'linkedin'),
      ),
    ).thenAnswer((_) async => _profile());
    when(
      () => repo.updateBusinessSettings(
        currency: any(named: 'currency'),
        currencySymbol: any(named: 'currencySymbol'),
        timezone: any(named: 'timezone'),
        dateFormat: any(named: 'dateFormat'),
        timeFormat: any(named: 'timeFormat'),
        measurementUnit: any(named: 'measurementUnit'),
        weekStartDay: any(named: 'weekStartDay'),
        locale: any(named: 'locale'),
      ),
    ).thenAnswer((_) async => _business());
    when(
      () => repo.updateEmailSettings(
        emailFromName: any(named: 'emailFromName'),
        emailFromAddress: any(named: 'emailFromAddress'),
      ),
    ).thenAnswer((_) async => const GymEmailSettings());
    when(() => repo.updateNotificationSettings(any())).thenAnswer(
      (i) async => i.positionalArguments.first as GymNotificationSettings,
    );
    when(
      () => repo.updateBranding(
        primaryColor: any(named: 'primaryColor'),
        secondaryColor: any(named: 'secondaryColor'),
        theme: any(named: 'theme'),
        welcomeMessage: any(named: 'welcomeMessage'),
      ),
    ).thenAnswer((_) async => _branding());
    when(
      () => repo.updateInvoiceSettings(
        invoicePrefix: any(named: 'invoicePrefix'),
        taxPercentage: any(named: 'taxPercentage'),
        defaultPaymentTermsDays: any(named: 'defaultPaymentTermsDays'),
        invoiceFooter: any(named: 'invoiceFooter'),
      ),
    ).thenAnswer(
      (_) async => const GymInvoiceSettings(
        invoicePrefix: 'INV',
        invoiceFooter: null,
        taxPercentage: 18,
        defaultPaymentTermsDays: 7,
      ),
    );
    when(() => repo.updateSecuritySettings(any())).thenAnswer(
      (i) async => GymSecuritySettings(
        mfaRequiredRoles: (i.positionalArguments.first as List).cast<String>(),
      ),
    );
    when(
      () => repo.updateAiSettings(
        provider: any(named: 'provider'),
        model: any(named: 'model'),
        baseUrl: any(named: 'baseUrl'),
        temperature: any(named: 'temperature'),
        maxTokens: any(named: 'maxTokens'),
        apiKey: any(named: 'apiKey'),
      ),
    ).thenAnswer(
      (_) async => const TenantAiSettings(usingPlatformDefault: false),
    );
    when(() => repo.resetAiSettings()).thenAnswer((_) async {});
  });

  Future<void> pump(
    WidgetTester t,
    Widget child,
    List<String> perms, {
    Size size = const Size(360, 740),
  }) async {
    t.view.physicalSize = size * 2;
    t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    final session = _Session();
    when(() => session.state)
        .thenReturn(SessionAuthenticatedStaff(_user(perms), _tenant));
    await t.pumpWidget(
      BlocProvider<SessionCubit>.value(
        value: session,
        child: MaterialApp(home: child),
      ),
    );
  }

  Future<void> settle(WidgetTester t) async {
    await t.pump();
    await t.pump(const Duration(seconds: 3));
  }

  Future<void> show(WidgetTester t, Finder f) async {
    for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
      await t.drag(find.byType(Scrollable).first, const Offset(0, -300));
      await t.pump();
    }
    await t.ensureVisible(f.first);
    await t.pump();
  }

  group('hub', () {
    testWidgets('shows setup progress and one card per page', (t) async {
      await pump(t, const GymSettingsScreen(), _read);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Gym Settings'), findsOneWidget);
      expect(find.text('Setup progress'), findsOneWidget);
      for (final title in [
        'Gym profile',
        'Business',
        'Branding',
        'Invoice',
        'Security',
        'AI assistant',
        'Sessions',
      ]) {
        await show(t, find.text(title));
        expect(find.text(title), findsWidgets, reason: title);
      }
    });

    testWidgets('without settings:read: message and no requests', (t) async {
      await pump(t, const GymSettingsScreen(), const []);
      await settle(t);
      expect(find.text('No access to settings'), findsOneWidget);
      verifyNever(() => repo.getProfile());
    });

    testWidgets('setup progress is computed only from saved settings',
        (t) async {
      final p = await loadSetupProgress();
      // profile + hours + branding + mfa + invoice = 5 items
      expect(p.items.map((i) => i.key), [
        'profile',
        'hours',
        'branding',
        'mfa',
        'invoice',
      ]);
      expect(p.items.last.fraction, 1); // prefix set + tax > 0
      expect(p.items[3].detail, '1/4 roles');
      invalidateSetupProgress();
      when(() => repo.getBranding()).thenAnswer((_) async => throw Exception());
      final q = await loadSetupProgress();
      expect(q.items.map((i) => i.key), isNot(contains('branding')));
    });
  });

  group('profile', () {
    testWidgets('phone 360 renders its sections; no save bar until edited',
        (t) async {
      await pump(t, const GymProfileSettingsScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      for (final s in [
        'Basic information',
        'Contact information',
        'Social media links',
        'Weekly opening hours',
        'Business card',
      ]) {
        await show(t, find.text(s));
        expect(find.text(s), findsOneWidget, reason: s);
      }
      await show(t, find.text('Business hours'));
      expect(find.text('Business hours'), findsWidgets);
      expect(find.text('Save changes'), findsNothing);
    });

    testWidgets('tablet 1500x1300 renders without overflow', (t) async {
      await pump(
        t,
        const GymProfileSettingsScreen(),
        _manage,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });

    testWidgets('editing shows the save bar; saving fires all four writes',
        (t) async {
      await pump(t, const GymProfileSettingsScreen(), _manage);
      await settle(t);
      await t.enterText(find.byType(TextField).first, 'New Gym');
      await t.pump();
      expect(find.text('Save changes'), findsOneWidget);
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateProfile(
          gymName: 'New Gym',
          legalBusinessName: 'Iron Forge LLP',
          registrationNumber: '',
          gstVatNumber: '',
          businessType: 'Fitness Center',
          description: '',
        ),
      ).called(1);
      verify(
        () => repo.updateContact(
          email: 'a@b.test',
          phone: '9999',
          alternatePhone: '',
          website: '',
          addressLine: '1 Main St',
          city: 'Bengaluru',
          state: 'KA',
          country: 'India',
          postalCode: '560001',
          latitude: 12.97,
          longitude: 77.59,
        ),
      ).called(1);
      verify(() => repo.updateBusinessHours(any())).called(1);
      verify(
        () => repo.updateSocialLinks(
          facebook: '',
          instagram: 'https://i.test',
          twitter: '',
          youtube: '',
          linkedin: '',
        ),
      ).called(1);
    });

    testWidgets('gym name is required (web rule)', (t) async {
      await pump(t, const GymProfileSettingsScreen(), _manage);
      await settle(t);
      await t.enterText(find.byType(TextField).first, '');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(find.text('Gym name is required.'), findsOneWidget);
      verifyNever(
        () => repo.updateProfile(
          gymName: any(named: 'gymName'),
          legalBusinessName: any(named: 'legalBusinessName'),
          registrationNumber: any(named: 'registrationNumber'),
          gstVatNumber: any(named: 'gstVatNumber'),
          businessType: any(named: 'businessType'),
          description: any(named: 'description'),
        ),
      );
    });

    testWidgets('read-only without settings:manage: notice, no save bar',
        (t) async {
      await pump(t, const GymProfileSettingsScreen(), _read);
      await settle(t);
      expect(
        find.text('You can view these settings but not change them.'),
        findsOneWidget,
      );
      await t.enterText(find.byType(TextField).first, 'Changed');
      await t.pump();
      expect(find.text('Save changes'), findsNothing);
    });

    testWidgets('without settings:read: message, no request', (t) async {
      await pump(t, const GymProfileSettingsScreen(), const []);
      await settle(t);
      expect(find.text('No access to settings'), findsOneWidget);
      verifyNever(() => repo.getProfile());
    });

    testWidgets('a failed load shows the server message with Retry', (t) async {
      when(() => repo.getProfile()).thenAnswer(
        (_) async => throw const ApiException(message: 'Nope', statusCode: 500),
      );
      await pump(t, const GymProfileSettingsScreen(), _manage);
      await settle(t);
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('business', () {
    testWidgets('loads the three resources and saves them together', (t) async {
      await pump(t, const BusinessSettingsScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      verify(() => repo.getBusinessSettings()).called(greaterThanOrEqualTo(1));
      verify(() => repo.getEmailSettings()).called(1);
      verify(() => repo.getNotificationSettings()).called(1);
      await t.enterText(find.byType(TextField).at(1), '\$');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateBusinessSettings(
          currency: 'INR',
          currencySymbol: '\$',
          timezone: 'Asia/Kolkata',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          measurementUnit: MeasurementUnit.metric,
          weekStartDay: 1,
          locale: 'en',
        ),
      ).called(1);
      verify(
        () => repo.updateEmailSettings(
          emailFromName: 'Iron Forge',
          emailFromAddress: 'hi@forge.test',
        ),
      ).called(1);
      verify(() => repo.updateNotificationSettings(any())).called(1);
    });

    testWidgets('currency and timezone are required', (t) async {
      await pump(t, const BusinessSettingsScreen(), _manage);
      await settle(t);
      await t.enterText(find.byType(TextField).first, '');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(find.text('Currency and timezone are required.'), findsOneWidget);
    });

    testWidgets('a channel switch marks the form dirty', (t) async {
      await pump(t, const BusinessSettingsScreen(), _manage);
      await settle(t);
      await show(t, find.text('Push notifications'));
      await t.tap(
        find.descendant(
          of: find.widgetWithText(TeamToggleRow, 'Push notifications'),
          matching: find.byType(GestureDetector),
        ),
      );
      await t.pump();
      expect(find.text('Save changes'), findsOneWidget);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(
        t,
        const BusinessSettingsScreen(),
        _manage,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });
  });

  group('branding', () {
    testWidgets(
        'renders colours, images and the preview; secondary colour '
        'and message are left out when blank', (t) async {
      when(() => repo.getBranding()).thenAnswer(
        (_) async => const GymBranding(
          logoUrl: null,
          primaryColor: '#4f46e5',
          secondaryColor: '',
          theme: 'SYSTEM',
          welcomeMessage: '',
        ),
      );
      await pump(t, const BrandingSettingsScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      await show(t, find.text('Dark'));
      await t.tap(find.text('Dark'));
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateBranding(
          primaryColor: '#4f46e5',
          secondaryColor: '',
          theme: 'DARK',
          welcomeMessage: '',
        ),
      ).called(1);
      await show(t, find.text('Branding preview'));
      expect(find.text('Branding preview'), findsOneWidget);
    });

    testWidgets('image upload buttons are disabled without settings:manage',
        (t) async {
      await pump(t, const BrandingSettingsScreen(), _read);
      await settle(t);
      await show(t, find.text('Gym logo'));
      final b = t.widget<OutlinedButton>(find.byType(OutlinedButton).first);
      expect(b.onPressed, isNull);
    });

    testWidgets('tablet renders without overflow', (t) async {
      await pump(
        t,
        const BrandingSettingsScreen(),
        _manage,
        size: const Size(1500, 1300),
      );
      await settle(t);
      expect(t.takeException(), isNull);
    });
  });

  group('invoice', () {
    testWidgets('prefix is required; tax and terms are validated', (t) async {
      await pump(t, const InvoiceSettingsScreen(), _manage);
      await settle(t);
      await t.enterText(find.byType(TextField).first, '');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(find.text('Invoice prefix is required.'), findsOneWidget);
      await t.enterText(find.byType(TextField).first, 'INV');
      await t.enterText(find.byType(TextField).at(1), '150');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(
        find.text('Tax percentage must be between 0 and 100.'),
        findsOneWidget,
      );
    });

    testWidgets('saves the trimmed values', (t) async {
      await pump(t, const InvoiceSettingsScreen(), _manage);
      await settle(t);
      await t.enterText(find.byType(TextField).first, 'GYM');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateInvoiceSettings(
          invoicePrefix: 'GYM',
          taxPercentage: 18,
          defaultPaymentTermsDays: 7,
          invoiceFooter: 'Thanks!',
        ),
      ).called(1);
    });
  });

  group('security', () {
    testWidgets('toggling a role saves the complete set', (t) async {
      await pump(t, const SecurityPolicyScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('1 role requires 2FA'), findsOneWidget);
      await t.tap(find.text('Manager'));
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      final sent = verify(() => repo.updateSecuritySettings(captureAny()))
          .captured
          .single as List;
      expect(sent.toSet(), {'OWNER', 'MANAGER'});
    });

    testWidgets('read-only without settings:manage', (t) async {
      await pump(t, const SecurityPolicyScreen(), _read);
      await settle(t);
      await t.tap(find.text('Manager'));
      await t.pump();
      expect(find.text('Save changes'), findsNothing);
      expect(find.text('How 2FA works'), findsOneWidget);
    });
  });

  group('AI', () {
    testWidgets('platform default state, saves temperature and clears nothing',
        (t) async {
      await pump(t, const AiSettingsScreen(), _manage);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Source: Platform'), findsOneWidget);
      await show(t, find.text('Temperature (0–2)'));
      await t.enterText(find.byType(TextField).at(3), '1.2');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateAiSettings(
          provider: '',
          model: '',
          baseUrl: '',
          temperature: 1.2,
          maxTokens: null,
          apiKey: null,
        ),
      ).called(1);
    });

    testWidgets('temperature outside 0-2 is refused', (t) async {
      await pump(t, const AiSettingsScreen(), _manage);
      await settle(t);
      await show(t, find.text('Temperature (0–2)'));
      await t.enterText(find.byType(TextField).at(3), '3');
      await t.pump();
      await t.tap(find.text('Save changes'));
      await t.pump();
      expect(find.text('Temperature must be between 0 and 2.'), findsOneWidget);
    });

    testWidgets('a saved key is never shown; it can be cleared', (t) async {
      when(() => repo.getAiSettings()).thenAnswer(
        (_) async => const TenantAiSettings(
          provider: 'openai',
          model: 'gpt',
          hasApiKey: true,
          apiKeyMasked: 'sk-…1234',
          usingPlatformDefault: false,
        ),
      );
      await pump(t, const AiSettingsScreen(), _manage);
      await settle(t);
      expect(find.text('Source: Your own'), findsOneWidget);
      await show(t, find.text('Clear stored key'));
      await t.tap(find.text('Clear stored key'));
      await t.pump();
      await t.tap(find.text('Save changes'));
      await settle(t);
      verify(
        () => repo.updateAiSettings(
          provider: 'openai',
          model: 'gpt',
          baseUrl: '',
          temperature: null,
          maxTokens: null,
          apiKey: '',
        ),
      ).called(1);
    });

    testWidgets('a plan without the AI module shows the server message',
        (t) async {
      when(() => repo.getAiSettings()).thenAnswer(
        (_) async => throw const ApiException(
          message: 'This module is currently unavailable.',
          statusCode: 403,
        ),
      );
      await pump(t, const AiSettingsScreen(), _manage);
      await settle(t);
      expect(
        find.textContaining('This module is currently unavailable.'),
        findsWidgets,
      );
      expect(find.text('Try again'), findsOneWidget);
    });
  });

  group('sessions', () {
    testWidgets('lists devices; signing out asks first', (t) async {
      when(() => auth.listSessions()).thenAnswer(
        (_) async => [
          UserSession(
            id: 's1',
            deviceLabel: 'Pixel 8',
            ipAddress: '1.1.1.1',
            userAgent: 'Android',
            lastActiveAt: DateTime.now(),
            isCurrent: true,
          ),
          UserSession(
            id: 's2',
            deviceLabel: 'Chrome on Mac',
            ipAddress: '2.2.2.2',
            userAgent: 'Mac',
            lastActiveAt: DateTime.now().subtract(const Duration(hours: 3)),
            isCurrent: false,
          ),
        ],
      );
      when(() => auth.logoutDevice(any())).thenAnswer((_) async {});
      await pump(t, const SessionsScreen(), _read);
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('This device'), findsOneWidget);
      expect(find.text('2 active devices'), findsOneWidget);
      await t.ensureVisible(find.text('Sign out'));
      await t.pump();
      await t.tap(find.text('Sign out'));
      await settle(t);
      expect(find.text('Sign out this device?'), findsOneWidget);
      verifyNever(() => auth.logoutDevice(any()));
      await t.tap(find.text('Sign out').last);
      await settle(t);
      verify(() => auth.logoutDevice('s2')).called(1);
    });
  });

  group('appearance', () {
    testWidgets('three previews; choosing one changes the theme', (t) async {
      final cubit = ThemeCubit(_Storage());
      addTearDown(cubit.close);
      t.view.physicalSize = const Size(720, 1480);
      t.view.devicePixelRatio = 2;
      addTearDown(t.view.reset);
      await t.pumpWidget(
        BlocProvider<ThemeCubit>.value(
          value: cubit,
          child: const MaterialApp(home: AppearanceScreen()),
        ),
      );
      await settle(t);
      expect(t.takeException(), isNull);
      expect(find.text('Light'), findsWidgets);
      expect(find.text('Dark'), findsWidgets);
      expect(find.text('System'), findsOneWidget);
      await t.tap(find.text('System'));
      await settle(t);
      expect(cubit.state, ThemeMode.system);
      cubit.setMode(ThemeMode.dark);
    });
  });
}
