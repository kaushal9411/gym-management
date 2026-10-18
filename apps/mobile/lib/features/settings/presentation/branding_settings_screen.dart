import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/gym_branding.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';
import 'widgets/settings_fields.dart';
import 'widgets/settings_previews.dart';

/// Branding — web's `/gym-settings/branding`: Theme colors (primary and
/// secondary colour, the theme — Match device / Light / Dark — and the login
/// welcome message), the five Images (logo, favicon, login background,
/// dashboard banner, email logo) and a live preview of the login screen and
/// dashboard.
///
/// Colours, theme and message save with the save bar (`PATCH
/// /settings/branding`; a blank secondary colour or message is left out, as on
/// web). **Each image uploads and saves immediately**, like web (`POST
/// /settings/branding/{logo,favicon,upload}`): pick from the camera or
/// gallery, the picture is shrunk to the size web uses (logo and email logo
/// 512, favicon 64, backgrounds 1280) and sent as a base64 data URL — the
/// API's 1 MB body cap applies, oversized pictures are refused with a message.
///
/// Needs `settings:read` / `settings:manage`. Colours accept any CSS colour as
/// text (saved as typed) plus preset swatches; only `#rrggbb` can be drawn in
/// the preview.
///
/// **Dropped vs web**: the browser's native colour picker (preset swatches +
/// the hex field replace it) and upload progress percentage (a spinner).
class BrandingSettingsScreen extends StatefulWidget {
  const BrandingSettingsScreen({super.key});

  @override
  State<BrandingSettingsScreen> createState() => _BrandingSettingsScreenState();
}

