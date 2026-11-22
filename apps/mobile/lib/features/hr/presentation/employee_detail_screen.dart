import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_clock.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/hr_admin.dart';
import '../../../models/hr_attendance.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_leave.dart';
import '../../../models/hr_payroll.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import 'apply_leave_screen.dart';
import 'hr_palette.dart';
import 'my_leaves_screen.dart';
import 'my_payslips_screen.dart';
import 'widgets/hr_calendar_card.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// Route argument of the employee HR detail.
class HrEmployeeArgs {
  const HrEmployeeArgs({required this.userId, this.name});

  final String userId;

  /// Shown in the hero while the detail loads.
  final String? name;
}

/// **Employee HR detail** - `GET /hr/employees/:userId` (`hr:view`).
///
/// Month attendance heatmap (tap a day; with `hr:attendance_manage` the day
/// sheet offers the manual mark / edit), leave balances, and - with
/// `hr:leave_manage` - the leave history (tap to decide a pending request) plus
/// **Apply leave on behalf**. With `hr:payroll_manage` the API also returns the
/// pay structure and recent payslips; they are shown read-only (editing the
/// structure is web-only). Without those keys the API sends `payStructure:
/// null` / `payslips: []` / `leaves: []`, and the blocks simply do not render.
class EmployeeDetailScreen extends StatefulWidget {
  const EmployeeDetailScreen({super.key, required this.args});

  final HrEmployeeArgs args;

  @override
  State<EmployeeDetailScreen> createState() => _EmployeeDetailScreenState();
}

