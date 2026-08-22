import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

String _fmtDate(DateTime? d) => d == null
    ? ''
    : '${d.day.toString().padLeft(2, '0')}/'
        '${d.month.toString().padLeft(2, '0')}/${d.year}';

/// Design frame "7a. Create/edit plan" — mirrors web's `PlanFormFields`
/// section-for-section ("Plan information" / "Plan features" / "Membership
/// rules") and the merged detail+edit screen web uses at `/memberships/:id`
/// (header with status + Duplicate/Activate-Deactivate/Delete/Restore,
/// same form body, pre-filled). `widget.plan == null` → create
/// (`POST /membership-plans`); otherwise → edit
/// (`PATCH /membership-plans/:id`), same field set both ways.
class MembershipPlanFormScreen extends StatefulWidget {
  const MembershipPlanFormScreen({super.key, this.plan});

  final MembershipPlan? plan;

  bool get isEdit => plan != null;

  @override
  State<MembershipPlanFormScreen> createState() =>
      _MembershipPlanFormScreenState();
}

class _MembershipPlanFormScreenState extends State<MembershipPlanFormScreen> {
  final _name = TextEditingController();
  final _planCode = TextEditingController();
  final _category = TextEditingController();
  final _displayOrder = TextEditingController(text: '0');
  final _description = TextEditingController();
  final _durationValue = TextEditingController(text: '1');
  final _price = TextEditingController();
  final _joiningFee = TextEditingController();
  final _taxPercentage = TextEditingController();
  final _discountPercentage = TextEditingController();
  final _notes = TextEditingController();
  final _ptSessions = TextEditingController(text: '0');
  final _groupClasses = TextEditingController(text: '0');
  final _guestPasses = TextEditingController(text: '0');
  final _freezeDaysLimit = TextEditingController();
  final _gracePeriodDays = TextEditingController(text: '0');
  final _renewalWindowDays = TextEditingController(text: '0');
  final _minAge = TextEditingController();
  final _maxAge = TextEditingController();
  final _validityStartText = TextEditingController();
  final _validityEndText = TextEditingController();

  MembershipDurationType _durationType = MembershipDurationType.months;
  bool _gymAccessAllBranches = false;
  bool _dietConsultationIncluded = false;
  bool _lockerAccess = false;
  bool _freezeAllowed = false;
  bool _autoRenewalAllowed = false;
  DateTime? _validityStart;
  DateTime? _validityEnd;

