import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/billing_address.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Billing Address — web's `/billing/address`: the tenant's own tax / invoice
/// address for its platform subscription (`GET` / `PUT /billing/address`,
/// distinct from a *member's* address). `GET` returns `data: null` when
/// nothing has been saved yet — a real, common state for tenants provisioned
/// outside onboarding — which renders an empty form, not an error.
///
/// Same fields, order and rules as web's zod schema: Legal / business name
/// (optional, <= 160), Address line 1 (required, <= 200), Address line 2
/// (optional, <= 200), City and State / region (required, <= 100), Postal code
/// (required, <= 20), Country code (exactly 2 letters, upper-cased), Tax ID /
/// GST number (optional, <= 40); field-level messages match web's. Beside
/// (below on phones) the form sits web's live "Invoice preview" card ("Billed
/// to"). Saving is a full upsert; empty optional fields are left out of the
/// payload, as before.
///
/// Not gated per permission (menu tile `billing:read` only); a 403 on save
/// shows the server message, exactly as before.
class BillingAddressScreen extends StatefulWidget {
  const BillingAddressScreen({super.key});

  @override
  State<BillingAddressScreen> createState() => _BillingAddressScreenState();
}

class _BillingAddressScreenState extends State<BillingAddressScreen> {
  final _legalName = TextEditingController();
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _postalCode = TextEditingController();
  final _country = TextEditingController();
  final _taxId = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _loadError;
  String? _serverError;
  final _errors = <String, String>{};

