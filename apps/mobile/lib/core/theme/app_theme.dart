import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_text_styles.dart';

/// The app is dark-first by design (member + staff planes are both dark —
/// see the design doc's intro: "Dark-first, dual gradient identity"). One
/// `ThemeData` covers the whole app; per-role accent color is applied at
/// the widget level via `AppRoleAccent`, not via separate Flutter themes.
class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bg,
      canvasColor: AppColors.bg,
      colorScheme: base.colorScheme.copyWith(
        surface: AppColors.bg,
        onSurface: AppColors.ink,
      ),
      textTheme: base.textTheme.apply(
        bodyColor: AppColors.ink,
        displayColor: AppColors.ink,
      ),
      splashFactory: InkRipple.splashFactory,
      highlightColor: Colors.transparent,
      textSelectionTheme:
          const TextSelectionThemeData(cursorColor: AppColors.memberB),
      progressIndicatorTheme:
          const ProgressIndicatorThemeData(color: AppColors.memberB),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surface2,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: AppText.display(size: 18),
        contentTextStyle: AppText.body(color: AppColors.inkSoft),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.surface3,
        contentTextStyle: AppText.body(),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
