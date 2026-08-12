import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_portal_profile.dart';
import '../../../models/member_visit.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "4. Dashboard". The design's "Renew membership" CTA (and
/// its "4a. Renew — Confirm & pay" screen) are **not** built: `/portal/*`
/// is the member plane's entire API surface and it has no renew or payment
/// route — renewals are staff-initiated only. The expiry card states the
/// real status instead of offering an action the backend can't perform.
class MemberDashboardScreen extends StatefulWidget {
  const MemberDashboardScreen({required this.onQuickAction, super.key});

  /// Jumps the shell to the Workout (1) / Diet (2) tab.
  final ValueChanged<int> onQuickAction;

  @override
  State<MemberDashboardScreen> createState() => _MemberDashboardScreenState();
}

class _MemberDashboardScreenState extends State<MemberDashboardScreen> {
  MemberPortalProfile? _profile;
  List<MemberVisit> _visits = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = getIt<MemberPortalRepository>();
      final (profile, visits) =
          await (repo.me(), repo.attendance(limit: 60)).wait;
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _visits = visits.items;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int get _visitsThisMonth {
    final now = DateTime.now();
    return _visits
        .where(
          (v) =>
              v.attendanceDate.year == now.year &&
              v.attendanceDate.month == now.month,
        )
        .length;
  }

  /// Consecutive days with a visit, counting back from today (or from
  /// yesterday, so a streak isn't shown as broken before today's workout).
  int get _streak {
    final days = _visits
        .map(
          (v) => DateTime(
            v.attendanceDate.year,
            v.attendanceDate.month,
            v.attendanceDate.day,
          ),
        )
        .toSet();
    if (days.isEmpty) return 0;
    final now = DateTime.now();
    var cursor = DateTime(now.year, now.month, now.day);
    if (!days.contains(cursor)) {
      cursor = cursor.subtract(const Duration(days: 1));
      if (!days.contains(cursor)) return 0;
    }
    var streak = 0;
    while (days.contains(cursor)) {
      streak++;
      cursor = cursor.subtract(const Duration(days: 1));
    }
    return streak;
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    if (_error != null) {
      return AppErrorView(
        message: _error!,
        onRetry: _load,
        role: AppRole.member,
      );
    }
    final profile = _profile;
    if (profile == null) return const SizedBox.shrink();

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_greeting, style: AppText.eyebrow()),
                    Text(profile.name, style: AppText.display(size: 22)),
                  ],
                ),
              ),
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  gradient: AppColors.memberGrad,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  profile.initials,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: AppColors.memberOnGrad,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _MembershipCard(profile: profile),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: 'This month',
                  value: '$_visitsThisMonth',
                  caption: 'visits',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  label: 'Streak',
                  value: '$_streak',
                  caption: 'days',
                  accent: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quick actions', style: AppText.eyebrow()),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _QuickAction(
                        icon: Icons.fitness_center_rounded,
                        label: 'Workout',
                        onTap: () => widget.onQuickAction(1),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _QuickAction(
                        icon: Icons.restaurant_rounded,
                        label: 'Diet log',
                        onTap: () => widget.onQuickAction(2),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MembershipCard extends StatelessWidget {
  const _MembershipCard({required this.profile});

  final MemberPortalProfile profile;

  @override
  Widget build(BuildContext context) {
    final membership = profile.currentMembership;
    final days = profile.daysLeft;

    final headline = membership == null
        ? 'No active plan'
        : days == null
            ? membership.planName
            : days < 0
                ? 'Expired'
                : days == 0
                    ? 'Expires today'
                    : '$days day${days == 1 ? '' : 's'} left';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
        ),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            membership?.planName ?? 'Membership',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: AppColors.memberPillFg,
            ),
          ),
          const SizedBox(height: 4),
          Text(headline, style: AppText.display(size: 24)),
          const SizedBox(height: 6),
          Text(
            membership == null
                ? 'Ask the front desk to set up your membership.'
                : 'Renewals are handled at the front desk.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.caption,
    this.accent = false,
  });

  final String label;
  final String value;
  final String caption;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppText.display(
              size: 26,
              color: accent ? AppColors.memberPillFg : AppColors.ink,
            ),
          ),
          Text(
            caption,
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: AppColors.memberB),
              const SizedBox(height: 6),
              Text(
                label,
                style: AppText.body(size: 12, weight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
