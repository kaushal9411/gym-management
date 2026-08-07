import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Two ThemeData objects, not one Material ColorScheme toggled dark/light —
/// the design deliberately runs the Staff surfaces light/cobalt and the
/// Member surfaces dark/amber as a fixed identity, not a user preference.
class AppTheme {
  AppTheme._();

  static ThemeData get staff => _build(
        brightness: Brightness.light,
        accent: AppColors.accentStaff,
        accentSoft: AppColors.accentStaffSoft,
        pageBg: AppColors.pageBgLight,
        surface: AppColors.surfaceLight,
        surface2: AppColors.surface2Light,
        ink: AppColors.inkLight,
        inkSoft: AppColors.inkSoftLight,
        border: AppColors.borderLight,
      );

  static ThemeData get member => _build(
        brightness: Brightness.dark,
        accent: AppColors.accentMember,
        accentSoft: AppColors.accentMemberSoft,
        pageBg: AppColors.pageBgDark,
        surface: AppColors.surfaceDark,
        surface2: AppColors.surface2Dark,
        ink: AppColors.inkDark,
        inkSoft: AppColors.inkSoftDark,
        border: AppColors.borderDark,
      );

  static ThemeData _build({
    required Brightness brightness,
    required Color accent,
    required Color accentSoft,
    required Color pageBg,
    required Color surface,
    required Color surface2,
    required Color ink,
    required Color inkSoft,
    required Color border,
  }) {
    final base = ThemeData(brightness: brightness, useMaterial3: true);
    final displayFont = 'Bebas Neue';
    final bodyFont = 'Manrope';

    return base.copyWith(
      scaffoldBackgroundColor: pageBg,
      colorScheme: base.colorScheme.copyWith(
        primary: accent,
        secondary: accent,
        surface: surface,
        error: AppColors.danger,
        onSurface: ink,
      ),
      cardColor: surface2,
      dividerColor: border,
      appBarTheme: AppBarTheme(
        backgroundColor: pageBg,
        foregroundColor: ink,
        elevation: 0,
        titleTextStyle: TextStyle(
          fontFamily: displayFont,
          fontSize: 22,
          color: ink,
          fontWeight: FontWeight.w400,
        ),
      ),
      textTheme: base.textTheme
          .apply(bodyColor: ink, displayColor: ink, fontFamily: bodyFont)
          .copyWith(
            displayLarge: TextStyle(
              fontFamily: displayFont,
              fontSize: 40,
              height: 1.0,
              color: ink,
            ),
            displayMedium: TextStyle(
              fontFamily: displayFont,
              fontSize: 28,
              height: 1.0,
              color: ink,
            ),
            titleLarge: TextStyle(
              fontFamily: bodyFont,
              fontWeight: FontWeight.w800,
              fontSize: 17,
              color: ink,
            ),
            bodyMedium: TextStyle(
              fontFamily: bodyFont,
              fontWeight: FontWeight.w500,
              fontSize: 15,
              color: inkSoft,
            ),
            labelSmall: TextStyle(
              fontFamily: bodyFont,
              fontWeight: FontWeight.w800,
              fontSize: 11,
              letterSpacing: 1.2,
              color: inkSoft,
            ),
          ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          textStyle: TextStyle(
            fontFamily: bodyFont,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: ink,
          side: BorderSide(color: border),
          textStyle: TextStyle(
            fontFamily: bodyFont,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface2,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 13, vertical: 13),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: accent, width: 1.5),
        ),
        labelStyle: TextStyle(
          fontFamily: bodyFont,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: inkSoft,
        ),
      ),
      extensions: [
        AppSemanticColors(
          accent: accent,
          accentSoft: accentSoft,
          surface2: surface2,
          border: border,
          inkSoft: inkSoft,
          inkFaint: inkSoft.withValues(alpha: .75),
          success: AppColors.success,
          successSoft: AppColors.successSoft,
          warning: AppColors.warning,
          warningSoft: AppColors.warningSoft,
          danger: AppColors.danger,
          dangerSoft: AppColors.dangerSoft,
        ),
      ],
    );
  }
}

/// Everything the design system needs that Flutter's ColorScheme has no slot
/// for (soft/tint pairs, semantic status colors) — read via
/// `Theme.of(context).extension<AppSemanticColors>()!` from any widget.
class AppSemanticColors extends ThemeExtension<AppSemanticColors> {
  final Color accent;
  final Color accentSoft;
  final Color surface2;
  final Color border;
  final Color inkSoft;
  final Color inkFaint;
  final Color success;
  final Color successSoft;
  final Color warning;
  final Color warningSoft;
  final Color danger;
  final Color dangerSoft;

  const AppSemanticColors({
    required this.accent,
    required this.accentSoft,
    required this.surface2,
    required this.border,
    required this.inkSoft,
    required this.inkFaint,
    required this.success,
    required this.successSoft,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
  });

  @override
  AppSemanticColors copyWith() => this;

  @override
  AppSemanticColors lerp(ThemeExtension<AppSemanticColors>? other, double t) =>
      this;
}
