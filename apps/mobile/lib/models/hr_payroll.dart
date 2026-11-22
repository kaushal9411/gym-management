import 'hr_attendance.dart';
import 'hr_enums.dart';
import 'paginated_result.dart';

/// `PayslipLine`.
class HrPayslipLine {
  const HrPayslipLine({
    required this.id,
    required this.name,
    required this.isAllowance,
    required this.amount,
    this.source = 'STRUCTURE',
  });

  final String id;
  final String name;

  /// `ALLOWANCE` (true) or `DEDUCTION` (false).
  final bool isAllowance;
  final double amount;

  /// `STRUCTURE` | `MANUAL`.
  final String source;

  factory HrPayslipLine.fromJson(Map<String, dynamic> j) => HrPayslipLine(
        id: j['id'] as String? ?? '',
        name: j['name'] as String? ?? '',
        isAllowance: j['type'] != 'DEDUCTION',
        amount: hrNum(j['amount']),
        source: j['source'] as String? ?? 'STRUCTURE',
      );
}

/// `PayslipSummary` (list rows, the self summary's latest payslip).
class HrPayslipSummary {
  const HrPayslipSummary({
    required this.id,
    required this.runId,
    required this.month,
    required this.status,
    required this.netPay,
    required this.grossEarnings,
    required this.totalDeductions,
    this.employee,
    this.paidAt,
    this.paymentMode,
  });

  final String id;
  final String runId;

  /// `YYYY-MM`.
  final String month;
  final PayslipStatus status;
  final HrEmployeeRef? employee;
  final double netPay;
  final double grossEarnings;
  final double totalDeductions;
  final DateTime? paidAt;
  final PaymentMode? paymentMode;

  bool get isPaid => status == PayslipStatus.paid;

  factory HrPayslipSummary.fromJson(Map<String, dynamic> j) => HrPayslipSummary(
        id: j['id'] as String? ?? '',
        runId: j['runId'] as String? ?? '',
        month: j['month'] as String? ?? '',
        status: PayslipStatus.parse(j['status']),
        employee: HrEmployeeRef.tryParse(j['employee']),
        netPay: hrNum(j['netPay']),
        grossEarnings: hrNum(j['grossEarnings']),
        totalDeductions: hrNum(j['totalDeductions']),
        paidAt: hrParseInstant(j['paidAt']),
        paymentMode: PaymentMode.tryParse(j['paymentMode']),
      );
}

/// Full `Payslip` (attendance summary + earnings / deductions breakdown).
class HrPayslip {
  const HrPayslip({
    required this.summary,
    required this.salaryType,
    required this.workingDays,
    required this.presentDays,
    required this.halfDays,
    required this.paidLeaveDays,
    required this.unpaidLeaveDays,
    required this.absentDays,
    required this.holidayDays,
    required this.weeklyOffDays,
    required this.lateCount,
    required this.overtimeMinutes,
    required this.unpaidDays,
    required this.dailyRate,
    required this.baseSalary,
    required this.fixedAllowances,
    required this.monthlyGross,
    required this.attendanceDeduction,
    required this.overtimePay,
    required this.extraAllowances,
    required this.bonus,
    required this.fixedDeductions,
    required this.extraDeductions,
    required this.latePenalty,
    required this.advanceRecovery,
    this.lines = const [],
    this.notes = const [],
    this.paidOn,
    this.paidBy,
    this.paidRemark,
  });

  final HrPayslipSummary summary;
  final String salaryType;
  final double workingDays;
  final double presentDays;
  final double halfDays;
  final double paidLeaveDays;
  final double unpaidLeaveDays;
  final double absentDays;
  final double holidayDays;
  final double weeklyOffDays;
  final int lateCount;
  final int overtimeMinutes;

  /// Absent + half-day losses + unpaid leave + not-employed days.
  final double unpaidDays;
  final double dailyRate;
  final double baseSalary;
  final double fixedAllowances;
  final double monthlyGross;
  final double attendanceDeduction;
  final double overtimePay;
  final double extraAllowances;
  final double bonus;
  final double fixedDeductions;
  final double extraDeductions;
  final double latePenalty;
  final double advanceRecovery;
  final List<HrPayslipLine> lines;
  final List<String> notes;
  final DateTime? paidOn;
  final HrUserRef? paidBy;
  final String? paidRemark;

  String get id => summary.id;
  String get month => summary.month;
  PayslipStatus get status => summary.status;
  double get netPay => summary.netPay;
  double get grossEarnings => summary.grossEarnings;
  double get totalDeductions => summary.totalDeductions;

