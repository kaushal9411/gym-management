import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import 'app_labeled_field.dart';

/// Dropdown-style field: looks like [AppLabeledField], opens a bottom sheet
/// of (value, label) options. Stores the wire value, shows the label.
class OptionPickerField extends StatefulWidget {
  const OptionPickerField({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onChanged,
    this.hintText,
    this.icon,
    this.iconColor,
  });

  final String label;
  final List<(String, String)> options;
  final String? value;
  final ValueChanged<String?> onChanged;
  final String? hintText;
  final IconData? icon;
  final Color? iconColor;

  @override
  State<OptionPickerField> createState() => _OptionPickerFieldState();
}

class _OptionPickerFieldState extends State<OptionPickerField> {
  late final TextEditingController _controller =
      TextEditingController(text: _labelFor(widget.value));

  String _labelFor(String? v) {
    for (final o in widget.options) {
      if (o.$1 == v) return o.$2;
    }
    return '';
  }

  @override
  void didUpdateWidget(OptionPickerField old) {
    super.didUpdateWidget(old);
    final text = _labelFor(widget.value);
    if (_controller.text != text) _controller.text = text;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.75,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 6),
                child: Text(widget.label, style: AppText.display(size: 17)),
              ),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final o in widget.options)
                      ListTile(
                        title: Text(o.$2),
                        trailing: o.$1 == widget.value
                            ? const Icon(
                                Icons.check_rounded,
                                color: Color(0xFF8B5CF6),
                              )
                            : null,
                        onTap: () => Navigator.of(ctx).pop(o.$1),
                      ),
                    if (widget.value != null)
                      ListTile(
                        title: Text(
                          'Clear',
                          style: TextStyle(color: AppColors.inkFaint),
                        ),
                        onTap: () => Navigator.of(ctx).pop(''),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (picked == null) return;
    widget.onChanged(picked.isEmpty ? null : picked);
  }

  @override
  Widget build(BuildContext context) {
    return AppLabeledField(
      label: widget.label,
      hintText: widget.hintText ?? 'Select',
      icon: widget.icon,
      iconColor: widget.iconColor,
      controller: _controller,
      readOnly: true,
      onTap: _open,
      suffixIcon: Icon(
        Icons.keyboard_arrow_down_rounded,
        color: AppColors.inkFaint,
      ),
    );
  }
}