class _BrandingSettingsScreenState extends State<BrandingSettingsScreen> {
  late final SettingsAccess _access;
  final _primary = TextEditingController();
  final _secondary = TextEditingController();
  final _welcome = TextEditingController();
  String _theme = 'SYSTEM';
  GymBranding? _branding;
  String _gymName = '';
  String _baseline = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  List<TextEditingController> get _all => [_primary, _secondary, _welcome];

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
        _primary.text.trim(),
        _secondary.text.trim(),
        _welcome.text.trim(),
        _theme,
      ].join('\u0001');

  void _apply(GymBranding b) {
    _branding = b;
    _primary.text = b.primaryColor ?? '';
    _secondary.text = b.secondaryColor ?? '';
    _welcome.text = b.welcomeMessage ?? '';
    _theme = b.theme;
    _baseline = _snapshot();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = getIt<GymSettingsRepository>();
      final b = await repo.getBranding();
      // The gym name only labels the preview; a failure there is harmless.
      try {
        _gymName = (await repo.getProfile()).gymName;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _apply(b);
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
          _error = 'Could not load branding ($e)';
          _loading = false;
        });
      }
    }
  }

  bool get _dirty => !_loading && _error == null && _snapshot() != _baseline;

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      final b = await getIt<GymSettingsRepository>().updateBranding(
        primaryColor: _primary.text.trim(),
        secondaryColor: _secondary.text.trim(),
        theme: _theme,
        welcomeMessage: _welcome.text.trim(),
      );
      invalidateSetupProgress();
      if (!mounted) return;
      setState(() => _apply(b));
      teamSnack(context, 'Theme colors saved');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Could not save branding ($e)', error: true);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  /// Uploads save immediately and update only the image fields, so unsaved
  /// colour edits are never overwritten by the response.
  Future<void> _upload(Future<GymBranding> Function() call) async {
    try {
      final b = await call();
      invalidateSetupProgress();
      if (!mounted) return;
      setState(() => _branding = b);
      teamSnack(context, 'Image uploaded');
    } on ApiException catch (e) {
      throw Exception(e.detailedMessage);
    }
  }

  @override
  Widget build(BuildContext context) {
    final manage = _access.canManage;
    final b = _branding;
    final repo = getIt<GymSettingsRepository>();
    return SettingsScaffold(
      access: _access,
      page: SettingsPage.branding,
      title: 'Branding',
      subtitle: "Your gym's colors, logo, and images across the app, login, "
          'and emails.',
      loading: _loading,
      error: _error,
      onRetry: _load,
      onRefresh: _load,
      chips: [
        if (b != null)
          ListHeroChip(
            icon: Icons.image_outlined,
            label: '${b.imageCount}/5 images uploaded',
          ),
      ],
      saveBar: (manage && _dirty)
          ? SettingsSaveBar(
              saving: _saving,
              onSave: _save,
              onDiscard: () {
                if (b != null) setState(() => _apply(b));
              },
            )
          : null,
      main: [
        if (!manage) const ReadOnlyNotice(),
        TeamFormSection(
          icon: Icons.palette_rounded,
          color: TeamColors.fuchsia,
          title: 'Theme colors',
          subtitle: 'Applied to the sidebar, buttons and login screen',
          children: [
            ColorField(
              label: 'Primary color',
              controller: _primary,
              disabled: !manage,
              onChanged: (_) => setState(() {}),
            ),
            ColorField(
              label: 'Secondary color',
              controller: _secondary,
              disabled: !manage,
              onChanged: (_) => setState(() {}),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final t in const [
                  ('SYSTEM', 'Match device'),
                  ('LIGHT', 'Light'),
                  ('DARK', 'Dark'),
                ])
                  TeamFilterChip(
                    label: t.$2,
                    selected: _theme == t.$1,
                    color: TeamColors.fuchsia,
                    onTap: () {
                      if (manage) setState(() => _theme = t.$1);
                    },
                  ),
              ],
            ),
            AppLabeledField(
              label: 'Login welcome message',
              icon: Icons.waving_hand_outlined,
              iconColor: TeamColors.amber,
              controller: _welcome,
              readOnly: !manage,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.image_outlined,
          color: TeamColors.indigo,
          title: 'Images',
          subtitle: 'Uploads are resized on your phone and saved immediately',
          children: [
            BrandImageField(
              label: 'Gym logo',
              description: 'Shown in the sidebar and login screen.',
              url: b?.logoUrl,
              maxDimension: 512,
              disabled: !manage,
              onUpload: (d) => _upload(() => repo.uploadLogo(d)),
            ),
            BrandImageField(
              label: 'Favicon',
              description: 'Shown in the browser tab.',
              url: b?.faviconUrl,
              maxDimension: 64,
              disabled: !manage,
              onUpload: (d) => _upload(() => repo.uploadFavicon(d)),
            ),
            BrandImageField(
              label: 'Login background image',
              url: b?.loginBackgroundUrl,
              maxDimension: 1280,
              wide: true,
              disabled: !manage,
              onUpload: (d) => _upload(
                () => repo.uploadBrandingAsset('loginBackgroundUrl', d),
              ),
            ),
            BrandImageField(
              label: 'Dashboard banner',
              url: b?.dashboardBannerUrl,
              maxDimension: 1280,
              wide: true,
              disabled: !manage,
              onUpload: (d) => _upload(
                () => repo.uploadBrandingAsset('dashboardBannerUrl', d),
              ),
            ),
            BrandImageField(
              label: 'Email logo',
              description:
                  'Used in transactional emails sent to your staff and members.',
              url: b?.emailLogoUrl,
              maxDimension: 512,
              disabled: !manage,
              onUpload: (d) =>
                  _upload(() => repo.uploadBrandingAsset('emailLogoUrl', d)),
            ),
          ],
        ),
      ],
      aside: [
        BrandingPreview(
          primary: _primary.text,
          secondary: _secondary.text,
          theme: _theme,
          welcome: _welcome.text,
          gymName: _gymName,
          logoUrl: b?.logoUrl,
          loginBackgroundUrl: b?.loginBackgroundUrl,
          dashboardBannerUrl: b?.dashboardBannerUrl,
        ),
      ],
    );
  }
}
