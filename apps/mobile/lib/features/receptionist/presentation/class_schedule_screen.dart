import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/group_class.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "18a. Class schedule" — recurring weekly day + time slots,
/// `PATCH /classes/:id/schedule`. Each save replaces the whole slot list
/// (the endpoint isn't additive), so the local list is the source of truth
/// until "Save schedule" is pressed.
class ClassScheduleScreen extends StatefulWidget {
  const ClassScheduleScreen({super.key, required this.groupClass});

  final GroupClass groupClass;

  @override
  State<ClassScheduleScreen> createState() => _ClassScheduleScreenState();
}

class _ClassScheduleScreenState extends State<ClassScheduleScreen> {
  final _timeController = TextEditingController(text: '07:00');
  WeekDay _day = WeekDay.monday;
  final List<ScheduleSlot> _slots = [];
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _timeController.dispose();
    super.dispose();
  }

  void _addSlot() {
    final time = _timeController.text.trim();
    if (!RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(time)) {
      setState(() => _error = 'Enter a time as HH:mm, e.g. 07:00');
      return;
    }
    setState(() {
      _error = null;
      _slots.removeWhere((s) => s.dayOfWeek == _day);
      _slots.add(ScheduleSlot(dayOfWeek: _day, startTime: time));
      _slots.sort((a, b) => a.dayOfWeek.index.compareTo(b.dayOfWeek.index));
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GroupClassRepository>()
          .setSchedule(widget.groupClass.id, _slots);
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
            Text('Weekly Schedule', style: AppText.display(size: 18)),
            Text(widget.groupClass.name, style: AppText.eyebrow()),
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
              Text('Day', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: WeekDay.values.map((d) {
                  final selected = d == _day;
                  return GestureDetector(
                    onTap: () => setState(() => _day = d),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: selected ? AppColors.staffGrad : null,
                        color: selected ? null : AppColors.surface3,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        d.label,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: selected ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Start time (HH:mm)',
                controller: _timeController,
                keyboardType: TextInputType.datetime,
              ),
              const SizedBox(height: 10),
              AppButton(
                label: '+ Add slot',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                onPressed: _addSlot,
              ),
              if (_slots.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text('Slots this week', style: AppText.eyebrow()),
                const SizedBox(height: 8),
                for (final slot in _slots)
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
                          slot.dayOfWeek.apiValue[0] +
                              slot.dayOfWeek.apiValue
                                  .substring(1)
                                  .toLowerCase(),
                          style: AppText.body(
                            size: 13,
                            weight: FontWeight.w700,
                          ),
                        ),
                        Row(
                          children: [
                            Text(
                              slot.startTime,
                              style: AppText.body(
                                size: 12,
                                color: AppColors.inkFaint,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16),
                              color: AppColors.inkFaint,
                              onPressed: () => setState(
                                () => _slots.remove(slot),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
              const SizedBox(height: 18),
              AppButton(
                label: 'Save schedule',
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
