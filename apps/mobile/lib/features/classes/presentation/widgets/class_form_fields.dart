import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/branch_option.dart';
import '../../../../models/group_class.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/option_picker_field.dart';
import '../../../../shared/widgets/trainer_picker_field.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// The class form's working state (web's `GroupClassFormState`): name,
/// description, branch, trainer, capacity, duration and the active flag.
/// A [ChangeNotifier] so the create page's live summary and the detail
/// page's unsaved-changes bar can follow every edit; it owns its
/// controllers, so create it once in `initState` and [dispose] it.
class ClassFormData extends ChangeNotifier {
  ClassFormData({GroupClass? initial}) {
    if (initial != null) fill(initial);
    _baseline = snapshot;
  }

  final name = TextEditingController();
  final description = TextEditingController();
  final capacity = TextEditingController(text: '15');
  final duration = TextEditingController(text: '60');
  String? branchId;
  TrainerOption? trainer;
  bool isActive = true;
  String _baseline = '';

  /// Loads [c] into the form and makes it the clean baseline.
  void fill(GroupClass c) {
    name.text = c.name;
    description.text = c.description ?? '';
    capacity.text = '${c.capacity}';
    duration.text = '${c.durationMinutes}';
    branchId = c.branch?.id;
    final t = c.trainer;
    trainer = t == null ? null : TrainerOption(id: t.id, name: t.name);
    isActive = c.isActive;
    _baseline = snapshot;
    notifyListeners();
  }

  String get snapshot => [
        name.text.trim(),
        description.text.trim(),
        capacity.text.trim(),
        duration.text.trim(),
        branchId ?? '',
        trainer?.id ?? '',
        '$isActive',
      ].join('\u0001');

  bool get isDirty => snapshot != _baseline;

  /// Makes the current values the clean baseline (after a successful save).
  void markClean() {
    _baseline = snapshot;
    notifyListeners();
  }

  /// Back to the baseline values from [original].
  void reset(GroupClass original) => fill(original);

  void touch() => notifyListeners();

  void setBranch(String? id) {
    branchId = id;
    notifyListeners();
  }

  void setTrainer(TrainerOption? t) {
    trainer = t;
    notifyListeners();
  }

  void setActive(bool v) {
    isActive = v;
    notifyListeners();
  }

  int? get capacityValue => int.tryParse(capacity.text.trim());
  int? get durationValue => int.tryParse(duration.text.trim());

  /// First problem with the form, or null. Mirrors web's required fields
  /// (name, branch, capacity, duration) plus the API's ranges
  /// (`capacity` 1-500, `durationMinutes` 1-480).
  String? validate() {
    if (name.text.trim().isEmpty) return 'Class name is required';
    if (name.text.trim().length > 150) {
      return 'Class name can be at most 150 characters';
    }
    if (branchId == null || branchId!.isEmpty) return 'Select a branch';
    final cap = capacityValue;
    if (cap == null || cap <= 0 || cap > 500) {
      return 'Capacity must be between 1 and 500';
    }
    final dur = durationValue;
    if (dur == null || dur <= 0 || dur > 480) {
      return 'Duration must be between 1 and 480 minutes';
    }
    if (description.text.length > 2000) {
      return 'Description can be at most 2000 characters';
    }
    return null;
  }

  /// Share of web's three "Ready to create" checks that pass (0..1).
  double get readiness {
    final ok = [
      name.text.trim().isNotEmpty,
      (branchId ?? '').isNotEmpty,
      capacity.text.trim().isNotEmpty && duration.text.trim().isNotEmpty,
    ];
    return ok.where((v) => v).length / ok.length;
  }

  @override
  void dispose() {
    name.dispose();
    description.dispose();
    capacity.dispose();
    duration.dispose();
    super.dispose();
  }
}

/// The "Class information" card: every field of web's
/// `GroupClassFormFields`. [enabled] false makes it read-only (web disables
/// the fields without `classes:update`).
class ClassInfoFields extends StatelessWidget {
  const ClassInfoFields({
    super.key,
    required this.data,
    required this.branches,
    this.enabled = true,
  });

  final ClassFormData data;
  final List<BranchOption> branches;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final digits = [FilteringTextInputFormatter.digitsOnly];
    return ListenableBuilder(
      listenable: data,
      builder: (context, _) {
        return TeamFormSection(
          icon: Icons.calendar_month_rounded,
          color: TeamColors.indigo,
          title: 'Class information',
          children: [
            AppLabeledField(
              label: 'Class name',
              hintText: 'e.g. Morning Yoga',
              controller: data.name,
              readOnly: !enabled,
              icon: Icons.edit_rounded,
              iconColor: TeamColors.indigo,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              onChanged: (_) => data.touch(),
            ),
            IgnorePointer(
              ignoring: !enabled,
              child: OptionPickerField(
                label: 'Branch',
                hintText: 'Select a branch',
                icon: Icons.storefront_rounded,
                iconColor: TeamColors.teal,
                options: [for (final b in branches) (b.id, b.name)],
                value: data.branchId,
                onChanged: data.setBranch,
              ),
            ),
            AppLabeledField(
              label: 'Description',
              hintText: 'What members can expect (optional)',
              controller: data.description,
              readOnly: !enabled,
              minLines: 3,
              maxLines: 6,
              keyboardType: TextInputType.multiline,
              onChanged: (_) => data.touch(),
            ),
            IgnorePointer(
              ignoring: !enabled,
              child: TrainerPickerField(
                selectedTrainer: data.trainer,
                onChanged: data.setTrainer,
              ),
            ),
            AppLabeledField(
              label: 'Capacity',
              hintText: 'Seats per session',
              controller: data.capacity,
              readOnly: !enabled,
              icon: Icons.groups_rounded,
              iconColor: TeamColors.violet,
              keyboardType: TextInputType.number,
              inputFormatters: digits,
              onChanged: (_) => data.touch(),
            ),
            AppLabeledField(
              label: 'Duration (minutes)',
              hintText: 'Minutes per session',
              controller: data.duration,
              readOnly: !enabled,
              icon: Icons.timelapse_rounded,
              iconColor: TeamColors.amber,
              keyboardType: TextInputType.number,
              inputFormatters: digits,
              onChanged: (_) => data.touch(),
            ),
            TeamToggleRow(
              title: 'Active',
              subtitle: 'Included in session generation',
              icon: Icons.check_circle_rounded,
              color: TeamColors.green,
              value: data.isActive,
              onChanged: enabled ? data.setActive : null,
            ),
          ],
        );
      },
    );
  }
}
