import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/attendance_summary.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'attendance_access.dart';
import 'attendance_ui.dart';

/// Human text for a failed attendance call (field errors included).
String attendanceErrorText(Object e) => e is ApiException
    ? e.detailedMessage
    : 'Something went wrong. Please try again.';

/// Checks the member of [r] out (`POST /attendance/manual-check-out` with the
/// record id, needs `attendance:checkout`). Shows the success / error snack
/// itself; returns whether it worked.
Future<bool> checkOutRecord(BuildContext context, AttendanceRecord r) async {
  final memberId = r.memberUuid;
  if (memberId == null) {
    teamSnack(context, 'This visit has no member to check out.', error: true);
    return false;
  }
  try {
    await getIt<AttendanceRepository>()
        .manualCheckOut(memberId: memberId, attendanceId: r.id);
    if (context.mounted) teamSnack(context, '${r.memberName} checked out.');
    return true;
  } on ApiException catch (e) {
    if (context.mounted) teamSnack(context, e.detailedMessage, error: true);
  } catch (e) {
    if (context.mounted) {
      teamSnack(context, attendanceErrorText(e), error: true);
    }
  }
  return false;
}

// ── visit detail ────────────────────────────────────────────────────────────

/// Bottom sheet with everything the API knows about one visit, plus the
/// actions the viewer is allowed (Check out / Edit / Delete / View member).
/// Resolves `true` when the record changed, so the caller can reload.
Future<bool> showAttendanceDetailSheet(
  BuildContext context,
  AttendanceRecord record, {
  AttendanceAccess? access,
}) async {
  final acc = access ?? AttendanceAccess.of(context);
  final changed = await showTeamSheet<bool>(
    context,
    (sheetContext) => TeamSheetScaffold(
      icon: attendanceMethodIcon(record.method),
      title: record.memberName,
      subtitle: [
        if (record.memberCode != null) record.memberCode!,
        if (record.branchName != null) record.branchName!,
      ].join(' · '),
      color: attendanceMethodColor(record.method),
      child: _DetailBody(record: record, access: acc),
    ),
  );
  return changed == true;
}

class _DetailBody extends StatefulWidget {
  const _DetailBody({required this.record, required this.access});

  final AttendanceRecord record;
  final AttendanceAccess access;

  @override
  State<_DetailBody> createState() => _DetailBodyState();
}

class _DetailBodyState extends State<_DetailBody> {
  bool _busy = false;

  AttendanceRecord get r => widget.record;

