import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_enums.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_form_kit.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

/// Who still needs a record on a day: nothing recorded AND a normal working day
/// for them (not marked yet, or computed absent). Employees already recorded,
/// on leave, on a weekly off or a holiday are left alone.
List<HrBoardRow> bulkCandidates(List<HrBoardRow> rows) => [
      for (final r in rows)
        if (!r.attendance.recorded &&
            (r.attendance.status == DayStatus.notMarked ||
                r.attendance.status == DayStatus.absent))
          r,
    ];

/// "Mark all present" for one day (`POST /hr/attendance/bulk`,
/// `hr:attendance_manage`): pick who (everyone without a record is ticked), one
/// shared **required** remark, an optional check-in time. Returns `true` when
/// the server updated people.
Future<bool> showBulkMarkSheet(
  BuildContext context, {
  required DateTime date,
  required List<HrBoardRow> rows,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.how_to_reg_rounded,
      color: HrPalette.present,
      title: 'Mark everyone present',
      subtitle: '${hrDateWd(date)} · employees without a record',
      child: _BulkForm(date: date, candidates: bulkCandidates(rows)),
    ),
  );
  return changed == true;
}

class _BulkForm extends StatefulWidget {
  const _BulkForm({required this.date, required this.candidates});

  final DateTime date;
  final List<HrBoardRow> candidates;

  @override
  State<_BulkForm> createState() => _BulkFormState();
}

class _BulkFormState extends State<_BulkForm> {
  late final Set<String> _selected = {
    for (final c in widget.candidates) c.employee.userId,
  };
  final _remark = TextEditingController();
  String _checkIn = '';
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  @override
  void dispose() {
    _remark.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final errors = validateBulkMark(
      remark: _remark.text,
      selected: _selected.length,
    );
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      final r = await getIt<HrRepository>().bulkMarkPresent(
        date: hrIso(widget.date),
        remark: _remark.text,
        userIds: _selected.toList(),
        checkInTime: _checkIn.isEmpty ? null : _checkIn,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(
        context,
        '${r.updated} employee${r.updated == 1 ? '' : 's'} marked present '
        'for ${hrDate(widget.date)}',
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        final fe = hrServerFieldErrors(e);
        _errors = {if (fe['remark'] != null) 'remark': fe['remark']!};
        _serverError = e.detailedMessage;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.candidates;
    if (list.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(
          'Nothing to mark - every employee already has a record or is off '
          'that day.',
          key: const Key('bulk-empty'),
          style: AppText.body(color: AppColors.inkSoft),
        ),
      );
    }
    final all = _selected.length == list.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(child: HrFieldLabel('WHO')),
            TextButton(
              key: const Key('bulk-toggle-all'),
              onPressed: () => setState(() {
                if (all) {
                  _selected.clear();
                } else {
                  _selected.addAll(list.map((c) => c.employee.userId));
                }
              }),
              child: Text(all ? 'Clear all' : 'Select all'),
            ),
          ],
        ),
        for (final c in list)
          CheckboxListTile(
            key: Key('bulk-${c.employee.userId}'),
            contentPadding: EdgeInsets.zero,
            dense: true,
            controlAffinity: ListTileControlAffinity.leading,
            activeColor: HrPalette.present,
            value: _selected.contains(c.employee.userId),
            onChanged: (v) => setState(() {
              if (v == true) {
                _selected.add(c.employee.userId);
              } else {
                _selected.remove(c.employee.userId);
              }
            }),
            title: Text(
              c.employee.name,
              style: AppText.body(size: 14, weight: FontWeight.w800),
            ),
            subtitle: Text(
              c.employee.roleLabel,
              style: AppText.body(
                size: 11.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ),
        if (_errors['entries'] != null)
          Text(
            _errors['entries']!,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: AppColors.danger,
            ),
          ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('bulk-remark'),
          label: 'Shared remark (required)',
          controller: _remark,
          hintText: 'e.g. Bulk mark - biometric was down',
          errorText: _errors['remark'],
          minLines: 2,
          maxLines: 4,
        ),
        const SizedBox(height: 12),
        HrTimeTile(
          key: const Key('bulk-checkin'),
          label: 'Check in (optional)',
          value: _checkIn,
          clearable: true,
          color: HrPalette.present,
          onChanged: (v) => setState(() => _checkIn = v),
        ),
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('bulk-save'),
          label: 'Mark ${_selected.length} present',
          icon: Icons.check_rounded,
          loading: _busy,
          gradient: LinearGradient(colors: HrPalette.clockIn),
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}
