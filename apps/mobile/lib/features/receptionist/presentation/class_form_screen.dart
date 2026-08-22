import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/group_class.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import '../../../shared/widgets/status_action_menu.dart';
import '../../../shared/widgets/trainer_picker_field.dart';

/// Design frame "18. Create class", extended to a merged create/edit form —
/// `widget.classId == null` → create (`POST /classes`); otherwise → edit
/// (`PATCH /classes/:id`), same field set both ways, matching web's class
/// form. Reused from two entry points: the Receptionist's own classes
/// calendar ("+ Create class") and the Owner/Manager Classes catalog
/// (`features/catalog/presentation/classes_screen.dart`) — one screen, one
/// `GroupClassRepository`, since Classes has no separate per-role flow the
/// way Workout/Diet plans do. On create, pushes straight into "18a. Class
/// schedule" so a new class isn't left with an empty calendar; edit mode
/// instead offers a "Edit weekly schedule" shortcut into the same screen.
class ClassFormScreen extends StatefulWidget {
  const ClassFormScreen({super.key, this.classId});

  /// Null → create. The catalog list only ever has the full `GroupClass`
  /// shape already (unlike Workout/Diet plans' thin summaries), but this
  /// screen still fetches by id itself so it stays a self-contained route.
  final String? classId;

  bool get isEdit => classId != null;

  @override
  State<ClassFormScreen> createState() => _ClassFormScreenState();
}

