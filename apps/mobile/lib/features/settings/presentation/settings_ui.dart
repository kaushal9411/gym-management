import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_branding.dart';
import '../../../models/gym_profile.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Gym Settings permissions — the keys web checks: `settings:read` shows the
/// pages (and their tab bar), `settings:manage` makes the fields editable and
/// shows the save bar. The API enforces the same (`settings.routes.ts`:
/// `canRead` on every GET, `canManage` on every write; `/ai/settings` likewise).
class SettingsAccess {
  const SettingsAccess({required this.canRead, required this.canManage});

  final bool canRead;
  final bool canManage;

  factory SettingsAccess.of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    if (s is! SessionAuthenticatedStaff) {
      return const SettingsAccess(canRead: false, canManage: false);
    }
    return SettingsAccess(
      canRead: s.user.hasPermission('settings:read'),
      canManage: s.user.hasPermission('settings:manage'),
    );
  }
}

enum SettingsPage { profile, business, branding, invoice, security, ai }

extension SettingsPageX on SettingsPage {
  String get label => switch (this) {
        SettingsPage.profile => 'Profile',
        SettingsPage.business => 'Business',
        SettingsPage.branding => 'Branding',
        SettingsPage.invoice => 'Invoice',
        SettingsPage.security => 'Security',
        SettingsPage.ai => 'AI',
      };

  String get route => switch (this) {
        SettingsPage.profile => AppRoutes.gymProfileSettings,
        SettingsPage.business => AppRoutes.businessSettings,
        SettingsPage.branding => AppRoutes.brandingSettings,
        SettingsPage.invoice => AppRoutes.invoiceSettings,
        SettingsPage.security => AppRoutes.securityPolicySettings,
        SettingsPage.ai => AppRoutes.aiSettings,
      };

  IconData get icon => switch (this) {
        SettingsPage.profile => Icons.storefront_rounded,
        SettingsPage.business => Icons.tune_rounded,
        SettingsPage.branding => Icons.palette_rounded,
        SettingsPage.invoice => Icons.receipt_long_rounded,
        SettingsPage.security => Icons.shield_rounded,
        SettingsPage.ai => Icons.smart_toy_rounded,
      };

  Color get color => switch (this) {
        SettingsPage.profile => TeamColors.indigo,
        SettingsPage.business => TeamColors.teal,
        SettingsPage.branding => TeamColors.fuchsia,
        SettingsPage.invoice => TeamColors.green,
        SettingsPage.security => TeamColors.rose,
        SettingsPage.ai => TeamColors.violet,
      };
}

/// Web's hero tab bar: Profile / Business / Branding / Invoice / Security /
/// AI (only with `settings:read`).
class SettingsTabs extends StatelessWidget {
  const SettingsTabs({super.key, required this.active});

  final SettingsPage active;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final p in SettingsPage.values)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TeamFilterChip(
                label: p.label,
                selected: p == active,
                color: p.color,
                onTap: () {
                  if (p != active) context.pushReplacement(p.route);
                },
              ),
            ),
        ],
      ),
    );
  }
}

/// Bottom "unsaved changes" bar (web's `UnsavedChangesBar`): shown only when
/// the form differs from what is saved and the viewer may manage settings.
class SettingsSaveBar extends StatelessWidget {
  const SettingsSaveBar({
    super.key,
    required this.saving,
    required this.onSave,
    required this.onDiscard,
  });

  final bool saving;
  final VoidCallback onSave;
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    return TeamBottomBar(
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: TeamOutlineButton(
              label: 'Discard',
              icon: Icons.undo_rounded,
              onTap: saving ? null : onDiscard,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: TeamGradientButton(
              label: 'Save changes',
              icon: Icons.check_rounded,
              loading: saving,
              onTap: saving ? null : onSave,
            ),
          ),
        ],
      ),
    );
  }
}

// ── setup progress ──────────────────────────────────────────────────────────

class SetupItem {
  const SetupItem({
    required this.key,
    required this.label,
    required this.detail,
    required this.fraction,
    required this.page,
    required this.icon,
    required this.color,
  });

  final String key;
  final String label;
  final String detail;

  /// 0..1
  final double fraction;
  final SettingsPage page;
  final IconData icon;
  final Color color;
}

/// How complete the gym's configuration is, derived **only** from the saved
/// settings (web's `useSetupProgress`): a request that failed contributes no
/// item, so the percentage never includes made-up values.
class SetupProgress {
  const SetupProgress(this.items);

  final List<SetupItem> items;

  int? get percent => items.isEmpty
      ? null
      : (items.fold<double>(0, (s, i) => s + i.fraction) / items.length * 100)
          .round();
}

DateTime? _setupAt;
Future<SetupProgress>? _setupFuture;

/// Forget the cached progress (call after saving any settings page).
void invalidateSetupProgress() {
  _setupAt = null;
  _setupFuture = null;
}

