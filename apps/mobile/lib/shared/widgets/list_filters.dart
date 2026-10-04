import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';

/// One option of a [FilterChipsRow]; [count] renders as "Label · 12" when
/// the server supplied it.
class FilterChipOption<T> {
  const FilterChipOption(this.value, this.label, {this.count});

  final T value;
  final String label;
  final int? count;
}

/// Horizontally scrolling single-select chips (status tabs, category and
/// audience filters). Same look as `AnalyticsPeriodChips`.
class FilterChipsRow<T> extends StatelessWidget {
  const FilterChipsRow({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelected,
    this.role = AppRole.staff,
  });

  /// Palette of the selected chip (member screens must pass `member`).
  final AppRole role;
  final List<FilterChipOption<T>> options;
  final T selected;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final o in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Material(
                color: Colors.transparent,
                child: ChoiceChip(
                  label: Text(
                    o.count == null ? o.label : '${o.label} · ${o.count}',
                  ),
                  selected: o.value == selected,
                  showCheckmark: false,
                  onSelected: (_) => onSelected(o.value),
                  backgroundColor: AppColors.surface2,
                  selectedColor: role.soft,
                  side: BorderSide(
                    color:
                        o.value == selected ? role.b : AppColors.line,
                  ),
                  labelStyle: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: o.value == selected
                        ? role.pillFg
                        : AppColors.inkSoft,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Search box that reports the trimmed text after a short pause, for
/// server-side `search` params.
class DebouncedSearchField extends StatefulWidget {
  const DebouncedSearchField({
    super.key,
    required this.hint,
    required this.onChanged,
    this.delay = const Duration(milliseconds: 400),
  });

  final String hint;
  final ValueChanged<String> onChanged;
  final Duration delay;

  @override
  State<DebouncedSearchField> createState() => _DebouncedSearchFieldState();
}

class _DebouncedSearchFieldState extends State<DebouncedSearchField> {
  final _controller = TextEditingController();
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _changed(String v) {
    _timer?.cancel();
    _timer = Timer(widget.delay, () => widget.onChanged(v.trim()));
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _controller,
      onChanged: _changed,
      textInputAction: TextInputAction.search,
      style: AppText.body(size: 13),
      decoration: InputDecoration(
        isDense: true,
        hintText: widget.hint,
        hintStyle: AppText.body(size: 13, color: AppColors.inkFaint),
        prefixIcon: const Icon(Icons.search_rounded, size: 18),
        suffixIcon: _controller.text.isEmpty
            ? null
            : IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                onPressed: () {
                  _controller.clear();
                  _timer?.cancel();
                  widget.onChanged('');
                  setState(() {});
                },
              ),
        filled: true,
        fillColor: AppColors.surface2,
        contentPadding: const EdgeInsets.symmetric(vertical: 10),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          borderSide: const BorderSide(color: AppColors.staffB),
        ),
      ),
    );
  }
}