  late MembershipPlan? _currentPlan = widget.plan;
  bool _saving = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final plan = widget.plan;
    if (plan != null) {
      _name.text = plan.name;
      _planCode.text = plan.planCode;
      _category.text = plan.category ?? '';
      _displayOrder.text = '${plan.displayOrder}';
      _description.text = plan.description ?? '';
      _durationValue.text = '${plan.durationValue}';
      _durationType = plan.durationType;
      _price.text = plan.price.toStringAsFixed(2);
      _joiningFee.text =
          plan.joiningFee == 0 ? '' : plan.joiningFee.toStringAsFixed(2);
      _taxPercentage.text =
          plan.taxPercentage == 0 ? '' : plan.taxPercentage.toStringAsFixed(2);
      _discountPercentage.text = plan.discountPercentage == 0
          ? ''
          : plan.discountPercentage.toStringAsFixed(2);
      _notes.text = plan.notes ?? '';
      _ptSessions.text = '${plan.ptSessionsIncluded}';
      _groupClasses.text = '${plan.groupClassesIncluded}';
      _guestPasses.text = '${plan.guestPasses}';
      _gymAccessAllBranches = plan.gymAccessAllBranches;
      _dietConsultationIncluded = plan.dietConsultationIncluded;
      _lockerAccess = plan.lockerAccess;
      _freezeAllowed = plan.freezeAllowed;
      _freezeDaysLimit.text = plan.freezeDaysLimit?.toString() ?? '';
      _validityStart = plan.validityStart;
      _validityEnd = plan.validityEnd;
      _validityStartText.text = _fmtDate(_validityStart);
      _validityEndText.text = _fmtDate(_validityEnd);
      _gracePeriodDays.text = '${plan.gracePeriodDays}';
      _renewalWindowDays.text = '${plan.renewalWindowDays}';
      _autoRenewalAllowed = plan.autoRenewalAllowed;
      _minAge.text = plan.minAge?.toString() ?? '';
      _maxAge.text = plan.maxAge?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _planCode,
      _category,
      _displayOrder,
      _description,
      _durationValue,
      _price,
      _joiningFee,
      _taxPercentage,
      _discountPercentage,
      _notes,
      _ptSessions,
      _groupClasses,
      _guestPasses,
      _freezeDaysLimit,
      _gracePeriodDays,
      _renewalWindowDays,
      _minAge,
      _maxAge,
      _validityStartText,
      _validityEndText,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  int? _int(TextEditingController c) => int.tryParse(c.text.trim());
  double? _double(TextEditingController c) => double.tryParse(c.text.trim());

  Future<void> _submit() async {
    final name = _name.text.trim();
    final durationValue = _int(_durationValue);
    final price = _double(_price);
    if (name.isEmpty) {
      setState(() => _error = 'Plan name is required');
      return;
    }
    if (durationValue == null || durationValue <= 0) {
      setState(() => _error = 'Enter a valid duration');
      return;
    }
    if (price == null || price < 0) {
      setState(() => _error = 'Enter a valid price');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final input = MembershipPlanFormInput(
      name: name,
      planCode: _planCode.text.trim().isEmpty ? null : _planCode.text.trim(),
      description:
          _description.text.trim().isEmpty ? null : _description.text.trim(),
      category: _category.text.trim().isEmpty ? null : _category.text.trim(),
      durationValue: durationValue,
      durationType: _durationType,
      price: price,
      joiningFee: _double(_joiningFee),
      taxPercentage: _double(_taxPercentage),
      discountPercentage: _double(_discountPercentage),
      displayOrder: _int(_displayOrder),
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      gymAccessAllBranches: _gymAccessAllBranches,
      ptSessionsIncluded: _int(_ptSessions) ?? 0,
      groupClassesIncluded: _int(_groupClasses) ?? 0,
      dietConsultationIncluded: _dietConsultationIncluded,
      lockerAccess: _lockerAccess,
      guestPasses: _int(_guestPasses) ?? 0,
      freezeAllowed: _freezeAllowed,
      freezeDaysLimit: _freezeAllowed ? _int(_freezeDaysLimit) : null,
      validityStart: _validityStart,
      validityEnd: _validityEnd,
      gracePeriodDays: _int(_gracePeriodDays),
      renewalWindowDays: _int(_renewalWindowDays),
      autoRenewalAllowed: _autoRenewalAllowed,
      minAge: _int(_minAge),
      maxAge: _int(_maxAge),
    );
    try {
      final repo = getIt<MembershipPlanRepository>();
      if (widget.isEdit) {
        await repo.update(_currentPlan!.id, input);
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Plan updated')));
      } else {
        final created = await repo.create(input);
        if (!mounted) return;
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('${created.name} created')));
      }
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _confirm({
    required String action,
    required bool destructive,
  }) async {
    final name = _currentPlan!.name;
    final label = '${action[0].toUpperCase()}${action.substring(1)}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text('$label "$name"?'),
        content: Text(
          action == 'delete'
              ? 'This soft-deletes the plan — it can no longer be assigned '
                  'to members until restored.'
              : 'This action can be reversed later if needed.',
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(true),
            child: Text(
              label,
              style: TextStyle(
                color: destructive ? AppColors.danger : AppColors.staffPillFg,
              ),
            ),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  Future<void> _runAction(
    Future<void> Function() action,
    String pastTenseLabel,
  ) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Plan $pastTenseLabel.')),
      );
      final refreshed =
          await getIt<MembershipPlanRepository>().getById(_currentPlan!.id);
      if (!mounted) return;
      setState(() => _currentPlan = refreshed);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _activate() async {
    if (!await _confirm(action: 'activate', destructive: false)) return;
    await _runAction(
      () => getIt<MembershipPlanRepository>().activate(_currentPlan!.id),
      'activated',
    );
  }

  Future<void> _deactivate() async {
    if (!await _confirm(action: 'deactivate', destructive: false)) return;
    await _runAction(
      () => getIt<MembershipPlanRepository>().deactivate(_currentPlan!.id),
      'deactivated',
    );
  }

  Future<void> _restore() async {
    if (!await _confirm(action: 'restore', destructive: false)) return;
    await _runAction(
      () => getIt<MembershipPlanRepository>().restore(_currentPlan!.id),
      'restored',
    );
  }

  Future<void> _delete() async {
    if (!await _confirm(action: 'delete', destructive: true)) return;
    setState(() => _busy = true);
    try {
      await getIt<MembershipPlanRepository>().delete(_currentPlan!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Plan deleted.')));
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _duplicate() async {
    setState(() => _busy = true);
    try {
      final created =
          await getIt<MembershipPlanRepository>().duplicate(_currentPlan!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Duplicated as "${created.name}" (inactive draft).'),
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickDate({required bool isStart}) async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
      initialDate: (isStart ? _validityStart : _validityEnd) ?? DateTime.now(),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _validityStart = picked;
        _validityStartText.text = _fmtDate(picked);
      } else {
        _validityEnd = picked;
        _validityEndText.text = _fmtDate(picked);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final plan = _currentPlan;
    final deleted = plan?.deletedAt != null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(widget.isEdit ? 'Edit Plan' : 'New Plan'),
        actions: [
          if (widget.isEdit && plan != null)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert_rounded, color: AppColors.ink),
              color: AppColors.surface2,
              enabled: !_busy,
              onSelected: (value) => switch (value) {
                'duplicate' => _duplicate(),
                'activate' => _activate(),
                'deactivate' => _deactivate(),
                'delete' => _delete(),
                'restore' => _restore(),
                _ => null,
              },
              itemBuilder: (context) => [
                const PopupMenuItem(
                  value: 'duplicate',
                  child: Text('Duplicate'),
                ),
                if (deleted)
                  const PopupMenuItem(
                    value: 'restore',
                    child: Text('Restore'),
                  )
                else ...[
                  PopupMenuItem(
                    value: plan.isActive ? 'deactivate' : 'activate',
                    child: Text(plan.isActive ? 'Deactivate' : 'Activate'),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text(
                      'Delete',
                      style: TextStyle(color: AppColors.danger),
                    ),
                  ),
                ],
              ],
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.isEdit && plan != null) ...[
                _PlanHeader(plan: plan),
                const SizedBox(height: 16),
              ],
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 12),
              ],
              Text('Plan information', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              AppLabeledField(
                label: 'Plan name *',
                hintText: 'e.g. Quarterly Pro',
                controller: _name,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Plan code',
                hintText: 'Optional — auto-generated if left blank',
                controller: _planCode,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Category',
                      hintText: 'e.g. Premium',
                      controller: _category,
                      textInputAction: TextInputAction.next,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Display order',
                      controller: _displayOrder,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Description',
                controller: _description,
                minLines: 3,
                maxLines: 6,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Duration *',
                      controller: _durationValue,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Duration type', style: AppText.eyebrow()),
                        const SizedBox(height: 6),
                        CategoryChipSelector<MembershipDurationType>(
                          options: MembershipDurationType.values,
                          labelOf: (d) => d.label,
                          value: _durationType,
                          onChanged: (d) => setState(() => _durationType = d),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Price *',
                      hintText: 'e.g. 4999',
                      controller: _price,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Joining fee',
                      controller: _joiningFee,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Tax %',
                      controller: _taxPercentage,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Discount %',
                      controller: _discountPercentage,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(
                          RegExp(r'^\d*\.?\d{0,2}'),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Notes',
                controller: _notes,
                minLines: 2,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 22),
              Text('Plan features', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'PT sessions',
                      controller: _ptSessions,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Group classes',
                      controller: _groupClasses,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Guest passes',
                      controller: _guestPasses,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _CheckboxRow(
                label: 'Gym access at all branches',
                value: _gymAccessAllBranches,
                onChanged: (v) => setState(() => _gymAccessAllBranches = v),
              ),
              _CheckboxRow(
                label: 'Diet consultation included',
                value: _dietConsultationIncluded,
                onChanged: (v) => setState(() => _dietConsultationIncluded = v),
              ),
              _CheckboxRow(
                label: 'Locker access',
                value: _lockerAccess,
                onChanged: (v) => setState(() => _lockerAccess = v),
              ),
              _CheckboxRow(
                label: 'Freeze allowed',
                value: _freezeAllowed,
                onChanged: (v) => setState(() => _freezeAllowed = v),
              ),
              if (_freezeAllowed) ...[
                const SizedBox(height: 10),
                AppLabeledField(
                  label: 'Freeze days limit',
                  hintText: 'Blank = no cap',
                  controller: _freezeDaysLimit,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                ),
              ],
              const SizedBox(height: 22),
              Text('Membership rules', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Validity start',
                      hintText: 'dd/mm/yyyy',
                      controller: _validityStartText,
                      readOnly: true,
                      onTap: () => _pickDate(isStart: true),
                      suffixIcon: const Icon(
                        Icons.calendar_today_rounded,
                        size: 16,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Validity end',
                      hintText: 'dd/mm/yyyy',
                      controller: _validityEndText,
                      readOnly: true,
                      onTap: () => _pickDate(isStart: false),
                      suffixIcon: const Icon(
                        Icons.calendar_today_rounded,
                        size: 16,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Grace period (days)',
                      controller: _gracePeriodDays,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Renewal window (days)',
                      hintText: '0 = anytime',
                      controller: _renewalWindowDays,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: AppLabeledField(
                      label: 'Minimum age',
                      controller: _minAge,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppLabeledField(
                      label: 'Maximum age',
                      controller: _maxAge,
                      keyboardType: TextInputType.number,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _CheckboxRow(
                label: 'Auto-renewal allowed',
                value: _autoRenewalAllowed,
                onChanged: (v) => setState(() => _autoRenewalAllowed = v),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: widget.isEdit ? 'Save changes' : 'Create plan',
                loading: _saving,
                onPressed: _saving ? null : _submit,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

/// Edit mode's header — status, plan code, member count, mirroring web's
/// merged detail+edit page.
class _PlanHeader extends StatelessWidget {
  const _PlanHeader({required this.plan});

  final MembershipPlan plan;

  @override
  Widget build(BuildContext context) {
    final deleted = plan.deletedAt != null;
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
                  plan.name,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${plan.planCode} · ${plan.memberCount} member'
                  '${plan.memberCount == 1 ? '' : 's'} on this plan',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          AppPill(
            label:
                deleted ? 'Deleted' : (plan.isActive ? 'Active' : 'Inactive'),
            tone: deleted
                ? AppPillTone.neutral
                : (plan.isActive ? AppPillTone.success : AppPillTone.danger),
          ),
        ],
      ),
    );
  }
}

/// Web's checkbox rows, reimplemented as a tappable row (square check box +
/// label) rather than this app's usual pill toggle — closer to the source
/// design for this particular form.
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
