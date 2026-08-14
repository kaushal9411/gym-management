import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8d. Holidays" — `PATCH /branches/:id` scoped to
/// `holidays`, same whole-list-replace shape as `updateOperatingHours`.
class BranchHolidaysScreen extends StatefulWidget {
  const BranchHolidaysScreen({super.key, required this.branch});

  final Branch branch;

  @override
  State<BranchHolidaysScreen> createState() => _BranchHolidaysScreenState();
}

class _BranchHolidaysScreenState extends State<BranchHolidaysScreen> {
  late final List<BranchHoliday> _holidays = [...widget.branch.holidays];
  final _labelController = TextEditingController();
  DateTime? _date;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 730)),
    );
    if (picked != null) setState(() => _date = picked);
  }

  void _addHoliday() {
    final date = _date;
    if (date == null) {
      setState(() => _error = 'Pick a date first');
      return;
    }
    final iso =
        '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    setState(() {
      _error = null;
      _holidays.add(
        BranchHoliday(
          date: iso,
          label: _labelController.text.trim().isEmpty
              ? null
              : _labelController.text.trim(),
        ),
      );
      _holidays.sort((a, b) => a.date.compareTo(b.date));
      _date = null;
      _labelController.clear();
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BranchRepository>()
          .updateHolidays(widget.branch.id, _holidays);
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Holidays', style: AppText.display(size: 18)),
            Text(widget.branch.name, style: AppText.eyebrow()),
          ],
        ),
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
              AppLabeledField(
                label: 'Date',
                hintText: 'Tap to pick a date',
                controller: TextEditingController(
                  text: _date == null
                      ? ''
                      : '${_date!.day}/${_date!.month}/${_date!.year}',
                ),
                readOnly: true,
                onTap: _pickDate,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Label',
                hintText: 'e.g. Diwali (optional)',
                controller: _labelController,
              ),
              const SizedBox(height: 10),
              AppButton(
                label: '+ Add holiday',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                onPressed: _addHoliday,
              ),
              if (_holidays.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text('Upcoming', style: AppText.eyebrow()),
                const SizedBox(height: 8),
                for (final h in _holidays)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          h.label?.isNotEmpty == true ? h.label! : h.date,
                          style: AppText.body(size: 13, weight: FontWeight.w700),
                        ),
                        Row(
                          children: [
                            Text(
                              h.date,
                              style: AppText.body(
                                size: 12,
                                color: AppColors.inkFaint,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16),
                              color: AppColors.inkFaint,
                              onPressed: () =>
                                  setState(() => _holidays.remove(h)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 18),
              AppButton(
                label: 'Save holidays',
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
