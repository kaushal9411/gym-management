import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../lead_ui.dart';

/// Opens [builder] as a rounded modal bottom sheet (same chrome as the
/// Members KPI / insight sheets).
Future<T?> showLeadSheet<T>(BuildContext context, WidgetBuilder builder) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.surface2,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: builder,
  );
}

/// Drag handle + icon/title header + scrollable body capped below full
/// screen height.
class LeadSheetScaffold extends StatelessWidget {
  const LeadSheetScaffold({
    super.key,
    required this.icon,
    required this.title,
    required this.color,
    required this.child,
    this.subtitle,
    this.footer,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final Color color;
  final Widget child;

  /// Pinned below the scrolling body (Apply / Save bars) so it never
  /// scrolls out of reach.
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      gradient: LinearGradient(
                        colors: [
                          color,
                          Color.lerp(color, LeadColors.fuchsia, 0.5)!,
                        ],
                      ),
                    ),
                    child: Icon(icon, size: 18, color: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppText.display(size: 17)),
                        if (subtitle != null)
                          Text(
                            subtitle!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding:
                    EdgeInsets.fromLTRB(18, 0, 18, footer == null ? 24 : 12),
                child: child,
              ),
            ),
            if (footer != null)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 14),
                  child: footer,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Section card: tinted gradient header band (icon chip + title + optional
/// badge / action) over the body. With [onTap] the whole card is tappable
/// and shows a chevron (insight panels that open a detail sheet).
class LeadPanel extends StatelessWidget {
  const LeadPanel({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.child,
    this.subtitle,
    this.badge,
    this.onTap,
    this.action,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? subtitle;
  final String? badge;
  final VoidCallback? onTap;
  final Widget? action;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final header = Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.22),
            color.withValues(alpha: 0.03),
          ],
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(11),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color, Color.lerp(color, LeadColors.fuchsia, 0.5)!],
              ),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.4),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, size: 17, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppText.display(size: 15)),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
              ],
            ),
          ),
          if (badge != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                badge!,
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
            const SizedBox(width: 4),
          ],
          if (action != null) action!,
          if (onTap != null)
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.inkFaint,
            ),
        ],
      ),
    );
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              header,
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: child,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Icon-tile for one field (label over value), greyed when empty.
class LeadFieldTile extends StatelessWidget {
  const LeadFieldTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.onTap,
    this.maxLines = 2,
  });

  final IconData icon;
  final String label;
  final String? value;
  final Color color;
  final VoidCallback? onTap;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final empty = value == null || value!.trim().isEmpty;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: empty ? null : onTap,
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: color.withValues(alpha: empty ? 0.04 : 0.09),
            border:
                Border.all(color: color.withValues(alpha: empty ? 0.1 : 0.2)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(9),
                  color: color.withValues(alpha: empty ? 0.1 : 0.2),
                ),
                child: Icon(
                  icon,
                  size: 15,
                  color: empty ? color.withValues(alpha: 0.5) : color,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 9,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ).copyWith(letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      empty ? 'Not set' : value!,
                      maxLines: maxLines,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 12.5,
                        weight: empty ? FontWeight.w600 : FontWeight.w800,
                        color: empty ? AppColors.inkFaint : AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Two-column (or one-column when [single]) grid of [LeadFieldTile]s.
class LeadFieldGrid extends StatelessWidget {
  const LeadFieldGrid({super.key, required this.tiles, this.fullWidth = false});

  final List<Widget> tiles;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final w = fullWidth ? c.maxWidth : (c.maxWidth - 8) / 2;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final t in tiles) SizedBox(width: w, child: t)],
        );
      },
    );
  }
}

/// Single-select pill group with icon header (same look as the Add-member
/// wizard's chip groups). [colorOf] / [iconOf] tint each option.
class LeadChipGroup<T> extends StatelessWidget {
  const LeadChipGroup({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.options,
    required this.value,
    required this.labelOf,
    this.onChanged,
    this.selected,
    this.onToggle,
    this.iconOf,
    this.colorOf,
    this.allowClear = false,
  });

  final String label;
  final IconData icon;
  final Color color;
  final List<T> options;
  final T? value;

  /// Single-select callback (null again when [allowClear] and re-tapped).
  final ValueChanged<T?>? onChanged;

  /// Multi-select mode: when [selected] is set, taps call [onToggle].
  final Set<T>? selected;
  final ValueChanged<T>? onToggle;
  final String Function(T) labelOf;
  final IconData Function(T)? iconOf;
  final Color Function(T)? colorOf;
  final bool allowClear;

