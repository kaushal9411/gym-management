import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_leave.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

// ── manual attendance mark ──────────────────────────────────────────────────

/// Manual mark / override of one employee-day (`PUT /hr/attendance`,
/// `hr:attendance_manage`): status, optional check-in / check-out times (only
/// for present / late / half-day) and a REQUIRED remark that is stored with the
/// record and shown back to the employee. A recorded row can also be removed
/// (`DELETE /hr/attendance`, remark required). Returns `true` when something
/// changed.
Future<bool> showMarkAttendanceSheet(
  BuildContext context, {
  required HrEmployeeRef employee,
  required DateTime date,
  HrAttendanceDay? existing,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.edit_calendar_rounded,
      color: HrPalette.onLeave,
      title: existing?.recorded == true ? 'Edit attendance' : 'Mark attendance',
      subtitle: '${employee.name} · ${hrDateWd(date)}',
      child: _MarkForm(employee: employee, date: date, existing: existing),
    ),
  );
  return changed == true;
}

class _MarkForm extends StatefulWidget {
  const _MarkForm({
    required this.employee,
    required this.date,
    required this.existing,
  });

  final HrEmployeeRef employee;
  final DateTime date;
  final HrAttendanceDay? existing;

  @override
  State<_MarkForm> createState() => _MarkFormState();
}

