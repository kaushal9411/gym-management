import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';

class _SettingsEntry {
  const _SettingsEntry({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
}

const _entries = [
  _SettingsEntry(
    icon: Icons.storefront_outlined,
    title: 'Gym profile',
    subtitle: 'Legal name, contact, business',
    route: AppRoutes.gymProfileSettings,
  ),
  _SettingsEntry(
    icon: Icons.palette_outlined,
    title: 'Branding',
    subtitle: 'Logo, colors, theme',
    route: AppRoutes.brandingSettings,
  ),
  _SettingsEntry(
    icon: Icons.receipt_long_outlined,
    title: 'Invoice settings',
    subtitle: 'Prefix, tax, payment terms',
    route: AppRoutes.invoiceSettings,
  ),
  _SettingsEntry(
    icon: Icons.shield_outlined,
    title: 'Security policy',
    subtitle: 'Mandatory 2FA roles',
    route: AppRoutes.securityPolicySettings,
  ),
  _SettingsEntry(
    icon: Icons.devices_outlined,
    title: 'Sessions',
    subtitle: 'Active devices',
    route: AppRoutes.sessions,
  ),
];

/// Design frame "11. Gym settings" — the hub. Each row opens its own frame
/// (11a–11d, plus "11f. Sessions"); this screen holds no fields of its own.
class GymSettingsScreen extends StatelessWidget {
  const GymSettingsScreen({super.key});

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
            Text('Gym Settings', style: AppText.display(size: 18)),
            Text('Owner only', style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: _entries.map((e) => _SettingsTile(entry: e)).toList(),
        ),
      ),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({required this.entry});

  final _SettingsEntry entry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context.push(entry.route),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.staffSoft,
                    borderRadius: BorderRadius.circular(AppRadii.tile),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    entry.icon,
                    size: 18,
                    color: AppColors.staffPillFg,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.title,
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      Text(
                        entry.subtitle,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
