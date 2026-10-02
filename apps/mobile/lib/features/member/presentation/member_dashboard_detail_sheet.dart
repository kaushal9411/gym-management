import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_portal_profile.dart';
import '../../../models/member_visit.dart';
import '../../../models/member_workout_assignment.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/workout_plan.dart' show WeekDayX;
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'member_pay_invoice_sheet.dart';

/// Same "every dashboard tile is clickable, opening a sheet with the real
/// records behind the number" pattern as the owner dashboard's
/// `DashboardStatKind`/`showDashboardDetailSheet` (`features/owner/presentation/widgets/dashboard_detail_sheet.dart`)
/// — mirrored here for the Member role's 4 tiles. Unlike the owner version,
/// every kind here takes already-loaded data as a param instead of
/// re-fetching: `MemberDashboardScreen` already loads all 4 data sources up
/// front for the tiles themselves, so there's nothing left to fetch.
enum MemberDashboardStatKind { membership, attendance, workout, outstanding }

String _titleFor(MemberDashboardStatKind kind) => switch (kind) {
      MemberDashboardStatKind.membership => 'Membership',
      MemberDashboardStatKind.attendance => 'Your visits',
      MemberDashboardStatKind.workout => 'Workout progress',
      MemberDashboardStatKind.outstanding => 'Outstanding payments',
    };

void showMemberDashboardDetailSheet(
  BuildContext context, {
  required MemberDashboardStatKind kind,
  required MemberPortalProfile profile,
  required List<MemberVisit> visits,
  required MemberWorkoutAssignment? workout,
  required List<MemberInvoice> invoices,
  required VoidCallback onViewWorkout,
  required VoidCallback onInvoicePaid,
}) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.surface2,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
    ),
    builder: (_) => _MemberDashboardDetailSheet(
      kind: kind,
      profile: profile,
      visits: visits,
      workout: workout,
      invoices: invoices,
      onViewWorkout: onViewWorkout,
      onInvoicePaid: onInvoicePaid,
    ),
  );
}

class _MemberDashboardDetailSheet extends StatelessWidget {
  const _MemberDashboardDetailSheet({
    required this.kind,
    required this.profile,
    required this.visits,
    required this.workout,
    required this.invoices,
    required this.onViewWorkout,
    required this.onInvoicePaid,
  });

  final MemberDashboardStatKind kind;
  final MemberPortalProfile profile;
  final List<MemberVisit> visits;
  final MemberWorkoutAssignment? workout;
  final List<MemberInvoice> invoices;
  final VoidCallback onViewWorkout;
  final VoidCallback onInvoicePaid;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_titleFor(kind), style: AppText.display(size: 16)),
            const SizedBox(height: 12),
            Expanded(
              child: switch (kind) {
                MemberDashboardStatKind.membership =>
                  _MembershipDetail(profile: profile),
                MemberDashboardStatKind.attendance =>
                  _AttendanceDetail(visits: visits),
                MemberDashboardStatKind.workout => _WorkoutDetail(
                    workout: workout,
                    onViewAll: () {
                      Navigator.of(context).pop();
                      onViewWorkout();
                    },
                  ),
                MemberDashboardStatKind.outstanding => _OutstandingDetail(
                    invoices: invoices,
                    onPaid: onInvoicePaid,
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ViewAllLink extends StatelessWidget {
  const _ViewAllLink({required this.route});

  final String route;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {
          Navigator.of(context).pop();
          context.push(route);
        },
        child: const Text('View all →'),
      ),
    );
  }
}

String _fmtDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

