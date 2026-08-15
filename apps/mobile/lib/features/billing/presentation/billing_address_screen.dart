import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/billing_address.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// `/billing/address` — the tenant's own tax/invoice address for its
/// FitCloud subscription (distinct from a *member's* address). No frame in
/// the Kinetic design; reached from the Billing screen. `GET` returns
/// `data: null` when nothing has been set yet — a real, common state for
/// tenants provisioned outside onboarding, not an error.
class BillingAddressScreen extends StatefulWidget {
  const BillingAddressScreen({super.key});

  @override
  State<BillingAddressScreen> createState() => _BillingAddressScreenState();
}

class _BillingAddressScreenState extends State<BillingAddressScreen> {
  final _legalNameController = TextEditingController();
  final _line1Controller = TextEditingController();
  final _line2Controller = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _postalCodeController = TextEditingController();
  final _countryController = TextEditingController();
  final _taxIdController = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _legalNameController.dispose();
    _line1Controller.dispose();
    _line2Controller.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _postalCodeController.dispose();
    _countryController.dispose();
    _taxIdController.dispose();
    super.dispose();
  }

  void _populate(BillingAddress? address) {
    if (address == null) return;
    _legalNameController.text = address.legalName ?? '';
    _line1Controller.text = address.line1;
    _line2Controller.text = address.line2 ?? '';
    _cityController.text = address.city;
    _stateController.text = address.state;
    _postalCodeController.text = address.postalCode;
    _countryController.text = address.country;
    _taxIdController.text = address.taxId ?? '';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final address = await getIt<BillingRepository>().getAddress();
      if (!mounted) return;
      _populate(address);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final line1 = _line1Controller.text.trim();
    final city = _cityController.text.trim();
    final state = _stateController.text.trim();
    final postalCode = _postalCodeController.text.trim();
    final country = _countryController.text.trim();
    if (line1.isEmpty ||
        city.isEmpty ||
        state.isEmpty ||
        postalCode.isEmpty ||
        country.length != 2) {
      setState(
        () => _error =
            'Address line, city, state, postal code and a 2-letter country '
                'code are required',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BillingRepository>().saveAddress(
        legalName: _legalNameController.text.trim(),
        line1: line1,
        line2: _line2Controller.text.trim(),
        city: city,
        state: state,
        postalCode: postalCode,
        country: country,
        taxId: _taxIdController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Billing address saved')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Billing Address', style: AppText.display(size: 18)),
            Text('Tax & invoice details', style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      FormAlert(message: _error!),
                    ],
                    const SizedBox(height: 16),
                    AppLabeledField(
                      label: 'Legal name',
                      hintText: 'e.g. Kaushal Fitness Pvt Ltd',
                      controller: _legalNameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Address line 1',
                      hintText: 'Street, building, area',
                      controller: _line1Controller,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Address line 2',
                      hintText: 'Apartment, suite, etc. (optional)',
                      controller: _line2Controller,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: AppLabeledField(
                            label: 'City',
                            hintText: 'e.g. Mumbai',
                            controller: _cityController,
                            textInputAction: TextInputAction.next,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppLabeledField(
                            label: 'State',
                            hintText: 'e.g. Maharashtra',
                            controller: _stateController,
                            textInputAction: TextInputAction.next,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: AppLabeledField(
                            label: 'Postal code',
                            hintText: 'e.g. 400001',
                            controller: _postalCodeController,
                            textInputAction: TextInputAction.next,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppLabeledField(
                            label: 'Country (e.g. IN, US)',
                            hintText: 'IN',
                            controller: _countryController,
                            textCapitalization: TextCapitalization.characters,
                            textInputAction: TextInputAction.next,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Tax ID',
                      hintText: 'e.g. GSTIN (optional)',
                      controller: _taxIdController,
                      textInputAction: TextInputAction.done,
                    ),
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Save address',
                      loading: _saving,
                      onPressed: _save,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }
}
