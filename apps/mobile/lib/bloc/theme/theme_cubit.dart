import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/storage/secure_storage.dart';
import '../../core/theme/app_colors.dart';

/// The user's appearance choice (Settings → Appearance). Stored on-device
/// only; it is a per-device preference, not an account setting, so no API
/// is involved. [ThemeMode.system] follows the phone.
///
/// `AppColors` reads [AppColors.isLight] directly (its neutrals are getters,
/// not `const`), so this cubit sets that flag *before* emitting; the app
/// root then force-rebuilds the tree once so every widget re-reads it.
class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit(this._storage) : super(ThemeMode.dark);

  final SecureStorage _storage;

  /// Call once before `runApp` so the first frame already has the right
  /// colours.
  Future<void> load() async {
    final saved = await _storage.readThemeMode();
    final mode = ThemeMode.values.firstWhere(
      (m) => m.name == saved,
      orElse: () => ThemeMode.dark,
    );
    _apply(mode);
    emit(mode);
  }

  Future<void> setMode(ThemeMode mode) async {
    _apply(mode);
    emit(mode);
    await _storage.saveThemeMode(mode.name);
  }

  /// Re-evaluates the flag when the phone switches light/dark while the
  /// choice is [ThemeMode.system]. Returns true if the flag changed.
  bool onPlatformBrightnessChanged() {
    if (state != ThemeMode.system) return false;
    final before = AppColors.isLight;
    _apply(state);
    return before != AppColors.isLight;
  }

  void _apply(ThemeMode mode) {
    final platformDark = WidgetsBinding
            .instance.platformDispatcher.platformBrightness ==
        Brightness.dark;
    AppColors.isLight = switch (mode) {
      ThemeMode.light => true,
      ThemeMode.dark => false,
      ThemeMode.system => !platformDark,
    };
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness:
            AppColors.isLight ? Brightness.dark : Brightness.light,
        statusBarBrightness:
            AppColors.isLight ? Brightness.light : Brightness.dark,
      ),
    );
  }
}
