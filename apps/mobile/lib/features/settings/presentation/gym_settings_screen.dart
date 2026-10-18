import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'settings_ui.dart';

class _Entry {
  const _Entry(this.icon, this.title, this.subtitle, this.route, this.color);

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final Color color;
}

/// The six pages of web's Gym Settings (its tab bar), plus this app's
/// Sessions entry (active devices — the account-level page).
const _entries = <_Entry>[
  _Entry(
    Icons.storefront_rounded,
    'Gym profile',
    'Identity, contact, hours, social links',
    AppRoutes.gymProfileSettings,
    TeamColors.indigo,
  ),
  _Entry(
    Icons.tune_rounded,
    'Business',
    'Currency, timezone, email, channels',
    AppRoutes.businessSettings,
    TeamColors.teal,
  ),
  _Entry(
    Icons.palette_rounded,
    'Branding',
    'Colors, theme, logo and images',
    AppRoutes.brandingSettings,
    TeamColors.fuchsia,
  ),
  _Entry(
    Icons.receipt_long_rounded,
    'Invoice',
    'Prefix, tax, payment terms, footer',
    AppRoutes.invoiceSettings,
    TeamColors.green,
  ),
  _Entry(
    Icons.shield_rounded,
    'Security',
    'Mandatory 2FA roles',
    AppRoutes.securityPolicySettings,
    TeamColors.rose,
  ),
  _Entry(
    Icons.smart_toy_rounded,
    'AI assistant',
    'Bring your own AI provider key',
    AppRoutes.aiSettings,
    TeamColors.violet,
  ),
  _Entry(
    Icons.devices_rounded,
    'Sessions',
    'Active devices',
    AppRoutes.sessions,
    TeamColors.sky,
  ),
];

/// Gym Settings hub — the entry to web's six settings pages. Web has no hub
/// (its pages share a tab bar and each page opens straight to its form); on the
/// phone the Menu tile lands here: the setup-progress card (web's, from the
/// saved settings) and one card per page. Needs `settings:read` (the Menu tile
/// already requires it; without it the screen says so and makes no request).
class GymSettingsScreen extends StatelessWidget {
  const GymSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final access = SettingsAccess.of(context);
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: SettingsHeader(
              title: 'Gym Settings',
              subtitle: 'Profile, business, branding, invoices, security and '
                  'AI for your gym.',
              showSetup: access.canRead,
            ),
          ),
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                child: !access.canRead
                    ? SizedBox(
                        height: 260 + top * 0,
                        child: const AppEmptyState(
                          icon: Icons.lock_outline_rounded,
                          title: 'No access to settings',
                          message:
                              "You don't have permission to view gym settings.",
                        ),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SetupProgressCard(),
                          const SizedBox(height: 14),
                          LayoutBuilder(
                            builder: (context, c) {
                              final cols = c.maxWidth >= 700 ? 2 : 1;
                              const gap = 12.0;
                              final w = (c.maxWidth - gap * (cols - 1)) / cols;
                              return Wrap(
                                spacing: gap,
                                runSpacing: gap,
                                children: [
                                  for (var i = 0; i < _entries.length; i++)
                                    SizedBox(
                                      width: w,
                                      child: FadeUp(
                                        index: i,
                                        child: _HubCard(entry: _entries[i]),
                                      ),
                                    ),
                                ],
                              );
                            },
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HubCard extends StatelessWidget {
  const _HubCard({required this.entry});

  final _Entry entry;

  @override
  Widget build(BuildContext context) {
    final c = entry.color;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(entry.route),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [c.withValues(alpha: 0.14), Colors.transparent],
            ),
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: c.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [c, c.withValues(alpha: 0.65)],
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(entry.icon, size: 22, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      style: AppText.display(size: 15.5),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
