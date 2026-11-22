// Real-shaped HR API payloads (`docs/HR-API-CONTRACT.md`). The `data` part of
// the envelope only - what the repository hands to `fromJson`.

const hrEmployeeRefJson = {
  'userId': 'u-vikram',
  'employeeId': 'EMP-0002',
  'name': 'Vikram Coach',
  'avatarUrl': null,
  'role': 'TRAINER',
};

const hrLeaveTypeCasual = {
  'id': 'lt-casual',
  'name': 'Casual Leave',
  'code': 'CASUAL',
  'color': '#6366f1',
  'isPaid': true,
};

const hrLeaveTypeUnpaid = {
  'id': 'lt-unpaid',
  'name': 'Unpaid Leave',
  'code': 'UNPAID',
  'color': '#64748b',
  'isPaid': false,
};

Map<String, dynamic> hrAttendanceDayJson({
  String date = '2026-11-22',
  String status = 'PRESENT',
  bool recorded = true,
  String? checkInTime = '06:05',
  String? checkOutTime,
  String? source = 'SELF',
  String? remark,
  int lateMinutes = 0,
}) =>
    {
      'date': date,
      'userId': 'u-vikram',
      'status': status,
      'recorded': recorded,
      'id': recorded ? 'att-1' : null,
      'checkInAt': checkInTime == null ? null : '${date}T00:35:00.000Z',
      'checkOutAt': checkOutTime == null ? null : '${date}T10:00:00.000Z',
      'checkInTime': checkInTime,
      'checkOutTime': checkOutTime,
      'workedMinutes': checkOutTime == null ? null : 565,
      'lateMinutes': lateMinutes,
      'overtimeMinutes': 0,
      'source': source,
      'remark': remark,
      'markedBy': source == 'MANUAL'
          ? {'id': 'u-owner', 'name': 'Kaushal Chauhan'}
          : null,
      'leaveRequestId': null,
      'leaveType': null,
      'leaveDayPart': null,
      'holidayName': null,
      'shift': {'name': 'General', 'startTime': '06:00', 'endTime': '21:00'},
    };

const hrStatsJson = {
  'present': 18,
  'late': 2,
  'halfDay': 1,
  'onLeave': 2,
  'absent': 0,
  'weeklyOff': 4,
  'holiday': 1,
  'notMarked': 3,
  'workedMinutes': 9120,
  'lateCount': 2,
  'overtimeMinutes': 0,
};

Map<String, dynamic> hrLeaveRequestJson({
  String id = 'lr-1',
  String status = 'PENDING',
  String dayPart = 'FULL_DAY',
  double days = 2,
  String start = '2026-11-25',
  String end = '2026-11-26',
  String? decisionRemark,
  bool canCancel = true,
  bool onBehalf = false,
}) =>
    {
      'id': id,
      'employee': hrEmployeeRefJson,
      'leaveType': hrLeaveTypeCasual,
      'startDate': start,
      'endDate': end,
      'dayPart': dayPart,
      'days': days,
      'reason': 'Family function',
      'status': status,
      'appliedOnBehalf': onBehalf,
      'appliedBy': {'id': 'u-vikram', 'name': 'Vikram Coach'},
      'createdAt': '2026-11-20T04:00:00.000Z',
      'decidedBy': status == 'PENDING'
          ? null
          : {'id': 'u-owner', 'name': 'Kaushal Chauhan'},
      'decidedAt': status == 'PENDING' ? null : '2026-11-21T04:00:00.000Z',
      'decisionRemark': decisionRemark,
      'cancelledAt': null,
      'canCancel': canCancel,
    };

const hrBalanceCasualJson = {
  'leaveType': hrLeaveTypeCasual,
  'leaveYear': 2026,
  'leaveYearLabel': '2026-27',
  'periodStart': '2026-04-01',
  'periodEnd': '2027-03-31',
  'quota': 12,
  'carriedForward': 0,
  'adjustment': 0,
  'entitled': 12,
  'used': 1.5,
  'pending': 2,
  'available': 8.5,
};

