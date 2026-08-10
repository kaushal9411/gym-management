import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';

/// The rounded gradient FitCloud glyph used on Splash/Find Gym, and the
/// white-glass initials bubble used once a specific gym is resolved
/// (`kaushalgym` → "KF"), exactly as in the design's login/splash frames.
class BrandMark extends StatelessWidget {
  const BrandMark.glyph({super.key, required this.role, this.size = 84})
      : initials = null,
        _glass = false;

  const BrandMark.initials({
    super.key,
    required this.initials,
    this.role = AppRole.staff,
    this.size = 68,
  }) : _glass = true;

  final AppRole role;
  final double size;
  final String? initials;
  final bool _glass;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.31;
    if (_glass) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.white, Color(0xFFE4DCFF)],
          ),
          borderRadius: BorderRadius.circular(radius),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66000000),
              blurRadius: 28,
              offset: Offset(0, 14),
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          initials ?? '',
          style: AppText.display(
            size: size * 0.2,
            color: role.b,
            weight: FontWeight.w800,
          ),
        ),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: role.gradient,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: role.glow,
            blurRadius: 40,
            offset: const Offset(0, 20),
            spreadRadius: -10,
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Icon(
        Icons.fitness_center_rounded,
        size: size * 0.42,
        color: role.onGradient,
      ),
    );
  }
}
