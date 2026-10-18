import 'package:flutter/material.dart';

/// Lays [children] out in one column on phones and two columns from
/// [breakpoint] dp (cards alternate left / right, each keeps its own height).
///
/// Unlike `TeamAdaptive` this does **not** use `IntrinsicHeight`, so children
/// that contain a `LayoutBuilder` (every chart) are fine. Use [fullWidth]
/// for cards that should span both columns on a tablet (they come last).
class AdaptiveColumns extends StatelessWidget {
  const AdaptiveColumns({
    super.key,
    required this.children,
    this.fullWidth = const [],
    this.gap = 12,
    this.breakpoint = 700,
  });

  final List<Widget> children;
  final List<Widget> fullWidth;
  final double gap;
  final double breakpoint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        if (box.maxWidth < breakpoint) {
          return Column(
            children: [
              for (final w in [...children, ...fullWidth]) ...[
                w,
                SizedBox(height: gap),
              ],
            ],
          );
        }
        Widget col(int parity) => Expanded(
              child: Column(
                children: [
                  for (var i = parity; i < children.length; i += 2) ...[
                    children[i],
                    SizedBox(height: gap),
                  ],
                ],
              ),
            );
        return Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [col(0), SizedBox(width: gap), col(1)],
            ),
            for (final w in fullWidth) ...[w, SizedBox(height: gap)],
          ],
        );
      },
    );
  }
}
