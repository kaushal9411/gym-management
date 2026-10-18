import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Web's profile accent: the "members" violet.
const kProfileColor = TeamColors.violet;

/// Pill switch row used by the notification preferences (web's `PrefSwitch`).
class ProfilePrefRow extends StatelessWidget {
  const ProfilePrefRow({
    super.key,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: TeamToggleRow(
        title: label,
        value: value,
        color: TeamColors.sky,
        onChanged: onChanged,
      ),
    );
  }
}

/// A small centred message inside a section ("no history yet", etc.).
class ProfileNote extends StatelessWidget {
  const ProfileNote(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Text(
          text,
          style: AppText.body(
            size: 12.5,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
      );
}

/// Shared page for the profile sub-pages: a gradient banner under a
/// transparent app bar, loading / error states, the sections, an inline error
/// alert and one gradient action button ([TeamEditScaffold]'s layout, but with
/// a free banner chip so "Security" pages don't say "Editing …").
class ProfileFormPage extends StatelessWidget {
  const ProfileFormPage({
    super.key,
    required this.title,
    required this.chip,
    required this.icon,
    required this.color,
    required this.name,
    required this.subtitle,
    required this.sections,
    this.avatarUrl,
    this.loading = false,
    this.loadError,
    this.onRetry,
    this.error,
    this.saving = false,
    this.onSave,
    this.saveLabel = 'Save changes',
    this.saveIcon = Icons.check_rounded,
    this.footer,
  });

  final String title;
  final String chip;
  final IconData icon;
  final Color color;
  final String name;
  final String subtitle;
  final String? avatarUrl;
  final List<Widget> sections;
  final bool loading;
  final String? loadError;
  final VoidCallback? onRetry;
  final String? error;
  final bool saving;
  final VoidCallback? onSave;
  final String saveLabel;
  final IconData saveIcon;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(title),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TeamBanner(
              top: top,
              name: name,
              subtitle: subtitle,
              avatarUrl: avatarUrl,
              chip: chip,
              chipIcon: icon,
              color: color,
            ),
            if (loading)
              const SizedBox(height: 240, child: AppLoadingView())
            else if (loadError != null)
              SizedBox(
                height: 260,
                child: AppErrorView(message: loadError!, onRetry: onRetry),
              )
            else
              TeamCenter(
                maxWidth: 760,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (error != null) ...[
                        FormAlert(message: error!),
                        const SizedBox(height: 14),
                      ],
                      for (var i = 0; i < sections.length; i++) ...[
                        if (i > 0) const SizedBox(height: 14),
                        sections[i],
                      ],
                      if (footer != null) ...[
                        const SizedBox(height: 14),
                        footer!,
                      ],
                      if (onSave != null) ...[
                        const SizedBox(height: 20),
                        TeamGradientButton(
                          label: saveLabel,
                          icon: saveIcon,
                          loading: saving,
                          onTap: saving ? null : onSave,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
