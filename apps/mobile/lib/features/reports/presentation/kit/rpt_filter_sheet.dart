import 'package:flutter/material.dart';

import '../../../../core/theme/app_text_styles.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'rpt_theme.dart';

/// A labelled group inside a filter sheet ("STATUS" + chips, "PLAN" + a
/// picker).
class RptFilterGroup extends StatelessWidget {
  const RptFilterGroup({super.key, required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: AppText.eyebrow()),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

/// Bottom-sheet scaffold for a report's extra filters (membership status +
/// plan, payment status, ...). [builder] draws the groups and may call the
/// `setSheet` it is given to refresh; the screen keeps the real filter
/// values and applies them when the sheet resolves `true`.
///
/// Capped at 640 dp on tablets, with a Reset (calls [onReset], then closes
/// with `true` so the list reloads) and an Apply button.
Future<bool?> showRptFilterSheet(
  BuildContext context, {
  required String title,
  required Widget Function(BuildContext context, StateSetter setSheet) builder,
  String? subtitle,
  VoidCallback? onReset,
  String applyLabel = 'Apply filters',
  Color color = RptColors.violet,
}) {
  return showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.tune_rounded,
      title: title,
      subtitle: subtitle,
      color: color,
      child: StatefulBuilder(
        builder: (ctx, setSheet) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            builder(ctx, setSheet),
            Row(
              children: [
                if (onReset != null) ...[
                  Expanded(
                    child: AppButton(
                      label: 'Reset',
                      variant: AppButtonVariant.ghost,
                      onPressed: () {
                        onReset();
                        Navigator.of(ctx).pop(true);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  flex: 2,
                  child: AppButton(
                    label: applyLabel,
                    onPressed: () => Navigator.of(ctx).pop(true),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
