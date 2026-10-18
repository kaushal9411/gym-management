import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_ai_settings.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';

/// Web's provider list (`PROVIDERS`); the empty value means "Platform default".
const _providers = <(String, String)>[
  ('', 'Platform default'),
  ('openrouter', 'OpenRouter'),
  ('openai', 'OpenAI'),
  ('anthropic', 'Anthropic Claude'),
  ('gemini', 'Google Gemini'),
  ('azure-openai', 'Azure OpenAI'),
  ('ollama', 'Local LLM (Ollama)'),
];

/// AI Assistant — web's `/gym-settings/ai`: bring your own AI provider key, or
/// leave everything blank to use the platform default. Provider cards, model,
/// credentials (the API key is stored encrypted and never shown again — only
/// "Key saved" / "Using saved key (masked)", with "Clear stored key"), optional
/// base URL, temperature (0–2, with the precise → creative scale) and max
/// tokens, a live configuration summary, and "Reset everything to the platform
/// default". `GET` / `PUT` / `DELETE /ai/settings`.
///
/// Needs `settings:read` to open and `settings:manage` to change (web's rule);
/// the API also requires the `ai:use` permission and the `ai_coach` module, so
/// on a plan without it the API answers "This module is currently unavailable"
/// and that message is shown with a Retry — the page never pretends to work.
class AiSettingsScreen extends StatefulWidget {
  const AiSettingsScreen({super.key});

  @override
  State<AiSettingsScreen> createState() => _AiSettingsScreenState();
}

class _AiSettingsScreenState extends State<AiSettingsScreen> {
  late final SettingsAccess _access;
  final _model = TextEditingController();
  final _baseUrl = TextEditingController();
  final _temperature = TextEditingController();
  final _maxTokens = TextEditingController();
  final _apiKey = TextEditingController();
  String _provider = '';
  bool _clearKey = false;
  TenantAiSettings? _settings;
  String _platformName = 'the platform';
  String _baseline = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<TextEditingController> get _all =>
      [_model, _baseUrl, _temperature, _maxTokens, _apiKey];

