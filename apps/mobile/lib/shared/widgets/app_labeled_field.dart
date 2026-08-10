import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// `.field label` (11px, 800 weight, uppercase, wide tracking, faint) +
/// `.field input` (surface2 fill, 14px radius, hairline border).
class AppLabeledField extends StatefulWidget {
  const AppLabeledField({
    super.key,
    required this.label,
    required this.controller,
    this.obscureText = false,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.errorText,
    this.autofillHints,
    this.onSubmitted,
    this.textInputAction,
    this.autofocus = false,
    this.inputFormatters,
    this.readOnly = false,
    this.onTap,
    this.suffixIcon,
  });

  final String label;
  final TextEditingController controller;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final String? errorText;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final TextInputAction? textInputAction;
  final bool autofocus;
  final List<TextInputFormatter>? inputFormatters;

  /// Makes this a tap-to-open trigger (date pickers, etc.) instead of a
  /// normal editable field — the caret/keyboard never shows.
  final bool readOnly;
  final VoidCallback? onTap;
  final Widget? suffixIcon;

  @override
  State<AppLabeledField> createState() => _AppLabeledFieldState();
}

class _AppLabeledFieldState extends State<AppLabeledField> {
  bool _obscured = true;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(widget.label, style: AppText.eyebrow()),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.field),
            border:
                Border.all(color: hasError ? AppColors.danger : AppColors.line),
          ),
          child: TextField(
            controller: widget.controller,
            obscureText: _obscured,
            keyboardType: widget.keyboardType,
            textCapitalization: widget.textCapitalization,
            autofillHints: widget.autofillHints,
            onSubmitted: widget.onSubmitted,
            textInputAction: widget.textInputAction,
            autofocus: widget.autofocus,
            inputFormatters: widget.inputFormatters,
            readOnly: widget.readOnly,
            onTap: widget.onTap,
            showCursor: widget.readOnly ? false : null,
            style: AppText.body(size: 15, weight: FontWeight.w600),
            cursorColor: AppColors.memberB,
            decoration: InputDecoration(
              isDense: true,
              filled: false,
              border: InputBorder.none,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              suffixIcon: widget.obscureText
                  ? IconButton(
                      icon: Icon(
                        _obscured
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                        size: 18,
                        color: AppColors.inkFaint,
                      ),
                      onPressed: () => setState(() => _obscured = !_obscured),
                    )
                  : widget.suffixIcon,
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 2),
            child: Text(
              widget.errorText!,
              style: AppText.body(
                size: 12,
                color: AppColors.danger,
                weight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}
