import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/gym_branding.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';
import 'widgets/settings_previews.dart';

/// Invoice Settings — web's `/gym-settings/invoice`: Numbering, tax & terms
/// (invoice prefix, default tax %, default payment terms in days) and the
/// Invoice footer, with a live invoice-header preview. `PATCH
/// /settings/invoice` via the save bar; needs `settings:read` /
/// `settings:manage`. Client check: the prefix is required (like web).
///
/// 0 payment-terms days reads as "Due on receipt" (the API stores a number of
/// days).
class InvoiceSettingsScreen extends StatefulWidget {
  const InvoiceSettingsScreen({super.key});

  @override
  State<InvoiceSettingsScreen> createState() => _InvoiceSettingsScreenState();
}

class _InvoiceSettingsScreenState extends State<InvoiceSettingsScreen> {
  late final SettingsAccess _access;
  final _prefix = TextEditingController();
  final _tax = TextEditingController();
  final _terms = TextEditingController();
  final _footer = TextEditingController();
  String _gymName = '';
  String _baseline = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<TextEditingController> get _all => [_prefix, _tax, _terms, _footer];

  @override
  void initState() {
    super.initState();
    _access = SettingsAccess.of(context);
    for (final c in _all) {
      c.addListener(_changed);
    }
    if (_access.canRead) {
      _load();
    } else {
      _loading = false;
    }
  }

  @override
  void dispose() {
    for (final c in _all) {
      c.dispose();
    }
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  String _snapshot() => _all.map((c) => c.text.trim()).join('\u0001');

  void _apply(GymInvoiceSettings s) {
    _prefix.text = s.invoicePrefix;
    _tax.text = s.taxPercentage == s.taxPercentage.roundToDouble()
        ? s.taxPercentage.toInt().toString()
        : s.taxPercentage.toString();
    _terms.text = '${s.defaultPaymentTermsDays}';
    _footer.text = s.invoiceFooter ?? '';
    _baseline = _snapshot();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = getIt<GymSettingsRepository>();
      final s = await repo.getInvoiceSettings();
      try {
        _gymName = (await repo.getProfile()).gymName;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _apply(s);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.detailedMessage;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not load invoice settings ($e)';
          _loading = false;
        });
      }
    }
  }

  bool get _dirty => !_loading && _error == null && _snapshot() != _baseline;

  Future<void> _save() async {
    if (_saving) return;
    if (_prefix.text.trim().isEmpty) {
      teamSnack(context, 'Invoice prefix is required.', error: true);
      return;
    }
    final tax = double.tryParse(_tax.text.trim());
    final terms = int.tryParse(_terms.text.trim());
    if (tax == null || tax < 0 || tax > 100) {
      teamSnack(
        context,
        'Tax percentage must be between 0 and 100.',
        error: true,
      );
      return;
    }
    if (terms == null || terms < 0 || terms > 365) {
      teamSnack(context, 'Payment terms must be 0–365 days.', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final s = await getIt<GymSettingsRepository>().updateInvoiceSettings(
        invoicePrefix: _prefix.text.trim(),
        taxPercentage: tax,
        defaultPaymentTermsDays: terms,
        invoiceFooter: _footer.text.trim(),
      );
      invalidateSetupProgress();
      if (!mounted) return;
      setState(() => _apply(s));
      teamSnack(context, 'Invoice settings saved');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not save ($e)', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = _access.canManage;
    final tax = double.tryParse(_tax.text.trim()) ?? 0;
    final terms = int.tryParse(_terms.text.trim()) ?? 0;
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.invoice,
      title: 'Invoice Settings',
      subtitle: 'Defaults applied to invoices your gym issues to members.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (!_loading) ...[
          ListHeroChip(icon: Icons.percent_rounded, label: 'Default tax $tax%'),
          ListHeroChip(
            icon: Icons.event_rounded,
            label: terms > 0 ? 'Terms $terms days' : 'Due on receipt',
          ),
        ],
      ],
      saveBar: (manage && _dirty)
          ? SettingsSaveBar(saving: _saving, onSave: _save, onDiscard: _load)
          : null,
      main: [
        if (!manage) const ReadOnlyNotice(),
        TeamFormSection(
          icon: Icons.tag_rounded,
          color: TeamColors.green,
          title: 'Numbering, tax & terms',
          subtitle: 'Tax percentage is your default rate — it can still be '
              'overridden per invoice later',
          children: [
            AppLabeledField(
              label: 'Invoice prefix',
              icon: Icons.tag_rounded,
              iconColor: TeamColors.green,
              controller: _prefix,
              readOnly: !manage,
              textCapitalization: TextCapitalization.characters,
            ),
            AppLabeledField(
              label: 'Tax percentage',
              icon: Icons.percent_rounded,
              iconColor: TeamColors.amber,
              controller: _tax,
              readOnly: !manage,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
            AppLabeledField(
              label: 'Default payment terms (days)',
              icon: Icons.event_available_rounded,
              iconColor: TeamColors.indigo,
              controller: _terms,
              readOnly: !manage,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.description_outlined,
          color: TeamColors.indigo,
          title: 'Invoice footer',
          subtitle: 'Printed at the bottom of every invoice',
          children: [
            AppLabeledField(
              label: 'Invoice footer',
              hintText: 'e.g. Thank you for your business!',
              icon: Icons.notes_rounded,
              iconColor: TeamColors.violet,
              controller: _footer,
              readOnly: !manage,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
      ],
      aside: [
        InvoicePreview(
          prefix: _prefix.text,
          taxPercentage: tax,
          termsDays: terms,
          footer: _footer.text,
          gymName: _gymName,
        ),
      ],
    );
  }
}
