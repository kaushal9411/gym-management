import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Reproduces the design system's `.field` component exactly: a small
/// uppercase caption sitting ABOVE a plain bordered box, not Material's
/// floating-label-inside-the-border pattern. Every text input in the app
/// should go through this rather than `InputDecoration(labelText: …)`.
class AppLabeledField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Widget? suffixIcon;
  final ValueChanged<String>? onSubmitted;
  final bool readOnly;
  final int? maxLength;
  final TextAlign textAlign;
  final TextStyle? style;

  const AppLabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.suffixIcon,
    this.onSubmitted,
    this.readOnly = false,
    this.maxLength,
    this.textAlign = TextAlign.start,
    this.style,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: .8,
            color: colors.inkFaint,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: colors.surface2,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: colors.border),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            onSubmitted: onSubmitted,
            readOnly: readOnly,
            maxLength: maxLength,
            textAlign: textAlign,
            style: style ??
                const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            decoration: InputDecoration(
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
              suffixIcon: suffixIcon,
              counterText: '',
            ),
          ),
        ),
      ],
    );
  }
}