  Future<void> _checkOut() async {
    setState(() => _busy = true);
    final ok = await checkOutRecord(context, r);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  Future<void> _edit() async {
    final ok = await showTeamSheet<bool>(
      context,
      (c) => TeamSheetScaffold(
        icon: Icons.edit_calendar_rounded,
        title: 'Edit visit',
        subtitle: r.memberName,
        color: TeamColors.violet,
        child: _EditBody(record: r),
      ),
    );
    if (ok == true && mounted) Navigator.of(context).pop(true);
  }

  Future<void> _delete() async {
    final sure = await confirmTeam(
      context,
      title: 'Delete this visit?',
      message: 'This soft-deletes the record — it stays in the database but '
          'drops out of reports and history.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!sure || !mounted) return;
    setState(() => _busy = true);
    try {
      await getIt<AttendanceRepository>().delete(r.id);
      if (!mounted) return;
      teamSnack(context, 'Attendance record deleted.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, attendanceErrorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _viewMember() {
    final id = r.memberUuid;
    if (id == null) return;
    final router = GoRouter.of(context);
    Navigator.of(context).pop(false);
    router.push(AppRoutes.memberDetail, extra: id);
  }

  @override
  Widget build(BuildContext context) {
    final inside = r.isInside;
    final out = r.checkOutTime;
    final acc = widget.access;
    final color = attendanceMethodColor(r.method);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              colors: inside
                  ? [
                      TeamColors.green.withValues(alpha: 0.22),
                      TeamColors.teal.withValues(alpha: 0.08),
                    ]
                  : [
                      TeamColors.slate.withValues(alpha: 0.18),
                      TeamColors.slate.withValues(alpha: 0.05),
                    ],
            ),
            border: Border.all(
              color: (inside ? TeamColors.green : TeamColors.slate)
                  .withValues(alpha: 0.4),
            ),
          ),
          child: Row(
            children: [
              AttendanceAvatar(
                name: r.memberName,
                photoUrl: r.memberPhotoUrl,
                color: color,
                size: 52,
                live: inside,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inside
                          ? 'Inside for ${fmtDuration(visitDuration(r))}'
                          : 'Visit lasted ${fmtDuration(visitDuration(r))}',
                      style: AppText.display(size: 16),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        AttendanceStatusTag(inside: inside),
                        AttendanceMethodTag(method: r.method),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.login_rounded,
              label: 'Checked in',
              value: fmtDateTime(r.checkInTime),
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.logout_rounded,
              label: 'Checked out',
              value: out == null ? 'Still inside' : fmtDateTime(out),
              color: TeamColors.teal,
            ),
            TeamFieldTile(
              icon: Icons.timer_outlined,
              label: 'Duration',
              value: fmtDuration(visitDuration(r)),
              color: TeamColors.violet,
            ),
            TeamFieldTile(
              icon: attendanceMethodIcon(r.method),
              label: 'Method',
              value: attendanceMethodLabel(r.method),
              color: color,
            ),
            TeamFieldTile(
              icon: Icons.storefront_rounded,
              label: 'Branch',
              value: r.branchName,
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.sensors_rounded,
              label: 'Device',
              value: r.deviceName,
              color: TeamColors.amber,
            ),
            TeamFieldTile(
              icon: Icons.badge_rounded,
              label: 'Checked in by',
              value: r.checkedInBy,
              color: TeamColors.fuchsia,
            ),
            TeamFieldTile(
              icon: Icons.badge_outlined,
              label: 'Checked out by',
              value: r.checkedOutBy,
              color: TeamColors.rose,
            ),
          ],
        ),
        if (r.notes != null && r.notes!.isNotEmpty) ...[
          const SizedBox(height: 8),
          TeamFieldTile(
            icon: Icons.notes_rounded,
            label: 'Notes',
            value: r.notes,
            color: TeamColors.sky,
            maxLines: 6,
          ),
        ],
        const SizedBox(height: 14),
        if (inside && acc.canCheckOut) ...[
          TeamGradientButton(
            label: 'Check out',
            icon: Icons.logout_rounded,
            loading: _busy,
            gradient: const LinearGradient(
              colors: [TeamColors.rose, TeamColors.fuchsia],
            ),
            onTap: _checkOut,
          ),
          const SizedBox(height: 10),
        ],
        Row(
          children: [
            if (acc.canUpdate)
              Expanded(
                child: TeamOutlineButton(
                  label: 'Edit',
                  icon: Icons.edit_rounded,
                  onTap: _busy ? null : _edit,
                ),
              ),
            if (acc.canUpdate && acc.canDelete) const SizedBox(width: 10),
            if (acc.canDelete)
              Expanded(
                child: TeamOutlineButton(
                  label: 'Delete',
                  icon: Icons.delete_outline_rounded,
                  onTap: _busy ? null : _delete,
                ),
              ),
          ],
        ),
        if (acc.canViewMembers && r.memberUuid != null) ...[
          const SizedBox(height: 10),
          TeamOutlineButton(
            label: 'View member',
            icon: Icons.person_rounded,
            onTap: _viewMember,
          ),
        ],
      ],
    );
  }
}

/// Edit form (`PATCH /attendance/:id`): status, check-out time, notes —
/// the same three fields web's edit dialog sends.
class _EditBody extends StatefulWidget {
  const _EditBody({required this.record});

  final AttendanceRecord record;

  @override
  State<_EditBody> createState() => _EditBodyState();
}