const hrBalanceUnpaidJson = {
  'leaveType': hrLeaveTypeUnpaid,
  'leaveYear': 2026,
  'leaveYearLabel': '2026-27',
  'periodStart': '2026-04-01',
  'periodEnd': '2027-03-31',
  'quota': null,
  'carriedForward': 0,
  'adjustment': 0,
  'entitled': null,
  'used': 0,
  'pending': 0,
  'available': null,
};

Map<String, dynamic> hrSummaryJson({
  bool canCheckIn = true,
  bool canCheckOut = false,
  String? checkInTime,
  String? checkOutTime,
  String status = 'NOT_MARKED',
}) =>
    {
      'employee': {
        ...hrEmployeeRefJson,
        'joiningDate': '2026-11-01',
        'shift': {
          'id': 'sh-1',
          'name': 'General',
          'startTime': '06:00',
          'endTime': '21:00',
          'graceMinutes': 10,
        },
        'weeklyOff': ['SUNDAY'],
      },
      'today': {
        'date': '2026-11-22',
        'attendance': hrAttendanceDayJson(
          status: status,
          recorded: checkInTime != null,
          checkInTime: checkInTime,
          checkOutTime: checkOutTime,
        ),
        'isWeeklyOff': false,
        'holidayName': null,
        'canCheckIn': canCheckIn,
        'canCheckOut': canCheckOut,
      },
      'month': {'month': '2026-11', 'stats': hrStatsJson},
      'leaveBalances': [hrBalanceCasualJson, hrBalanceUnpaidJson],
      'pendingLeaves': [hrLeaveRequestJson()],
      'upcomingLeaves': <Map<String, dynamic>>[],
      'upcomingHolidays': [
        {
          'id': 'h-1',
          'date': '2026-12-25',
          'name': 'Christmas',
          'description': null,
          'branch': null,
        },
      ],
      'latestPayslip': {
        'id': 'ps-1',
        'runId': 'run-1',
        'month': '2026-10',
        'status': 'PAID',
        'employee': hrEmployeeRefJson,
        'netPay': 17875,
        'grossEarnings': 18375,
        'totalDeductions': 500,
        'paidAt': '2026-11-01T05:00:00.000Z',
        'paymentMode': 'UPI',
      },
      'unreadNotifications': 2,
    };

Map<String, dynamic> hrPayslipJson({String status = 'DRAFT'}) => {
      'id': 'ps-2',
      'runId': 'run-2',
      'month': '2026-11',
      'status': status,
      'employee': hrEmployeeRefJson,
      'salaryType': 'MONTHLY',
      'workingDays': 26,
      'presentDays': 21,
      'halfDays': 1,
      'paidLeaveDays': 2,
      'unpaidLeaveDays': 0,
      'absentDays': 1,
      'holidayDays': 1,
      'weeklyOffDays': 4,
      'notEmployedDays': 0,
      'lateCount': 2,
      'overtimeMinutes': 0,
      'unpaidDays': 1.5,
      'dailyRate': 750,
      'baseSalary': 18000,
      'fixedAllowances': 1500,
      'monthlyGross': 19500,
      'attendanceDeduction': 1125,
      'overtimePay': 0,
      'extraAllowances': 0,
      'bonus': 0,
      'grossEarnings': 18375,
      'fixedDeductions': 500,
      'extraDeductions': 0,
      'latePenalty': 0,
      'advanceRecovery': 0,
      'totalDeductions': 500,
      'netPay': 17875,
      'lines': [
        {
          'id': 'l1',
          'name': 'Travel allowance',
          'type': 'ALLOWANCE',
          'amount': 1500,
          'source': 'STRUCTURE',
        },
        {
          'id': 'l2',
          'name': 'Provident fund',
          'type': 'DEDUCTION',
          'amount': 500,
          'source': 'STRUCTURE',
        },
      ],
      'notes': <String>[],
      'paidAt': status == 'PAID' ? '2026-12-01T05:00:00.000Z' : null,
      'paymentMode': status == 'PAID' ? 'UPI' : null,
      'paidOn': status == 'PAID' ? '2026-12-01' : null,
      'paidBy': status == 'PAID'
          ? {'id': 'u-owner', 'name': 'Kaushal Chauhan'}
          : null,
      'paidRemark': status == 'PAID' ? 'Txn ref 123' : null,
      'expenseId': null,
      'createdAt': '2026-12-01T00:00:00.000Z',
      'updatedAt': '2026-12-01T00:00:00.000Z',
    };