/// Loads the four settings the progress is computed from; cached for a minute
/// so every page's hero does not repeat four requests.
Future<SetupProgress> loadSetupProgress() {
  final at = _setupAt;
  if (_setupFuture != null &&
      at != null &&
      DateTime.now().difference(at) < const Duration(minutes: 1)) {
    return _setupFuture!;
  }
  _setupAt = DateTime.now();
  return _setupFuture = _computeSetup();
}

const _profileFields = 14;

Future<SetupProgress> _computeSetup() async {
  final repo = getIt<GymSettingsRepository>();
  Future<T?> safe<T>(Future<T> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }

  final results = await Future.wait<Object?>([
    safe(repo.getProfile()),
    safe(repo.getBranding()),
    safe(repo.getSecuritySettings()),
    safe(repo.getInvoiceSettings()),
  ]);
  final items = <SetupItem>[];
  final p = results[0];
  if (p != null) {
    final profile = p as GymProfile;
    final filled = [
      profile.gymName,
      profile.legalBusinessName,
      profile.registrationNumber,
      profile.gstVatNumber,
      profile.businessType,
      profile.description,
      profile.email,
      profile.phone,
      profile.website,
      profile.addressLine,
      profile.city,
      profile.state,
      profile.country,
      profile.postalCode,
    ].where((v) => v != null && v.toString().trim().isNotEmpty).length;
    items.add(
      SetupItem(
        key: 'profile',
        label: 'Profile details',
        detail: '$filled/$_profileFields fields',
        fraction: filled / _profileFields,
        page: SettingsPage.profile,
        icon: Icons.storefront_rounded,
        color: TeamColors.indigo,
      ),
    );
    final hours = profile.businessHours;
    items.add(
      SetupItem(
        key: 'hours',
        label: 'Business hours',
        detail: '${hours.openDays}/7 days open',
        fraction: hours.openDays / 7,
        page: SettingsPage.profile,
        icon: Icons.schedule_rounded,
        color: TeamColors.teal,
      ),
    );
  }
  final b = results[1];
  if (b != null) {
    final n = (b as GymBranding).imageCount;
    items.add(
      SetupItem(
        key: 'branding',
        label: 'Branding assets',
        detail: '$n/5 uploaded',
        fraction: n / 5,
        page: SettingsPage.branding,
        icon: Icons.palette_rounded,
        color: TeamColors.fuchsia,
      ),
    );
  }
  final sec = results[2];
  if (sec != null) {
    final n = (sec as GymSecuritySettings).mfaRequiredRoles.length;
    items.add(
      SetupItem(
        key: 'mfa',
        label: '2FA enforced',
        detail: '$n/4 roles',
        fraction: n / 4,
        page: SettingsPage.security,
        icon: Icons.shield_rounded,
        color: TeamColors.rose,
      ),
    );
  }
  final inv = results[3];
  if (inv != null) {
    final i = inv as GymInvoiceSettings;
    final hasPrefix = i.invoicePrefix.trim().isNotEmpty;
    final hasTax = i.taxPercentage > 0;
    final n = (hasPrefix ? 1 : 0) + (hasTax ? 1 : 0);
    items.add(
      SetupItem(
        key: 'invoice',
        label: 'Invoice defaults',
        detail: '${hasPrefix ? 'prefix set' : 'no prefix'}, '
            '${hasTax ? 'tax ${i.taxPercentage}%' : 'no tax'}',
        fraction: n / 2,
        page: SettingsPage.invoice,
        icon: Icons.receipt_long_rounded,
        color: TeamColors.green,
      ),
    );
  }
  return SetupProgress(items);
}

