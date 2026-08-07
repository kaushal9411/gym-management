import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum PillTone { neutral, success, warning, danger, accent }

class StatusPill extends StatelessWidget {
  final String label;
  final PillTone tone;

  const StatusPill(this.label, {super.key, this.tone = PillTone.neutral});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final (bg, fg) = switch (tone) {
      PillTone.success => (colors.successSoft, colors.success),
      PillTone.warning => (colors.warningSoft, colors.warning),
      PillTone.danger => (colors.dangerSoft, colors.danger),
      PillTone.accent => (colors.accentSoft, colors.accent),
      PillTone.neutral => (colors.surface2, colors.inkSoft),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
        border:
            tone == PillTone.neutral ? Border.all(color: colors.border) : null,
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: fg,
          letterSpacing: .2,
        ),
      ),
    );
  }
}
