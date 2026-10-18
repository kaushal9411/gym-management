import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/gym_business_settings.dart';
import '../../../models/gym_email_notification_settings.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';
import 'widgets/settings_previews.dart';

/// Business Settings — web's `/gym-settings/business`: Regional & display
/// (currency code and symbol, timezone, date and time format, week start,
/// measurement unit, language), Email settings (the sender name and address of
/// outbound emails) and Notification preferences (the four tenant-wide channel
/// defaults, each still capped by the plan's quota), with a live format
/// preview. These were previously squeezed into the Gym profile screen.
///
/// One save bar fires `PATCH /settings/business`, `/email` and `/notifications`
/// together; on success the app's cached currency (`AppCurrency`) is refreshed
/// so money formatting follows the change immediately. Needs `settings:read` /
/// `settings:manage`. Client check: currency and timezone are required, like
/// web.
class BusinessSettingsScreen extends StatefulWidget {
  const BusinessSettingsScreen({super.key});

  @override
  State<BusinessSettingsScreen> createState() => _BusinessSettingsScreenState();
}

class _BusinessSettingsScreenState extends State<BusinessSettingsScreen> {
  late final SettingsAccess _access;
  final _currency = TextEditingController();
  final _symbol = TextEditingController();
  final _timezone = TextEditingController();
  final _locale = TextEditingController();
  final _fromName = TextEditingController();
  final _fromAddress = TextEditingController();
  String _dateFormat = 'MM/DD/YYYY';
  String _timeFormat = '12h';
  int _weekStart = 0;
  MeasurementUnit _unit = MeasurementUnit.metric;
  GymNotificationSettings _channels = const GymNotificationSettings(
    email: false,
    push: false,
    sms: false,
    whatsapp: false,
  );
  String _baseline = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<TextEditingController> get _all =>
      [_currency, _symbol, _timezone, _locale, _fromName, _fromAddress];

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

