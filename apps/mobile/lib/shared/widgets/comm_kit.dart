import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_text_styles.dart';
import '../../features/income/presentation/income_insights.dart'
    show LedgerKpiTile;
import '../../features/manager/presentation/widgets/member_detail_anim.dart';

/// Pieces shared by the Notifications and Announcements screens (the
/// "Communication" section).

/// KPI tiles in a wrapping grid: 2 columns on phones, [wideColumns] from 600
/// dp. A trailing odd tile spans the full row on a 2-column layout.
class CommKpiGrid extends StatelessWidget {
  const CommKpiGrid({super.key, required this.tiles, this.wideColumns = 4});

  final List<LedgerKpiTile> tiles;
  final int wideColumns;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final cols = c.maxWidth >= 600 ? wideColumns : 2;
        const gap = 10.0;
        final w = (c.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var i = 0; i < tiles.length; i++)
              FadeUp(
                index: i,
                child: SizedBox(
                  width:
                      cols == 2 && i == tiles.length - 1 && tiles.length.isOdd
                          ? c.maxWidth
                          : w,
                  height: 128,
                  child: tiles[i],
                ),
              ),
          ],
        );
      },
    );
  }
}

/// Small pill switcher (web's `SegmentedTabs`): one option selected.
class CommSegmented<T> extends StatelessWidget {
  const CommSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    required this.color,
  });

  final List<(T, String)> options;
  final T value;
  final ValueChanged<T> onChanged;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: AppColors.surface3,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final o in options)
            Semantics(
              button: true,
              selected: o.$1 == value,
              label: o.$2,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(o.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: o.$1 == value ? color : Colors.transparent,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    o.$2,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: o.$1 == value ? Colors.white : AppColors.inkSoft,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