class _ClassFormScreenState extends State<ClassFormScreen> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _capacityController = TextEditingController(text: '15');
  final _durationController = TextEditingController(text: '60');
  List<BranchOption> _branchOptions = [];
  String? _branchId;
  TrainerOption? _trainer;
  bool _isActive = true;

  GroupClass? _currentClass;
  bool _loadingBranches = true;
  bool _submitting = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      GroupClass? existing;
      if (widget.classId != null) {
        existing = await getIt<GroupClassRepository>().getById(
          widget.classId!,
        );
      }
      if (!mounted) return;
      setState(() {
        _branchOptions = options;
        if (existing != null) {
          _currentClass = existing;
          _nameController.text = existing.name;
          _descriptionController.text = existing.description ?? '';
          _capacityController.text = '${existing.capacity}';
          _durationController.text = '${existing.durationMinutes}';
          _branchId = existing.branch?.id ??
              (options.isEmpty ? null : options.first.id);
          final trainer = existing.trainer;
          _trainer = trainer == null
              ? null
              : TrainerOption(id: trainer.id, name: trainer.name);
          _isActive = existing.isActive;
        } else {
          _branchId = options.isNotEmpty ? options.first.id : null;
        }
        _loadingBranches = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingBranches = false;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    _capacityController.dispose();
    _durationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Class name is required');
      return;
    }
    if (_branchId == null) {
      setState(() => _error = 'Select a branch');
      return;
    }
    final capacity = int.tryParse(_capacityController.text.trim());
    final duration = int.tryParse(_durationController.text.trim());
    if (capacity == null || capacity <= 0) {
      setState(() => _error = 'Enter a valid capacity');
      return;
    }
    if (duration == null || duration <= 0) {
      setState(() => _error = 'Enter a valid duration');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repo = getIt<GroupClassRepository>();
      if (widget.isEdit) {
        final updated = await repo.update(
          _currentClass!.id,
          name: name,
          description: _descriptionController.text.trim(),
          trainerId: _trainer?.id,
          branchId: _branchId!,
          capacity: capacity,
          durationMinutes: duration,
          isActive: _isActive,
        );
        if (!mounted) return;
        setState(() => _currentClass = updated);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Class updated')));
      } else {
        final created = await repo.create(
          name: name,
          branchId: _branchId!,
          description: _descriptionController.text.trim(),
          trainerId: _trainer?.id,
          capacity: capacity,
          durationMinutes: duration,
          isActive: _isActive,
        );
        if (!mounted) return;
        context.pushReplacement(AppRoutes.classSchedule, extra: created);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _delete() async {
    setState(() => _busy = true);
    try {
      await getIt<GroupClassRepository>().delete(_currentClass!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Class deleted.')));
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _busy = true);
    try {
      await getIt<GroupClassRepository>().restore(_currentClass!.id);
      if (!mounted) return;
      final refreshed = await getIt<GroupClassRepository>().getById(
        _currentClass!.id,
      );
      if (!mounted) return;
      setState(() => _currentClass = refreshed);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Class restored.')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cls = _currentClass;
    final deleted = cls?.deletedAt != null;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(widget.isEdit ? 'Edit Class' : 'New Class'),
        actions: [
          if (widget.isEdit && cls != null)
            _busy
                ? const Padding(
                    padding: EdgeInsets.only(right: 16),
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  )
                : StatusActionMenu(
                    subjectName: cls.name,
                    isDeleted: deleted,
                    isActive: cls.isActive,
                    canDuplicate: false,
                    showActivateDeactivate: false,
                    onDelete: _delete,
                    onRestore: _restore,
                    deleteDescription: 'This soft-deletes the class — its '
                        'schedule stops generating new sessions until '
                        'restored.',
                    iconColor: AppColors.ink,
                  ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _loadingBranches
            ? const AppLoadingView()
            : SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (widget.isEdit && cls != null) ...[
                      const SizedBox(height: 16),
                      _ClassHeader(groupClass: cls),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      FormAlert(message: _error!),
                    ],
                    const SizedBox(height: 16),
                    AppLabeledField(
                      label: 'Class name',
                      hintText: 'e.g. Morning Yoga',
                      controller: _nameController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    AppLabeledField(
                      label: 'Description',
                      hintText: 'What members can expect (optional)',
                      controller: _descriptionController,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: AppLabeledField(
                            label: 'Capacity',
                            controller: _capacityController,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: AppLabeledField(
                            label: 'Duration (min)',
                            controller: _durationController,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (_branchOptions.length > 1) ...[
                      const SizedBox(height: 14),
                      Text('Branch', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      CategoryChipSelector<String>(
                        options: _branchOptions.map((b) => b.id).toList(),
                        labelOf: (id) =>
                            _branchOptions.firstWhere((b) => b.id == id).name,
                        value: _branchId!,
                        onChanged: (id) => setState(() => _branchId = id),
                      ),
                    ],
                    const SizedBox(height: 14),
                    TrainerPickerField(
                      selectedTrainer: _trainer,
                      onChanged: (t) => setState(() => _trainer = t),
                    ),
                    const SizedBox(height: 4),
                    _CheckboxRow(
                      label: 'Active (visible for booking)',
                      value: _isActive,
                      onChanged: (v) => setState(() => _isActive = v),
                    ),
                    const SizedBox(height: 24),
                    AppButton(
                      label: widget.isEdit ? 'Save changes' : 'Create class',
                      loading: _submitting,
                      onPressed: _submit,
                    ),
                    if (widget.isEdit && cls != null && !deleted) ...[
                      const SizedBox(height: 12),
                      AppButton(
                        label: 'Edit weekly schedule',
                        variant: AppButtonVariant.ghost,
                        onPressed: () => context.push(
                          AppRoutes.classSchedule,
                          extra: cls,
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }
}

class _ClassHeader extends StatelessWidget {
  const _ClassHeader({required this.groupClass});

  final GroupClass groupClass;

  @override
  Widget build(BuildContext context) {
    final deleted = groupClass.deletedAt != null;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  groupClass.name,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${groupClass.schedule.length} weekly slot'
                  '${groupClass.schedule.length == 1 ? '' : 's'}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          AppPill(
            label: deleted
                ? 'Deleted'
                : (groupClass.isActive ? 'Active' : 'Inactive'),
            tone: deleted
                ? AppPillTone.neutral
                : (groupClass.isActive
                    ? AppPillTone.success
                    : AppPillTone.danger),
          ),
        ],
      ),
    );
  }
}

class _CheckboxRow extends StatelessWidget {
  const _CheckboxRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.field),
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  gradient: value ? AppColors.staffGrad : null,
                  color: value ? null : AppColors.surface3,
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(
                    color: value ? Colors.transparent : AppColors.line,
                  ),
                ),
                child: value
                    ? const Icon(
                        Icons.check_rounded,
                        size: 14,
                        color: Colors.white,
                      )
                    : null,
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: AppText.body(size: 13, weight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