  String _snapshot() => [
        ..._all.map((c) => c.text.trim()),
        _dateFormat,
        _timeFormat,
        _weekStart,
        _unit.name,
        _channels.email,
        _channels.push,
        _channels.sms,
        _channels.whatsapp,
      ].join('\u0001');

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = getIt<GymSettingsRepository>();
      final results = await Future.wait<Object>([
        repo.getBusinessSettings(),
        repo.getEmailSettings(),
        repo.getNotificationSettings(),
      ]);
      if (!mounted) return;
      final b = results[0] as GymBusinessSettings;
      final e = results[1] as GymEmailSettings;
      setState(() {
        _currency.text = b.currency;
        _symbol.text = b.currencySymbol;
        _timezone.text = b.timezone;
        _locale.text = b.locale;
        _dateFormat = b.dateFormat;
        _timeFormat = b.timeFormat;
        _weekStart = b.weekStartDay;
        _unit = b.measurementUnit;
        _fromName.text = e.emailFromName ?? '';
        _fromAddress.text = e.emailFromAddress ?? '';
        _channels = results[2] as GymNotificationSettings;
        _baseline = _snapshot();
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
          _error = 'Could not load the business settings ($e)';
          _loading = false;
        });
      }
    }
  }

  bool get _dirty => !_loading && _error == null && _snapshot() != _baseline;

  Future<void> _save() async {
    if (_saving) return;
    if (_currency.text.trim().isEmpty || _timezone.text.trim().isEmpty) {
      teamSnack(context, 'Currency and timezone are required.', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final repo = getIt<GymSettingsRepository>();
      await Future.wait([
        repo.updateBusinessSettings(
          currency: _currency.text.trim().toUpperCase(),
          currencySymbol: _symbol.text.trim(),
          timezone: _timezone.text.trim(),
          dateFormat: _dateFormat,
          timeFormat: _timeFormat,
          measurementUnit: _unit,
          weekStartDay: _weekStart,
          locale: _locale.text.trim(),
        ),
        repo.updateEmailSettings(
          emailFromName: _fromName.text.trim(),
          emailFromAddress: _fromAddress.text.trim(),
        ),
        repo.updateNotificationSettings(_channels),
      ]);
      await AppCurrency.refresh();
      if (!mounted) return;
      setState(() => _baseline = _snapshot());
      teamSnack(context, 'Business settings saved');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save the settings ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = _access.canManage;
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    Widget channel(
      String title,
      String subtitle,
      IconData icon,
      bool value,
      GymNotificationSettings Function(bool) update,
    ) =>
        TeamToggleRow(
          title: title,
          subtitle: subtitle,
          icon: icon,
          color: TeamColors.indigo,
          value: value,
          onChanged:
              manage ? (v) => setState(() => _channels = update(v)) : null,
        );
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.business,
      title: 'Business Settings',
      subtitle: 'Currency, timezone, formats, outbound email identity, and '
          'notification channels.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (!_loading && _currency.text.isNotEmpty)
          ListHeroChip(
            icon: Icons.paid_rounded,
            label: 'Currency ${_currency.text.toUpperCase()}',
          ),
      ],
      saveBar: (manage && _dirty)
          ? SettingsSaveBar(
              saving: _saving,
              onSave: _save,
              onDiscard: _load,
            )
          : null,
      main: [
        if (!manage) const ReadOnlyNotice(),
        TeamFormSection(
          icon: Icons.public_rounded,
          color: TeamColors.teal,
          title: 'Regional & display',
          subtitle: 'Currency, timezone, date/time formats and units used '
              'across the app',
          children: [
            AppLabeledField(
              label: 'Currency (ISO code)',
              icon: Icons.paid_rounded,
              iconColor: TeamColors.green,
              controller: _currency,
              readOnly: !manage,
              textCapitalization: TextCapitalization.characters,
              inputFormatters: [
                LengthLimitingTextInputFormatter(3),
                FilteringTextInputFormatter.allow(RegExp('[A-Za-z]')),
              ],
            ),
            AppLabeledField(
              label: 'Currency symbol',
              icon: Icons.currency_rupee_rounded,
              iconColor: TeamColors.amber,
              controller: _symbol,
              readOnly: !manage,
              inputFormatters: [LengthLimitingTextInputFormatter(8)],
            ),
            AppLabeledField(
              label: 'Timezone',
              hintText: 'Asia/Kolkata',
              icon: Icons.schedule_rounded,
              iconColor: TeamColors.indigo,
              controller: _timezone,
              readOnly: !manage,
            ),
            OptionPickerField(
              label: 'Date format',
              icon: Icons.event_rounded,
              iconColor: TeamColors.violet,
              value: _dateFormat,
              options: const [
                ('MM/DD/YYYY', 'MM/DD/YYYY'),
                ('DD/MM/YYYY', 'DD/MM/YYYY'),
                ('YYYY-MM-DD', 'YYYY-MM-DD'),
              ],
              onChanged: (v) {
                if (manage && v != null) setState(() => _dateFormat = v);
              },
            ),
            OptionPickerField(
              label: 'Time format',
              icon: Icons.access_time_rounded,
              iconColor: TeamColors.sky,
              value: _timeFormat,
              options: const [('12h', '12-hour'), ('24h', '24-hour')],
              onChanged: (v) {
                if (manage && v != null) setState(() => _timeFormat = v);
              },
            ),
            OptionPickerField(
              label: 'Week starts on',
              icon: Icons.calendar_view_week_rounded,
              iconColor: TeamColors.fuchsia,
              value: '$_weekStart',
              options: [for (var i = 0; i < 7; i++) ('$i', days[i])],
              onChanged: (v) {
                if (manage && v != null) {
                  setState(() => _weekStart = int.tryParse(v) ?? 0);
                }
              },
            ),
            OptionPickerField(
              label: 'Measurement unit',
              icon: Icons.straighten_rounded,
              iconColor: TeamColors.rose,
              value: _unit.apiValue,
              options: const [
                ('METRIC', 'Metric (kg, cm)'),
                ('IMPERIAL', 'Imperial (lb, in)'),
              ],
              onChanged: (v) {
                if (manage && v != null) {
                  setState(() => _unit = MeasurementUnitX.fromApi(v));
                }
              },
            ),
            AppLabeledField(
              label: 'Language',
              hintText: 'en',
              icon: Icons.translate_rounded,
              iconColor: TeamColors.slate,
              controller: _locale,
              readOnly: !manage,
            ),
            Text(
              'Future-ready — the app is English-only today.',
              style: AppText.body(size: 11, color: AppColors.inkFaint),
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.mail_outline_rounded,
          color: TeamColors.indigo,
          title: 'Email settings',
          subtitle:
              'The sender identity used for outbound emails from your gym',
          children: [
            AppLabeledField(
              label: 'From name',
              icon: Icons.badge_outlined,
              iconColor: TeamColors.indigo,
              controller: _fromName,
              readOnly: !manage,
              textCapitalization: TextCapitalization.words,
            ),
            AppLabeledField(
              label: 'From address',
              icon: Icons.alternate_email_rounded,
              iconColor: TeamColors.violet,
              controller: _fromAddress,
              readOnly: !manage,
              keyboardType: TextInputType.emailAddress,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.notifications_active_outlined,
          color: TeamColors.fuchsia,
          title: 'Notification preferences',
          subtitle: "Tenant-wide channel defaults — each is still capped by "
              "the plan's platform-set quota",
          children: [
            channel(
              'Email notifications',
              'Send notifications by email',
              Icons.mail_outline_rounded,
              _channels.email,
              (v) => _channels.copyWith(email: v),
            ),
            channel(
              'Push notifications',
              'Send notifications to the mobile app',
              Icons.smartphone_rounded,
              _channels.push,
              (v) => _channels.copyWith(push: v),
            ),
            channel(
              'SMS notifications',
              'Send notifications by text message',
              Icons.sms_outlined,
              _channels.sms,
              (v) => _channels.copyWith(sms: v),
            ),
            channel(
              'WhatsApp notifications',
              'Send notifications on WhatsApp',
              Icons.chat_outlined,
              _channels.whatsapp,
              (v) => _channels.copyWith(whatsapp: v),
            ),
          ],
        ),
      ],
      aside: [
        FormatPreview(
          currency: _currency.text,
          symbol: _symbol.text,
          dateFormat: _dateFormat,
          timeFormat: _timeFormat,
          weekStartDay: _weekStart,
          unit: _unit,
          timezone: _timezone.text,
        ),
      ],
    );
  }
}
