import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_branding.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// The design's swatch rows, as hex values (`cssColorSchema` accepts them).
const _primarySwatches = ['#DB1F1F', '#8B5CF6', '#14E0B4', '#FFB648'];
const _secondarySwatches = ['#1B1526', '#241C33', '#2E2440'];
const _themes = ['LIGHT', 'DARK', 'SYSTEM'];

/// Design frame "11b. Branding" — primary/secondary swatches + theme,
/// writing to `PATCH /settings/branding`. The frame's "Upload logo" button
/// is not built: there's no image-picker package in the app, and the
/// endpoint takes a base64 data URL that only a real picker could produce.
/// The logo tile shows the gym's initials, as the design does.
class BrandingSettingsScreen extends StatefulWidget {
  const BrandingSettingsScreen({super.key});

  @override
  State<BrandingSettingsScreen> createState() => _BrandingSettingsScreenState();
}

class _BrandingSettingsScreenState extends State<BrandingSettingsScreen> {
  GymBranding? _branding;
  String? _primary;
  String? _secondary;
  String _theme = 'SYSTEM';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final branding = await getIt<GymSettingsRepository>().getBranding();
      if (!mounted) return;
      setState(() {
        _branding = branding;
        _primary = branding.primaryColor;
        _secondary = branding.secondaryColor;
        _theme = branding.theme;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final updated = await getIt<GymSettingsRepository>().updateBranding(
        primaryColor: _primary,
        secondaryColor: _secondary,
        theme: _theme,
      );
      if (!mounted) return;
      setState(() => _branding = updated);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Branding saved')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final tenantName =
        session is SessionAuthenticatedStaff ? session.tenant.name : '';
    final initials = tenantName
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Branding', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null && _branding == null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _branding == null
                ? const AppLoadingView()
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    children: [
                      if (_error != null) ...[
                        FormAlert(message: _error!),
                        const SizedBox(height: 12),
                      ],
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(AppRadii.card),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        alignment: Alignment.center,
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            gradient: AppColors.staffGrad,
                            borderRadius: BorderRadius.circular(18),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            initials.isEmpty ? '?' : initials,
                            style: AppText.body(
                              size: 20,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text('Primary color', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      _SwatchRow(
                        swatches: _primarySwatches,
                        selected: _primary,
                        onSelected: (c) => setState(() => _primary = c),
                      ),
                      const SizedBox(height: 18),
                      Text('Secondary color', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      _SwatchRow(
                        swatches: _secondarySwatches,
                        selected: _secondary,
                        onSelected: (c) => setState(() => _secondary = c),
                      ),
                      const SizedBox(height: 18),
                      Text('Theme', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      CategoryChipSelector<String>(
                        options: _themes,
                        labelOf: (t) => t[0] + t.substring(1).toLowerCase(),
                        value: _theme,
                        onChanged: (t) => setState(() => _theme = t),
                      ),
                      const SizedBox(height: 24),
                      AppButton(
                        label: 'Save changes',
                        loading: _saving,
                        onPressed: _save,
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _SwatchRow extends StatelessWidget {
  const _SwatchRow({
    required this.swatches,
    required this.selected,
    required this.onSelected,
  });

  final List<String> swatches;
  final String? selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: swatches.map((hex) {
        final isSelected = selected?.toUpperCase() == hex;
        return Padding(
          padding: const EdgeInsets.only(right: 10),
          child: GestureDetector(
            onTap: () => onSelected(hex),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Color(int.parse('FF${hex.substring(1)}', radix: 16)),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: isSelected ? AppColors.ink : Colors.transparent,
                  width: 2,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