class _MarkFormState extends State<_MarkForm> {
  late DayStatus _status;
  TimeOfDay? _in;
  TimeOfDay? _out;
  final _remark = TextEditingController();
  bool _busy = false;
  bool _submitted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _status = e != null && DayStatus.markable.contains(e.status)
        ? e.status
        : DayStatus.present;
    _in = _parse(e?.checkInTime);
    _out = _parse(e?.checkOutTime);
  }

  @override
  void dispose() {
    _remark.dispose();
    super.dispose();
  }

  static TimeOfDay? _parse(String? hm) {
    if (hm == null) return null;
    final p = hm.split(':');
    final h = int.tryParse(p.first);
    final m = p.length > 1 ? int.tryParse(p[1]) : null;
    return h == null || m == null ? null : TimeOfDay(hour: h, minute: m);
  }

  static String _hm(TimeOfDay t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  String? get _remarkError {
    if (!_submitted) return null;
    return _remark.text.trim().length < 3
        ? 'A remark is required (at least 3 characters)'
        : null;
  }

  String? get _timeError {
    if (!_submitted || !_status.acceptsTimes) return null;
    if (_out != null && _in == null) return 'Add the check-in time first';
    if (_in != null && _out != null) {
      final a = _in!.hour * 60 + _in!.minute;
      final b = _out!.hour * 60 + _out!.minute;
      if (b <= a) return 'Check-out must be after check-in';
    }
    return null;
  }

  Future<void> _pick(bool isIn) async {
    final initial = (isIn ? _in : _out) ?? const TimeOfDay(hour: 9, minute: 0);
    final t = await showTimePicker(context: context, initialTime: initial);
    if (t != null) setState(() => isIn ? _in = t : _out = t);
  }

  Future<void> _save() async {
    setState(() {
      _submitted = true;
      _error = null;
    });
    if (_remarkError != null || _timeError != null) return;
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().markAttendance(
        userId: widget.employee.userId,
        date: hrIso(widget.date),
        status: _status,
        remark: _remark.text,
        checkInTime: _in == null ? null : _hm(_in!),
        checkOutTime: _out == null ? null : _hm(_out!),
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(
        context,
        'Marked ${widget.employee.name} ${_status.label.toLowerCase()}',
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.detailedMessage;
        });
      }
    }
  }

  Future<void> _clear() async {
    final remark = await askHrRemark(
      context,
      title: 'Remove this record?',
      subtitle: 'The day goes back to its calendar-computed status.',
      confirmLabel: 'Remove record',
      color: HrPalette.absent,
      icon: Icons.delete_outline_rounded,
      hint: 'Why is it being removed',
      maxLength: 300,
    );
    if (remark == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().clearAttendance(
        userId: widget.employee.userId,
        date: hrIso(widget.date),
        remark: remark,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
      hrSnack(context, 'Attendance record removed');
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.detailedMessage;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final accent = HrPalette.status(_status);
    final today = AppClock.today();
    final future = widget.date.isAfter(today);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (future)
          const Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: HrRemark(
              remark: 'Attendance can only be marked up to today.',
              color: HrPalette.late,
            ),
          ),
        Text('STATUS', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final s in DayStatus.markable)
              _StatusPill(
                status: s,
                selected: s == _status,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _status = s);
                },
              ),
          ],
        ),
        AnimatedSize(
          duration: const Duration(milliseconds: 220),
          alignment: Alignment.topCenter,
          child: _status.acceptsTimes
              ? Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('TIMES (OPTIONAL)', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _TimeField(
                              label: 'Check in',
                              icon: Icons.login_rounded,
                              value: _in,
                              color: accent,
                              onTap: () => _pick(true),
                              onClear: () => setState(() => _in = null),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _TimeField(
                              label: 'Check out',
                              icon: Icons.logout_rounded,
                              value: _out,
                              color: accent,
                              onTap: () => _pick(false),
                              onClear: () => setState(() => _out = null),
                            ),
                          ),
                        ],
                      ),
                      if (_timeError != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            _timeError!,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: AppColors.danger,
                            ),
                          ),
                        ),
                    ],
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
        const SizedBox(height: 14),
        Text('REMARK (REQUIRED)', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        TextField(
          key: const Key('hr-mark-remark'),
          controller: _remark,
          minLines: 2,
          maxLines: 4,
          maxLength: 300,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (_) => setState(() {}),
          style: AppText.body(),
          decoration: InputDecoration(
            hintText: 'e.g. Forgot to punch in - confirmed by manager',
            hintStyle: AppText.body(color: AppColors.inkFaint),
            errorText: _remarkError,
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: accent, width: 1.6),
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          FormAlert(message: _error!),
        ],
        const SizedBox(height: 12),
        TeamGradientButton(
          label: 'Save attendance',
          icon: Icons.check_rounded,
          loading: _busy,
          gradient: LinearGradient(
            colors: [accent, accent.withValues(alpha: 0.7)],
          ),
          onTap: future ? null : _save,
        ),
        if (widget.existing?.recorded == true) ...[
          const SizedBox(height: 10),
          TeamOutlineButton(
            label: 'Remove record',
            icon: Icons.delete_outline_rounded,
            onTap: _busy ? null : _clear,
          ),
        ],
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.status,
    required this.selected,
    required this.onTap,
  });

  final DayStatus status;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.status(status);
    return Semantics(
      button: true,
      selected: selected,
      label: status.label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: selected ? c : c.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(AppRadii.pill),
            border: Border.all(color: c.withValues(alpha: selected ? 1 : 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                HrPalette.glyph(status),
                size: 14,
                color: selected ? Colors.white : c,
              ),
              const SizedBox(width: 5),
              Text(
                status.label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: selected ? Colors.white : c,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TimeField extends StatelessWidget {
  const _TimeField({
    required this.label,
    required this.icon,
    required this.value,
    required this.color,
    required this.onTap,
    required this.onClear,
  });

  final String label;
  final IconData icon;
  final TimeOfDay? value;
  final Color color;
  final VoidCallback onTap;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final text = value == null ? 'Set time' : value!.format(context);
    return Semantics(
      button: true,
      label: '$label, ${value == null ? 'not set' : text}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: value == null ? AppColors.line : color,
              ),
            ),
            child: Row(
              children: [
                Icon(icon, size: 16, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: AppText.body(
                          size: 10.5,
                          weight: FontWeight.w700,
                          color: AppColors.inkFaint,
                        ),
                      ),
                      Text(
                        text,
                        style: AppText.body(
                          size: 13.5,
                          weight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                if (value != null)
                  InkWell(
                    onTap: onClear,
                    child: Icon(
                      Icons.close_rounded,
                      size: 16,
                      color: AppColors.inkFaint,
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

// ── leave decision ──────────────────────────────────────────────────────────

/// Approver's view of one request: the applicant's balance for that type, who
/// else is off on the same dates, and the decision controls - **Approve**
/// (remark optional), **Reject** (remark REQUIRED) or, for an approved request,
/// **Cancel leave** (remark REQUIRED). Never lets a user decide their own
/// request (the API refuses it too). Returns the updated request, or `null`.
Future<HrLeaveRequest?> showLeaveDecisionSheet(
  BuildContext context,
  HrLeaveRequest request, {
  String? selfUserId,
}) {
  return showTeamSheet<HrLeaveRequest>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.fact_check_rounded,
      color: HrPalette.leaveType(request.leaveType.colorHex),
      title: request.employee.name,
      subtitle: '${request.leaveType.name} request',
      child: _DecisionBody(request: request, selfUserId: selfUserId),
    ),
  );
}

class _DecisionBody extends StatefulWidget {
  const _DecisionBody({required this.request, this.selfUserId});

  final HrLeaveRequest request;
  final String? selfUserId;

  @override
  State<_DecisionBody> createState() => _DecisionBodyState();
}

class _DecisionBodyState extends State<_DecisionBody> {
  HrLeaveDetail? _detail;
  String? _loadError;
  final _remark = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _tried = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _remark.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = await getIt<HrRepository>().leaveDetail(widget.request.id);
      if (mounted) setState(() => _detail = d);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    }
  }

  bool get _mine => widget.selfUserId == widget.request.employee.userId;

  Future<void> _decide(String kind) async {
    final remark = _remark.text.trim();
    final needs = kind != 'approve';
    setState(() {
      _tried = true;
      _error = null;
    });
    if (needs && remark.length < 3) return;
    setState(() => _busy = true);
    final repo = getIt<HrRepository>();
    try {
      final r = switch (kind) {
        'approve' => await repo.approveLeave(
            widget.request.id,
            remark: remark.isEmpty ? null : remark,
          ),
        'reject' => await repo.rejectLeave(widget.request.id, remark: remark),
        _ => await repo.cancelLeave(widget.request.id, remark: remark),
      };
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(r);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.detailedMessage;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = _detail?.request ?? widget.request;
    final hue = HrPalette.leaveType(r.leaveType.colorHex);
    final dates = r.isSingleDay
        ? hrDateWd(r.startDate)
        : '${hrDate(r.startDate)} – ${hrDateY(r.endDate)}';
    final b = _detail?.balance;
    final pending = r.status == LeaveStatus.pending;
    final approved = r.status == LeaveStatus.approved;
    final canAct = !_mine && (pending || approved);
    final remarkError = _tried && _remark.text.trim().length < 3;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            HrChip(
              label: r.status.label,
              color: HrPalette.leave(r.status),
              icon: HrPalette.leaveGlyph(r.status),
            ),
            const SizedBox(width: 8),
            HrChip(
              label: '${hrDays(r.days)} ${r.days == 1 ? 'day' : 'days'}',
              color: hue,
              dense: true,
            ),
            if (r.appliedOnBehalf) ...[
              const SizedBox(width: 8),
              const HrChip(
                label: 'Applied by HR',
                color: HrPalette.onLeave,
                dense: true,
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        HrInfoRow(label: 'Dates', value: dates, icon: Icons.event_rounded),
        HrInfoRow(
          label: 'Part of day',
          value: r.dayPart.label,
          icon: HrPalette.dayPart(r.dayPart),
        ),
        if (r.reason.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text('REASON', style: AppText.eyebrow()),
          const SizedBox(height: 4),
          Text(r.reason, style: AppText.body(size: 13.5)),
        ],
        if (r.decisionRemark != null && r.decisionRemark!.isNotEmpty) ...[
          const SizedBox(height: 10),
          HrRemark(
            who: r.decidedBy?.name,
            remark: r.decisionRemark!,
            color: HrPalette.leave(r.status),
          ),
        ],
        const SizedBox(height: 14),
        if (_detail == null && _loadError == null)
          const HrShimmerBox(height: 70, radius: 14)
        else if (_loadError != null)
          Text(
            _loadError!,
            style: AppText.body(size: 12.5, color: AppColors.danger),
          )
        else ...[
          if (b != null) _BalanceStrip(balance: b, color: hue, days: r.days),
          if (_detail!.conflicts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('ALSO OFF THESE DATES', style: AppText.eyebrow()),
            const SizedBox(height: 6),
            for (final c in _detail!.conflicts)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    HrAvatar(employee: c.employee, size: 28),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c.employee.name,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      c.startDate == c.endDate
                          ? hrDate(c.startDate)
                          : '${hrDate(c.startDate)} – ${hrDate(c.endDate)}',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ],
        if (_mine && (pending || approved)) ...[
          const SizedBox(height: 12),
          const HrRemark(
            remark: 'You cannot decide your own leave request.',
            color: HrPalette.late,
          ),
        ],
        if (canAct) ...[
          const SizedBox(height: 14),
          Text(
            pending ? 'REMARK (REQUIRED TO REJECT)' : 'REMARK (REQUIRED)',
            style: AppText.eyebrow(),
          ),
          const SizedBox(height: 8),
          TextField(
            key: const Key('hr-decision-remark'),
            controller: _remark,
            minLines: 2,
            maxLines: 4,
            maxLength: 500,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            style: AppText.body(),
            decoration: InputDecoration(
              hintText: pending
                  ? 'Add a note for the employee'
                  : 'Why is the approved leave being cancelled?',
              hintStyle: AppText.body(color: AppColors.inkFaint),
              errorText:
                  remarkError && !pending ? 'A remark is required' : null,
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide(color: AppColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide(color: AppColors.line),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            FormAlert(message: _error!),
          ],
          const SizedBox(height: 10),
          if (pending)
            Row(
              children: [
                Expanded(
                  child: _DecisionButton(
                    key: const Key('hr-reject'),
                    label: 'Reject',
                    icon: Icons.close_rounded,
                    colors: HrPalette.clockOut,
                    busy: _busy,
                    onTap: () => _decide('reject'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _DecisionButton(
                    key: const Key('hr-approve'),
                    label: 'Approve',
                    icon: Icons.check_rounded,
                    colors: HrPalette.clockIn,
                    busy: _busy,
                    onTap: () => _decide('approve'),
                  ),
                ),
              ],
            )
          else
            _DecisionButton(
              key: const Key('hr-cancel-leave'),
              label: 'Cancel approved leave',
              icon: Icons.event_busy_rounded,
              colors: HrPalette.clockOut,
              busy: _busy,
              onTap: () => _decide('cancel'),
            ),
          if (pending && remarkError)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                'Rejecting needs a remark of at least 3 characters.',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ),
        ],
      ],
    );
  }
}

class _DecisionButton extends StatelessWidget {
  const _DecisionButton({
    super.key,
    required this.label,
    required this.icon,
    required this.colors,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final List<Color> colors;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => TeamGradientButton(
        label: label,
        icon: icon,
        loading: busy,
        gradient: LinearGradient(colors: colors),
        onTap: busy ? null : onTap,
      );
}

class _BalanceStrip extends StatelessWidget {
  const _BalanceStrip({
    required this.balance,
    required this.color,
    required this.days,
  });

  final HrLeaveBalance balance;
  final Color color;
  final double days;

  @override
  Widget build(BuildContext context) {
    final b = balance;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          HrBalanceRing(
            label: b.leaveType.code,
            remaining: b.available ?? 0,
            total: b.entitled ?? 0,
            used: b.used,
            unlimited: b.unlimited,
            color: color,
            size: 64,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${b.leaveType.name} balance',
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  b.unlimited
                      ? 'Unlimited · ${hrDays(b.used)} used'
                      : '${hrDays(b.used)} used · ${hrDays(b.pending)} '
                          'pending · ${hrDays(b.available ?? 0)} available '
                          '(${b.leaveYearLabel})',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkSoft,
                  ),
                ),
                if (!b.unlimited)
                  Text(
                    // `available` already reserves this request's days while
                    // it is pending.
                    'This request: ${hrDays(days)} '
                    '${days == 1 ? 'day' : 'days'}',
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── pay sheet ───────────────────────────────────────────────────────────────

/// What the pay sheet collects.
class HrPayInput {
  const HrPayInput({required this.mode, required this.paidOn, this.remark});

  final PaymentMode mode;

  /// `YYYY-MM-DD`.
  final String paidOn;
  final String? remark;
}

/// Payment mode + paid-on date + optional note, for "Mark as paid" and "Pay
/// all". Returns `null` when dismissed.
Future<HrPayInput?> showPaySheet(
  BuildContext context, {
  required String title,
  required String subtitle,
  required double amount,
  String confirmLabel = 'Confirm payment',
}) {
  return showTeamSheet<HrPayInput>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.payments_rounded,
      color: HrPalette.paid,
      title: title,
      subtitle: subtitle,
      child: _PayForm(amount: amount, confirmLabel: confirmLabel),
    ),
  );
}

class _PayForm extends StatefulWidget {
  const _PayForm({required this.amount, required this.confirmLabel});

  final double amount;
  final String confirmLabel;

  @override
  State<_PayForm> createState() => _PayFormState();
}

class _PayFormState extends State<_PayForm> {
  PaymentMode _mode = PaymentMode.bankTransfer;
  DateTime _paidOn = AppClock.today();
  final _remark = TextEditingController();

  @override
  void dispose() {
    _remark.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final today = AppClock.today();
    final d = await showDatePicker(
      context: context,
      initialDate: _paidOn,
      firstDate: today.subtract(const Duration(days: 120)),
      lastDate: today,
    );
    if (d != null) setState(() => _paidOn = d);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                HrPalette.paid.withValues(alpha: 0.22),
                HrPalette.money.withValues(alpha: 0.06),
              ],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: HrPalette.paid.withValues(alpha: 0.35)),
          ),
          child: Row(
            children: [
              const Icon(Icons.payments_rounded, color: HrPalette.paid),
              const SizedBox(width: 10),
              Text(
                Formatters.currency(widget.amount),
                style: AppText.display(size: 24, color: HrPalette.paid),
              ),
              const Spacer(),
              Text(
                'will be recorded\nas a salary expense',
                textAlign: TextAlign.right,
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Text('PAYMENT MODE', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final m in PaymentMode.values)
              TeamFilterChip(
                label: m.label,
                selected: m == _mode,
                color: HrPalette.paid,
                onTap: () => setState(() => _mode = m),
              ),
          ],
        ),
        const SizedBox(height: 14),
        Text('PAID ON', style: AppText.eyebrow()),
        const SizedBox(height: 8),
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: _pickDate,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.event_rounded,
                    size: 18,
                    color: HrPalette.paid,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      hrDateY(_paidOn),
                      style: AppText.body(weight: FontWeight.w800),
                    ),
                  ),
                  Icon(
                    Icons.edit_calendar_rounded,
                    size: 18,
                    color: AppColors.inkFaint,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _remark,
          maxLength: 200,
          style: AppText.body(),
          decoration: InputDecoration(
            labelText: 'Note (optional) - e.g. transaction ref',
            labelStyle: AppText.body(color: AppColors.inkFaint, size: 13),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
          ),
        ),
        const SizedBox(height: 8),
        TeamGradientButton(
          label: widget.confirmLabel,
          icon: Icons.check_circle_rounded,
          gradient: const LinearGradient(
            colors: [HrPalette.paid, HrPalette.money],
          ),
          onTap: () => Navigator.of(context).pop(
            HrPayInput(
              mode: _mode,
              paidOn: hrIso(_paidOn),
              remark: _remark.text.trim().isEmpty ? null : _remark.text.trim(),
            ),
          ),
        ),
      ],
    );
  }
}
