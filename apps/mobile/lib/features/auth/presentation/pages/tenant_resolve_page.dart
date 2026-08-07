import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../core/errors/app_exception.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_labeled_field.dart';
import '../../../../widgets/brand_mark.dart';

class TenantResolvePage extends StatefulWidget {
  const TenantResolvePage({super.key});

  @override
  State<TenantResolvePage> createState() => _TenantResolvePageState();
}

class _TenantResolvePageState extends State<TenantResolvePage> {
  final _slugController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _slugController.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final slug = _slugController.text.trim();
    if (slug.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<SessionCubit>().resolveTenant(slug);
      if (mounted) context.go('/login');
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
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(flex: 3),
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colors.accentSoft,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Center(child: BrandMark(size: 30, color: colors.accent)),
              ),
              const SizedBox(height: 18),
              RichText(
                text: TextSpan(
                  style:
                      const TextStyle(fontFamily: 'Bebas Neue', fontSize: 34),
                  children: [
                    TextSpan(
                      text: 'Fit',
                      style: TextStyle(color: colors.accent),
                    ),
                    const TextSpan(
                      text: 'Cloud',
                      style: TextStyle(color: Colors.black),
                    ),
                  ],
                ),
              ),
              const Spacer(flex: 2),
              AppLabeledField(
                label: "Your gym's ID",
                controller: _slugController,
                textInputAction: TextInputAction.go,
                onSubmitted: (_) => _continue(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: TextStyle(color: colors.danger, fontSize: 13),
                ),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _loading ? null : _continue,
                  child: _loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Continue'),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                "Or scan the QR code on your welcome email",
                style: TextStyle(fontSize: 12, color: colors.inkFaint),
                textAlign: TextAlign.center,
              ),
              const Spacer(flex: 3),
            ],
          ),
        ),
      ),
    );
  }
}
