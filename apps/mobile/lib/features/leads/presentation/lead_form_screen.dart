import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/lead.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/lead_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import 'lead_ui.dart';

/// Route argument: pass [lead] to edit, omit to create.
class LeadFormArgs {
  const LeadFormArgs({this.lead});

  final Lead? lead;
}

/// Create / edit a lead — `POST /leads`, `PATCH /leads/:id`.
///
/// Edit sends ONLY changed keys (`null` clears an optional field). The
/// assignee picker shows on CREATE only and only with `leads:assign` (the
/// API refuses assigning someone else without it, and `PATCH /leads/:id`
/// cannot change the assignee — that's the detail screen's Assign action).
/// A 409 shows a banner listing the matching lead/member with links to open
/// them; 422 `errors[].field` map onto the inline field errors.
///
/// Dropped vs web: gender (not captured by the staff app's member forms
/// either), branch-scoped plan filtering.
class LeadFormScreen extends StatefulWidget {
  const LeadFormScreen({super.key, this.args = const LeadFormArgs()});

  final LeadFormArgs args;

  @override
  State<LeadFormScreen> createState() => _LeadFormScreenState();
}

class _LeadFormScreenState extends State<LeadFormScreen> {
  Lead? get _lead => widget.args.lead;
  bool get _editing => _lead != null;

  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _sourceDetail = TextEditingController();
  final _interest = TextEditingController();
  final _notes = TextEditingController();
  LeadSource _source = LeadSource.walkIn;
  LeadRef? _plan;
  LeadRef? _branch;
  LeadRef? _assignee;
  DateTime? _followUp;
  DateTime? _joinDate;

