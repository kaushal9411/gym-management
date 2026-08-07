import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? backgroundColor;
  final Color? borderColor;

  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.backgroundColor,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? colors.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor ?? colors.border),
      ),
      child: child,
    );
  }
}
