import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

const _employmentTypes = {
  'FULL_TIME': 'Full-time',
  'PART_TIME': 'Part-time',
  'CONTRACT': 'Contract',
  'INTERN': 'Intern',
};
const _salaryTypes = {
  'MONTHLY': 'Monthly',
  'HOURLY': 'Hourly',
  'DAILY': 'Daily',
  'PER_SESSION': 'Per session',
};
const _workStatuses = {
  'WORKING': 'Working',
  'ON_LEAVE': 'On leave',
  'NOTICE_PERIOD': 'Notice period',
  'TERMINATED': 'Terminated',
};
const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Design frame "5b-ii. Employment details" — `weeklyOff` is a single
/// free-form string server-side (not an array), so the multi-select here
/// joins the chosen days with ", " to match what `updateStaffSchema`
/// actually stores.
class StaffEditEmploymentScreen extends StatefulWidget {
  const StaffEditEmploymentScreen({super.key, required this.staff});

  final StaffMember staff;

  @override
  State<StaffEditEmploymentScreen> createState() =>
      _StaffEditEmploymentScreenState();
}

class _StaffEditEmploymentScreenState extends State<StaffEditEmploymentScreen> {
  late final _salaryAmountController = TextEditingController(
    text: widget.staff.salaryAmount?.toString() ?? '',
  );
  late final _shiftController =
      TextEditingController(text: widget.staff.shift ?? '');
  late String _employmentType =
      widget.staff.employmentType ?? _employmentTypes.keys.first;
  late String _salaryType = widget.staff.salaryType ?? _salaryTypes.keys.first;
  late String _workStatus = widget.staff.workStatus ?? _workStatuses.keys.first;
  late final Set<String> _weeklyOff = (widget.staff.weeklyOff ?? '')
      .split(',')
      .map((d) => d.trim())
      .where(_weekdays.contains)
      .toSet();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _salaryAmountController.dispose();
    _shiftController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<StaffRepository>().update(widget.staff.id, {
        'employmentType': _employmentType,
        'salaryType': _salaryType,
        'salaryAmount': double.tryParse(_salaryAmountController.text.trim()),
        'shift': _shiftController.text.trim().isEmpty
            ? null
            : _shiftController.text.trim(),
        'weeklyOff': _weeklyOff.isEmpty
            ? null
            : (_weekdays.where(_weeklyOff.contains).join(', ')),
        'workStatus': _workStatus,
      });
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Employment Details · ${widget.staff.name}'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                const SizedBox(height: 8),
                FormAlert(message: _error!),
              ],
              const SizedBox(height: 16),
              Text('Employment type', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<String>(
                options: _employmentTypes.keys.toList(),
                labelOf: (k) => _employmentTypes[k]!,
                value: _employmentType,
                onChanged: (v) => setState(() => _employmentType = v),
              ),
              const SizedBox(height: 14),
              Text('Work status', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<String>(
                options: _workStatuses.keys.toList(),
                labelOf: (k) => _workStatuses[k]!,
                value: _workStatus,
                onChanged: (v) => setState(() => _workStatus = v),
              ),
              const SizedBox(height: 14),
              Text('Salary type', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<String>(
                options: _salaryTypes.keys.toList(),
                labelOf: (k) => _salaryTypes[k]!,
                value: _salaryType,
                onChanged: (v) => setState(() => _salaryType = v),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Salary amount',
                hintText: 'e.g. 25000',
                controller: _salaryAmountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
                ],
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Shift',
                hintText: 'e.g. 9 AM - 6 PM',
                controller: _shiftController,
              ),
              const SizedBox(height: 14),
              Text('Weekly off', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _weekdays.map((d) {
                  final on = _weeklyOff.contains(d);
                  return GestureDetector(
                    onTap: () => setState(() {
                      on ? _weeklyOff.remove(d) : _weeklyOff.add(d);
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: on ? AppColors.staffGrad : null,
                        color: on ? null : AppColors.surface3,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        d,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: on ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save changes',
                loading: _saving,
                onPressed: _save,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
