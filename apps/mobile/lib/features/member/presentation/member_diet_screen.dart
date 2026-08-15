import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/member_diet_assignment.dart';
import '../../../models/member_workout_progress.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// One glass = 250 ml. The API stores `waterIntakeMl`, so the design's
/// 8-glass row is rendered by converting; nothing about "glasses" is
/// persisted.
const _mlPerGlass = 250;
const _glassGoal = 8;

/// Design frame "6. Diet log" — water intake, today's weight and per-meal
/// status, all writing to `POST /portal/diet/:id/log` (which merges into
/// the day's existing log rather than overwriting).
///
/// The design's "6a. Log meal" food-picker is not built: the portal plane
/// has no food endpoints, and the API models a meal as a single status per
/// meal type, not a list of foods. Tapping a meal row cycles that status
/// instead, which is what the backend actually stores.
class MemberDietScreen extends StatefulWidget {
  const MemberDietScreen({super.key});

  @override
  State<MemberDietScreen> createState() => _MemberDietScreenState();
}

class _MemberDietScreenState extends State<MemberDietScreen> {
  final _weightController = TextEditingController();
  MemberDietAssignment? _assignment;
  bool _loading = true;
  bool _savingWeight = false;
  String? _error;

  DateTime get _today {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final assignment = await getIt<MemberPortalRepository>().diet();
      if (!mounted) return;
      setState(() {
        _assignment = assignment;
        final weight = assignment?.logFor(_today)?.weightKg;
        if (weight != null) _weightController.text = weight.toStringAsFixed(1);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _log({
    int? waterIntakeMl,
    double? weightKg,
    Map<MealType, ExerciseProgressStatus>? mealsStatus,
  }) async {
    final assignment = _assignment;
    if (assignment == null) return;
    setState(() => _error = null);
    try {
      final updated = await getIt<MemberPortalRepository>().logDiet(
        assignmentId: assignment.id,
        date: _today,
        waterIntakeMl: waterIntakeMl,
        weightKg: weightKg,
        mealsStatus: mealsStatus,
      );
      if (!mounted) return;
      setState(() => _assignment = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _saveWeight() async {
    final weight = double.tryParse(_weightController.text.trim());
    if (weight == null || weight <= 0) {
      setState(() => _error = 'Enter a valid weight');
      return;
    }
    setState(() => _savingWeight = true);
    await _log(weightKg: weight);
    if (mounted) setState(() => _savingWeight = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    final assignment = _assignment;
    if (_error != null && assignment == null) {
      return AppErrorView(
        message: _error!,
        onRetry: _load,
        role: AppRole.member,
      );
    }
    if (assignment == null) {
      return const AppEmptyState(
        icon: Icons.restaurant_outlined,
        title: 'No diet plan yet',
        message: 'Your trainer will assign one soon.',
      );
    }

    final log = assignment.logFor(_today);
    final glasses = ((log?.waterIntakeMl ?? 0) / _mlPerGlass).floor();

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
        children: [
          Text('Today', style: AppText.eyebrow()),
          Text('Diet Log', style: AppText.display(size: 22)),
          const SizedBox(height: 4),
          Text(
            assignment.dailyCalories != null
                ? '${assignment.planName} · ${assignment.dailyCalories} kcal target'
                : assignment.planName,
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x24C6F135), Color(0x1A14E0B4)],
              ),
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.glassBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Water intake', style: AppText.eyebrow()),
                const SizedBox(height: 10),
                Row(
                  children: List.generate(_glassGoal, (i) {
                    final filled = i < glasses;
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 5),
                        child: GestureDetector(
                          onTap: () =>
                              _log(waterIntakeMl: (i + 1) * _mlPerGlass),
                          child: Container(
                            height: 30,
                            decoration: BoxDecoration(
                              gradient: filled ? AppColors.memberGrad : null,
                              color: filled ? null : AppColors.surface3,
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(5),
                                bottom: Radius.circular(9),
                              ),
                              border: Border.all(
                                color: filled
                                    ? Colors.transparent
                                    : AppColors.line,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 8),
                Text(
                  '$glasses / $_glassGoal glasses · ${log?.waterIntakeMl ?? 0} ml',
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Today's weight (kg)", style: AppText.eyebrow()),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _weightController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        style: AppText.body(size: 15, weight: FontWeight.w600),
                        cursorColor: AppColors.memberB,
                        decoration: InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: AppColors.surface3,
                          hintText: '—',
                          hintStyle: AppText.body(color: AppColors.inkFaint),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 13,
                          ),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.field),
                            borderSide: const BorderSide(
                              color: AppColors.line,
                            ),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppRadii.field),
                            borderSide: const BorderSide(
                              color: AppColors.line,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    AppButton(
                      label: 'Save',
                      role: AppRole.member,
                      size: AppButtonSize.small,
                      fullWidth: false,
                      loading: _savingWeight,
                      onPressed: _saveWeight,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          for (final mealType in assignment.mealTypes) ...[
            _MealRow(
              mealType: mealType,
              status:
                  log?.mealsStatus[mealType] ?? ExerciseProgressStatus.pending,
              onTap: () {
                final current = log?.mealsStatus[mealType] ??
                    ExerciseProgressStatus.pending;
                final next = switch (current) {
                  ExerciseProgressStatus.pending =>
                    ExerciseProgressStatus.completed,
                  ExerciseProgressStatus.completed =>
                    ExerciseProgressStatus.skipped,
                  ExerciseProgressStatus.skipped =>
                    ExerciseProgressStatus.pending,
                };
                _log(mealsStatus: {mealType: next});
              },
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }
}

class _MealRow extends StatelessWidget {
  const _MealRow({
    required this.mealType,
    required this.status,
    required this.onTap,
  });

  final MealType mealType;
  final ExerciseProgressStatus status;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  mealType.label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: switch (status) {
                  ExerciseProgressStatus.completed => 'Done',
                  ExerciseProgressStatus.skipped => 'Skipped',
                  ExerciseProgressStatus.pending => 'Pending',
                },
                tone: switch (status) {
                  ExerciseProgressStatus.completed => AppPillTone.success,
                  ExerciseProgressStatus.skipped => AppPillTone.neutral,
                  ExerciseProgressStatus.pending => AppPillTone.warning,
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
