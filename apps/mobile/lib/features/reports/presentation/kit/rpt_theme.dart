import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// Colours for the report chart kit. Series hues are the same family web's
/// `reports-theme.ts` uses (`--chart-*`); the neutrals (grid, track,
/// "previous period" grey) are `AppColors` getters, so they follow the
/// light/dark theme — never cache them in a `static final`.
class RptColors {
  RptColors._();

  static const indigo = TeamColors.indigo;
  static const violet = TeamColors.violet;
  static const teal = TeamColors.teal;
  static const amber = TeamColors.amber;
  static const rose = TeamColors.rose;
  static const green = TeamColors.green;
  static const fuchsia = TeamColors.fuchsia;
  static const sky = TeamColors.sky;
  static const slate = TeamColors.slate;

  /// Ordered categorical palette for multi-series charts / donut slices.
  static const series = <Color>[
    indigo,
    teal,
    amber,
    rose,
    violet,
    green,
    fuchsia,
    sky,
  ];

  /// Colour of the "previous period" overlay (dashed line / thin bar).
  static Color get previous => AppColors.inkFaint;

  /// Chart grid lines.
  static Color get grid => AppColors.line;

  /// Empty part of a bar / ring.
  static Color get track => AppColors.surface3;

  /// Axis labels.
  static Color get axis => AppColors.inkFaint;

  /// Good / bad delta colours.
  static const good = TeamColors.green;
  static const bad = TeamColors.rose;
}

/// The n-th categorical series colour (wraps around).
Color rptSeriesColor(int i) => RptColors.series[i % RptColors.series.length];

/// Report families — web's `ReportAccent`. Each carries the colour its cards,
/// tiles and charts use, so a Finance report reads green everywhere.
enum RptAccent { members, finance, attendance, staff, operations, analytics }

extension RptAccentX on RptAccent {
  Color get color => switch (this) {
        RptAccent.members => RptColors.indigo,
        RptAccent.finance => RptColors.green,
        RptAccent.attendance => RptColors.teal,
        RptAccent.staff => RptColors.fuchsia,
        RptAccent.operations => RptColors.sky,
        RptAccent.analytics => RptColors.violet,
      };

  String get label => switch (this) {
        RptAccent.members => 'Members',
        RptAccent.finance => 'Finance',
        RptAccent.attendance => 'Attendance',
        RptAccent.staff => 'Staff',
        RptAccent.operations => 'Operations',
        RptAccent.analytics => 'Analytics',
      };
}

/// A translucent tint of [c] — safe on light and dark surfaces.
Color rptTint(Color c, [double alpha = 0.16]) => c.withValues(alpha: alpha);
