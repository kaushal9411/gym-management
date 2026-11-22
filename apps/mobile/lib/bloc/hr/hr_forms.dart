/// Pure validators for the HR admin forms - one function per form, each
/// mirroring the API / web rules (`docs/HR-API-CONTRACT.md`) and returning a
/// `field -> message` map (empty = valid). Kept free of Flutter so they unit
/// test without a widget tree; the sheets call them on submit and show the
/// messages inline.
library;

import '../../core/network/api_exception.dart';

typedef HrFormErrors = Map<String, String>;

/// `1500`, `1,500.50`, `` -> number / `null`.
double? hrParseNumber(String v) {
  final t = v.trim().replaceAll(',', '');
  return t.isEmpty ? null : double.tryParse(t);
}

/// Remark rule shared by reject / cancel / manual mark / clear / adjust /
/// bulk mark: at least [min] characters once trimmed.
String? validateHrRemark(String v, {int min = 3, int max = 300}) {
  final t = v.trim();
  if (t.length < min) {
    return 'A remark of at least $min characters is required.';
  }
  if (t.length > max) return 'Keep the remark under $max characters.';
  return null;
}

final _codeRe = RegExp(r'^[A-Z0-9_]{2,12}$');

/// `HH:mm` -> minutes, `-1` when unparsable.
int hrMinutesOf(String hm) {
  final p = hm.split(':');
  if (p.length < 2) return -1;
  final h = int.tryParse(p[0]);
  final m = int.tryParse(p[1]);
  return h == null || m == null ? -1 : h * 60 + m;
}

HrFormErrors validateShiftForm({
  required String name,
  required String startTime,
  required String endTime,
  required String graceText,
}) {
  final e = <String, String>{};
  if (name.trim().isEmpty) e['name'] = 'Give the shift a name.';
  if (name.trim().length > 40) e['name'] = 'Keep the name under 40 characters.';
  final s = hrMinutesOf(startTime);
  final t = hrMinutesOf(endTime);
  if (s < 0) e['startTime'] = 'Pick a start time.';
  if (t < 0) {
    e['endTime'] = 'Pick an end time.';
  } else if (s >= 0 && t <= s) {
    e['endTime'] = 'End time must be after the start time.';
  }
  final g = hrParseNumber(graceText);
  if (g == null || g < 0 || g > 240 || g != g.roundToDouble()) {
    e['graceMinutes'] = 'Enter 0 to 240 whole minutes.';
  }
  return e;
}

HrFormErrors validateLeaveTypeForm({
  required String name,
  required String code,
  required bool unlimited,
  required String quotaText,
  required bool carryForward,
  required String carryMaxText,
}) {
  final e = <String, String>{};
  if (name.trim().isEmpty) e['name'] = 'Give the leave type a name.';
  if (!_codeRe.hasMatch(code)) {
    e['code'] = 'Use 2-12 capital letters, digits or underscores.';
  }
  if (!unlimited) {
    final q = hrParseNumber(quotaText);
    if (q == null || q < 0) e['yearlyQuota'] = 'Enter the yearly quota.';
  }
  if (carryForward && carryMaxText.trim().isNotEmpty) {
    final c = hrParseNumber(carryMaxText);
    if (c == null || c < 0) e['carryForwardMax'] = 'Enter 0 or more days.';
  }
  return e;
}

HrFormErrors validateHolidayForm({
  required DateTime? date,
  required String name,
}) {
  final e = <String, String>{};
  if (date == null) e['date'] = 'Pick a date.';
  if (name.trim().isEmpty) e['name'] = 'Name the holiday.';
  if (name.trim().length > 80) e['name'] = 'Keep the name under 80 characters.';
  return e;
}

/// Raw text of the policy form.
class HrPolicyDraft {
  const HrPolicyDraft({
    required this.lateGraceMinutes,
    required this.halfDayThresholdHours,
    required this.standardDayHours,
    required this.latePenaltyLatesPerUnit,
    required this.latePenaltyDays,
    required this.overtimeMultiplier,
    required this.backdateLeaveDays,
  });

  final String lateGraceMinutes;
  final String halfDayThresholdHours;
  final String standardDayHours;
  final String latePenaltyLatesPerUnit;
  final String latePenaltyDays;
  final String overtimeMultiplier;
  final String backdateLeaveDays;
}

