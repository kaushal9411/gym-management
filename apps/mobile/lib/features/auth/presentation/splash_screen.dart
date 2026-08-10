import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../core/theme/app_colors.dart';
import '../../../shared/widgets/brand_mark.dart';
import 'widgets/auth_wordmark.dart';

/// Design frame "1. Splash" — kicks off session restore from secure
/// storage; the router's redirect takes over as soon as [SessionCubit]
/// emits anything other than [SessionUnknown].
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionCubit>().restore();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandMark.glyph(role: AppRole.staff, size: 84),
            const SizedBox(height: 20),
            const AuthWordmark(role: AppRole.staff, size: 32),
            const SizedBox(height: 24),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _Dot(active: true, role: AppRole.staff),
                const SizedBox(width: 6),
                const _Dot(active: false),
                const SizedBox(width: 6),
                const _Dot(active: false),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.active, this.role = AppRole.staff});

  final bool active;
  final AppRole role;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 7,
      height: 7,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active ? role.a : AppColors.inkFaint.withValues(alpha: 0.4),
      ),
    );
  }
}