  bool _isSel(T o) => selected != null ? selected!.contains(o) : o == value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(label, style: AppText.eyebrow()),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in options)
              GestureDetector(
                onTap: () {
                  if (selected != null) {
                    onToggle?.call(o);
                  } else {
                    onChanged?.call(o == value && allowClear ? null : o);
                  }
                },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    color: _isSel(o)
                        ? (colorOf?.call(o) ?? color).withValues(alpha: 0.18)
                        : AppColors.surface2,
                    border: Border.all(
                      color: _isSel(o)
                          ? (colorOf?.call(o) ?? color)
                          : AppColors.line,
                      width: _isSel(o) ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (iconOf != null) ...[
                        Icon(
                          iconOf!(o),
                          size: 14,
                          color: _isSel(o)
                              ? (colorOf?.call(o) ?? color)
                              : AppColors.inkFaint,
                        ),
                        const SizedBox(width: 5),
                      ],
                      Text(
                        labelOf(o),
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: _isSel(o)
                              ? (colorOf?.call(o) ?? color)
                              : AppColors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Read-only tap-to-pick field (dates, plan, branch, assignee) built on the
/// shared labeled-field look. Keeps a persistent controller whose text
/// follows [text]; [onClear] swaps the arrow for an X when a value is set.
class LeadValueField extends StatefulWidget {
  const LeadValueField({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.text,
    required this.onTap,
    this.hint = 'Select',
    this.onClear,
    this.error,
    this.trailingIcon = Icons.keyboard_arrow_down_rounded,
  });

  final String label;
  final IconData icon;
  final Color color;
  final String? text;
  final String hint;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final String? error;
  final IconData trailingIcon;

  @override
  State<LeadValueField> createState() => _LeadValueFieldState();
}

class _LeadValueFieldState extends State<LeadValueField> {
  late final TextEditingController _c =
      TextEditingController(text: widget.text ?? '');

  @override
  void didUpdateWidget(LeadValueField old) {
    super.didUpdateWidget(old);
    final t = widget.text ?? '';
    if (_c.text != t) _c.text = t;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final has = widget.text != null && widget.text!.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(widget.label, style: AppText.eyebrow()),
        ),
        InkWell(
          borderRadius: BorderRadius.circular(AppRadii.field),
          onTap: widget.onTap,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.field),
              border: Border.all(
                color: widget.error != null ? AppColors.danger : AppColors.line,
              ),
            ),
            child: Row(
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 10, right: 6),
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(9),
                      color: widget.color.withValues(alpha: 0.16),
                    ),
                    child: Icon(widget.icon, size: 15, color: widget.color),
                  ),
                ),
                Expanded(
                  child: IgnorePointer(
                    child: TextField(
                      controller: _c,
                      readOnly: true,
                      showCursor: false,
                      style: AppText.body(size: 15, weight: FontWeight.w600),
                      decoration: InputDecoration(
                        isDense: true,
                        filled: false,
                        border: InputBorder.none,
                        hintText: widget.hint,
                        hintStyle: AppText.body(
                          size: 15,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 13,
                        ),
                      ),
                    ),
                  ),
                ),
                if (has && widget.onClear != null)
                  IconButton(
                    tooltip: 'Clear',
                    visualDensity: VisualDensity.compact,
                    icon: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                    onPressed: widget.onClear,
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(right: 10),
                    child: Icon(
                      widget.trailingIcon,
                      size: 20,
                      color: AppColors.inkFaint,
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (widget.error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 2),
            child: Text(
              widget.error!,
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

/// Frosted pill used on the gradient hero banners.
class LeadHeroPill extends StatelessWidget {
  const LeadHeroPill(this.text, {super.key, this.icon, this.dot});

  final String text;
  final IconData? icon;
  final Color? dot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot != null) ...[
            PulseDot(color: dot!, size: 8),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[
            Icon(icon, size: 13, color: Colors.white),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11,
                weight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Frosted action button for the gradient hero (Call / WhatsApp / Edit...).
class LeadHeroAction extends StatelessWidget {
  const LeadHeroAction({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 15, color: Colors.white),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// KPI tile: tinted wash, icon chip, count-up value, label and optional
/// delta chip. Tappable tiles open a bottom sheet.
class LeadKpiTile extends StatelessWidget {
  const LeadKpiTile({
    super.key,
    required this.label,
    required this.color,
    required this.icon,
    this.intValue,
    this.text,
    this.suffix = '',
    this.deltaPercent,
    this.invertDelta = false,
    this.onTap,
    this.active = false,
    this.index = 0,
  });

  final String label;
  final Color color;
  final IconData icon;

  /// Animated count-up value; [text] is shown instead when set.
  final int? intValue;
  final String? text;
  final String suffix;
  final double? deltaPercent;

  /// Lower is better (lost leads): a rise is shown red, a fall green.
  final bool invertDelta;
  final VoidCallback? onTap;
  final bool active;
  final int index;

  @override
  Widget build(BuildContext context) {
    final valueStyle = AppText.display(size: 24, color: color);
    final d = deltaPercent;
    final good = d == null ? true : (invertDelta ? d <= 0 : d >= 0);
    final deltaColor = good ? LeadColors.green : LeadColors.rose;
    return FadeUp(
      index: index,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [color.withValues(alpha: 0.16), Colors.transparent],
              ),
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: active ? color : color.withValues(alpha: 0.24),
                width: active ? 1.4 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(9),
                      ),
                      child: Icon(icon, size: 14, color: color),
                    ),
                    const Spacer(),
                    if (d != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: deltaColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              d >= 0
                                  ? Icons.arrow_upward_rounded
                                  : Icons.arrow_downward_rounded,
                              size: 10,
                              color: deltaColor,
                            ),
                            Text(
                              '${d.abs().round()}%',
                              style: AppText.body(
                                size: 10,
                                weight: FontWeight.w800,
                                color: deltaColor,
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (onTap != null)
                      Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: AppColors.inkFaint,
                      ),
                  ],
                ),
                const Spacer(),
                if (text != null)
                  Text(text!, style: valueStyle)
                else
                  CountUp(
                    value: intValue ?? 0,
                    suffix: suffix,
                    style: valueStyle,
                  ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Horizontal gradient bar row (label, count, optional sub-line) that grows
/// in on first build.
class LeadBarRow extends StatelessWidget {
  const LeadBarRow({
    super.key,
    required this.label,
    required this.value,
    required this.fraction,
    required this.color,
    this.sub,
    this.leading,
  });

  final String label;
  final String value;
  final double fraction;
  final Color color;
  final String? sub;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Row(
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 10)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      value,
                      style: AppText.body(
                        size: 12,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                GrowBar(
                  ratio: fraction,
                  height: 7,
                  track: AppColors.surface3,
                  colors: [color, color.withValues(alpha: 0.55)],
                ),
                if (sub != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      sub!,
                      style: AppText.body(
                        size: 10.5,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Muted "nothing here" line for panels.
class LeadEmptyLine extends StatelessWidget {
  const LeadEmptyLine(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(
          text,
          style: AppText.body(size: 12.5, color: AppColors.inkFaint),
        ),
      );
}

/// Pill tab strip identical to the Member detail tabs.
class LeadTabBar extends StatelessWidget {
  const LeadTabBar({
    super.key,
    required this.tabs,
    required this.selected,
    required this.onSelected,
  });

  final List<String> tabs;
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final sel = i == selected;
          return GestureDetector(
            onTap: () => onSelected(i),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                gradient: sel ? LeadColors.cta : null,
                color: sel ? null : AppColors.surface,
                boxShadow: sel
                    ? [
                        BoxShadow(
                          color: LeadColors.violet.withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ]
                    : null,
                border: sel ? null : Border.all(color: AppColors.line),
              ),
              child: Text(
                tabs[i],
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: sel ? Colors.white : AppColors.inkSoft,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Chrome shared by the add / edit lead screens: transparent AppBar over a
/// gradient banner (icon, title, subtitle, pill), the form sections, then a
/// shimmering gradient save button.
class LeadFormScaffold extends StatelessWidget {
  const LeadFormScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.sections,
    required this.saving,
    required this.onSave,
    required this.saveLabel,
    this.banner,
    this.error,
    this.extra = const [],
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final List<Widget> sections;
  final bool saving;
  final VoidCallback onSave;
  final String saveLabel;

  /// Extra widget inside the banner (avatar etc.).
  final Widget? banner;
  final String? error;

  /// Widgets between the error alert and the sections (duplicate tiles).
  final List<Widget> extra;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(title),
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.only(bottom: 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MeshHeroBackground(
              radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
              child: SizedBox(
                width: double.infinity,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
                  child: Row(
                    children: [
                      Floating(
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withValues(alpha: 0.2),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.5),
                              width: 2,
                            ),
                          ),
                          child: Icon(icon, size: 28, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: AppText.display(
                                size: 22,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              subtitle,
                              style: AppText.body(
                                size: 12.5,
                                weight: FontWeight.w600,
                                color: Colors.white.withValues(alpha: 0.88),
                              ),
                            ),
                            if (banner != null) ...[
                              const SizedBox(height: 8),
                              banner!,
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (error != null) ...[
                    FormAlert(message: error!),
                    const SizedBox(height: 14),
                  ],
                  ...extra,
                  for (var i = 0; i < sections.length; i++) ...[
                    if (i > 0) const SizedBox(height: 14),
                    FadeUp(index: i, child: sections[i]),
                  ],
                  const SizedBox(height: 20),
                  ShimmerButton(
                    colors: const [
                      LeadColors.indigo,
                      LeadColors.violet,
                      LeadColors.fuchsia,
                    ],
                    onTap: saving ? null : onSave,
                    padding: const EdgeInsets.symmetric(vertical: 15),
                    child: saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.2,
                              color: Colors.white,
                            ),
                          )
                        : Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.check_rounded,
                                size: 18,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                saveLabel,
                                style: AppText.body(
                                  size: 15,
                                  weight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
