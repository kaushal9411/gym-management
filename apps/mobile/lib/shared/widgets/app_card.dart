import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';

/// `.card` — flat surface2 card, 20px radius, hairline border.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.opacity = 1,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: opacity,
      child: Container(
        width: double.infinity,
        padding: padding ?? const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line),
        ),
        child: child,
      ),
    );
  }
}

/// `.glass` — frosted glassmorphism surface (blur + translucent fill), used
/// for hero/status panels. `gradientOverlay` reproduces the design's
/// `linear-gradient(160deg, rgba(...))` tinted glass variant.
class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.padding,
    this.gradientOverlay,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Gradient? gradientOverlay;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.glass),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          width: double.infinity,
          padding: padding ?? const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.glassFill,
            gradient: gradientOverlay,
            borderRadius: BorderRadius.circular(AppRadii.glass),
            border: Border.all(color: borderColor ?? AppColors.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}