  List<TextEditingController> get _all => [
        _legalName,
        _line1,
        _line2,
        _city,
        _state,
        _postalCode,
        _country,
        _taxId,
      ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _all) {
      c.dispose();
    }
    super.dispose();
  }

  void _populate(BillingAddress? address) {
    if (address == null) return;
    _legalName.text = address.legalName ?? '';
    _line1.text = address.line1;
    _line2.text = address.line2 ?? '';
    _city.text = address.city;
    _state.text = address.state;
    _postalCode.text = address.postalCode;
    _country.text = address.country;
    _taxId.text = address.taxId ?? '';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final address = await getIt<BillingRepository>().getAddress();
      if (!mounted) return;
      _populate(address);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) {
        setState(() => _loadError = 'Could not load the address ($e)');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// web's zod rules; returns field -> message.
  Map<String, String> _validate() {
    final e = <String, String>{};
    if (_line1.text.trim().isEmpty) e['line1'] = 'Address line 1 is required';
    if (_city.text.trim().isEmpty) e['city'] = 'City is required';
    if (_state.text.trim().isEmpty) e['state'] = 'State is required';
    if (_postalCode.text.trim().isEmpty) {
      e['postalCode'] = 'Postal code is required';
    }
    if (_country.text.trim().length != 2) {
      e['country'] = 'Use a 2-letter country code (e.g. US, IN, GB)';
    }
    return e;
  }

  Future<void> _save() async {
    if (_saving) return;
    final errors = _validate();
    if (errors.isNotEmpty) {
      setState(() {
        _errors
          ..clear()
          ..addAll(errors);
        _serverError = null;
      });
      return;
    }
    setState(() {
      _saving = true;
      _serverError = null;
      _errors.clear();
    });
    try {
      await getIt<BillingRepository>().saveAddress(
        legalName: _legalName.text.trim(),
        line1: _line1.text.trim(),
        line2: _line2.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        postalCode: _postalCode.text.trim(),
        country: _country.text.trim(),
        taxId: _taxId.text.trim(),
      );
      if (!mounted) return;
      teamSnack(context, 'Billing address saved');
    } on ApiException catch (e) {
      if (mounted) setState(() => _serverError = e.detailedMessage);
    } catch (e) {
      if (mounted) {
        setState(() => _serverError = 'Could not save the address ($e)');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _clearError(String field) {
    if (_errors.containsKey(field)) setState(() => _errors.remove(field));
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Billing Address'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Hero(
              top: top,
              subtitle: 'The address and tax ID printed on your $appName '
                  'invoices.',
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 60),
                child: AppLoadingView(),
              )
            else if (_loadError != null)
              Padding(
                padding: const EdgeInsets.only(top: 40),
                child: AppErrorView(message: _loadError!, onRetry: _load),
              )
            else
              TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: LayoutBuilder(
                    builder: (context, c) {
                      final form = _form();
                      final preview = _preview();
                      if (c.maxWidth < 760) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [form, const SizedBox(height: 14), preview],
                        );
                      }
                      return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 3, child: form),
                          const SizedBox(width: 14),
                          Expanded(flex: 2, child: preview),
                        ],
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _form() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_serverError != null) ...[
          FormAlert(message: _serverError!),
          const SizedBox(height: 14),
        ],
        TeamFormSection(
          icon: Icons.location_on_rounded,
          color: TeamColors.indigo,
          title: 'Billing address',
          subtitle: 'Used to calculate tax and shown on invoices',
          children: [
            _field(
              'Legal / business name (optional)',
              _legalName,
              'legalName',
              hint: 'e.g. Kaushal Fitness Pvt Ltd',
              icon: Icons.business_rounded,
              max: 160,
            ),
            _field(
              'Address line 1',
              _line1,
              'line1',
              hint: 'Street, building, area',
              icon: Icons.home_rounded,
              max: 200,
            ),
            _field(
              'Address line 2 (optional)',
              _line2,
              'line2',
              hint: 'Apartment, suite, etc.',
              icon: Icons.apartment_rounded,
              max: 200,
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _field(
                    'City',
                    _city,
                    'city',
                    hint: 'e.g. Mumbai',
                    max: 100,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    'State / region',
                    _state,
                    'state',
                    hint: 'e.g. Maharashtra',
                    max: 100,
                  ),
                ),
              ],
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _field(
                    'Postal code',
                    _postalCode,
                    'postalCode',
                    hint: 'e.g. 400001',
                    max: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field(
                    'Country code',
                    _country,
                    'country',
                    hint: 'IN',
                    caps: true,
                  ),
                ),
              ],
            ),
            _field(
              'Tax ID / GST number (optional)',
              _taxId,
              'taxId',
              hint: 'e.g. GSTIN',
              icon: Icons.confirmation_number_rounded,
              max: 40,
              last: true,
            ),
          ],
        ),
        const SizedBox(height: 18),
        TeamGradientButton(
          key: const ValueKey('address-save'),
          label: 'Save billing address',
          icon: Icons.check_rounded,
          loading: _saving,
          onTap: _save,
        ),
      ],
    );
  }

  Widget _field(
    String label,
    TextEditingController controller,
    String name, {
    String? hint,
    IconData? icon,
    int? max,
    bool caps = false,
    bool last = false,
  }) {
    return AppLabeledField(
      key: ValueKey('address-$name'),
      label: label,
      hintText: hint,
      icon: icon,
      iconColor: TeamColors.indigo,
      controller: controller,
      errorText: _errors[name],
      textCapitalization:
          caps ? TextCapitalization.characters : TextCapitalization.words,
      textInputAction: last ? TextInputAction.done : TextInputAction.next,
      inputFormatters: [if (max != null) LengthLimitingTextInputFormatter(max)],
      onChanged: (_) => _clearError(name),
    );
  }

  Widget _preview() {
    return TeamSectionCard(
      icon: Icons.receipt_rounded,
      color: TeamColors.fuchsia,
      title: 'Invoice preview',
      subtitle: 'How your details will appear on invoices',
      child: ListenableBuilder(
        listenable: Listenable.merge(_all),
        builder: (context, _) {
          String t(TextEditingController c) => c.text.trim();
          final cityLine = [
            t(_city),
            [t(_state), t(_postalCode)].where((s) => s.isNotEmpty).join(' '),
          ].where((s) => s.isNotEmpty).join(', ');
          final hasAny = _all.any((c) => t(c).isNotEmpty);
          final lines = <Widget>[
            if (t(_legalName).isNotEmpty)
              Text(
                t(_legalName),
                style: AppText.display(size: 16),
              ),
            if (t(_line1).isNotEmpty) _line(t(_line1)),
            if (t(_line2).isNotEmpty) _line(t(_line2)),
            if (cityLine.isNotEmpty) _line(cityLine),
            if (t(_country).isNotEmpty) _line(t(_country).toUpperCase()),
            if (t(_taxId).isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Tax ID: ${t(_taxId)}',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ),
          ];
          return Container(
            key: const ValueKey('address-preview'),
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.location_on_rounded,
                      size: 14,
                      color: AppColors.inkFaint,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'BILLED TO',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w800,
                        color: AppColors.inkFaint,
                      ).copyWith(letterSpacing: 1.2),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (hasAny)
                  ...lines
                else
                  Text(
                    'Start typing to preview your invoice address.',
                    style: AppText.body(
                      size: 13,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _line(String s) => Padding(
        padding: const EdgeInsets.only(bottom: 2),
        child:
            Text(s, style: AppText.body(size: 13.5, weight: FontWeight.w600)),
      );
}

/// Full-width gradient header under the transparent app bar.
class _Hero extends StatelessWidget {
  const _Hero({required this.top, required this.subtitle});

  final double top;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final side = 18 + teamSideInset(context);
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(side, top + 4, side, 22),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
              ),
              child: const Icon(
                Icons.location_on_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Billing address',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Billing · Tax & invoice details',
                    icon: Icons.credit_card_rounded,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
