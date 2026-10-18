import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/motion.dart';
import 'rpt_theme.dart';

/// One entry of a [RptLegend].
class RptLegendItem {
  const RptLegendItem({
    required this.key,
    required this.label,
    required this.color,
    this.dashed = false,
    this.value,
  });

  final String key;
  final String label;
  final Color color;

  /// Dashed swatch — the previous-period series.
  final bool dashed;

  /// Optional figure shown after the label (e.g. a total).
  final String? value;
}

/// Chart legend. With [onToggle] each item is a button that hides / shows
/// its series ([hidden] holds the keys currently off) — web's click-to-hide.
class RptLegend extends StatelessWidget {
  const RptLegend({
    super.key,
    required this.items,
    this.hidden = const {},
    this.onToggle,
  });

  final List<RptLegendItem> items;
  final Set<String> hidden;
  final ValueChanged<String>? onToggle;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      runSpacing: 4,
      children: [
        for (final it in items)
          _LegendChip(
            item: it,
            off: hidden.contains(it.key),
            onTap: onToggle == null ? null : () => onToggle!(it.key),
          ),
      ],
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.item, required this.off, this.onTap});

  final RptLegendItem item;
  final bool off;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final swatch = item.dashed
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++) ...[
                Container(
                  width: 4,
                  height: 3,
                  decoration: BoxDecoration(
                    color: item.color,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                if (i < 2) const SizedBox(width: 2),
              ],
            ],
          )
        : Container(
            width: 14,
            height: 4,
            decoration: BoxDecoration(
              color: item.color,
              borderRadius: BorderRadius.circular(3),
            ),
          );
    return Semantics(
      button: onTap != null,
      selected: !off,
      label: item.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          onTap: onTap,
          child: Opacity(
            opacity: off ? 0.38 : 1,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  swatch,
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.inkSoft,
                      ).copyWith(
                        decoration: off ? TextDecoration.lineThrough : null,
                      ),
                    ),
                  ),
                  if (item.value != null) ...[
                    const SizedBox(width: 6),
                    Text(
                      item.value!,
                      style: AppText.tabular(
                        size: 12,
                        weight: FontWeight.w800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One option of a [RptSegmented].
class RptSegment<T> {
  const RptSegment(this.value, this.label, {this.icon});

  final T value;
  final String label;
  final IconData? icon;
}

/// Animated pill switcher (web's `SegmentedTabs`): Daily / Weekly /
/// Cumulative, Members / Revenue, ... The selected pill fills with [color].
/// Scrolls horizontally when it does not fit.
class RptSegmented<T> extends StatelessWidget {
  const RptSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.color = RptColors.violet,
    this.small = true,
  });

  final List<RptSegment<T>> options;
  final T value;
  final ValueChanged<T> onChanged;
  final Color color;

  /// Compact (card actions) vs regular size.
  final bool small;

  @override
  Widget build(BuildContext context) {
    final dur = reduceMotion(context)
        ? Duration.zero
        : const Duration(milliseconds: 200);
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface3,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final o in options)
              Semantics(
                button: true,
                selected: o.value == value,
                label: o.label,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onChanged(o.value),
                  child: AnimatedContainer(
                    duration: dur,
                    curve: Curves.easeOutCubic,
                    padding: EdgeInsets.symmetric(
                      horizontal: small ? 11 : 14,
                      vertical: small ? 6 : 8,
                    ),
                    decoration: BoxDecoration(
                      color: o.value == value ? color : Colors.transparent,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                      boxShadow: o.value == value
                          ? [
                              BoxShadow(
                                color: color.withValues(alpha: 0.35),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (o.icon != null) ...[
                          Icon(
                            o.icon,
                            size: 13,
                            color: o.value == value
                                ? Colors.white
                                : AppColors.inkFaint,
                          ),
                          const SizedBox(width: 4),
                        ],
                        Text(
                          o.label,
                          style: AppText.body(
                            size: small ? 11.5 : 12.5,
                            weight: FontWeight.w800,
                            color: o.value == value
                                ? Colors.white
                                : AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Small rounded label / value pill ("Busiest day · Mon").
class RptStatPill extends StatelessWidget {
  const RptStatPill({
    super.key,
    required this.value,
    this.label,
    this.icon,
    this.color = RptColors.violet,
  });

  final String value;
  final String? label;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
          ],
          if (label != null) ...[
            Text(
              label!,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w700,
                color: color.withValues(alpha: 0.85),
              ),
            ),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.tabular(
                size: 11,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One chip of a [RptFilterChips].
class RptChip<T> {
  const RptChip(this.value, this.label, {this.count, this.dot});

  final T value;
  final String label;

  /// Count shown after the label (web's `FilterChips` counts).
  final int? count;

  /// Coloured dot before the label.
  final Color? dot;
}

/// Single-select chip row ("All / Active / Expired"); the selected chip is
/// filled with [color]. Horizontally scrollable.
class RptFilterChips<T> extends StatelessWidget {
  const RptFilterChips({
    super.key,
    required this.chips,
    required this.value,
    required this.onChanged,
    this.color = RptColors.violet,
  });

  final List<RptChip<T>> chips;
  final T value;
  final ValueChanged<T> onChanged;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (var i = 0; i < chips.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            _FilterChip(
              chip: chips[i],
              selected: chips[i].value == value,
              color: color,
              onTap: () => onChanged(chips[i].value),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip<T> extends StatelessWidget {
  const _FilterChip({
    required this.chip,
    required this.selected,
    required this.color,
    required this.onTap,
  });

  final RptChip<T> chip;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? Colors.white : AppColors.inkSoft;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: reduceMotion(context)
              ? Duration.zero
              : const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? color : AppColors.surface3,
            borderRadius: BorderRadius.circular(AppRadii.pill),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: color.withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (chip.dot != null) ...[
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: chip.dot,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Text(
                chip.label,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w800,
                  color: fg,
                ),
              ),
              if (chip.count != null) ...[
                const SizedBox(width: 6),
                Text(
                  '${chip.count}',
                  style: AppText.tabular(
                    size: 11.5,
                    weight: FontWeight.w700,
                    color: selected
                        ? Colors.white.withValues(alpha: 0.85)
                        : AppColors.inkFaint,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
