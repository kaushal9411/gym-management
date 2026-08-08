import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_top_bar.dart';
import '../../data/auth_repository.dart';
import '../../data/login_result.dart';

class OtpPage extends StatefulWidget {
  final String email;
  final String purpose;
  final String tenantSlug;

  const OtpPage({
    super.key,
    required this.email,
    required this.purpose,
    required this.tenantSlug,
  });

  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  final _codeController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<AuthRepository>().verifyOtp(
            email: widget.email,
            code: _codeController.text.trim(),
            purpose: widget.purpose,
            tenantSlug: widget.tenantSlug,
          );
      if (!mounted) return;
      if (result case LoginSuccess(user: final user)) {
        final tenant =
            (context.read<SessionCubit>().state as SessionNeedsLogin).tenant;
        context.read<SessionCubit>().authenticated(tenant, user);
        context.go('/dashboard');
      } else {
        setState(() => _error = 'Verification did not complete — try again.');
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
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: AppTopBar(
                caption: 'Security',
                title: 'Verify OTP',
                showBackButton: true,
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 20),
                    Icon(
                      Icons.shield_outlined,
                      color: colors.accent,
                      size: 34,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Verify it\'s you',
                      style: TextStyle(fontFamily: 'Bebas Neue', fontSize: 26),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      widget.purpose == '2fa'
                          ? "Enter the 6-digit code from your authenticator app"
                          : "Enter the 6-digit code we emailed to ${widget.email}",
                      style: TextStyle(fontSize: 13, color: colors.inkFaint),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    TextField(
                      controller: _codeController,
                      keyboardType: TextInputType.text,
                      textAlign: TextAlign.center,
                      maxLength: 24,
                      onSubmitted: (_) => _verify(),
                      style: const TextStyle(
                        fontFamily: 'Bebas Neue',
                        fontSize: 22,
                        letterSpacing: 6,
                      ),
                      decoration: const InputDecoration(counterText: ''),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        _error!,
                        style: TextStyle(color: colors.danger, fontSize: 13),
                      ),
                    ],
                    const SizedBox(height: 10),
                    ElevatedButton(
                      onPressed: _loading ? null : _verify,
                      child: _loading
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Verify & continue'),
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
