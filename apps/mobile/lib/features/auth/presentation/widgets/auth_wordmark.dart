import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

/// `.wordmark` — "Fit" rendered in the role's gradient (`background-clip:
/// text` in CSS; Flutter equivalent is a `ShaderMask`), "Cloud" in plain ink.
class AuthWordmark extends StatelessWidget {
  const AuthWordmark({super.key, required this.role, this.size = 32});

  final AppRole role;
  final double size;

  @override
  Widget build(BuildContext context) {
    final style = AppText.display(size: size, weight: FontWeight.w800);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        ShaderMask(
          shaderCallback: (bounds) => role.gradient.createShader(bounds),
          child: Text('Fit', style: style.copyWith(color: Colors.white)),
        ),
        Text('Cloud', style: style.copyWith(color: AppColors.ink)),
      ],
    );
  }
}
