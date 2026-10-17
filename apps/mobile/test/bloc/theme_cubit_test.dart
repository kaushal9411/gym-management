import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/bloc/theme/theme_cubit.dart';
import 'package:gym_saas_mobile/core/storage/secure_storage.dart';
import 'package:gym_saas_mobile/core/theme/app_colors.dart';

class _FakeStorage implements SecureStorage {
  String? mode;

  @override
  Future<String?> readThemeMode() async => mode;

  @override
  Future<void> saveThemeMode(String value) async => mode = value;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  tearDown(() => AppColors.isLight = false);

  test('defaults to dark when nothing is saved', () async {
    final cubit = ThemeCubit(_FakeStorage());
    await cubit.load();
    expect(cubit.state, ThemeMode.dark);
    expect(AppColors.isLight, isFalse);
  });

  test('restores a saved light choice before the first frame', () async {
    final cubit = ThemeCubit(_FakeStorage()..mode = 'light');
    await cubit.load();
    expect(cubit.state, ThemeMode.light);
    expect(AppColors.isLight, isTrue);
    expect(AppColors.bg, const Color(0xFFF6F5FB));
  });

  test('setMode flips the palette and persists the choice', () async {
    final storage = _FakeStorage();
    final cubit = ThemeCubit(storage);
    await cubit.setMode(ThemeMode.light);
    expect(AppColors.ink, const Color(0xFF16132B));
    expect(storage.mode, 'light');
    await cubit.setMode(ThemeMode.dark);
    expect(AppColors.ink, const Color(0xFFF5F1FA));
    expect(storage.mode, 'dark');
  });
}
