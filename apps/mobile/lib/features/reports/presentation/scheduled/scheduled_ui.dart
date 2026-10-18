import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/scheduled_report.dart';
import '../../../../models/user_profile.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../kit/kit.dart';

/// Who may do what with scheduled reports.
///
/// **Unchanged**: the hub tile and both routes (no per-route guard — the API
/// answers 403 and the screens show its message). **Added** (web gates the
/// same way, the key is seeded and is exactly the API route's
/// `requirePermission`): the "+", Pause / Resume, Run now and Delete need
/// `reports:export`; listing needs `reports:view` (server-enforced).
class ScheduledAccess {
  const ScheduledAccess(this.user);

  static ScheduledAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    return ScheduledAccess(s is SessionAuthenticatedStaff ? s.user : null);
  }

  final UserProfile? user;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  /// `GET /reports/scheduled`.
  bool get canView => _has('reports:view');

  /// create / pause / resume / run now / delete.
  bool get canManage => _has('reports:export');
}

IconData frequencyIcon(ReportFrequency f) => switch (f) {
      ReportFrequency.daily => Icons.today_rounded,
      ReportFrequency.weekly => Icons.date_range_rounded,
      ReportFrequency.monthly => Icons.calendar_month_rounded,
    };

Color frequencyColor(ReportFrequency f) => switch (f) {
      ReportFrequency.daily => RptColors.teal,
      ReportFrequency.weekly => RptColors.indigo,
      ReportFrequency.monthly => RptColors.fuchsia,
    };

/// Colour of a schedule's report family (web's catalogue accents).
Color scheduledTypeColor(String apiValue) {
  final t = ScheduledReportTypeX.fromApi(apiValue);
  return switch (t) {
    null => RptColors.slate,
    ScheduledReportType.membership ||
    ScheduledReportType.memberProgress ||
    ScheduledReportType.expiringMemberships ||
    ScheduledReportType.activeVsInactive =>
      RptAccent.members.color,
    ScheduledReportType.revenue ||
    ScheduledReportType.expenses ||
    ScheduledReportType.payments =>
      RptAccent.finance.color,
    ScheduledReportType.attendance => RptAccent.attendance.color,
    ScheduledReportType.staff ||
    ScheduledReportType.trainerPerformance =>
      RptAccent.staff.color,
    ScheduledReportType.branchPerformance => RptAccent.operations.color,
    _ => RptAccent.analytics.color,
  };
}

IconData scheduledTypeIcon(String apiValue) {
  final t = ScheduledReportTypeX.fromApi(apiValue);
  if (t == null) return Icons.description_rounded;
  if (t.isAnalytics) return Icons.insights_rounded;
  return switch (t) {
    ScheduledReportType.membership => Icons.assignment_rounded,
    ScheduledReportType.attendance => Icons.how_to_reg_rounded,
    ScheduledReportType.revenue => Icons.trending_up_rounded,
    ScheduledReportType.expenses => Icons.account_balance_wallet_rounded,
    ScheduledReportType.payments => Icons.credit_card_rounded,
    ScheduledReportType.staff => Icons.badge_rounded,
    ScheduledReportType.trainerPerformance => Icons.emoji_events_rounded,
    ScheduledReportType.memberProgress => Icons.insights_rounded,
    ScheduledReportType.branchPerformance => Icons.storefront_rounded,
    ScheduledReportType.expiringMemberships => Icons.hourglass_bottom_rounded,
    _ => Icons.pie_chart_rounded,
  };
}

/// Splits a "a@x.com, b@y.com" field into trimmed non-empty addresses.
List<String> parseRecipients(String raw) => [
      for (final e in raw.split(RegExp('[,;\\n]')))
        if (e.trim().isNotEmpty) e.trim(),
    ];

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

bool isValidEmail(String e) => _emailRe.hasMatch(e);