class _EditBodyState extends State<_EditBody> {
  late final TextEditingController _notes =
      TextEditingController(text: widget.record.notes ?? '');
  late final TextEditingController _outText = TextEditingController();
  late String _status = widget.record.isInside ? 'CHECKED_IN' : 'CHECKED_OUT';
  DateTime? _out;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _out = widget.record.checkOutTime?.toLocal();
    _syncText();
  }

  @override
  void dispose() {
    _notes.dispose();
    _outText.dispose();
    super.dispose();
  }

  void _syncText() => _outText.text = _out == null ? '' : fmtDateTime(_out);

  Future<void> _pickOut() async {
    final inAt = widget.record.checkInTime.toLocal();
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _out ?? now,
      firstDate: dayOnly(inAt),
      lastDate: now.isAfter(inAt) ? now : inAt,
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_out ?? now),
    );
    if (time == null || !mounted) return;
    setState(() {
      _out = DateTime(date.year, date.month, date.day, time.hour, time.minute);
      _status = 'CHECKED_OUT';
      _error = null;
      _syncText();
    });
  }

  void _setStatus(String s) {
    setState(() {
      _status = s;
      if (s == 'CHECKED_IN') {
        _out = null;
        _syncText();
      }
      _error = null;
    });
  }

  Future<void> _save() async {
    final inAt = widget.record.checkInTime.toLocal();
    if (_status == 'CHECKED_OUT' && _out == null) {
      setState(() => _error = 'Pick the check-out time.');
      return;
    }
    if (_out != null && _out!.isBefore(inAt)) {
      setState(() => _error = 'Check-out must be after the check-in time.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<AttendanceRepository>().update(widget.record.id, {
        'checkOutTime': _out?.toUtc().toIso8601String(),
        'notes': _notes.text.trim(),
        'status': _status,
      });
      if (!mounted) return;
      teamSnack(context, 'Attendance record updated.');
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = attendanceErrorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Checked in ${fmtDateTime(widget.record.checkInTime)}',
          style: AppText.body(
            size: 12,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        Text('STATUS', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        Row(
          children: [
            TeamFilterChip(
              label: 'Checked in',
              color: TeamColors.green,
              selected: _status == 'CHECKED_IN',
              onTap: () => _setStatus('CHECKED_IN'),
            ),
            const SizedBox(width: 8),
            TeamFilterChip(
              label: 'Checked out',
              color: TeamColors.slate,
              selected: _status == 'CHECKED_OUT',
              onTap: () => _setStatus('CHECKED_OUT'),
            ),
          ],
        ),
        const SizedBox(height: 14),
        AppLabeledField(
          label: 'Check-out time',
          hintText: 'Not checked out',
          icon: Icons.logout_rounded,
          iconColor: TeamColors.teal,
          controller: _outText,
          readOnly: true,
          onTap: _pickOut,
          suffixIcon: _out == null
              ? Icon(
                  Icons.schedule_rounded,
                  size: 18,
                  color: AppColors.inkFaint,
                )
              : IconButton(
                  icon: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: AppColors.inkFaint,
                  ),
                  onPressed: () => setState(() {
                    _out = null;
                    _status = 'CHECKED_IN';
                    _syncText();
                  }),
                ),
        ),
        const SizedBox(height: 14),
        AppLabeledField(
          label: 'Notes',
          hintText: 'Anything worth remembering',
          icon: Icons.notes_rounded,
          iconColor: TeamColors.sky,
          controller: _notes,
          minLines: 3,
          maxLines: 5,
          textCapitalization: TextCapitalization.sentences,
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w700,
              color: AppColors.danger,
            ),
          ),
        ],
        const SizedBox(height: 16),
        TeamGradientButton(
          label: 'Save changes',
          icon: Icons.check_rounded,
          gradient: TeamColors.ctaGreen,
          loading: _saving,
          onTap: _save,
        ),
      ],
    );
  }
}

// ── list + insight sheets ───────────────────────────────────────────────────