/// Ring + checklist card (web's `SetupProgressCard`, top of the hub and the
/// Profile page).
class SetupProgressCard extends StatelessWidget {
  const SetupProgressCard({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<SetupProgress>(
      future: loadSetupProgress(),
      builder: (context, snap) {
        final p = snap.data;
        Widget body;
        if (snap.connectionState != ConnectionState.done) {
          body = const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Center(child: CircularProgressIndicator(strokeWidth: 3)),
          );
        } else if (p == null || p.percent == null) {
          body = Text(
            'Setup progress is unavailable right now.',
            style: AppText.body(size: 13, color: AppColors.inkFaint),
          );
        } else {
          body = Column(
            children: [
              AnimatedRing(
                value: p.percent! / 100,
                size: 120,
                stroke: 13,
                colors: const [TeamColors.teal, TeamColors.green],
                track: AppColors.surface3,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('${p.percent}%', style: AppText.display(size: 26)),
                    Text(
                      'complete',
                      style: AppText.body(
                        size: 10.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              LayoutBuilder(
                builder: (context, c) {
                  final cols =
                      c.maxWidth >= 620 ? 3 : (c.maxWidth >= 420 ? 2 : 1);
                  const gap = 10.0;
                  final w = (c.maxWidth - gap * (cols - 1)) / cols;
                  return Wrap(
                    spacing: gap,
                    runSpacing: gap,
                    children: [
                      for (final it in p.items)
                        SizedBox(width: w, child: _SetupChip(item: it)),
                    ],
                  );
                },
              ),
            ],
          );
        }
        return TeamSectionCard(
          icon: Icons.auto_awesome_rounded,
          color: TeamColors.violet,
          title: 'Setup progress',
          subtitle: "How complete your gym's configuration is, from what you "
              'have saved so far.',
          child: Padding(padding: const EdgeInsets.all(14), child: body),
        );
      },
    );
  }
}

class _SetupChip extends StatelessWidget {
  const _SetupChip({required this.item});

  final SetupItem item;

  @override
  Widget build(BuildContext context) {
    final done = item.fraction >= 1;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push(item.page.route),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: item.color.withValues(alpha: done ? 0.5 : 0.22),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(item.icon, size: 18, color: item.color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 12.5, weight: FontWeight.w800),
                    ),
                    Text(
                      item.detail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                done
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked,
                size: 18,
                color: done ? TeamColors.green : AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The hero shared by the settings pages: title, subtitle, back button, and
/// the "Setup complete" chip (with `settings:read`, like web) followed by the
/// page-specific [chips].
class SettingsHeader extends StatefulWidget {
  const SettingsHeader({
    super.key,
    required this.title,
    required this.subtitle,
    required this.showSetup,
    this.chips = const [],
  });

  final String title;
  final String subtitle;
  final bool showSetup;
  final List<Widget> chips;

  @override
  State<SettingsHeader> createState() => _SettingsHeaderState();
}

class _SettingsHeaderState extends State<SettingsHeader> {
  SetupProgress? _progress;

  @override
  void initState() {
    super.initState();
    if (widget.showSetup) {
      loadSetupProgress().then((p) {
        if (mounted) setState(() => _progress = p);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pct = _progress?.percent;
    return ListHero(
      title: widget.title,
      subtitle: widget.subtitle,
      topInset: MediaQuery.of(context).padding.top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      chips: [
        if (pct != null)
          ListHeroChip(
            icon: Icons.task_alt_rounded,
            label: '$pct% setup complete',
          ),
        ...widget.chips,
      ],
    );
  }
}

/// Page frame shared by the six settings pages: hero, tab bar, then either the
/// loading / error / no-access state or the content (form sections + previews —
/// two columns from 900 dp), plus the unsaved-changes bar.
class SettingsScaffold extends StatelessWidget {
  const SettingsScaffold({
    super.key,
    required this.access,
    required this.page,
    required this.title,
    required this.subtitle,
    required this.loading,
    required this.main,
    this.aside = const [],
    this.error,
    this.onRetry,
    this.onRefresh,
    this.saveBar,
    this.chips = const [],
  });

  final SettingsAccess access;
  final SettingsPage page;
  final String title;
  final String subtitle;
  final bool loading;
  final String? error;
  final VoidCallback? onRetry;
  final Future<void> Function()? onRefresh;
  final List<Widget> main;
  final List<Widget> aside;
  final Widget? saveBar;
  final List<Widget> chips;

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    Widget content;
    if (!access.canRead) {
      content = const SizedBox(
        height: 260,
        child: AppEmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'No access to settings',
          message: "You don't have permission to view gym settings.",
        ),
      );
    } else if (error != null) {
      content = ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 260),
        child: AppErrorView(message: error!, onRetry: onRetry ?? () {}),
      );
    } else if (loading) {
      content = const SizedBox(height: 260, child: AppLoadingView());
    } else {
      Widget stack(List<Widget> items) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < items.length; i++) ...[
                FadeUp(index: i.clamp(0, 6), child: items[i]),
                const SizedBox(height: 14),
              ],
            ],
          );
      content = (wide && aside.isNotEmpty)
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: stack(main)),
                const SizedBox(width: 16),
                Expanded(flex: 2, child: stack(aside)),
              ],
            )
          : stack([...main, ...aside]);
    }
    return Scaffold(
      backgroundColor: AppColors.bg,
      bottomNavigationBar: saveBar,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: onRefresh ?? () async {},
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: SettingsHeader(
                title: title,
                subtitle: subtitle,
                showSetup: access.canRead,
                chips: chips,
              ),
            ),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (access.canRead) ...[
                        SettingsTabs(active: page),
                        const SizedBox(height: 14),
                      ],
                      content,
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A small "Read-only" note shown above the form when the viewer may read but
/// not manage settings (web simply disables every field).
class ReadOnlyNotice extends StatelessWidget {
  const ReadOnlyNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: TeamColors.slate.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Row(
        children: [
          Icon(Icons.visibility_outlined, size: 18, color: AppColors.inkSoft),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'You can view these settings but not change them.',
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: AppColors.inkSoft,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A key/value row used by the previews.
class PreviewRow extends StatelessWidget {
  const PreviewRow(this.label, this.value, {super.key});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.surface3,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppText.body(
                  size: 11.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                value ?? 'Invalid value',
                textAlign: TextAlign.right,
                style: AppText.tabular(
                  size: 13,
                  weight: FontWeight.w800,
                  color: value == null ? TeamColors.rose : AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      );
}
