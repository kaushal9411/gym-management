import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/session/session_cubit.dart';
import 'package:gym_saas_mobile/features/auth/data/auth_repository.dart';
import 'package:gym_saas_mobile/features/auth/presentation/pages/tenant_resolve_page.dart';
import 'package:gym_saas_mobile/storage/secure_storage.dart';
import 'package:gym_saas_mobile/theme/app_theme.dart';
import 'package:mocktail/mocktail.dart';

class _MockAuthRepository extends Mock implements AuthRepository {}

class _MockSecureStorage extends Mock implements SecureStorage {}

void main() {
  testWidgets('TenantResolvePage renders the gym-ID field and Continue button',
      (tester) async {
    final sessionCubit =
        SessionCubit(_MockAuthRepository(), _MockSecureStorage());
    addTearDown(sessionCubit.close);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.staff,
        home: BlocProvider<SessionCubit>.value(
          value: sessionCubit,
          child: const TenantResolvePage(),
        ),
      ),
    );

    expect(find.text("YOUR GYM'S ID"), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Continue'), findsOneWidget);
  });
}
