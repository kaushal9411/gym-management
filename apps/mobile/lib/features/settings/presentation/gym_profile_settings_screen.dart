import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/business_hours.dart';
import '../../../models/gym_profile.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';
import 'widgets/business_hours_editor.dart';
import 'widgets/settings_previews.dart';

/// Gym Profile — web's `/gym-settings/profile`: the setup-progress card, Basic
/// information (name, legal name, registration, GST / VAT, business type,
/// description), Contact information (email, website, phones, address,
/// coordinates), Business hours (per weekday) and Social media links, with the
/// weekly-hours chart and the business-card preview beside / below them.
///
/// Saving mirrors web: one bar for the whole page that fires the four writes
/// (`PATCH /settings/profile`, `/contact`, `/business-hours`, `/social-links`)
/// together, then reloads the profile. Needs `settings:read` to open and
/// `settings:manage` to edit (read-only otherwise, no save bar).
/// "Gym name is required." is the one client check, like web's required field.
///
/// **Dropped vs web**: nothing. The business-settings block that used to live
/// on this screen moved to its own Business page, as on web.
class GymProfileSettingsScreen extends StatefulWidget {
  const GymProfileSettingsScreen({super.key});

  @override
  State<GymProfileSettingsScreen> createState() =>
      _GymProfileSettingsScreenState();
}

class _GymProfileSettingsScreenState extends State<GymProfileSettingsScreen> {
  late final SettingsAccess _access;