Map<String, dynamic> hrRunJson({String status = 'APPROVED'}) => {
      'id': 'run-2',
      'month': '2026-11',
      'status': status,
      'employeeCount': 4,
      'totalGross': 80000,
      'totalDeductions': 2000,
      'totalNet': 78000,
      'paidCount': 1,
      'paidAmount': 17875,
      'notes': null,
      'createdBy': {'id': 'u-owner', 'name': 'Kaushal Chauhan'},
      'createdAt': '2026-12-01T00:00:00.000Z',
      'approvedBy': {'id': 'u-owner', 'name': 'Kaushal Chauhan'},
      'approvedAt': '2026-12-01T01:00:00.000Z',
      'paidAt': null,
    };

const hrOverviewJson = {
  'date': '2026-11-22',
  'headcount': 4,
  'today': {
    'present': 1,
    'late': 1,
    'halfDay': 0,
    'onLeave': 1,
    'absent': 0,
    'weeklyOff': 0,
    'holiday': 0,
    'notMarked': 1,
    'checkedInNow': 2,
  },
  'pendingLeaves': 3,
  'payroll': {
    'month': '2026-11',
    'runId': 'run-2',
    'status': 'APPROVED',
    'totalNet': 78000,
    'unpaidPayslips': 3,
  },
  'upcomingLeaves': [
    {
      'id': 'lr-9',
      'employee': hrEmployeeRefJson,
      'leaveType': hrLeaveTypeCasual,
      'startDate': '2026-11-25',
      'endDate': '2026-11-26',
      'dayPart': 'FULL_DAY',
      'days': 2,
    },
  ],
  'trend': [
    {
      'date': '2026-11-20',
      'present': 3,
      'late': 1,
      'halfDay': 0,
      'onLeave': 0,
      'absent': 0,
    },
    {
      'date': '2026-11-21',
      'present': 2,
      'late': 0,
      'halfDay': 1,
      'onLeave': 1,
      'absent': 0,
    },
  ],
  'upcomingHolidays': [
    {
      'id': 'h-1',
      'date': '2026-12-25',
      'name': 'Christmas',
      'description': null,
      'branch': null,
    },
  ],
};

// ── setup / payroll / grid payloads (shapes verified against the live API) ──

const hrShiftJson = {
  'id': 'sh-general',
  'name': 'General',
  'startTime': '06:00',
  'endTime': '21:00',
  'graceMinutes': 10,
  'weeklyOffDays': ['SUNDAY'],
  'isDefault': true,
  'isActive': true,
  'employeeCount': 3,
};

const hrShiftMorningJson = {
  'id': 'sh-morning',
  'name': 'Morning',
  'startTime': '06:00',
  'endTime': '14:00',
  'graceMinutes': 5,
  'weeklyOffDays': ['SATURDAY', 'SUNDAY'],
  'isDefault': false,
  'isActive': true,
  'employeeCount': 0,
};

const hrPolicyJson = {
  'leaveYearStartMonth': 4,
  'defaultWeeklyOff': ['SUNDAY'],
  'lateGraceMinutes': 10,
  'halfDayThresholdHours': 4,
  'standardDayHours': 8,
  'latePenaltyEnabled': false,
  'latePenaltyLatesPerUnit': 3,
  'latePenaltyDays': 0.5,
  'overtimeEnabled': false,
  'overtimeMultiplier': 1.5,
  'backdateLeaveDays': 30,
  'workingDaysBasis': 'CALENDAR_MINUS_WEEKLY_OFFS',
};

const hrLeaveTypeFullCasual = {
  'id': 'lt-casual',
  'name': 'Casual Leave',
  'code': 'CASUAL',
  'color': '#6366f1',
  'isPaid': true,
  'yearlyQuota': 12,
  'carryForward': false,
  'carryForwardMax': null,
  'isActive': true,
  'sortOrder': 1,
};