  factory HrPayslip.fromJson(Map<String, dynamic> j) => HrPayslip(
        summary: HrPayslipSummary.fromJson(j),
        salaryType: j['salaryType'] as String? ?? 'MONTHLY',
        workingDays: hrNum(j['workingDays']),
        presentDays: hrNum(j['presentDays']),
        halfDays: hrNum(j['halfDays']),
        paidLeaveDays: hrNum(j['paidLeaveDays']),
        unpaidLeaveDays: hrNum(j['unpaidLeaveDays']),
        absentDays: hrNum(j['absentDays']),
        holidayDays: hrNum(j['holidayDays']),
        weeklyOffDays: hrNum(j['weeklyOffDays']),
        lateCount: hrInt(j['lateCount']),
        overtimeMinutes: hrInt(j['overtimeMinutes']),
        unpaidDays: hrNum(j['unpaidDays']),
        dailyRate: hrNum(j['dailyRate']),
        baseSalary: hrNum(j['baseSalary']),
        fixedAllowances: hrNum(j['fixedAllowances']),
        monthlyGross: hrNum(j['monthlyGross']),
        attendanceDeduction: hrNum(j['attendanceDeduction']),
        overtimePay: hrNum(j['overtimePay']),
        extraAllowances: hrNum(j['extraAllowances']),
        bonus: hrNum(j['bonus']),
        fixedDeductions: hrNum(j['fixedDeductions']),
        extraDeductions: hrNum(j['extraDeductions']),
        latePenalty: hrNum(j['latePenalty']),
        advanceRecovery: hrNum(j['advanceRecovery']),
        lines: (j['lines'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrPayslipLine.fromJson)
            .toList(),
        notes: (j['notes'] as List? ?? const []).whereType<String>().toList(),
        paidOn: j['paidOn'] == null ? null : hrParseDate(j['paidOn']),
        paidBy: HrUserRef.tryParse(j['paidBy']),
        paidRemark: j['paidRemark'] as String?,
      );
}

/// `PayrollRun`.
class HrPayrollRun {
  const HrPayrollRun({
    required this.id,
    required this.month,
    required this.status,
    required this.employeeCount,
    required this.totalGross,
    required this.totalDeductions,
    required this.totalNet,
    required this.paidCount,
    required this.paidAmount,
    this.notes,
  });

  final String id;

  /// `YYYY-MM`.
  final String month;
  final PayrollRunStatus status;
  final int employeeCount;
  final double totalGross;
  final double totalDeductions;
  final double totalNet;
  final int paidCount;
  final double paidAmount;
  final String? notes;

  int get unpaidCount => (employeeCount - paidCount).clamp(0, employeeCount);

  /// Share of payslips already paid (drives the progress ring).
  double get paidFraction =>
      employeeCount == 0 ? 0 : (paidCount / employeeCount).clamp(0.0, 1.0);

  factory HrPayrollRun.fromJson(Map<String, dynamic> j) => HrPayrollRun(
        id: j['id'] as String? ?? '',
        month: j['month'] as String? ?? '',
        status: PayrollRunStatus.parse(j['status']),
        employeeCount: hrInt(j['employeeCount']),
        totalGross: hrNum(j['totalGross']),
        totalDeductions: hrNum(j['totalDeductions']),
        totalNet: hrNum(j['totalNet']),
        paidCount: hrInt(j['paidCount']),
        paidAmount: hrNum(j['paidAmount']),
        notes: j['notes'] as String?,
      );
}

/// `GET /hr/payroll/runs/:id` -> `{ run, payslips }`.
class HrPayrollRunDetail {
  const HrPayrollRunDetail({required this.run, required this.payslips});

  final HrPayrollRun run;
  final List<HrPayslip> payslips;

  factory HrPayrollRunDetail.fromJson(Map<String, dynamic> j) =>
      HrPayrollRunDetail(
        run: HrPayrollRun.fromJson(j['run'] as Map<String, dynamic>),
        payslips: (j['payslips'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrPayslip.fromJson)
            .toList(),
      );
}

/// `POST /hr/payroll/runs/:id/pay-all`.
class HrPayAllResult {
  const HrPayAllResult({
    required this.paid,
    required this.skipped,
    required this.failed,
    required this.run,
  });

  final int paid;
  final int skipped;

  /// `(payslipId, message)` per failure.
  final List<(String, String)> failed;
  final HrPayrollRun run;

  factory HrPayAllResult.fromJson(Map<String, dynamic> j) => HrPayAllResult(
        paid: hrInt(j['paid']),
        skipped: hrInt(j['skipped']),
        failed: (j['failed'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(
              (f) => (
                f['payslipId'] as String? ?? '',
                f['message'] as String? ?? '',
              ),
            )
            .toList(),
        run: HrPayrollRun.fromJson(j['run'] as Map<String, dynamic>),
      );
}

/// `PayComponent` of a pay structure.
class HrPayComponent {
  const HrPayComponent({
    required this.name,
    required this.isAllowance,
    required this.amount,
    this.isActive = true,
  });

  final String name;
  final bool isAllowance;
  final double amount;
  final bool isActive;

  factory HrPayComponent.fromJson(Map<String, dynamic> j) => HrPayComponent(
        name: j['name'] as String? ?? '',
        isAllowance: j['type'] != 'DEDUCTION',
        amount: hrNum(j['amount']),
        isActive: j['isActive'] as bool? ?? true,
      );
}

/// `PayStructure` (read-only on mobile).
class HrPayStructure {
  const HrPayStructure({
    required this.salaryType,
    required this.monthlyGross,
    required this.fixedDeductions,
    this.baseSalary,
    this.components = const [],
  });

  final String salaryType;
  final double? baseSalary;
  final List<HrPayComponent> components;
  final double monthlyGross;
  final double fixedDeductions;

  factory HrPayStructure.fromJson(Map<String, dynamic> j) => HrPayStructure(
        salaryType: j['salaryType'] as String? ?? 'MONTHLY',
        baseSalary: hrNumOrNull(j['baseSalary']),
        components: (j['components'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(HrPayComponent.fromJson)
            .toList(),
        monthlyGross: hrNum(j['monthlyGross']),
        fixedDeductions: hrNum(j['fixedDeductions']),
      );
}

/// Convenience alias for list pages of payslip summaries.
typedef HrPayslipPage = PaginatedResult<HrPayslipSummary>;