  static const _textKeys = [
    'gymName',
    'legalBusinessName',
    'registrationNumber',
    'gstVatNumber',
    'businessType',
    'description',
    'email',
    'website',
    'phone',
    'alternatePhone',
    'addressLine',
    'city',
    'state',
    'country',
    'postalCode',
    'latitude',
    'longitude',
    'facebook',
    'instagram',
    'twitter',
    'youtube',
    'linkedin',
  ];
  final Map<String, TextEditingController> _c = {
    for (final k in _textKeys) k: TextEditingController(),
  };
  BusinessHours _hours = const BusinessHours();
  String _baseline = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _access = SettingsAccess.of(context);
    for (final c in _c.values) {
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
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _changed() {
    if (mounted) setState(() {});
  }

  String _snapshot() =>
      '${_textKeys.map((k) => _c[k]!.text.trim()).join('\u0001')}'
      '\u0002${_hours.toJson()}';

  void _apply(GymProfile p) {
    String s(String? v) => v ?? '';
    final social = p.socialLinks;
    final v = <String, String>{
      'gymName': p.gymName,
      'legalBusinessName': s(p.legalBusinessName),
      'registrationNumber': s(p.registrationNumber),
      'gstVatNumber': s(p.gstVatNumber),
      'businessType': s(p.businessType),
      'description': s(p.description),
      'email': s(p.email),
      'website': s(p.website),
      'phone': s(p.phone),
      'alternatePhone': s(p.alternatePhone),
      'addressLine': s(p.addressLine),
      'city': s(p.city),
      'state': s(p.state),
      'country': s(p.country),
      'postalCode': s(p.postalCode),
      'latitude': p.latitude?.toString() ?? '',
      'longitude': p.longitude?.toString() ?? '',
      'facebook': s(social?.facebook),
      'instagram': s(social?.instagram),
      'twitter': s(social?.twitter),
      'youtube': s(social?.youtube),
      'linkedin': s(social?.linkedin),
    };
    for (final e in v.entries) {
      _c[e.key]!.text = e.value;
    }
    _hours = p.businessHours;
    _baseline = _snapshot();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final p = await getIt<GymSettingsRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _apply(p);
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
          _error = 'Could not load the gym profile ($e)';
          _loading = false;
        });
      }
    }
  }

  bool get _dirty => !_loading && _error == null && _snapshot() != _baseline;

  Future<void> _save() async {
    if (_saving) return;
    String t(String k) => _c[k]!.text.trim();
    if (t('gymName').isEmpty) {
      teamSnack(context, 'Gym name is required.', error: true);
      return;
    }
    double? coord(String k, String label) {
      if (t(k).isEmpty) return null;
      final d = double.tryParse(t(k));
      if (d == null) throw ApiException(message: '$label must be a number.');
      return d;
    }

    setState(() => _saving = true);
    try {
      final lat = coord('latitude', 'Latitude');
      final lng = coord('longitude', 'Longitude');
      final repo = getIt<GymSettingsRepository>();
      await Future.wait([
        repo.updateProfile(
          gymName: t('gymName'),
          legalBusinessName: t('legalBusinessName'),
          registrationNumber: t('registrationNumber'),
          gstVatNumber: t('gstVatNumber'),
          businessType: t('businessType'),
          description: t('description'),
        ),
        repo.updateContact(
          email: t('email'),
          phone: t('phone'),
          alternatePhone: t('alternatePhone'),
          website: t('website'),
          addressLine: t('addressLine'),
          city: t('city'),
          state: t('state'),
          country: t('country'),
          postalCode: t('postalCode'),
          latitude: lat,
          longitude: lng,
        ),
        repo.updateBusinessHours(_hours),
        repo.updateSocialLinks(
          facebook: t('facebook'),
          instagram: t('instagram'),
          twitter: t('twitter'),
          youtube: t('youtube'),
          linkedin: t('linkedin'),
        ),
      ]);
      invalidateSetupProgress();
      final fresh = await repo.getProfile();
      if (!mounted) return;
      setState(() => _apply(fresh));
      teamSnack(context, 'Gym profile saved');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save the profile ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _discard() async {
    setState(() => _loading = true);
    await _load();
  }

  AppLabeledField _field(
    String key,
    String label, {
    IconData? icon,
    Color? color,
    TextInputType? keyboard,
    String? hint,
    int maxLines = 1,
    TextCapitalization cap = TextCapitalization.none,
  }) =>
      AppLabeledField(
        label: label,
        icon: icon,
        iconColor: color,
        hintText: hint,
        controller: _c[key]!,
        keyboardType: keyboard,
        readOnly: !_access.canManage,
        minLines: maxLines > 1 ? 3 : null,
        maxLines: maxLines,
        textCapitalization: cap,
      );

  int get _socialCount => [
        'facebook',
        'instagram',
        'twitter',
        'youtube',
        'linkedin',
      ].where((k) => _c[k]!.text.trim().isNotEmpty).length;

  @override
  Widget build(BuildContext context) {
    final address = [
      _c['addressLine']!.text.trim(),
      [_c['city']!.text.trim(), _c['state']!.text.trim()]
          .where((s) => s.isNotEmpty)
          .join(', '),
      [_c['country']!.text.trim(), _c['postalCode']!.text.trim()]
          .where((s) => s.isNotEmpty)
          .join(' '),
    ].where((s) => s.isNotEmpty).join(' - ');
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.profile,
      title: 'Gym Profile',
      subtitle: "Your gym's identity, legal details, contact info, hours and "
          'social links.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (!_loading)
          ListHeroChip(
            icon: Icons.schedule_rounded,
            label: '${weeklyHoursOf(_hours)} hours open / week',
          ),
      ],
      saveBar: (_access.canManage && _dirty)
          ? SettingsSaveBar(
              saving: _saving,
              onSave: _save,
              onDiscard: _discard,
            )
          : null,
      main: [
        if (!_access.canManage) const ReadOnlyNotice(),
        const SetupProgressCard(),
        TeamFormSection(
          icon: Icons.storefront_rounded,
          color: TeamColors.indigo,
          title: 'Basic information',
          subtitle: 'Identity and legal details',
          children: [
            _field(
              'gymName',
              'Gym name',
              icon: Icons.fitness_center_rounded,
              color: TeamColors.indigo,
              cap: TextCapitalization.words,
            ),
            _field(
              'legalBusinessName',
              'Legal business name',
              icon: Icons.gavel_rounded,
              color: TeamColors.violet,
              cap: TextCapitalization.words,
            ),
            _field(
              'registrationNumber',
              'Registration number',
              icon: Icons.tag_rounded,
              color: TeamColors.teal,
            ),
            _field(
              'gstVatNumber',
              'GST / VAT number',
              icon: Icons.receipt_long_rounded,
              color: TeamColors.green,
            ),
            _field(
              'businessType',
              'Business type',
              icon: Icons.category_rounded,
              color: TeamColors.amber,
              hint: 'e.g. Fitness Center',
              cap: TextCapitalization.words,
            ),
            _field(
              'description',
              'Description',
              icon: Icons.notes_rounded,
              color: TeamColors.slate,
              maxLines: 5,
              cap: TextCapitalization.sentences,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.contact_phone_rounded,
          color: TeamColors.teal,
          title: 'Contact information',
          subtitle: 'How members and partners reach you',
          children: [
            _field(
              'email',
              'Email',
              icon: Icons.mail_outline_rounded,
              color: TeamColors.indigo,
              keyboard: TextInputType.emailAddress,
            ),
            _field(
              'website',
              'Website',
              icon: Icons.public_rounded,
              color: TeamColors.sky,
              keyboard: TextInputType.url,
            ),
            _field(
              'phone',
              'Phone',
              icon: Icons.phone_outlined,
              color: TeamColors.green,
              keyboard: TextInputType.phone,
            ),
            _field(
              'alternatePhone',
              'Alternate phone',
              icon: Icons.phone_forwarded_outlined,
              color: TeamColors.teal,
              keyboard: TextInputType.phone,
            ),
            _field(
              'addressLine',
              'Address',
              icon: Icons.place_outlined,
              color: TeamColors.rose,
              cap: TextCapitalization.words,
            ),
            _field(
              'city',
              'City',
              icon: Icons.location_city_rounded,
              color: TeamColors.amber,
              cap: TextCapitalization.words,
            ),
            _field(
              'state',
              'State',
              icon: Icons.map_outlined,
              color: TeamColors.violet,
              cap: TextCapitalization.words,
            ),
            _field(
              'country',
              'Country',
              icon: Icons.flag_outlined,
              color: TeamColors.fuchsia,
              cap: TextCapitalization.words,
            ),
            _field(
              'postalCode',
              'Postal code',
              icon: Icons.markunread_mailbox_outlined,
              color: TeamColors.slate,
            ),
            _field(
              'latitude',
              'Latitude',
              icon: Icons.my_location_rounded,
              color: TeamColors.indigo,
              keyboard: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
            ),
            _field(
              'longitude',
              'Longitude',
              icon: Icons.explore_outlined,
              color: TeamColors.indigo,
              keyboard: const TextInputType.numberWithOptions(
                decimal: true,
                signed: true,
              ),
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.schedule_rounded,
          color: TeamColors.amber,
          title: 'Business hours',
          subtitle: 'Opening and closing time for each day',
          children: [
            BusinessHoursEditor(
              value: _hours,
              disabled: !_access.canManage,
              onChanged: (h) => setState(() => _hours = h),
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.share_rounded,
          color: TeamColors.fuchsia,
          title: 'Social media links',
          children: [
            _field(
              'facebook',
              'Facebook',
              icon: Icons.facebook_rounded,
              color: const Color(0xFF1877F2),
              keyboard: TextInputType.url,
              hint: 'https://facebook.com/yourgym',
            ),
            _field(
              'instagram',
              'Instagram',
              icon: Icons.camera_alt_outlined,
              color: const Color(0xFFE1306C),
              keyboard: TextInputType.url,
              hint: 'https://instagram.com/yourgym',
            ),
            _field(
              'twitter',
              'Twitter / X',
              icon: Icons.alternate_email_rounded,
              color: TeamColors.sky,
              keyboard: TextInputType.url,
              hint: 'https://twitter.com/yourgym',
            ),
            _field(
              'youtube',
              'YouTube',
              icon: Icons.smart_display_outlined,
              color: const Color(0xFFFF0000),
              keyboard: TextInputType.url,
              hint: 'https://youtube.com/@yourgym',
            ),
            _field(
              'linkedin',
              'LinkedIn',
              icon: Icons.work_outline_rounded,
              color: const Color(0xFF0A66C2),
              keyboard: TextInputType.url,
              hint: 'https://linkedin.com/company/yourgym',
            ),
          ],
        ),
      ],
      aside: [
        HoursChartCard(hours: _hours),
        BusinessCardPreview(
          gymName: _c['gymName']!.text,
          businessType: _c['businessType']!.text,
          description: _c['description']!.text,
          email: _c['email']!.text,
          phone: _c['phone']!.text,
          website: _c['website']!.text,
          address: address,
          socialCount: _socialCount,
        ),
      ],
    );
  }
}
