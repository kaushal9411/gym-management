import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_business_settings.dart';
import '../../../models/gym_profile.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

const _dateFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];
const _timeFormats = ['12h', '24h'];

/// Design frame "11a. Gym profile" — Legal name / contact fields, plus the
/// business-settings block (currency, timezone, formats) which has no
/// frame of its own but belongs with the profile. The design's "Operating
/// hours" single field is not built: the API models hours per weekday and
/// flattening that into one string would silently overwrite real per-day
/// values.
class GymProfileSettingsScreen extends StatefulWidget {
  const GymProfileSettingsScreen({super.key});

  @override
  State<GymProfileSettingsScreen> createState() =>
      _GymProfileSettingsScreenState();
}

class _GymProfileSettingsScreenState extends State<GymProfileSettingsScreen> {
  GymProfile? _profile;
  GymBusinessSettings? _business;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final repo = getIt<GymSettingsRepository>();
      final (profile, business) =
          await (repo.getProfile(), repo.getBusinessSettings()).wait;
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _business = business;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Gym Profile', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _profile == null || _business == null
                ? const AppLoadingView()
                : ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    children: [
                      _ProfileSection(profile: _profile!),
                      const SizedBox(height: 24),
                      _BusinessSection(business: _business!),
                    ],
                  ),
      ),
    );
  }
}

class _ProfileSection extends StatefulWidget {
  const _ProfileSection({required this.profile});

  final GymProfile profile;

  @override
  State<_ProfileSection> createState() => _ProfileSectionState();
}

class _ProfileSectionState extends State<_ProfileSection> {
  late final _nameController =
      TextEditingController(text: widget.profile.gymName);
  late final _legalNameController =
      TextEditingController(text: widget.profile.legalBusinessName ?? '');
  late final _emailController =
      TextEditingController(text: widget.profile.email ?? '');
  late final _phoneController =
      TextEditingController(text: widget.profile.phone ?? '');
  late final _addressController =
      TextEditingController(text: widget.profile.addressLine ?? '');
  late final _cityController =
      TextEditingController(text: widget.profile.city ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _legalNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GymSettingsRepository>().saveProfile(
        gymName: _nameController.text.trim(),
        legalBusinessName: _legalNameController.text.trim(),
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        addressLine: _addressController.text.trim(),
        city: _cityController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile saved')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null) ...[
          FormAlert(message: _error!),
          const SizedBox(height: 12),
        ],
        AppLabeledField(label: 'Legal name', controller: _legalNameController),
        const SizedBox(height: 14),
        AppLabeledField(label: 'Gym name', controller: _nameController),
        const SizedBox(height: 14),
        AppLabeledField(
          label: 'Contact email',
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 14),
        AppLabeledField(
          label: 'Contact phone',
          controller: _phoneController,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 14),
        AppLabeledField(label: 'Address', controller: _addressController),
        const SizedBox(height: 14),
        AppLabeledField(label: 'City', controller: _cityController),
        const SizedBox(height: 18),
        AppButton(label: 'Save changes', loading: _saving, onPressed: _save),
      ],
    );
  }
}

class _BusinessSection extends StatefulWidget {
  const _BusinessSection({required this.business});

  final GymBusinessSettings business;

  @override
  State<_BusinessSection> createState() => _BusinessSectionState();
}

class _BusinessSectionState extends State<_BusinessSection> {
  late final _currencyController =
      TextEditingController(text: widget.business.currency);
  late final _symbolController =
      TextEditingController(text: widget.business.currencySymbol);
  late final _timezoneController =
      TextEditingController(text: widget.business.timezone);
  late String _dateFormat = widget.business.dateFormat;
  late String _timeFormat = widget.business.timeFormat;
  late MeasurementUnit _unit = widget.business.measurementUnit;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _currencyController.dispose();
    _symbolController.dispose();
    _timezoneController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GymSettingsRepository>().updateBusinessSettings(
        currency: _currencyController.text.trim(),
        currencySymbol: _symbolController.text.trim(),
        timezone: _timezoneController.text.trim(),
        dateFormat: _dateFormat,
        timeFormat: _timeFormat,
        measurementUnit: _unit,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Business settings saved')),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Business', style: AppText.eyebrow()),
        const SizedBox(height: 10),
        if (_error != null) ...[
          FormAlert(message: _error!),
          const SizedBox(height: 12),
        ],
        Row(
          children: [
            Expanded(
              child: AppLabeledField(
                label: 'Currency code',
                controller: _currencyController,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AppLabeledField(
                label: 'Symbol',
                controller: _symbolController,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        AppLabeledField(label: 'Timezone', controller: _timezoneController),
        const SizedBox(height: 14),
        Text('Date format', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        CategoryChipSelector<String>(
          options: _dateFormats,
          labelOf: (f) => f,
          value: _dateFormat,
          onChanged: (f) => setState(() => _dateFormat = f),
        ),
        const SizedBox(height: 14),
        Text('Time format', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        CategoryChipSelector<String>(
          options: _timeFormats,
          labelOf: (f) => f,
          value: _timeFormat,
          onChanged: (f) => setState(() => _timeFormat = f),
        ),
        const SizedBox(height: 14),
        Text('Measurement unit', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        CategoryChipSelector<MeasurementUnit>(
          options: MeasurementUnit.values,
          labelOf: (u) => u.label,
          value: _unit,
          onChanged: (u) => setState(() => _unit = u),
        ),
        const SizedBox(height: 18),
        AppButton(
          label: 'Save business settings',
          loading: _saving,
          onPressed: _save,
        ),
      ],
    );
  }
}
