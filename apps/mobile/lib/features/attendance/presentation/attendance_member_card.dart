import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'attendance_ui.dart';

/// Why [m] can't be checked in right now, or null when they can — the same
/// client-side pre-check web's manual panel shows (frozen / inactive / no
/// plan / expired). Informational only: the server stays the authority.
String? memberIneligibleReason(GymMember m) {
  if (m.status == 'FROZEN') return 'Member is frozen and cannot check in.';
  if (m.status != 'ACTIVE') return 'Member is not active.';
  final ms = m.currentMembership;
  if (ms == null) return 'Member has no active membership.';
  if (dayOnly(ms.endDate.toLocal()).isBefore(dayOnly(DateTime.now()))) {
    return 'Membership has expired.';
  }
  return null;
}

/// "Here's who we found, whether they can act, and the buttons" — the shared
/// card for the QR result and the manual search results (web's
/// `MemberActionCard`). Tint follows [eligible] (green / rose).
class AttendanceMemberCard extends StatelessWidget {
  const AttendanceMemberCard({
    super.key,
    required this.name,
    required this.eligible,
    required this.message,
    this.code,
    this.subtitle,
    this.photoUrl,
    this.tags = const [],
    this.actions,
  });

  final String name;
  final String? code;
  final String? subtitle;
  final String? photoUrl;
  final bool eligible;

  /// "Eligible" or the reason they are not.
  final String message;
  final List<Widget> tags;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final tone = eligible ? TeamColors.green : TeamColors.rose;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [tone.withValues(alpha: 0.13), Colors.transparent],
        ),
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AttendanceAvatar(
                name: name,
                photoUrl: photoUrl,
                color: tone,
                size: 50,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 15, weight: FontWeight.w800),
                    ),
                    if (code != null || subtitle != null)
                      Text(
                        [
                          if (code != null && code!.isNotEmpty) code!,
                          if (subtitle != null && subtitle!.isNotEmpty)
                            subtitle!,
                        ].join(' · '),
                        maxLines: 1,
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
              for (final t in tags) ...[const SizedBox(width: 6), t],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(
                eligible
                    ? Icons.check_circle_rounded
                    : Icons.error_outline_rounded,
                size: 16,
                color: tone,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  message,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w800,
                    color: tone,
                  ),
                ),
              ),
            ],
          ),
          if (actions != null) ...[const SizedBox(height: 12), actions!],
        ],
      ),
    );
  }
}

/// Check in (green gradient) + Check out (rose outline) side by side.
class AttendanceActionRow extends StatelessWidget {
  const AttendanceActionRow({
    super.key,
    required this.busy,
    this.onCheckIn,
    this.onCheckOut,
  });

  final bool busy;
  final VoidCallback? onCheckIn;
  final VoidCallback? onCheckOut;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (onCheckIn != null)
          Expanded(
            flex: 3,
            child: TeamGradientButton(
              label: 'Check in',
              icon: Icons.login_rounded,
              gradient: TeamColors.ctaGreen,
              loading: busy,
              onTap: onCheckIn,
            ),
          ),
        if (onCheckIn != null && onCheckOut != null) const SizedBox(width: 10),
        if (onCheckOut != null)
          Expanded(
            flex: 2,
            child: GestureDetector(
              onTap: busy ? null : onCheckOut,
              child: Opacity(
                opacity: busy ? 0.5 : 1,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: TeamColors.rose.withValues(alpha: 0.12),
                    border: Border.all(
                      color: TeamColors.rose.withValues(alpha: 0.45),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.logout_rounded,
                        size: 17,
                        color: TeamColors.rose,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Check out',
                        style: AppText.body(
                          size: 14,
                          weight: FontWeight.w800,
                          color: TeamColors.rose,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
