import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../team/presentation/widgets/team_ui.dart';

const staffEmploymentTypes = [
  ('FULL_TIME', 'Full-time'),
  ('PART_TIME', 'Part-time'),
  ('CONTRACT', 'Contract'),
  ('INTERN', 'Intern'),
];
const staffSalaryTypes = [
  ('MONTHLY', 'Monthly'),
  ('HOURLY', 'Hourly'),
  ('DAILY', 'Daily'),
  ('PER_SESSION', 'Per session'),
];
const staffWorkStatuses = [
  ('WORKING', 'Working'),
  ('ON_LEAVE', 'On leave'),
  ('NOTICE_PERIOD', 'Notice period'),
  ('TERMINATED', 'Terminated'),
];
const staffWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Employment details (`PATCH /staff/:id`) — type, work status, salary type /
/// amount, shift and weekly off. `weeklyOff` is one free-form string
/// server-side; it is written as `MONDAY,TUESDAY` (what web writes) and both
/// that and the older `Mon, Tue` form are read back. Only changed fields are
/// sent. All enum values go on the wire as the backend's UPPER_SNAKE strings.
class StaffEditEmploymentScreen extends StatefulWidget {
  const StaffEditEmploymentScreen({super.key, required this.staff});

  final StaffMember staff;

  @override
  State<StaffEditEmploymentScreen> createState() =>
      _StaffEditEmploymentScreenState();
}

class _StaffEditEmploymentScreenState extends State<StaffEditEmploymentScreen> {
  StaffMember get s => widget.staff;

  late final _salary = TextEditingController(
    text: s.salaryAmount == null
        ? ''
        : s.salaryAmount!.toStringAsFixed(s.salaryAmount! % 1 == 0 ? 0 : 2),
  );
  late final _shift = TextEditingController(text: s.shift ?? '');
  late String _employmentType = s.employmentType ?? 'FULL_TIME';
  late String _salaryType = s.salaryType ?? 'MONTHLY';
  late String _workStatus = s.workStatus ?? 'WORKING';
  late final Set<String> _off = s.weeklyOffDays.toSet();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _salary.dispose();
    _shift.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final changes = <String, dynamic>{};
    if (_employmentType != (s.employmentType ?? 'FULL_TIME')) {
      changes['employmentType'] = _employmentType;
    }
    if (_workStatus != (s.workStatus ?? 'WORKING')) {
      changes['workStatus'] = _workStatus;
    }
    if (_salaryType != (s.salaryType ?? 'MONTHLY')) {
      changes['salaryType'] = _salaryType;
    }
    final amountText = _salary.text.trim();
    final amount = double.tryParse(amountText);
    if (amountText.isNotEmpty && amount == null) {
      setState(() => _error = 'Enter a valid salary amount');
      return;
    }
    if (amount != s.salaryAmount) changes['salaryAmount'] = amount;
    final shift = _shift.text.trim();
    if (shift != (s.shift ?? '')) {
      changes['shift'] = shift.isEmpty ? null : shift;
    }
    final oldOff = s.weeklyOffDays.toSet();
    if (_off.length != oldOff.length || !_off.containsAll(oldOff)) {
      changes['weeklyOff'] = encodeWeeklyOff(_off);
    }

    if (changes.isEmpty) {
      context.pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<StaffRepository>().update(s.id, changes);
      if (!mounted) return;
      teamSnack(context, 'Employment details saved.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return TeamEditScaffold(
      name: s.name,
      subtitle: '${s.role.label} · ${s.employeeId}',
      avatarUrl: s.avatarUrl,
      title: 'Employment',
      icon: Icons.work_rounded,
      color: TeamColors.violet,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.assignment_ind_rounded,
          color: TeamColors.violet,
          title: 'Status',
          children: [
            TeamChipGroup(
              label: 'Employment type',
              icon: Icons.assignment_ind_rounded,
              color: TeamColors.violet,
              options: staffEmploymentTypes,
              selected: {_employmentType},
              onToggle: (v) => setState(() => _employmentType = v),
            ),
            TeamChipGroup(
              label: 'Work status',
              icon: Icons.schedule_rounded,
              color: TeamColors.teal,
              options: staffWorkStatuses,
              selected: {_workStatus},
              onToggle: (v) => setState(() => _workStatus = v),
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.payments_rounded,
          color: TeamColors.green,
          title: 'Salary',
          children: [
            TeamChipGroup(
              label: 'Salary type',
              icon: Icons.payments_rounded,
              color: TeamColors.green,
              options: staffSalaryTypes,
              selected: {_salaryType},
              onToggle: (v) => setState(() => _salaryType = v),
            ),
            AppLabeledField(
              label: 'Salary amount (${AppCurrency.symbol})',
              hintText: 'e.g. 25000',
              icon: Icons.currency_rupee_rounded,
              iconColor: TeamColors.green,
              controller: _salary,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
          ],
        ),
        TeamFormSection(
          icon: Icons.wb_twilight_rounded,
          color: TeamColors.amber,
          title: 'Schedule',
          children: [
            AppLabeledField(
              label: 'Shift',
              hintText: 'e.g. Morning (6am-2pm)',
              icon: Icons.wb_twilight_rounded,
              iconColor: TeamColors.amber,
              controller: _shift,
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.weekend_rounded,
                      size: 14,
                      color: TeamColors.amber,
                    ),
                    const SizedBox(width: 6),
                    Text('Weekly off', style: AppText.eyebrow()),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final d in staffWeekdays)
                      GestureDetector(
                        onTap: () => setState(() {
                          _off.contains(d) ? _off.remove(d) : _off.add(d);
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            gradient: _off.contains(d) ? TeamColors.cta : null,
                            color: _off.contains(d) ? null : AppColors.surface3,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            d,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w800,
                              color: _off.contains(d)
                                  ? Colors.white
                                  : AppColors.inkSoft,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}
