import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Reproduces the design's `.segmented`/`.seg`/`.seg.active` component —
/// the Staff/Member switch on the login screen.
class SegmentedToggle extends StatelessWidget {
  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  const SegmentedToggle({
    super.key,
    required this.options,
    required this.selectedIndex,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: colors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          for (var i = 0; i < options.length; i++)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(i),
                child: Container(
                  color:
                      i == selectedIndex ? colors.accent : Colors.transparent,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  alignment: Alignment.center,
                  child: Text(
                    options[i],
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color:
                          i == selectedIndex ? Colors.white : colors.inkFaint,
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
