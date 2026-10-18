import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_option.dart';
import '../../../../models/lead.dart';
import '../../../../models/membership_plan.dart';
import '../../../../repositories/branch_repository.dart';
import '../../../../repositories/membership_plan_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/trainer_picker_field.dart';
import '../../../manager/presentation/widgets/member_detail_anim.dart';
import '../lead_ui.dart';
import 'lead_widgets.dart';

typedef LeadConvertSubmit = Future<({ConvertedMember? member, String? error})>
    Function(Map<String, dynamic> body);

/// Convert-to-member form (`POST /leads/:id/convert`). Branch is required
/// only when the lead has none; first/last name only when the lead's name is
/// a single word; plan defaults to the lead's interested plan. Pops the
/// created [ConvertedMember] on success (the caller offers to open it);
/// server errors (capacity, duplicate member email/phone...) show inline.
class LeadConvertSheet extends StatefulWidget {
  const LeadConvertSheet({
    super.key,
    required this.lead,
    required this.onSubmit,
  });

  final Lead lead;
  final LeadConvertSubmit onSubmit;

  @override
  State<LeadConvertSheet> createState() => _LeadConvertSheetState();
}

class _LeadConvertSheetState extends State<LeadConvertSheet> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  final _notes = TextEditingController();
  late LeadRef? _branch = widget.lead.branch;
  late LeadRef? _plan = widget.lead.interestedPlan;
  DateTime? _start;
  DateTime? _dob;
  TrainerOption? _trainer;
  String? _error;
  String? _branchError;
  String? _nameError;
  bool _saving = false;

  bool get _singleWord =>
      widget.lead.name.trim().split(RegExp(r'\s+')).length < 2;

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _pickBranch() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      final res = await pickOne<BranchOption>(
        context,
        title: 'Branch',
        icon: Icons.storefront_rounded,
        options: [for (final x in b) PickerOption(x, x.name)],
      );
      if (res?.picked != null && mounted) {
        setState(() {
          _branch = LeadRef(id: res!.picked!.id, name: res.picked!.name);
          _branchError = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on Object {
      if (mounted) setState(() => _error = 'Could not load branches');
    }
  }

  Future<void> _pickPlan() async {
    try {
      final r = await getIt<MembershipPlanRepository>()
          .list(limit: 100, isActive: true);
      if (!mounted) return;
      final res = await pickOne<MembershipPlan>(
        context,
        title: 'Membership plan',
        icon: Icons.card_membership_rounded,
        options: [
          const PickerOption<MembershipPlan>(null, 'No plan yet'),
          for (final p in r.items) PickerOption(p, p.name),
        ],
      );
      if (res != null && mounted) {
        setState(() {
          _plan = res.picked == null
              ? null
              : LeadRef(id: res.picked!.id, name: res.picked!.name);
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } on Object {
      if (mounted) setState(() => _error = 'Could not load plans');
    }
  }

  Future<void> _submit() async {
    if (_saving) return;
    setState(() {
      _error = null;
      _branchError = null;
      _nameError = null;
    });
    if (_branch == null) {
      setState(() => _branchError = 'Choose a branch for the new member');
      return;
    }
    if (_singleWord &&
        (_first.text.trim().isEmpty || _last.text.trim().isEmpty)) {
      setState(() => _nameError = 'Enter both first and last name');
      return;
    }
    setState(() => _saving = true);
    final notes = _notes.text.trim();
    try {
      final r = await widget.onSubmit({
        if (widget.lead.branch == null) 'branchId': _branch!.id,
        if (_singleWord) ...{
          'firstName': _first.text.trim(),
          'lastName': _last.text.trim(),
        },
        if (_plan != null) 'planId': _plan!.id,
        if (_start != null) 'startDate': ymd(_start!),
        if (_dob != null) 'dateOfBirth': ymd(_dob!),
        if (_trainer != null) 'trainerId': _trainer!.id,
        if (notes.isNotEmpty) 'notes': notes,
      });
      if (!mounted) return;
      if (r.error != null) {
        setState(() {
          _saving = false;
          _error = r.error;
        });
      } else {
        Navigator.of(context).pop(r.member);
      }
    } on Object {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Something went wrong. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return LeadSheetScaffold(
      icon: Icons.how_to_reg_rounded,
      color: LeadColors.green,
      title: 'Convert to member',
      subtitle: '${widget.lead.name} · ${widget.lead.phone}',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          if (widget.lead.branch == null)
            LeadValueField(
              label: 'Branch (required)',
              icon: Icons.storefront_rounded,
              color: LeadColors.amber,
              text: _branch?.name,
              hint: 'Choose branch',
              error: _branchError,
              onTap: _pickBranch,
            )
          else
            LeadFieldTile(
              icon: Icons.storefront_rounded,
              label: 'Branch',
              value: widget.lead.branch!.name,
              color: LeadColors.amber,
            ),
          if (_singleWord) ...[
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'First name',
              controller: _first,
              icon: Icons.badge_rounded,
              iconColor: LeadColors.indigo,
              errorText: _nameError,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 10),
            AppLabeledField(
              label: 'Last name',
              controller: _last,
              icon: Icons.badge_outlined,
              iconColor: LeadColors.indigo,
              textCapitalization: TextCapitalization.words,
            ),
          ],
          const SizedBox(height: 14),
          LeadValueField(
            label: 'Membership plan',
            icon: Icons.card_membership_rounded,
            color: LeadColors.violet,
            text: _plan?.name,
            hint: 'No plan yet',
            onTap: _pickPlan,
            onClear: () => setState(() => _plan = null),
          ),
          const SizedBox(height: 14),
          LeadValueField(
            label: 'Start date',
            icon: Icons.play_circle_rounded,
            color: LeadColors.green,
            text: _start == null ? null : fmtDay(_start),
            hint: 'Today',
            trailingIcon: Icons.calendar_month_rounded,
            onTap: () async {
              final d = await pickDate(
                context,
                initial: _start,
                first: DateTime.now().subtract(const Duration(days: 30)),
              );
              if (d != null) setState(() => _start = d);
            },
            onClear: () => setState(() => _start = null),
          ),
          const SizedBox(height: 14),
          LeadValueField(
            label: 'Date of birth',
            icon: Icons.cake_rounded,
            color: LeadColors.rose,
            text: _dob == null ? null : fmtDay(_dob),
            hint: 'Optional',
            trailingIcon: Icons.calendar_month_rounded,
            onTap: () async {
              final d = await pickDate(
                context,
                initial: _dob ?? DateTime(DateTime.now().year - 25),
                last: DateTime.now(),
              );
              if (d != null) setState(() => _dob = d);
            },
            onClear: () => setState(() => _dob = null),
          ),
          const SizedBox(height: 14),
          TrainerPickerField(
            selectedTrainer: _trainer,
            onChanged: (t) => setState(() => _trainer = t),
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Notes (optional)',
            controller: _notes,
            icon: Icons.sticky_note_2_rounded,
            iconColor: LeadColors.fuchsia,
            minLines: 2,
            maxLines: 4,
          ),
          const SizedBox(height: 20),
          ShimmerButton(
            colors: const [LeadColors.green, LeadColors.teal],
            onTap: _saving ? null : _submit,
            padding: const EdgeInsets.symmetric(vertical: 15),
            child: _saving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.how_to_reg_rounded,
                        size: 18,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Convert to member',
                        style: AppText.body(
                          size: 15,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
          ),
          const SizedBox(height: 4),
          Text(
            'Creates the member record and marks this lead as converted.',
            textAlign: TextAlign.center,
            style: AppText.body(size: 11, color: AppColors.inkFaint),
          ),
        ],
      ),
    );
  }
}