String _fmtTime(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

// ── Membership ───────────────────────────────────────────────────────────

class _MembershipDetail extends StatelessWidget {
  const _MembershipDetail({required this.profile});

  final MemberPortalProfile profile;

  @override
  Widget build(BuildContext context) {
    final membership = profile.currentMembership;
    if (membership == null) {
      return const AppEmptyState(
        title: 'No membership on file',
        message: 'Contact the front desk to get a membership plan set up.',
      );
    }
    final days = profile.daysLeft;
    final expired = days != null && days < 0;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _row('Plan', membership.planName),
          _row('Status', expired ? 'Expired' : membership.status),
          _row('Started', _fmtDate(membership.startDate)),
          _row(expired ? 'Expired on' : 'Expires', _fmtDate(membership.endDate)),
          if (days != null)
            _row(expired ? 'Days overdue' : 'Days left', '${days.abs()}'),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: AppText.body(size: 13, color: AppColors.inkFaint)),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

// ── Attendance ───────────────────────────────────────────────────────────

class _AttendanceDetail extends StatelessWidget {
  const _AttendanceDetail({required this.visits});

  final List<MemberVisit> visits;

  @override
  Widget build(BuildContext context) {
    if (visits.isEmpty) {
      return const AppEmptyState(title: 'No visits recorded yet');
    }
    final shown = visits.take(20).toList();
    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: shown.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final v = shown[i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_fmtDate(v.attendanceDate)),
                subtitle: Text(v.branchName),
                trailing: Text(
                  v.checkOutTime == null
                      ? '${_fmtTime(v.checkInTime)} →'
                      : '${_fmtTime(v.checkInTime)} – ${_fmtTime(v.checkOutTime!)}',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
              );
            },
          ),
        ),
        _ViewAllLink(route: AppRoutes.memberAttendance),
      ],
    );
  }
}

// ── Workout ──────────────────────────────────────────────────────────────

class _WorkoutDetail extends StatelessWidget {
  const _WorkoutDetail({required this.workout, required this.onViewAll});

  final MemberWorkoutAssignment? workout;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final plan = workout;
    if (plan == null) {
      return const AppEmptyState(
        title: 'No workout plan assigned',
        message: 'Ask your trainer to assign you one.',
      );
    }
    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: plan.exercises.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final e = plan.exercises[i];
              final status = plan.statusOf(e.exerciseId);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(e.name),
                subtitle: Text(e.dayOfWeek.label),
                trailing: _StatusPill(status: status),
              );
            },
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(onPressed: onViewAll, child: const Text('View all →')),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final ExerciseProgressStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      ExerciseProgressStatus.completed => ('Done', AppColors.success),
      ExerciseProgressStatus.skipped => ('Skipped', AppColors.inkFaint),
      ExerciseProgressStatus.pending => ('Pending', AppColors.warning),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: AppText.body(size: 11, weight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ── Outstanding ──────────────────────────────────────────────────────────

class _OutstandingDetail extends StatelessWidget {
  const _OutstandingDetail({required this.invoices, required this.onPaid});

  final List<MemberInvoice> invoices;
  final VoidCallback onPaid;

  Future<void> _openPaySheet(BuildContext context, MemberInvoice inv) async {
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberPayInvoiceSheet(
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount,
      ),
    );
    if (paid == true) onPaid();
  }

  @override
  Widget build(BuildContext context) {
    final outstanding = invoices.where((i) => i.status != 'PAID').toList();
    if (outstanding.isEmpty) {
      return const AppEmptyState(
        title: 'All paid',
        message: 'Nothing outstanding — every invoice is settled.',
      );
    }
    return Column(
      children: [
        Expanded(
          child: ListView.separated(
            itemCount: outstanding.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (_, i) {
              final inv = outstanding[i];
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(inv.invoiceNumber),
                subtitle: Text('Due ${_fmtDate(inv.dueDate)}'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '₹${inv.totalAmount.toStringAsFixed(0)}',
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    const SizedBox(width: 10),
                    AppButton(
                      label: 'Pay',
                      role: AppRole.member,
                      fullWidth: false,
                      size: AppButtonSize.small,
                      onPressed: () => _openPaySheet(context, inv),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        _ViewAllLink(route: AppRoutes.memberInvoices),
      ],
    );
  }
}