HrFormErrors validatePolicyForm(HrPolicyDraft d) {
  final e = <String, String>{};
  void atLeast(String key, String text, String label, double min) {
    final n = hrParseNumber(text);
    if (n == null || n < min) e[key] = '$label must be ${_trim(min)} or more.';
  }

  atLeast('lateGraceMinutes', d.lateGraceMinutes, 'Grace', 0);
  atLeast('halfDayThresholdHours', d.halfDayThresholdHours, 'Threshold', 0);
  atLeast('standardDayHours', d.standardDayHours, 'Day length', 1);
  atLeast(
    'latePenaltyLatesPerUnit',
    d.latePenaltyLatesPerUnit,
    'Lates per penalty',
    1,
  );
  atLeast('latePenaltyDays', d.latePenaltyDays, 'Penalty days', 0);
  atLeast('overtimeMultiplier', d.overtimeMultiplier, 'Multiplier', 1);
  atLeast('backdateLeaveDays', d.backdateLeaveDays, 'Back-date window', 0);
  return e;
}

String _trim(double v) =>
    v == v.roundToDouble() ? v.round().toString() : v.toString();

/// One editable line (name + amount text) of a payslip / pay structure.
class HrLineDraft {
  const HrLineDraft({required this.name, required this.amountText});

  final String name;
  final String amountText;
}

/// Payslip editor: bonus / advance >= 0, each manual line named with an
/// amount above 0, at most 20 lines. Line errors are keyed `line0`, `line1`...
HrFormErrors validatePayslipEdit({
  required String bonusText,
  required String advanceText,
  required List<HrLineDraft> lines,
}) {
  final e = <String, String>{};
  final bonus = bonusText.trim().isEmpty ? 0.0 : hrParseNumber(bonusText);
  final adv = advanceText.trim().isEmpty ? 0.0 : hrParseNumber(advanceText);
  if (bonus == null || bonus < 0) e['bonus'] = 'Must be 0 or more.';
  if (adv == null || adv < 0) e['advanceRecovery'] = 'Must be 0 or more.';
  if (lines.length > 20) e['lines'] = 'At most 20 extra lines.';
  for (var i = 0; i < lines.length; i++) {
    final l = lines[i];
    final amount = hrParseNumber(l.amountText);
    if (l.name.trim().isEmpty) {
      e['line$i'] = 'Name this line.';
    } else if (amount == null || amount <= 0) {
      e['line$i'] = 'Amount must be above 0.';
    }
  }
  return e;
}

/// Pay structure: base >= 0 (or blank), every component named with an amount
/// >= 0, at most 20. Errors keyed `row0`, `row1`...
HrFormErrors validatePayStructure({
  required String baseText,
  required List<HrLineDraft> rows,
}) {
  final e = <String, String>{};
  if (baseText.trim().isNotEmpty) {
    final b = hrParseNumber(baseText);
    if (b == null || b < 0) e['baseSalary'] = 'Cannot be negative.';
  }
  if (rows.length > 20) e['rows'] = 'At most 20 components.';
  for (var i = 0; i < rows.length; i++) {
    final r = rows[i];
    final a = hrParseNumber(r.amountText);
    if (r.name.trim().isEmpty) {
      e['row$i'] = 'Name the component.';
    } else if (a == null || a < 0) {
      e['row$i'] = 'Enter an amount.';
    }
  }
  return e;
}

/// Leave-balance adjust: a quota type, days above 0 and a REQUIRED remark.
HrFormErrors validateBalanceAdjust({
  required String? leaveTypeId,
  required String daysText,
  required String remark,
}) {
  final e = <String, String>{};
  if (leaveTypeId == null || leaveTypeId.isEmpty) {
    e['leaveTypeId'] = 'Choose a leave type.';
  }
  final d = hrParseNumber(daysText);
  if (d == null || d <= 0) e['days'] = 'Enter a number of days above 0.';
  final r = validateHrRemark(remark);
  if (r != null) e['remark'] = r;
  return e;
}

/// Bulk "mark present": a shared REQUIRED remark and 1-200 people.
HrFormErrors validateBulkMark({
  required String remark,
  required int selected,
}) {
  final e = <String, String>{};
  final r = validateHrRemark(remark);
  if (r != null) {
    e['remark'] = 'A shared remark of at least 3 characters is required.';
  }
  if (selected < 1) e['entries'] = 'Select at least one employee.';
  if (selected > 200) e['entries'] = 'Mark at most 200 employees at once.';
  return e;
}

/// Payment form (`PUT pay`): `paidOn` may not be in the future.
String? validatePaidOn(DateTime paidOn, DateTime today) =>
    DateTime(paidOn.year, paidOn.month, paidOn.day)
            .isAfter(DateTime(today.year, today.month, today.day))
        ? 'Paid-on date cannot be in the future.'
        : null;

/// Maps a 422 `VALIDATION_ERROR`'s `errors[].field` onto the form's own
/// field keys so the API's wording shows under the right input.
HrFormErrors hrServerFieldErrors(ApiException e) => {
      for (final f in e.fieldErrors)
        if (f.field != null && f.field!.isNotEmpty) f.field!: f.message,
    };
