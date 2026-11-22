import 'package:flutter/material.dart';

import '../../../models/hr_enums.dart';

/// The ONE place HR hues live (attendance-status, leave-status and payroll
/// hues). Everything else in `features/hr` uses `AppColors` / `AppText` and the
/// role palette; screens ask this file for a colour + glyph instead of
/// hard-coding either. The values are the same family as the Members / Team
/// palettes so the area feels native, with one extra hue per status so a
/// calendar full of days stays readable.
class HrPalette {
  HrPalette._();

  // Attendance statuses.
  static const present = Color(0xFF10B981); // emerald
  static const late = Color(0xFFF59E0B); // amber
  static const halfDay = Color(0xFFFB923C); // orange
  static const onLeave = Color(0xFF6366F1); // indigo
  static const absent = Color(0xFFFF5C7A); // rose
  static const weeklyOff = Color(0xFF64748B); // slate
  static const holiday = Color(0xFFC026D3); // fuchsia
  static const notMarked = Color(0xFF94A3B8); // light slate
  static const notJoined = Color(0xFF475569);

  // Leave-request statuses.
  static const pending = Color(0xFFF59E0B);
  static const approved = Color(0xFF10B981);
  static const rejected = Color(0xFFFF5C7A);
  static const cancelled = Color(0xFF64748B);

  // Payroll.
  static const draft = Color(0xFFF59E0B);
  static const run = Color(0xFF0EA5E9);
  static const paid = Color(0xFF10B981);
  static const money = Color(0xFF14B8A6);

  // Clock card (check-in vs check-out).
  static const clockIn = [Color(0xFF34D399), Color(0xFF059669)];
  static const clockOut = [Color(0xFFFB7185), Color(0xFFE11D48)];
  static const clockIdle = [Color(0xFF94A3B8), Color(0xFF64748B)];

  /// Background of the My HR clock card - deep indigo -> violet so the white
  /// ring + ticks pop, whichever theme is active.
  static const clockCard = [
    Color(0xFF1E1B4B),
    Color(0xFF312E81),
    Color(0xFF5B21B6),
  ];

  static Color status(DayStatus s) => switch (s) {
        DayStatus.present => present,
        DayStatus.late => late,
        DayStatus.halfDay => halfDay,
        DayStatus.onLeave => onLeave,
        DayStatus.absent => absent,
        DayStatus.weeklyOff => weeklyOff,
        DayStatus.holiday => holiday,
        DayStatus.notMarked => notMarked,
        DayStatus.notJoined => notJoined,
      };

  static IconData glyph(DayStatus s) => switch (s) {
        DayStatus.present => Icons.check_rounded,
        DayStatus.late => Icons.schedule_rounded,
        DayStatus.halfDay => Icons.contrast_rounded,
        DayStatus.onLeave => Icons.beach_access_rounded,
        DayStatus.absent => Icons.close_rounded,
        DayStatus.weeklyOff => Icons.bedtime_rounded,
        DayStatus.holiday => Icons.celebration_rounded,
        DayStatus.notMarked => Icons.more_horiz_rounded,
        DayStatus.notJoined => Icons.remove_rounded,
      };

  static Color leave(LeaveStatus s) => switch (s) {
        LeaveStatus.pending => pending,
        LeaveStatus.approved => approved,
        LeaveStatus.rejected => rejected,
        LeaveStatus.cancelled => cancelled,
      };

  static IconData leaveGlyph(LeaveStatus s) => switch (s) {
        LeaveStatus.pending => Icons.hourglass_top_rounded,
        LeaveStatus.approved => Icons.check_circle_rounded,
        LeaveStatus.rejected => Icons.cancel_rounded,
        LeaveStatus.cancelled => Icons.block_rounded,
      };

  static Color payslip(PayslipStatus s) =>
      s == PayslipStatus.paid ? paid : draft;

  static Color payrollRun(PayrollRunStatus s) => switch (s) {
        PayrollRunStatus.draft => draft,
        PayrollRunStatus.approved => run,
        PayrollRunStatus.paid => paid,
      };

  /// A leave type's own hex (`#6366f1`), falling back to indigo.
  static Color leaveType(String hex, {Color fallback = onLeave}) {
    var h = hex.trim().replaceFirst('#', '');
    if (h.length == 3) h = h.split('').map((c) => '$c$c').join();
    if (h.length != 6) return fallback;
    final v = int.tryParse(h, radix: 16);
    return v == null ? fallback : Color(0xFF000000 | v);
  }

  /// The swatches HR can pick for a leave type (same set as the web form).
  static const leaveTypeChoices = <(String, String)>[
    ('#6366f1', 'Indigo'),
    ('#ef4444', 'Red'),
    ('#10b981', 'Emerald'),
    ('#64748b', 'Slate'),
    ('#f59e0b', 'Amber'),
    ('#ec4899', 'Pink'),
    ('#14b8a6', 'Teal'),
    ('#8b5cf6', 'Violet'),
  ];

  static IconData dayPart(DayPart p) => switch (p) {
        DayPart.fullDay => Icons.wb_sunny_rounded,
        DayPart.halfMorning => Icons.wb_twilight_rounded,
        DayPart.halfEvening => Icons.nights_stay_rounded,
      };

  /// The calendar / legend entries, in display order.
  static const legend = [
    DayStatus.present,
    DayStatus.late,
    DayStatus.halfDay,
    DayStatus.onLeave,
    DayStatus.absent,
    DayStatus.weeklyOff,
    DayStatus.holiday,
  ];
}
