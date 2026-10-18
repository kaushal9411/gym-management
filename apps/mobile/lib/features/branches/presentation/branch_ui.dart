import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Shared building blocks for the Branches screens (list, detail, add / edit,
/// hours, holidays). Same visual language as the Team / Members / Leads
/// redesigns — it reuses the Team kit (`team_ui.dart`: colours, KPI tiles,
/// insight cards, sheets, form sections, buttons) and the `member_detail_anim`
/// primitives, and only adds what is branch-specific.

const kDayFull = {
  'monday': 'Monday',
  'tuesday': 'Tuesday',
  'wednesday': 'Wednesday',
  'thursday': 'Thursday',
  'friday': 'Friday',
  'saturday': 'Saturday',
  'sunday': 'Sunday',
};

const kDayShort = {
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
};

/// The weekday key (`monday`..`sunday`) for today on this device.
String todayKey() => branchWeekdays[DateTime.now().weekday - 1];

/// Common IANA zones for the timezone picker. `timezone` is a free string
/// server-side (max 64, not validated against the tz database), so the picker
/// offers sensible values and keeps whatever the branch already has.
const kTimezones = [
  'UTC',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Kathmandu',
  'Asia/Colombo',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Riyadh',
  'Asia/Qatar',
  'Asia/Tehran',
  'Asia/Jerusalem',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Australia/Sydney',
  'Australia/Perth',
  'Pacific/Auckland',
];

/// Timezone options, with [current] prepended when it isn't a known zone.
List<(String, String)> timezoneOptions(String? current) => [
      if (current != null &&
          current.isNotEmpty &&
          !kTimezones.contains(current))
        (current, current),
      for (final z in kTimezones) (z, z.replaceAll('_', ' ')),
    ];

// ── status helpers ──────────────────────────────────────────────────────────

Color branchTone(Branch b) => b.isDeleted
    ? TeamColors.rose
    : b.isActive
        ? TeamColors.green
        : TeamColors.amber;

String branchStatus(Branch b) => b.isDeleted
    ? 'Deleted'
    : b.isActive
        ? 'Active'
        : 'Inactive';

IconData branchStatusIcon(Branch b) => b.isDeleted
    ? Icons.delete_outline_rounded
    : b.isActive
        ? Icons.check_circle_rounded
        : Icons.pause_circle_rounded;

String branchInitials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  final letters = parts.take(2).map((p) => p[0].toUpperCase()).join();
  return letters.isEmpty ? 'B' : letters;
}

/// Capacity usage colour: calm green, amber when nearly full, rose when full.
Color usageColor(double ratio) => ratio >= 0.9
    ? TeamColors.rose
    : ratio >= 0.7
        ? TeamColors.amber
        : TeamColors.green;

/// Today's schedule line for a branch ("06:00 - 22:00", "Closed", "Not set").
String todayHoursLabel(Branch b) =>
    (b.operatingHours[todayKey()] ?? const DayHours()).label;

// ── launching ───────────────────────────────────────────────────────────────

Future<void> branchLaunch(BuildContext context, Uri uri) async {
  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  if (!ok && context.mounted) teamSnack(context, 'Could not open that app.');
}

String _waDigits(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  return digits.length == 10 ? '91$digits' : digits;
}

Uri whatsappUri(String phone) => Uri.parse('https://wa.me/${_waDigits(phone)}');

/// A maps link: exact coordinates when the branch has them, else its address.
Uri? directionsUri(Branch b) {
  if (b.hasCoordinates) {
    return Uri.parse(
      'https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}',
    );
  }
  final address = b.fullAddress;
  if (address.isEmpty) return null;
  return Uri.parse(
    'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}',
  );
}

// ── hero shell ──────────────────────────────────────────────────────────────

/// Full-bleed animated gradient (never capped) with [child] laid out inside the
/// capped content column. Use under a transparent AppBar
/// (`extendBodyBehindAppBar`); [topInset] = status bar + toolbar height.
class BranchHeroShell extends StatelessWidget {
  const BranchHeroShell({
    super.key,
    required this.topInset,
    required this.child,
    this.bottom = 22,
  });

