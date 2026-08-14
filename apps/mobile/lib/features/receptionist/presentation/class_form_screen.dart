import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

/// Design frame "18. Create class" — `trainerId` (optional server-side)
/// isn't collected here: there's no trainer-picker component yet, matching
/// `BranchFormScreen`'s precedent of only building the fields a real
/// selector already exists for. On success, pushes straight into frame
/// "18a. Class schedule" so a new class isn't left with an empty calendar.
class ClassFormScreen extends StatefulWidget {
  const ClassFormScreen({super.key});

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
  bool _loadingBranches = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  Future<void> _loadBranches() async {
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() {
        _branchOptions = options;
        _branchId = options.isNotEmpty ? options.first.id : null;
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
      final created = await getIt<GroupClassRepository>().create(
        name: name,
        branchId: _branchId!,
        description: _descriptionController.text.trim(),
        capacity: capacity,
        durationMinutes: duration,
      );
      if (!mounted) return;
      context.pushReplacement(AppRoutes.classSchedule, extra: created);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('New Class'),
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
                    const SizedBox(height: 24),
                    AppButton(
                      label: 'Create class',
                      loading: _submitting,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }
}
