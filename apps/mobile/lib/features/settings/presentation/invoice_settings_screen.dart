import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_branding.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "11c. Invoice settings". The frame's "Payment terms —
/// Due on receipt" is a free-text label; the API stores it as a number of
/// days (`defaultPaymentTermsDays`), so it's a numeric field here — 0 days
/// is "due on receipt".
class InvoiceSettingsScreen extends StatefulWidget {
  const InvoiceSettingsScreen({super.key});

  @override
  State<InvoiceSettingsScreen> createState() => _InvoiceSettingsScreenState();
}

class _InvoiceSettingsScreenState extends State<InvoiceSettingsScreen> {
  final _prefixController = TextEditingController();
  final _taxController = TextEditingController();
  final _termsController = TextEditingController();
  final _footerController = TextEditingController();
  GymInvoiceSettings? _settings;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _prefixController.dispose();
    _taxController.dispose();
    _termsController.dispose();
    _footerController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final settings = await getIt<GymSettingsRepository>().getInvoiceSettings();
      if (!mounted) return;
      setState(() {
        _settings = settings;
        _prefixController.text = settings.invoicePrefix;
        _taxController.text = settings.taxPercentage.toStringAsFixed(
          settings.taxPercentage % 1 == 0 ? 0 : 2,
        );
        _termsController.text = '${settings.defaultPaymentTermsDays}';
        _footerController.text = settings.invoiceFooter ?? '';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    final tax = double.tryParse(_taxController.text.trim());
    final terms = int.tryParse(_termsController.text.trim());
    if (_prefixController.text.trim().isEmpty) {
      setState(() => _error = 'Enter an invoice prefix');
      return;
    }
    if (tax == null || tax < 0 || tax > 100) {
      setState(() => _error = 'Tax rate must be between 0 and 100');
      return;
    }
    if (terms == null || terms < 0) {
      setState(() => _error = 'Enter payment terms in days');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GymSettingsRepository>().updateInvoiceSettings(
        invoicePrefix: _prefixController.text.trim(),
        taxPercentage: tax,
        defaultPaymentTermsDays: terms,
        invoiceFooter: _footerController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invoice settings saved')),
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
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Invoice Settings', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _settings == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  if (_error != null) ...[
                    FormAlert(message: _error!),
                    const SizedBox(height: 12),
                  ],
                  AppLabeledField(
                    label: 'Invoice prefix',
                    hintText: 'e.g. INV-',
                    controller: _prefixController,
                  ),
                  const SizedBox(height: 14),
                  AppLabeledField(
                    label: 'Tax rate % (GST)',
                    hintText: 'e.g. 18',
                    controller: _taxController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'^\d*\.?\d{0,2}'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  AppLabeledField(
                    label: 'Payment terms (days)',
                    hintText: 'e.g. 7 (0 = due on receipt)',
                    controller: _termsController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  ),
                  const SizedBox(height: 14),
                  AppLabeledField(
                    label: 'Footer note',
                    hintText: 'e.g. Thank you for your business (optional)',
                    controller: _footerController,
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
