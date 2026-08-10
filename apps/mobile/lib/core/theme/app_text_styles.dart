import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'app_colors.dart';

/// Typography tokens mirroring the design's `.display` / `.eyebrow` / body
/// classes. Bricolage Grotesque for display/headline text, Hanken Grotesk
/// for everything else — the exact two families declared in the approved
/// HTML (`@font-face` blocks), sourced via `google_fonts` since both are
/// real published Google Fonts families under those names.
class AppText {
  AppText._();

  /// `.display` — Bricolage Grotesque 700, tight tracking.
  static TextStyle display({
    required double size,
    Color color = AppColors.ink,
    FontWeight weight = FontWeight.w700,
  }) =>
      GoogleFonts.bricolageGrotesque(
        fontSize: size,
        fontWeight: weight,
        color: color,
        letterSpacing: size * -0.01,
        height: 1.15,
      );

  /// `.eyebrow` — Hanken Grotesk 800, 11px, uppercase, wide tracking, faint.
  static TextStyle eyebrow({Color color = AppColors.inkFaint}) =>
      GoogleFonts.hankenGrotesk(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        letterSpacing: 1.54, // .14em of 11px
        color: color,
      );

  /// Body copy — Hanken Grotesk, regular weight range per design (400-800).
  static TextStyle body({
    double size = 14,
    Color color = AppColors.ink,
    FontWeight weight = FontWeight.w500,
  }) =>
      GoogleFonts.hankenGrotesk(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: 1.4,
      );

  /// `.tabular` — same body font with tabular figures, for money/metrics.
  static TextStyle tabular({
    double size = 14,
    Color color = AppColors.ink,
    FontWeight weight = FontWeight.w700,
  }) =>
      GoogleFonts.hankenGrotesk(
        fontSize: size,
        fontWeight: weight,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      );
}