  final double topInset;
  final double bottom;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Positioned.fill(
          child: MeshHeroBackground(
            radius: BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox.expand(),
          ),
        ),
        TeamCenter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(18, 8 + topInset, 18, bottom),
            child: child,
          ),
        ),
      ],
    );
  }
}

/// The storefront glyph used where web shows a building icon: a gradient disc.
class BranchGlyph extends StatelessWidget {
  const BranchGlyph({
    super.key,
    this.size = 54,
    this.colors = const [Color(0xFF4338CA), Color(0xFFC026D3)],
    this.icon = Icons.storefront_rounded,
  });

  final double size;
  final List<Color> colors;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: size * 0.5, color: Colors.white),
    );
  }
}

/// Card avatar: a rotating-hue ring in the status colour around the branch
/// initials.
class BranchAvatar extends StatelessWidget {
  const BranchAvatar({
    super.key,
    required this.name,
    required this.color,
    this.size = 52,
  });

  final String name;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: SweepGradient(
          colors: [color, TeamColors.fuchsia, TeamColors.indigo, color],
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.surface2,
        ),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.55)!],
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            branchInitials(name),
            style: AppText.display(size: size * 0.34, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

// ── add / edit frame ────────────────────────────────────────────────────────

/// Gradient banner under a transparent AppBar for the add / edit screens
/// (sibling of `TeamBanner`, with the storefront glyph instead of an avatar).
class BranchBanner extends StatelessWidget {
  const BranchBanner({
    super.key,
    required this.top,
    required this.name,
    required this.subtitle,
    required this.chip,
    required this.chipIcon,
    required this.color,
  });

  final double top;
  final String name;
  final String subtitle;
  final String chip;
  final IconData chipIcon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, top + 4, 18, 22),
      decoration: BoxDecoration(
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF312E81),
            Color.lerp(color, const Color(0xFF7C3AED), 0.4)!,
            TeamColors.fuchsia,
          ],
        ),
      ),
      child: TeamCenter(
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
              ),
              child: const BranchGlyph(),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 20, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TeamHeroPill(chip, icon: chipIcon),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Page frame for the single-page Branch edit screens (details, hours,
/// holidays): transparent app bar over [BranchBanner], the [sections], then a
/// gradient Save button. Sibling of `TeamEditScaffold`.
class BranchEditScaffold extends StatelessWidget {
  const BranchEditScaffold({
    super.key,
    required this.name,
    required this.subtitle,
    required this.title,
    required this.icon,
    required this.color,
    required this.saving,
    required this.onSave,
    required this.sections,
    this.error,
    this.saveLabel = 'Save changes',
  });

  final String name;
  final String subtitle;
  final String title;
  final IconData icon;
  final Color color;
  final bool saving;
  final VoidCallback onSave;
  final List<Widget> sections;
  final String? error;
  final String saveLabel;

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
            BranchBanner(
              top: top,
              name: name,
              subtitle: subtitle,
              chip: 'Editing $title',
              chipIcon: icon,
              color: color,
            ),
            TeamCenter(
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
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: saveLabel,
                      icon: Icons.check_rounded,
                      loading: saving,
                      onTap: onSave,
                    ),
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

// ── small shared bits ───────────────────────────────────────────────────────

/// "Capacity 148 / 180" style progress row used in cards and sheets.
class UsageBar extends StatelessWidget {
  const UsageBar({
    super.key,
    required this.label,
    required this.used,
    required this.limit,
    this.height = 7,
  });

  final String label;
  final int used;
  final int? limit;
  final double height;

  @override
  Widget build(BuildContext context) {
    final ratio =
        limit != null && limit! > 0 ? (used / limit!).clamp(0.0, 1.0) : 0.0;
    final color = limit != null && limit! > 0
        ? usageColor(used / limit!)
        : TeamColors.indigo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: AppText.body(size: 12, weight: FontWeight.w700),
              ),
            ),
            Text(
              limit == null ? '$used' : '$used / $limit',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w800,
                color: limit == null ? AppColors.inkFaint : color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        GrowBar(
          ratio: ratio,
          height: height,
          track: AppColors.surface3,
          colors: [color, color.withValues(alpha: 0.55)],
        ),
      ],
    );
  }
}