/// First problem with the create form, or null — the same rules as the API
/// (name 1..150 chars, 1..20 valid recipient emails).
String? validateSchedule({required String name, required List<String> emails}) {
  if (name.trim().isEmpty) return 'Give this report a name.';
  if (name.trim().length > 150) return 'Name must be 150 characters or fewer.';
  if (emails.isEmpty) return 'Add at least one recipient email.';
  if (emails.length > 20) return 'At most 20 recipients.';
  for (final e in emails) {
    if (!isValidEmail(e)) return '"$e" is not a valid email address.';
  }
  return null;
}

/// One schedule: type icon, name, type + frequency + status, recipients,
/// next / last run, branch, and (with `reports:export`) Pause / Resume, Run
/// now and Delete.
class ScheduleCard extends StatelessWidget {
  const ScheduleCard({
    super.key,
    required this.report,
    required this.canManage,
    required this.busy,
    required this.onToggle,
    required this.onRunNow,
    required this.onDelete,
  });

  final ScheduledReport report;
  final bool canManage;
  final bool busy;
  final VoidCallback onToggle;
  final VoidCallback onRunNow;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final c = scheduledTypeColor(report.reportType);
    final fc = frequencyColor(report.frequency);
    final active = report.isActive;
    return Opacity(
      opacity: active ? 1 : 0.82,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 10),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [c.withValues(alpha: 0.18), Colors.transparent],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [c, Color.lerp(c, RptColors.fuchsia, 0.4)!],
                      ),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Icon(
                      scheduledTypeIcon(report.reportType),
                      size: 21,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          report.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 14.5, weight: FontWeight.w800),
                        ),
                        Text(
                          scheduledReportTypeLabel(report.reportType),
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
                  _StatusPill(active: active),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      RptStatPill(
                        icon: frequencyIcon(report.frequency),
                        value: report.frequency.label,
                        color: fc,
                      ),
                      RptStatPill(
                        icon: Icons.mail_outline_rounded,
                        value: report.recipientEmails.length == 1
                            ? '1 recipient'
                            : '${report.recipientEmails.length} recipients',
                        color: RptColors.sky,
                      ),
                      if (report.branchName != null)
                        RptStatPill(
                          icon: Icons.storefront_rounded,
                          value: report.branchName!,
                          color: RptColors.amber,
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _InfoLine(
                    icon: Icons.schedule_rounded,
                    label: 'Next run',
                    value: active ? fmtDateTime(report.nextRunAt) : 'Paused',
                  ),
                  const SizedBox(height: 4),
                  _InfoLine(
                    icon: Icons.history_rounded,
                    label: 'Last run',
                    value: fmtDateTime(report.lastRunAt),
                  ),
                  const SizedBox(height: 4),
                  _InfoLine(
                    icon: Icons.alternate_email_rounded,
                    label: 'To',
                    value: report.recipientEmails.join(', '),
                  ),
                  if (canManage) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _ActionButton(
                          icon: active
                              ? Icons.pause_circle_outline_rounded
                              : Icons.play_circle_outline_rounded,
                          label: active ? 'Pause' : 'Resume',
                          color: RptColors.amber,
                          onTap: busy ? null : onToggle,
                        ),
                        _ActionButton(
                          icon: Icons.send_rounded,
                          label: 'Run now',
                          color: RptColors.indigo,
                          onTap: busy ? null : onRunNow,
                        ),
                        _ActionButton(
                          icon: Icons.delete_outline_rounded,
                          label: 'Delete',
                          color: RptColors.rose,
                          onTap: busy ? null : onDelete,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    final c = active ? RptColors.green : RptColors.slate;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (active) PulseDot(color: c, size: 7) else _dot(c),
          const SizedBox(width: 6),
          Text(
            active ? 'Active' : 'Paused',
            style: AppText.body(size: 11.5, weight: FontWeight.w800, color: c),
          ),
        ],
      ),
    );
  }

  Widget _dot(Color c) => Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(color: c, shape: BoxShape.circle),
      );
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: AppColors.inkFaint),
        const SizedBox(width: 6),
        Text(
          '$label ',
          style: AppText.body(
            size: 12,
            color: AppColors.inkFaint,
            weight: FontWeight.w700,
          ),
        ),
        Expanded(
          child: Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(size: 12, weight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null ? 0.45 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.13),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 15, color: color),
                const SizedBox(width: 5),
                Text(
                  label,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
