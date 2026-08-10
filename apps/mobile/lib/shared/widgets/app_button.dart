import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

enum AppButtonVariant { roleGradient, ghost }

enum AppButtonSize { regular, small }

/// `.btn` / `.btn-staff` / `.btn-member` / `.btn-ghost` / `.btn-sm` — the
/// gradient CTA (glow shadow included), and the flat surface3 secondary.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.role = AppRole.staff,
    this.variant = AppButtonVariant.roleGradient,
    this.size = AppButtonSize.regular,
    this.fullWidth = true,
    this.loading = false,
    this.icon,
    this.foregroundColor,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppRole role;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final bool fullWidth;
  final bool loading;
  final IconData? icon;
  final Color? foregroundColor;

  bool get _isSmall => size == AppButtonSize.small;

  @override
  Widget build(BuildContext context) {
    final height = _isSmall ? 32.0 : 38.0;
    final radius = _isSmall ? AppRadii.buttonSm : AppRadii.button;
    final isGhost = variant == AppButtonVariant.ghost;
    final disabled = onPressed == null || loading;

    final child = Row(
      mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: isGhost ? AppColors.ink : role.onGradient,
            ),
          )
        else ...[
          if (icon != null) ...[
            Icon(
              icon,
              size: _isSmall ? 14 : 16,
              color: foregroundColor ??
                  (isGhost ? AppColors.ink : role.onGradient),
            ),
            const SizedBox(width: 6),
          ],
          Text(
            label,
            style: AppText.body(
              size: _isSmall ? 11 : 12,
              weight: FontWeight.w700,
              color: foregroundColor ??
                  (isGhost ? AppColors.ink : role.onGradient),
            ),
          ),
        ],
      ],
    );

    final decoration = isGhost
        ? BoxDecoration(
            color: AppColors.surface3,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: AppColors.line),
          )
        : BoxDecoration(
            gradient: role.gradient,
            borderRadius: BorderRadius.circular(radius),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: role.glow,
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                      spreadRadius: -6,
                    ),
                    const BoxShadow(
                      color: Color(0x59000000),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
          );

    return Opacity(
      opacity: disabled && !loading ? 0.5 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(radius),
          onTap: disabled ? null : onPressed,
          child: Container(
            height: height,
            width: fullWidth ? double.infinity : null,
            padding: EdgeInsets.symmetric(horizontal: _isSmall ? 12 : 14),
            decoration: decoration,
            alignment: Alignment.center,
            child: child,
          ),
        ),
      ),
    );
  }
}