  final Map<String, String> _errors = {};
  List<LeadDuplicate> _dups = const [];
  String? _formError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final l = _lead;
    if (l != null) {
      _name.text = l.name;
      _phone.text = l.phone;
      _email.text = l.email ?? '';
      _sourceDetail.text = l.sourceDetail ?? '';
      _interest.text = l.interest ?? '';
      _notes.text = l.notes ?? '';
      _source = l.source;
      _plan = l.interestedPlan;
      _branch = l.branch;
      _followUp = l.nextFollowUpAt?.toLocal();
      _joinDate = DateTime.tryParse(l.expectedJoinDate ?? '');
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _sourceDetail, _interest, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _clean(TextEditingController c) {
    final t = c.text.trim();
    return t.isEmpty ? null : t;
  }

  bool _validate() {
    _errors.clear();
    if (_name.text.trim().isEmpty) _errors['name'] = 'Name is required';
    if (!RegExp(r'^\+?[0-9\s-]{7,15}$').hasMatch(_phone.text.trim())) {
      _errors['phone'] = 'Enter a valid phone number';
    }
    final email = _email.text.trim();
    if (email.isNotEmpty &&
        !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      _errors['email'] = 'Enter a valid email address';
    }
    setState(() {});
    return _errors.isEmpty;
  }

  String? _iso(DateTime? d) => d?.toUtc().toIso8601String();

  Map<String, dynamic> _createBody() => {
        'name': _name.text.trim(),
        'phone': _phone.text.trim(),
        if (_clean(_email) != null) 'email': _clean(_email),
        'source': _source.api,
        if (_clean(_sourceDetail) != null)
          'sourceDetail': _clean(_sourceDetail),
        if (_branch != null) 'branchId': _branch!.id,
        if (_plan != null) 'interestedPlanId': _plan!.id,
        if (_clean(_interest) != null) 'interest': _clean(_interest),
        if (_assignee != null) 'assignedToUserId': _assignee!.id,
        if (_followUp != null) 'nextFollowUpAt': _iso(_followUp),
        if (_joinDate != null) 'expectedJoinDate': ymd(_joinDate!),
        if (_clean(_notes) != null) 'notes': _clean(_notes),
      };

  Map<String, dynamic> _patchBody(Lead o) {
    final p = <String, dynamic>{};
    void diff(String key, Object? now, Object? before) {
      if (now != before) p[key] = now;
    }

    diff('name', _name.text.trim(), o.name);
    diff('phone', _phone.text.trim(), o.phone);
    diff('email', _clean(_email), o.email);
    diff('source', _source.api, o.source.api);
    diff('sourceDetail', _clean(_sourceDetail), o.sourceDetail);
    diff('branchId', _branch?.id, o.branch?.id);
    diff('interestedPlanId', _plan?.id, o.interestedPlan?.id);
    diff('interest', _clean(_interest), o.interest);
    diff('notes', _clean(_notes), o.notes);
    diff(
      'expectedJoinDate',
      _joinDate == null ? null : ymd(_joinDate!),
      o.expectedJoinDate,
    );
    if (_followUp?.toUtc() != o.nextFollowUpAt?.toUtc()) {
      p['nextFollowUpAt'] = _iso(_followUp);
    }
    return p;
  }

  Future<void> _save() async {
    if (!_validate()) return;
    final repo = getIt<LeadRepository>();
    Map<String, dynamic>? patch;
    if (_editing) {
      patch = _patchBody(_lead!);
      if (patch.isEmpty) {
        context.pop();
        return;
      }
    }
    setState(() {
      _saving = true;
      _formError = null;
      _dups = const [];
    });
    try {
      final saved = _editing
          ? await repo.update(_lead!.id, patch!)
          : await repo.create(_createBody());
      if (!mounted) return;
      context.pop(saved);
    } on LeadDuplicateException catch (e) {
      if (!mounted) return;
      setState(() {
        _dups = e.duplicates;
        _formError = e.message;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        for (final f in e.fieldErrors) {
          if (f.field != null) _errors[f.field!] = f.message;
        }
        _formError = e.fieldErrors.isEmpty ? e.message : null;
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickPlan() async {
    try {
      final r = await getIt<MembershipPlanRepository>()
          .list(limit: 100, isActive: true);
      if (!mounted) return;
      final res = await pickOne<MembershipPlan>(
        context,
        title: 'Interested plan',
        selected: null,
        options: [
          const PickerOption<MembershipPlan>(null, 'None'),
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
      _toast(e.message);
    }
  }

  Future<void> _pickBranch() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      final res = await pickOne<BranchOption>(
        context,
        title: 'Branch',
        options: [
          const PickerOption<BranchOption>(null, 'None'),
          for (final x in b) PickerOption(x, x.name),
        ],
      );
      if (res != null && mounted) {
        setState(() {
          _branch = res.picked == null
              ? null
              : LeadRef(id: res.picked!.id, name: res.picked!.name);
        });
      }
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  Future<void> _pickAssignee() async {
    try {
      final a = await getIt<LeadRepository>().assignees();
      if (!mounted) return;
      final res = await pickOne<LeadAssignee>(
        context,
        title: 'Assign to',
        options: [
          const PickerOption<LeadAssignee>(null, 'Me (default)'),
          for (final x in a) PickerOption(x, x.name, sub: x.role),
        ],
      );
      if (res != null && mounted) {
        setState(() {
          _assignee = res.picked == null
              ? null
              : LeadRef(id: res.picked!.id, name: res.picked!.name);
        });
      }
    } on ApiException catch (e) {
      _toast(e.message);
    }
  }

  void _toast(String m) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _openDuplicate(LeadDuplicate d) async {
    if (d.isMember) {
      await context.push(AppRoutes.memberDetail, extra: d.id);
    } else {
      await context.push(AppRoutes.leadDetail, extra: d.id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canAssign = !_editing && leadsCan(context, 'leads:assign');
    final canFollowUp = !_editing || (_lead?.isOpen ?? true);
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(_editing ? 'Edit lead' : 'New lead'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_formError != null) FormAlert(message: _formError!),
              if (_dups.isNotEmpty) ...[
                const SizedBox(height: 10),
                for (final d in _dups)
                  _DuplicateTile(d, () => _openDuplicate(d)),
              ],
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Name',
                controller: _name,
                errorText: _errors['name'],
                textCapitalization: TextCapitalization.words,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Phone',
                controller: _phone,
                errorText: _errors['phone'],
                keyboardType: TextInputType.phone,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Email (optional)',
                controller: _email,
                errorText: _errors['email'],
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              Text('Source', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<LeadSource>(
                options: LeadSource.values,
                labelOf: (s) => s.label,
                value: _source,
                onChanged: (s) => setState(() => _source = s),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Source detail (optional)',
                hintText: 'e.g. Instagram reel, referred by Ravi',
                controller: _sourceDetail,
                errorText: _errors['sourceDetail'],
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              LeadPickerField(
                label: 'Interested plan',
                value: _plan?.name,
                onTap: _pickPlan,
                onClear: () => setState(() => _plan = null),
              ),
              const SizedBox(height: 14),
              LeadPickerField(
                label: 'Branch',
                value: _branch?.name,
                onTap: _pickBranch,
                onClear: () => setState(() => _branch = null),
              ),
              if (canAssign) ...[
                const SizedBox(height: 14),
                LeadPickerField(
                  label: 'Assigned to',
                  value: _assignee?.name,
                  hint: 'Me (default)',
                  onTap: _pickAssignee,
                  onClear: () => setState(() => _assignee = null),
                ),
              ],
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Goal / interest (optional)',
                hintText: 'e.g. Weight loss, strength training',
                controller: _interest,
                errorText: _errors['interest'],
                minLines: 1,
                maxLines: 3,
              ),
              if (canFollowUp) ...[
                const SizedBox(height: 14),
                LeadPickerField(
                  label: 'Next follow-up',
                  value: _followUp == null ? null : fmtWhen(_followUp),
                  error: _errors['nextFollowUpAt'],
                  onTap: () async {
                    final d = await pickDateTime(context, initial: _followUp);
                    if (d != null) setState(() => _followUp = d);
                  },
                  onClear: () => setState(() => _followUp = null),
                ),
              ],
              const SizedBox(height: 14),
              LeadPickerField(
                label: 'Expected join date',
                value: _joinDate == null ? null : fmtDay(_joinDate),
                error: _errors['expectedJoinDate'],
                onTap: () async {
                  final d = await pickDate(context, initial: _joinDate);
                  if (d != null) setState(() => _joinDate = d);
                },
                onClear: () => setState(() => _joinDate = null),
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Notes (optional)',
                controller: _notes,
                errorText: _errors['notes'],
                minLines: 2,
                maxLines: 5,
              ),
              const SizedBox(height: 24),
              AppButton(
                label: _editing ? 'Save changes' : 'Create lead',
                loading: _saving,
                onPressed: _save,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DuplicateTile extends StatelessWidget {
  const _DuplicateTile(this.dup, this.onTap);

  final LeadDuplicate dup;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final what = dup.isMember
        ? 'Member${dup.memberCode == null ? '' : ' ${dup.memberCode}'}'
        : 'Lead${dup.status == null ? '' : ' · ${LeadStatus.parse(dup.status).label}'}';
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Material(
        color: AppColors.warningSoft,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.field),
          side: BorderSide(color: AppColors.warning.withValues(alpha: 0.5)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.field),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 52),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  const Icon(
                    Icons.copy_all_rounded,
                    size: 18,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          dup.name,
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          '$what · same ${dup.matchedOn.join(' & ')}',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.inkFaint,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
