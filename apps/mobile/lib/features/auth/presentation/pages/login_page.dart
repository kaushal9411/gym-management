import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_labeled_field.dart';
import '../../../../widgets/brand_mark.dart';
import '../../../../widgets/segmented_toggle.dart';
import '../../data/auth_repository.dart';
import '../../data/login_result.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;
  int _audience = 0; // 0 = Staff, 1 = Member

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit(String tenantSlug) async {
    if (_audience == 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Member sign-in is coming in a later phase — switch to Staff for now.',
          ),
        ),
      );
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<AuthRepository>().login(
            tenantSlug: tenantSlug,
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      switch (result) {
        case LoginSuccess(user: final user):
          final tenant =
              (context.read<SessionCubit>().state as SessionNeedsLogin).tenant;
          context.read<SessionCubit>().authenticated(tenant, user);
          context.go('/dashboard');
        case LoginOtpRequired(email: final email, purpose: final purpose):
          context.push(
            '/otp',
            extra: {
              'email': email,
              'purpose': purpose,
              'tenantSlug': tenantSlug,
            },
          );
        case LoginMfaSetupRequired():
          setState(
            () => _error =
                'Two-factor setup is required for this account — not yet available on mobile. Use the web portal to finish setup.',
          );
      }
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final sessionState = context.watch<SessionCubit>().state;
    final tenant =
        sessionState is SessionNeedsLogin ? sessionState.tenant : null;

    if (tenant == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 32),
              Column(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: colors.accentSoft,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: BrandMark(size: 26, color: colors.accent),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    tenant.name.toUpperCase(),
                    style: const TextStyle(
                      fontFamily: 'Bebas Neue',
                      fontSize: 24,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    '${tenant.slug}.fitcloud.app',
                    style: TextStyle(fontSize: 12, color: colors.inkFaint),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SegmentedToggle(
                options: const ['Staff', 'Member'],
                selectedIndex: _audience,
                onChanged: (i) => setState(() => _audience = i),
              ),
              const SizedBox(height: 20),
              AppLabeledField(
                label: 'Work email',
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Password',
                controller: _passwordController,
                obscureText: _obscure,
                onSubmitted: (_) => _submit(tenant.slug),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscure
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    size: 20,
                  ),
                  onPressed: () => setState(() => _obscure = !_obscure),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: TextStyle(color: colors.danger, fontSize: 13),
                ),
              ],
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loading ? null : () => _submit(tenant.slug),
                child: _loading
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Sign in'),
              ),
              const SizedBox(height: 14),
              Center(
                child: Text(
                  'Forgot password?',
                  style: TextStyle(
                    fontSize: 12,
                    color: colors.accent,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
