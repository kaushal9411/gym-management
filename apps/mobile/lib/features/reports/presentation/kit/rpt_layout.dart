import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import 'rpt_chart_card.dart';

/// One block of a [RptPanelGrid]. [full] panels span both columns on wide
/// screens (a table-like branch comparison, a trend).
class RptPanel {
  const RptPanel(this.child, {this.full = false});

  final Widget child;
  final bool full;
}

/// Lays chart cards out in one column on phones and two masonry columns from
/// [breakpoint] dp; [RptPanel.full] panels break the flow and take the whole
/// row. Panels fade up one after another.
///
/// Plain columns/rows only — no `IntrinsicHeight`, which crashes on a child
/// that contains a `LayoutBuilder` (every chart does).
class RptPanelGrid extends StatelessWidget {
  const RptPanelGrid({
    super.key,
    required this.panels,
    this.gap = 12,
    this.breakpoint = 700,
  });

  final List<RptPanel> panels;
  final double gap;
  final double breakpoint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth >= breakpoint;
        Widget wrap(int i) => RptReveal(index: i, child: panels[i].child);
        if (!wide) {
          return Column(
            children: [
              for (var i = 0; i < panels.length; i++) ...[
                if (i > 0) SizedBox(height: gap),
                wrap(i),
              ],
            ],
          );
        }
        final out = <Widget>[];
        var left = <Widget>[];
        var right = <Widget>[];
        void flush() {
          if (left.isEmpty && right.isEmpty) return;
          if (out.isNotEmpty) out.add(SizedBox(height: gap));
          out.add(
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: Column(children: left)),
                SizedBox(width: gap),
                Expanded(child: Column(children: right)),
              ],
            ),
          );
          left = [];
          right = [];
        }

        var side = 0;
        for (var i = 0; i < panels.length; i++) {
          if (panels[i].full) {
            flush();
            if (out.isNotEmpty) out.add(SizedBox(height: gap));
            out.add(wrap(i));
            side = 0;
            continue;
          }
          final target = side.isEven ? left : right;
          if (target.isNotEmpty) target.add(SizedBox(height: gap));
          target.add(wrap(i));
          side++;
        }
        flush();
        return Column(children: out);
      },
    );
  }
}

/// "Showing 20 of 134 · Load more" footer for result lists.
class RptLoadMore extends StatelessWidget {
  const RptLoadMore({
    super.key,
    required this.shown,
    required this.total,
    required this.loading,
    required this.onPressed,
  });

  final int shown;
  final int total;
  final bool loading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Column(
        children: [
          Text(
            'Showing $shown of $total',
            style: AppText.body(
              size: 11.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 10),
          AppButton(
            label: 'Load more',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: loading,
            onPressed: onPressed,
          ),
        ],
      ),
    );
  }
}