class _EmployeeDetailScreenState extends State<EmployeeDetailScreen> {
  HrEmployeeDetail? _d;
  String? _error;
  bool _loading = true;
  int _tick = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final d = await getIt<HrRepository>().employee(widget.args.userId);
      if (!mounted) return;
      setState(() {
        _d = d;
        _error = null;
        _tick++;
      });
    } on ApiException catch (e) {
      if (mounted && _d == null) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markDay(DateTime date, HrAttendanceDay? existing) async {
    final d = _d;
    if (d == null) return;
    final changed = await showMarkAttendanceSheet(
      context,
      employee: d.employee.ref,
      date: date,
      existing: existing,
    );
    if (changed && mounted) _load(silent: true);
  }

  Future<void> _applyFor() async {
    final d = _d;
    if (d == null) return;
    final done = await context.push<bool>(
      AppRoutes.hrApplyLeave,
      extra: HrApplyLeaveArgs(onBehalfOf: d.employee.ref),
    );
    if (done == true && mounted) _load(silent: true);
  }

  Future<void> _openLeave(HrLeaveRequest r) async {
    final canDecide = hrCan(context, HrPerm.leaveManage) &&
        (r.status == LeaveStatus.pending || r.status == LeaveStatus.approved);
    if (canDecide) {
      final updated = await showLeaveDecisionSheet(
        context,
        r,
        selfUserId: hrSelfId(context),
      );
      if (updated != null && mounted) {
        hrSnack(context, 'Leave ${updated.status.label.toLowerCase()}');
        _load(silent: true);
      }
    } else {
      await showLeaveDetailSheet(context, r);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    final e = d?.employee;
    final canMark = hrCan(context, HrPerm.attendanceManage);
    final canLeave = hrCan(context, HrPerm.leaveManage);
    final self = hrSelfId(context);
    return HrPage(
      title: e?.name ?? widget.args.name ?? 'Employee',
      subtitle: e == null ? null : '${e.ref.employeeId} · ${e.ref.roleLabel}',
      onRefresh: () => _load(silent: true),
      chips: [
        if (e != null) ...[
          ListHeroChip(
            icon: HrPalette.glyph(e.todayStatus),
            label: 'Today: ${e.todayStatus.label}',
          ),
          if (e.shift != null)
            ListHeroChip(
              icon: Icons.schedule_rounded,
              label: e.shift!.name,
            ),
        ],
      ],
      slivers: [
        if (_loading && d == null)
          const SliverToBoxAdapter(child: HrSkeletonList(count: 4, height: 110))
        else if (_error != null && d == null)
          SliverToBoxAdapter(
            child: AppErrorView(message: _error!, onRetry: _load),
          )
        else if (d != null)
          SliverList.list(
            children: [
              if (canLeave || canMark) ...[
                Row(
                  children: [
                    if (canLeave && e!.userId != self)
                      Expanded(
                        child: _ActionButton(
                          icon: Icons.add_circle_rounded,
                          label: 'Apply leave',
                          color: HrPalette.onLeave,
                          onTap: _applyFor,
                        ),
                      ),
                    if (canLeave && canMark && e!.userId != self)
                      const SizedBox(width: 10),
                    if (canMark)
                      Expanded(
                        child: _ActionButton(
                          icon: Icons.edit_calendar_rounded,
                          label: 'Mark today',
                          color: HrPalette.present,
                          onTap: () async {
                            final today = AppClock.today();
                            final rec = d.attendance.byDay[today.day];
                            await _markDay(today, rec);
                          },
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
              ],
              _WorkSetup(e: d.employee),
              const SizedBox(height: 16),
              const HrSectionHeader(title: 'Attendance'),
              HrAttendanceCalendarCard(
                subject: d.employee.name,
                initial: d.attendance,
                refreshKey: _tick,
                fetch: (m) => getIt<HrRepository>().employeeAttendance(
                  widget.args.userId,
                  month: m,
                ),
                onMark: canMark ? (day) => _markDay(day.date, day) : null,
              ),
              if (d.balances.isNotEmpty) ...[
                const SizedBox(height: 18),
                const HrSectionHeader(title: 'Leave balance'),
                HrCard(
                  padding:
                      const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final b in d.balances)
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: HrBalanceRing(
                              label: b.leaveType.name,
                              remaining: b.available ?? 0,
                              total: b.entitled ?? 0,
                              used: b.used,
                              unlimited: b.unlimited,
                              color: HrPalette.leaveType(
                                b.leaveType.colorHex,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
              if (d.leaves.isNotEmpty) ...[
                const SizedBox(height: 18),
                const HrSectionHeader(title: 'Leave history'),
                for (final r in d.leaves) ...[
                  HrLeaveCard(request: r, onTap: () => _openLeave(r)),
                  const SizedBox(height: 10),
                ],
              ],
              if (d.payStructure != null) ...[
                const SizedBox(height: 8),
                const HrSectionHeader(title: 'Pay structure'),
                _PayStructureCard(s: d.payStructure!),
              ],
              if (d.payslips.isNotEmpty) ...[
                const SizedBox(height: 18),
                const HrSectionHeader(title: 'Payslips'),
                for (final p in d.payslips) ...[
                  HrPayslipTile(
                    payslip: p,
                    onTap: () => context.push(
                      AppRoutes.hrPayslipDetail,
                      extra: HrPayslipArgs(
                        id: p.id,
                        month: p.month,
                        admin: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ],
            ],
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
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [color.withValues(alpha: 0.22), Colors.transparent],
            ),
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WorkSetup extends StatelessWidget {
  const _WorkSetup({required this.e});

  final HrEmployee e;

  @override
  Widget build(BuildContext context) {
    String wd(String s) =>
        s.isEmpty ? s : s[0] + s.substring(1, 3).toLowerCase();
    return HrCard(
      child: Column(
        children: [
          HrInfoRow(
            label: 'Shift',
            value: e.shift == null
                ? 'Not assigned'
                : '${e.shift!.name} · ${hrTime12(e.shift!.startTime)} – '
                    '${hrTime12(e.shift!.endTime)}',
            icon: Icons.schedule_rounded,
          ),
          HrInfoRow(
            label: 'Weekly off',
            value:
                e.weeklyOff.isEmpty ? 'None' : e.weeklyOff.map(wd).join(', '),
            icon: Icons.bedtime_rounded,
          ),
          if (e.joiningDate != null)
            HrInfoRow(
              label: 'Joined',
              value: hrDateY(e.joiningDate!),
              icon: Icons.event_available_rounded,
            ),
          if (e.branches.isNotEmpty)
            HrInfoRow(
              label: 'Branches',
              value: e.branches.map((b) => b.name).join(', '),
              icon: Icons.storefront_outlined,
            ),
        ],
      ),
    );
  }
}

class _PayStructureCard extends StatelessWidget {
  const _PayStructureCard({required this.s});

  final HrPayStructure s;

  @override
  Widget build(BuildContext context) {
    return HrCard(
      accent: HrPalette.money,
      child: Column(
        children: [
          HrInfoRow(
            label: 'Base salary',
            value: s.baseSalary == null
                ? 'Not set'
                : '${Formatters.currency(s.baseSalary!)} · '
                    '${s.salaryType.toLowerCase()}',
            icon: Icons.account_balance_wallet_rounded,
          ),
          for (final c in s.components)
            HrInfoRow(
              label: c.name,
              value: '${c.isAllowance ? '+' : '−'} '
                  '${Formatters.currency(c.amount)}'
                  '${c.isActive ? '' : ' (off)'}',
              valueColor: c.isAllowance ? HrPalette.paid : HrPalette.absent,
            ),
          const Divider(height: 18),
          HrInfoRow(
            label: 'Monthly gross',
            value: Formatters.currency(s.monthlyGross),
            valueColor: HrPalette.money,
          ),
          HrInfoRow(
            label: 'Fixed deductions',
            value: Formatters.currency(s.fixedDeductions),
          ),
        ],
      ),
    );
  }
}
