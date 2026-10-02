import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_portal_profile.dart';
import '../../../models/member_visit.dart';
import '../../../models/member_workout_assignment.dart';
import '../../../models/member_workout_progress.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/notification_bell_icon.dart';
import 'member_dashboard_detail_sheet.dart';
import 'member_renew_sheet.dart';

/// Design frame "4. Dashboard". The design's "Renew membership" CTA (frame
/// "4a. Renew — Confirm & pay") is now built — `MemberRenewSheet`, opened
/// from `_MembershipCard` below once the membership has expired. Every tile
/// (Membership, This month, Streak, Workout, Outstanding) is tappable,
/// opening `MemberDashboardDetailSheet` with the real records behind it —
/// mirrors the Owner dashboard's `DashboardStatKind`/`showDashboardDetailSheet`
/// pattern, reusing data this screen already loaded rather than re-fetching.
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
  MemberWorkoutAssignment? _workout;
  List<MemberInvoice> _invoices = const [];
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
      // Fired in parallel (not individually awaited yet) — a plain
      // Future.wait/record .wait both work here, but this avoids depending
      // on the `async` package's record-wait extension actually covering
      // 4-tuples on whatever version is pinned.
      final profileFuture = repo.me();
      final visitsFuture = repo.attendance(limit: 60);
      final workoutFuture = repo.workout();
      final invoicesFuture = repo.invoices(limit: 20);
      final profile = await profileFuture;
      final visits = await visitsFuture;
      final workout = await workoutFuture;
      final invoices = await invoicesFuture;
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _visits = visits.items;
        _workout = workout;
        _invoices = invoices.items;
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

  /// Percent of the assigned plan's exercises marked COMPLETED — null when
  /// no plan is assigned, or the plan has no exercises to measure against.
  int? get _workoutPercent {
    final w = _workout;
    if (w == null || w.exercises.isEmpty) return null;
    final completed = w.exercises
        .where((e) => w.statusOf(e.exerciseId) == ExerciseProgressStatus.completed)
        .length;
    return (completed / w.exercises.length * 100).round();
  }

  double get _outstandingTotal => _invoices
      .where((i) => i.status != 'PAID')
      .fold(0.0, (sum, i) => sum + i.totalAmount);

  void _openDetail(MemberDashboardStatKind kind) {
    final profile = _profile;
    if (profile == null) return;
    showMemberDashboardDetailSheet(
      context,
      kind: kind,
      profile: profile,
      visits: _visits,
      workout: _workout,
      invoices: _invoices,
      onViewWorkout: () => widget.onQuickAction(1),
      onInvoicePaid: _load,
    );
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
              const NotificationBellIcon(isStaff: false),
              const SizedBox(width: 10),
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
          _MembershipCard(
            profile: profile,
            onRenewed: _load,
            onTap: () => _openDetail(MemberDashboardStatKind.membership),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: 'This month',
                  value: '$_visitsThisMonth',
                  caption: 'visits',
                  onTap: () => _openDetail(MemberDashboardStatKind.attendance),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  label: 'Streak',
                  value: '$_streak',
                  caption: 'days',
                  accent: true,
                  onTap: () => _openDetail(MemberDashboardStatKind.attendance),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: 'Workout',
                  value: _workoutPercent != null ? '$_workoutPercent%' : '—',
                  caption: 'progress',
                  onTap: () => _openDetail(MemberDashboardStatKind.workout),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  label: 'Outstanding',
                  value: _outstandingTotal > 0
                      ? '₹${_outstandingTotal.toStringAsFixed(0)}'
                      : 'All paid',
                  caption: _outstandingTotal > 0 ? 'due' : 'settled',
                  accent: _outstandingTotal > 0,
                  onTap: () => _openDetail(MemberDashboardStatKind.outstanding),
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
  const _MembershipCard({
    required this.profile,
    required this.onRenewed,
    required this.onTap,
  });

  final MemberPortalProfile profile;

  /// Called after a successful renewal (the sheet popped `true`) so the
  /// dashboard re-fetches and this card reflects the fresh expiry date.
  final VoidCallback onRenewed;

  /// Opens the Membership detail sheet — a separate tap target from the
  /// "Renew now" button below (Flutter's gesture arena resolves a tap on
  /// the nested button to the button alone, never both).
  final VoidCallback onTap;

  Future<void> _openRenewSheet(BuildContext context, String planName) async {
    final renewed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberRenewSheet(planName: planName),
    );
    if (renewed == true) onRenewed();
  }

  @override
  Widget build(BuildContext context) {
    final membership = profile.currentMembership;
    final days = profile.daysLeft;
    final expired = membership != null && days != null && days < 0;

    final headline = membership == null
        ? 'No active plan'
        : days == null
            ? membership.planName
            : days < 0
                ? 'Expired'
                : days == 0
                    ? 'Expires today'
                    : '$days day${days == 1 ? '' : 's'} left';

    final card = Container(
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
                : expired
                    ? 'Renew to keep using the gym.'
                    : 'Renewals open up once this expires.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          if (expired) ...[
            const SizedBox(height: 12),
            AppButton(
              label: 'Renew now',
              role: AppRole.member,
              size: AppButtonSize.small,
              fullWidth: false,
              onPressed: () => _openRenewSheet(context, membership!.planName),
            ),
          ],
        ],
      ),
    );
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: card,
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
    this.onTap,
  });

  final String label;
  final String value;
  final String caption;
  final bool accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Container(
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
    if (onTap == null) return content;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: content,
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
