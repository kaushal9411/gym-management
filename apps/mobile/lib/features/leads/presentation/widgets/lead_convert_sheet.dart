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
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/trainer_picker_field.dart';
import '../lead_ui.dart';

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
        options: [for (final x in b) PickerOption(x, x.name)],
      );
      if (res?.picked != null && mounted) {
        setState(() {
          _branch = LeadRef(id: res!.picked!.id, name: res.picked!.name);
          _branchError = null;
        });
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
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
      setState(() => _error = e.message);
    }
  }

  Future<void> _submit() async {
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
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18,
          0,
          18,
          16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Convert to member', style: AppText.display(size: 18)),
              const SizedBox(height: 4),
              Text(
                '${widget.lead.name} · ${widget.lead.phone}',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                FormAlert(message: _error!),
              ],
              if (widget.lead.branch == null) ...[
                const SizedBox(height: 14),
                LeadPickerField(
                  label: 'Branch (required)',
                  value: _branch?.name,
                  hint: 'Choose branch',
                  error: _branchError,
                  onTap: _pickBranch,
                ),
              ] else ...[
                const SizedBox(height: 14),
                Text(
                  'Branch: ${widget.lead.branch!.name}',
                  style: AppText.body(size: 13, color: AppColors.inkSoft),
                ),
              ],
              if (_singleWord) ...[
                const SizedBox(height: 14),
                AppLabeledField(
                  label: 'First name',
                  controller: _first,
                  errorText: _nameError,
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 10),
                AppLabeledField(
                  label: 'Last name',
                  controller: _last,
                  textCapitalization: TextCapitalization.words,
                ),
              ],
              const SizedBox(height: 14),
              LeadPickerField(
                label: 'Membership plan',
                value: _plan?.name,
                hint: 'No plan yet',
                onTap: _pickPlan,
                onClear: () => setState(() => _plan = null),
              ),
              const SizedBox(height: 14),
              LeadPickerField(
                label: 'Start date',
                value: _start == null ? null : fmtDay(_start),
                hint: 'Today',
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
              LeadPickerField(
                label: 'Date of birth',
                value: _dob == null ? null : fmtDay(_dob),
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
                minLines: 2,
                maxLines: 4,
              ),
              const SizedBox(height: 20),
              AppButton(
                label: 'Convert to member',
                loading: _saving,
                onPressed: _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
