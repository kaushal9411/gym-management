import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/di/service_locator.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radii.dart';
import '../../core/theme/app_text_styles.dart';
import '../../models/staff_member.dart';
import '../../repositories/staff_repository.dart';
import 'app_state_views.dart';

/// Just enough to display/submit a trainer selection — plan DTOs only ever
/// nest `{id, name}` for their assigned trainer (`PlanTrainer` in
/// `workout_plan.dart`, structurally identical ones for diet plans/
/// classes), so the field works off this minimal shape rather than a full
/// `StaffMember`. Pre-filling from an existing plan's trainer needs no
/// conversion beyond wrapping its `id`/`name` — no fake/partial
/// `StaffMember.fromJson` calls.
class TrainerOption {
  const TrainerOption({required this.id, required this.name});

  final String id;
  final String name;
}

/// Optional trainer assignment field — used by Workout Plan, Diet Plan, and
/// Class create/edit forms, all of which have an optional `trainerId` on
/// their DTO. No reusable picker existed anywhere in mobile before this;
/// `StaffRepository.list(role: StaffRole.trainer, status: 'ACTIVE')` was
/// already there server-side, just never surfaced as a form field.
class TrainerPickerField extends StatelessWidget {
  const TrainerPickerField({
    super.key,
    this.label = 'Trainer',
    required this.selectedTrainer,
    required this.onChanged,
  });

  final String label;
  final TrainerOption? selectedTrainer;
  final ValueChanged<TrainerOption?> onChanged;

  Future<void> _openPicker(BuildContext context) async {
    // The sheet only ever pops with a chosen `TrainerOption` (tapping a
    // row) or `null` (dismissed — back gesture/tap-outside). A dismiss
    // must leave the current selection untouched, not clear it — clearing
    // has its own explicit `X` affordance on the field itself below.
    final picked = await showModalBottomSheet<TrainerOption>(
      context: context,
      backgroundColor: AppColors.surface2,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (context) => const _TrainerPickerSheet(),
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: AppText.eyebrow()),
        ),
        Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.field),
            onTap: () => _openPicker(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.field),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      selectedTrainer?.name ?? 'No trainer assigned',
                      style: AppText.body(
                        size: 15,
                        weight: FontWeight.w600,
                        color: selectedTrainer == null
                            ? AppColors.inkFaint
                            : AppColors.ink,
                      ),
                    ),
                  ),
                  if (selectedTrainer != null)
                    GestureDetector(
                      onTap: () => onChanged(null),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: AppColors.inkFaint,
                      ),
                    )
                  else
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _TrainerPickerSheet extends StatefulWidget {
  const _TrainerPickerSheet();

  @override
  State<_TrainerPickerSheet> createState() => _TrainerPickerSheetState();
}

class _TrainerPickerSheetState extends State<_TrainerPickerSheet> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<StaffMember>? _results;
  String? _error;

  @override
  void initState() {
    super.initState();
    _search();
    _searchController.addListener(_onChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _search);
  }

  Future<void> _search() async {
    try {
      final result = await getIt<StaffRepository>().list(
        search: _searchController.text.trim(),
        role: StaffRole.trainer,
        status: 'ACTIVE',
      );
      if (!mounted) return;
      setState(() => _results = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 18,
        right: 18,
        top: 18,
        bottom: MediaQuery.of(context).viewInsets.bottom + 18,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Assign a trainer', style: AppText.display(size: 16)),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            autofocus: true,
            style: AppText.body(size: 14, weight: FontWeight.w600),
            decoration: InputDecoration(
              hintText: 'Search trainers…',
              hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
              prefixIcon:
                  const Icon(Icons.search_rounded, color: AppColors.inkFaint),
              filled: true,
              fillColor: AppColors.surface3,
              contentPadding: const EdgeInsets.symmetric(vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 320,
            child: _error != null
                ? AppErrorView(message: _error!, onRetry: _search)
                : _results == null
                    ? const AppLoadingView()
                    : _results!.isEmpty
                        ? const AppEmptyState(
                            icon: Icons.person_search_outlined,
                            title: 'No trainers found',
                          )
                        : ListView.builder(
                            itemCount: _results!.length,
                            itemBuilder: (context, i) {
                              final trainer = _results![i];
                              return Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.card),
                                  onTap: () => Navigator.of(context).pop(
                                    TrainerOption(
                                      id: trainer.id,
                                      name: trainer.name,
                                    ),
                                  ),
                                  child: Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface3,
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.card,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 30,
                                          height: 30,
                                          decoration: const BoxDecoration(
                                            color: AppColors.staffSoft,
                                            shape: BoxShape.circle,
                                          ),
                                          alignment: Alignment.center,
                                          child: Text(
                                            trainer.name.isEmpty
                                                ? '?'
                                                : trainer.name[0].toUpperCase(),
                                            style: AppText.body(
                                              size: 11,
                                              weight: FontWeight.w800,
                                              color: AppColors.staffPillFg,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            trainer.name,
                                            style: AppText.body(
                                              size: 13,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
