import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8b. + Add branch" — also doubles as Edit when [existing]
/// is passed. Only collects the fields the design's form actually shows
/// (name/address/capacity) — see `BranchFormInput` for why "Manager" isn't here.
class BranchFormScreen extends StatefulWidget {
  const BranchFormScreen({super.key, this.existing});

  final Branch? existing;

  @override
  State<BranchFormScreen> createState() => _BranchFormScreenState();
}

class _BranchFormScreenState extends State<BranchFormScreen> {
  late final _nameController =
      TextEditingController(text: widget.existing?.name ?? '');
  late final _addressController =
      TextEditingController(text: widget.existing?.addressLine1 ?? '');
  late final _capacityController =
      TextEditingController(text: widget.existing?.capacity?.toString() ?? '');
  bool _loading = false;
  String? _error;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _capacityController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Branch name is required');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final input = BranchFormInput(
      name: name,
      addressLine1: _addressController.text.trim(),
      capacity: int.tryParse(_capacityController.text.trim()),
    );
    try {
      final repo = getIt<BranchRepository>();
      if (_isEdit) {
        await repo.update(widget.existing!.id, input);
      } else {
        await repo.create(input);
      }
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(_isEdit ? 'Edit Branch' : 'New Branch'),
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
                label: 'Branch name',
                hintText: 'e.g. Bandra Branch',
                controller: _nameController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Address',
                hintText: 'Street, building, area',
                controller: _addressController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Capacity',
                hintText: 'e.g. 150',
                controller: _capacityController,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submit(),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: _isEdit ? 'Save changes' : 'Create branch',
                loading: _loading,
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