/// A sheet listing visits (KPI / insight drill-down). Tapping one opens its
/// detail sheet; [onChanged] fires when that changed anything.
Future<void> showAttendanceListSheet(
  BuildContext context, {
  required String title,
  required IconData icon,
  required Color color,
  required List<AttendanceRecord> records,
  String? subtitle,
  String emptyText = 'Nothing here right now.',
  bool showBranch = false,
  VoidCallback? onChanged,
  AttendanceAccess? access,
}) {
  final acc = access ?? AttendanceAccess.of(context);
  const cap = 80;
  return showTeamSheet<void>(
    context,
    (sheetContext) => TeamSheetScaffold(
      icon: icon,
      title: title,
      subtitle: subtitle ??
          '${records.length} ${records.length == 1 ? 'visit' : 'visits'}',
      color: color,
      child: records.isEmpty
          ? Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                emptyText,
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
            )
          : Column(
              children: [
                for (var i = 0; i < records.length && i < cap; i++)
                  FadeUp(
                    index: i.clamp(0, 6),
                    child: _SheetRecordRow(
                      record: records[i],
                      showBranch: showBranch,
                      onTap: () async {
                        final changed = await showAttendanceDetailSheet(
                          sheetContext,
                          records[i],
                          access: acc,
                        );
                        if (changed) {
                          if (sheetContext.mounted) {
                            Navigator.of(sheetContext).pop();
                          }
                          onChanged?.call();
                        }
                      },
                    ),
                  ),
                if (records.length > cap)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Showing the first $cap of ${records.length}.',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
    ),
  );
}

class _SheetRecordRow extends StatelessWidget {
  const _SheetRecordRow({
    required this.record,
    required this.showBranch,
    required this.onTap,
  });

  final AttendanceRecord record;
  final bool showBranch;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = record;
    final out = r.checkOutTime;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 2),
          child: Row(
            children: [
              AttendanceAvatar(
                name: r.memberName,
                photoUrl: r.memberPhotoUrl,
                color: attendanceMethodColor(r.method),
                size: 36,
                live: r.isInside,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      r.memberName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    Text(
                      [
                        out == null
                            ? 'In ${fmtClock(r.checkInTime)}'
                            : '${fmtClock(r.checkInTime)} – ${fmtClock(out)}',
                        attendanceMethodLabel(r.method),
                        if (showBranch && r.branchName != null) r.branchName!,
                      ].join(' · '),
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
              AttendanceStatusTag(inside: r.isInside),
              Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Day-by-day check-in counts over the loaded window (newest first).
Future<void> showAttendanceTrendSheet(
  BuildContext context,
  List<AttendanceTrendDay> trend,
) {
  final days = trend.reversed.toList();
  final max = days.fold(1, (a, d) => d.count > a ? d.count : a);
  final total = days.fold(0, (a, d) => a + d.count);
  return showTeamSheet<void>(
    context,
    (c) => TeamSheetScaffold(
      icon: Icons.show_chart_rounded,
      title: 'Daily check-ins',
      subtitle: 'Last ${days.length} days · $total check-ins',
      color: TeamColors.indigo,
      child: Column(
        children: [
          for (var i = 0; i < days.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  SizedBox(
                    width: 74,
                    child: Text(
                      i == 0
                          ? 'Today'
                          : '${weekdayShort(parseTrendDate(days[i].date))}, '
                              '${fmtDayMonth(parseTrendDate(days[i].date))}',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
                  Expanded(
                    child: GrowBar(
                      ratio: days[i].count / max,
                      height: 8,
                      track: AppColors.surface3,
                      colors: const [TeamColors.indigo, TeamColors.violet],
                    ),
                  ),
                  SizedBox(
                    width: 38,
                    child: Text(
                      '${days[i].count}',
                      textAlign: TextAlign.right,
                      style: AppText.body(size: 12.5, weight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

/// This-week vs last-week per weekday as a table with deltas.
Future<void> showAttendanceWeekSheet(
  BuildContext context,
  AttendanceTrendMetrics m,
) {
  return showTeamSheet<void>(
    context,
    (c) => TeamSheetScaffold(
      icon: Icons.compare_arrows_rounded,
      title: 'This week vs last week',
      subtitle: 'This week ${m.thisWeekSum} · Last week ${m.lastWeekSum}',
      color: TeamColors.violet,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'Week over week',
                style: AppText.body(size: 12.5, weight: FontWeight.w700),
              ),
              const SizedBox(width: 8),
              AttendanceDeltaChip(pct: m.weekDeltaPct),
            ],
          ),
          const SizedBox(height: 12),
          AttendancePairedBars(pairs: m.weekdayPairs),
          const SizedBox(height: 12),
          for (final p in m.weekdayPairs)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  SizedBox(
                    width: 44,
                    child: Text(
                      p.$1,
                      style: AppText.body(size: 12.5, weight: FontWeight.w800),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      '${p.$2} this week · ${p.$3} last week',
                      style: AppText.body(
                        size: 12,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}

/// Check-ins per hour today.
Future<void> showAttendanceHoursSheet(
  BuildContext context,
  Map<int, int> byHour, {
  int? peakHour,
}) {
  final hours = byHour.keys.toList()..sort();
  final max = byHour.values.fold(1, (a, b) => b > a ? b : a);
  return showTeamSheet<void>(
    context,
    (c) => TeamSheetScaffold(
      icon: Icons.schedule_rounded,
      title: 'Busiest hours today',
      subtitle: peakHour == null
          ? 'No check-ins yet'
          : 'Peak at ${fmtHour(peakHour, minutes: true)}',
      color: TeamColors.amber,
      child: hours.isEmpty
          ? Text(
              'No check-ins yet today.',
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            )
          : Column(
              children: [
                AttendanceHourBars(byHour: byHour, height: 110),
                const SizedBox(height: 14),
                for (final h in hours)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 64,
                          child: Text(
                            fmtHour(h, minutes: true),
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: AppColors.inkSoft,
                            ),
                          ),
                        ),
                        Expanded(
                          child: GrowBar(
                            ratio: byHour[h]! / max,
                            height: 8,
                            track: AppColors.surface3,
                            colors: const [TeamColors.amber, TeamColors.rose],
                          ),
                        ),
                        SizedBox(
                          width: 34,
                          child: Text(
                            '${byHour[h]}',
                            textAlign: TextAlign.right,
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    ),
  );
}