const hrLeaveTypeFullPaid = {
  'id': 'lt-paid',
  'name': 'Paid Leave',
  'code': 'PAID',
  'color': '#10b981',
  'isPaid': true,
  'yearlyQuota': 15,
  'carryForward': true,
  'carryForwardMax': 15,
  'isActive': true,
  'sortOrder': 3,
};

const hrLeaveTypeFullUnpaid = {
  'id': 'lt-unpaid',
  'name': 'Unpaid Leave',
  'code': 'UNPAID',
  'color': '#64748b',
  'isPaid': false,
  'yearlyQuota': null,
  'carryForward': false,
  'carryForwardMax': null,
  'isActive': true,
  'sortOrder': 4,
};

const hrHolidayJson = {
  'id': 'h-diwali',
  'date': '2026-11-08',
  'name': 'Diwali (Lakshmi Puja)',
  'description': 'Sample date - verify against your local calendar',
  'branch': null,
};

const hrHolidayBranchJson = {
  'id': 'h-branch',
  'date': '2026-11-24',
  'name': 'Guru Nanak Jayanti',
  'description': null,
  'branch': {'id': 'b-1', 'name': 'Main'},
};

/// Two employees x three days (the real endpoint returns every day of the
/// month; three is enough for rendering tests).
const hrMonthlyGridJson = {
  'month': '2026-11',
  'days': ['2026-11-20', '2026-11-21', '2026-11-22'],
  'employees': [
    {
      'employee': hrEmployeeRefJson,
      'cells': ['PRESENT', 'LATE', 'NOT_MARKED'],
      'stats': {
        'present': 1,
        'late': 1,
        'halfDay': 0,
        'onLeave': 0,
        'absent': 0,
        'weeklyOff': 0,
        'holiday': 0,
        'notMarked': 1,
        'workedMinutes': 0,
        'lateCount': 1,
        'overtimeMinutes': 0,
      },
    },
    {
      'employee': {
        'userId': 'u-asha',
        'employeeId': 'EMP-0003',
        'name': 'Asha Desk',
        'avatarUrl': null,
        'role': 'RECEPTIONIST',
      },
      'cells': ['ABSENT', 'WEEKLY_OFF', 'HOLIDAY'],
      'stats': {
        'present': 0,
        'late': 0,
        'halfDay': 0,
        'onLeave': 0,
        'absent': 1,
        'weeklyOff': 1,
        'holiday': 1,
        'notMarked': 0,
        'workedMinutes': 0,
        'lateCount': 0,
        'overtimeMinutes': 0,
      },
    },
  ],
};

const hrPayStructureJson = {
  'userId': 'u-vikram',
  'salaryType': 'MONTHLY',
  'baseSalary': 18000,
  'components': [
    {
      'id': 'c1',
      'name': 'Travel allowance',
      'type': 'ALLOWANCE',
      'amount': 1500,
      'isActive': true,
    },
    {
      'id': 'c2',
      'name': 'Provident fund',
      'type': 'DEDUCTION',
      'amount': 500,
      'isActive': true,
    },
  ],
  'monthlyGross': 19500,
  'fixedDeductions': 500,
};

/// A DRAFT payslip that already has one MANUAL line (an incentive).
Map<String, dynamic> hrPayslipWithManualLineJson() {
  final base = Map<String, dynamic>.from(hrPayslipJson());
  base['lines'] = [
    ...(base['lines'] as List),
    {
      'id': 'l3',
      'name': 'Incentive',
      'type': 'ALLOWANCE',
      'amount': 750,
      'source': 'MANUAL',
    },
  ];
  base['extraAllowances'] = 750;
  base['bonus'] = 200;
  return base;
}

const hrBalanceAdjustedJson = {
  'leaveType': hrLeaveTypeCasual,
  'leaveYear': 2026,
  'leaveYearLabel': '2026-27',
  'periodStart': '2026-04-01',
  'periodEnd': '2027-03-31',
  'quota': 12,
  'carriedForward': 0,
  'adjustment': 2,
  'entitled': 14,
  'used': 0,
  'pending': 0,
  'available': 14,
};