  @override
  void initState() {
    super.initState();
    _access = SettingsAccess.of(context);
    // The platform's display name (web: `tenant.platformName`).
    try {
      _platformName = context.read<PlatformConfigCubit>().state.appName;
    } catch (_) {
      // No provider (e.g. in isolation): keep the generic wording.
    }
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

  String _form() => [
        _provider,
        _model.text.trim(),
        _baseUrl.text.trim(),
        _temperature.text.trim(),
        _maxTokens.text.trim(),
      ].join('\u0001');

  bool get _dirty =>
      !_loading &&
      _error == null &&
      (_form() != _baseline || _apiKey.text.trim().isNotEmpty || _clearKey);

  void _apply(TenantAiSettings s) {
    _settings = s;
    _provider = s.provider ?? '';
    _model.text = s.model ?? '';
    _baseUrl.text = s.baseUrl ?? '';
    _temperature.text = s.temperature?.toString() ?? '';
    _maxTokens.text = s.maxTokens?.toString() ?? '';
    _apiKey.clear();
    _clearKey = false;
    _baseline = _form();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await getIt<GymSettingsRepository>().getAiSettings();
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
          _error = 'Could not load the AI settings ($e)';
          _loading = false;
        });
      }
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    final temp = _temperature.text.trim().isEmpty
        ? null
        : double.tryParse(_temperature.text.trim());
    final tokens = _maxTokens.text.trim().isEmpty
        ? null
        : int.tryParse(_maxTokens.text.trim());
    if (_temperature.text.trim().isNotEmpty &&
        (temp == null || temp < 0 || temp > 2)) {
      teamSnack(context, 'Temperature must be between 0 and 2.', error: true);
      return;
    }
    if (_maxTokens.text.trim().isNotEmpty &&
        (tokens == null || tokens < 1 || tokens > 32000)) {
      teamSnack(
        context,
        'Max tokens must be between 1 and 32000.',
        error: true,
      );
      return;
    }
    setState(() => _saving = true);
    try {
      final s = await getIt<GymSettingsRepository>().updateAiSettings(
        provider: _provider,
        model: _model.text.trim(),
        baseUrl: _baseUrl.text.trim(),
        temperature: temp,
        maxTokens: tokens,
        apiKey: _apiKey.text.trim().isNotEmpty
            ? _apiKey.text.trim()
            : (_clearKey ? '' : null),
      );
      if (!mounted) return;
      setState(() => _apply(s));
      teamSnack(context, 'AI settings saved.');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not save ($e)', error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reset() async {
    final ok = await confirmTeam(
      context,
      title: 'Reset to the platform default?',
      message: 'Your own provider, model and key are removed and the shared '
          'platform AI configuration is used again.',
      confirmLabel: 'Reset',
      destructive: true,
    );
    if (!ok || !mounted) return;
    try {
      await getIt<GymSettingsRepository>().resetAiSettings();
      if (!mounted) return;
      teamSnack(context, 'Reverted to the platform default AI configuration.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not reset ($e)', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = _access.canManage;
    final s = _settings;
    final temp = double.tryParse(_temperature.text.trim());
    final tempPct = temp == null ? null : (temp / 2).clamp(0.0, 1.0);
    final keyState = _clearKey
        ? 'clearing'
        : _apiKey.text.trim().isNotEmpty
            ? 'new'
            : (s?.hasApiKey ?? false)
                ? 'saved'
                : 'none';
    final keyLabel = switch (keyState) {
      'saved' => 'Key saved',
      'new' => 'New key (unsaved)',
      'clearing' => 'Will be cleared',
      _ => 'Not saved',
    };
    final providerLabel = _providers
        .firstWhere((p) => p.$1 == _provider, orElse: () => _providers.first)
        .$2;
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.ai,
      title: 'AI Assistant',
      subtitle: 'Bring your own AI provider key, or leave blank to use the '
          'platform default.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (s != null)
          ListHeroChip(
            icon: Icons.smart_toy_rounded,
            label: s.usingPlatformDefault
                ? 'Source: Platform'
                : 'Source: Your own',
          ),
      ],
      saveBar: (manage && _dirty)
          ? SettingsSaveBar(
              saving: _saving,
              onSave: _save,
              onDiscard: () {
                if (s != null) setState(() => _apply(s));
              },
            )
          : null,
      main: [
        if (!manage) const ReadOnlyNotice(),
        TeamFormSection(
          icon: Icons.smart_toy_rounded,
          color: TeamColors.violet,
          title: 'Your own AI provider',
          subtitle: (s?.usingPlatformDefault ?? true)
              ? "You're currently using $_platformName's shared platform AI "
                  'configuration. Leave a field blank to fall back to the '
                  'platform default for that field.'
              : "You're using your own AI provider configuration for this gym. "
                  'Leave a field blank to fall back to the platform default '
                  'for that field.',
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final p in _providers)
                  TeamFilterChip(
                    label: p.$2,
                    selected: _provider == p.$1,
                    color: TeamColors.violet,
                    onTap: () {
                      if (manage) setState(() => _provider = p.$1);
                    },
                  ),
              ],
            ),
            AppLabeledField(
              label: 'Model',
              hintText: 'e.g. google/gemma-4-31b-it:free',
              icon: Icons.psychology_rounded,
              iconColor: TeamColors.violet,
              controller: _model,
              readOnly: !manage,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.key_rounded,
          color: TeamColors.green,
          title: 'Credentials',
          subtitle: 'The key is stored encrypted and never displayed again',
          children: [
            AppLabeledField(
              label: 'API key',
              hintText: _clearKey
                  ? 'Will be cleared on save'
                  : (s?.hasApiKey ?? false)
                      ? 'Using saved key (${s?.apiKeyMasked ?? '••••'})'
                      : 'Not set — using the platform key',
              icon: Icons.vpn_key_outlined,
              iconColor: TeamColors.green,
              controller: _apiKey,
              obscureText: true,
              readOnly: !manage || _clearKey,
            ),
            if ((s?.hasApiKey ?? false) && manage)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() {
                    _clearKey = !_clearKey;
                    _apiKey.clear();
                  }),
                  child: Text(
                    _clearKey ? 'Cancel clearing key' : 'Clear stored key',
                  ),
                ),
              ),
            AppLabeledField(
              label: 'Base URL (optional)',
              hintText: "Leave blank for the provider's default endpoint",
              icon: Icons.link_rounded,
              iconColor: TeamColors.sky,
              controller: _baseUrl,
              readOnly: !manage,
              keyboardType: TextInputType.url,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.thermostat_rounded,
          color: TeamColors.amber,
          title: 'Generation',
          subtitle: 'Creativity and response length',
          children: [
            AppLabeledField(
              label: 'Temperature (0–2)',
              hintText: 'Platform default',
              icon: Icons.thermostat_rounded,
              iconColor: TeamColors.amber,
              controller: _temperature,
              readOnly: !manage,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
            Container(
              height: 8,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                gradient: const LinearGradient(
                  colors: [TeamColors.teal, TeamColors.green, TeamColors.rose],
                ),
              ),
              child: tempPct == null
                  ? null
                  : Align(
                      alignment: Alignment(tempPct * 2 - 1, 0),
                      child: Container(
                        width: 16,
                        height: 16,
                        decoration: BoxDecoration(
                          color: AppColors.ink,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (final l in const ['Precise', 'Balanced', 'Creative'])
                  Text(
                    l,
                    style: AppText.body(
                      size: 10,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
            AppLabeledField(
              label: 'Max tokens',
              hintText: 'Platform default',
              icon: Icons.data_array_rounded,
              iconColor: TeamColors.indigo,
              controller: _maxTokens,
              readOnly: !manage,
              keyboardType: TextInputType.number,
            ),
            if (manage && s != null && !s.usingPlatformDefault)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _reset,
                  child: Text(
                    'Reset everything to the platform default',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
      aside: [
        TeamSectionCard(
          icon: Icons.auto_awesome_rounded,
          color: TeamColors.violet,
          title: 'Configuration summary',
          subtitle: 'Reflects the form; the key is never shown',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                PreviewRow('Provider', providerLabel),
                PreviewRow(
                  'Model',
                  _model.text.trim().isEmpty
                      ? 'Platform default'
                      : _model.text.trim(),
                ),
                PreviewRow(
                  'Max tokens',
                  _maxTokens.text.trim().isEmpty
                      ? 'Platform default'
                      : _maxTokens.text.trim(),
                ),
                PreviewRow('API key', keyLabel),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
