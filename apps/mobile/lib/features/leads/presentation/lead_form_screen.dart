import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/lead.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/lead_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';
import 'lead_ui.dart';
import 'widgets/lead_widgets.dart';

/// Route argument: pass [lead] to edit, omit to create.
class LeadFormArgs {
  const LeadFormArgs({this.lead});

  final Lead? lead;
}

/// Create / edit a lead — `POST /leads`, `PATCH /leads/:id`.
///
/// Gradient banner + coloured sections (Contact, Enquiry, Follow-up, Notes)
/// in the same language as the member edit screens. Edit sends ONLY changed
/// keys (`null` clears an optional field). The assignee picker shows on
/// CREATE only and only with `leads:assign` (the API refuses assigning
/// someone else without it, and `PATCH /leads/:id` cannot change the
/// assignee — that's the detail screen's Assign action). A 409 shows a
/// banner listing the matching lead/member with links to open them; 422
/// `errors[].field` map onto the inline field errors.
///
/// Gender is the backend enum (`MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY`), sent
/// as the wire value. Dropped vs web: branch-scoped plan filtering.
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
  String? _gender;
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
      _gender = l.gender;
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
        if (_gender != null) 'gender': _gender,
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
    diff('gender', _gender, o.gender);
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

  static const _knownFields = {
    'name',
    'phone',
    'email',
    'sourceDetail',
    'interest',
    'notes',
    'nextFollowUpAt',
    'expectedJoinDate',
  };

  Future<void> _save() async {
    if (_saving || !_validate()) return;
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
      leadToast(context, _editing ? 'Lead updated' : 'Lead created');
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
        var unmapped = false;
        for (final f in e.fieldErrors) {
          if (f.field != null && _knownFields.contains(f.field)) {
            _errors[f.field!] = f.message;
          } else {
            unmapped = true;
          }
        }
        _formError =
            (e.fieldErrors.isEmpty || unmapped) ? e.detailedMessage : null;
      });
    } on Object {
      if (!mounted) return;
      setState(() => _formError = 'Something went wrong. Please try again.');
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
        icon: Icons.card_membership_rounded,
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
      if (mounted) leadToast(context, e.message, error: true);
    } on Object {
      if (mounted) leadToast(context, 'Could not load plans', error: true);
    }
  }

  Future<void> _pickBranch() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      final res = await pickOne<BranchOption>(
        context,
        title: 'Branch',
        icon: Icons.storefront_rounded,
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
      if (mounted) leadToast(context, e.message, error: true);
    } on Object {
      if (mounted) leadToast(context, 'Could not load branches', error: true);
    }
  }

  Future<void> _pickAssignee() async {
    try {
      final a = await getIt<LeadRepository>().assignees();
      if (!mounted) return;
      final res = await pickOne<LeadAssignee>(
        context,
        title: 'Assign to',
        icon: Icons.person_add_alt_rounded,
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
      if (mounted) leadToast(context, e.message, error: true);
    } on Object {
      if (mounted) leadToast(context, 'Could not load staff', error: true);
    }
  }

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
    return LeadFormScaffold(
      title: _editing ? 'Edit lead' : 'New lead',
      subtitle:
          _editing ? _lead!.name : 'Capture an enquiry and start the follow-up',
      icon: _editing ? Icons.edit_note_rounded : Icons.person_add_alt_1_rounded,
      banner: LeadHeroPill(
        _editing ? _lead!.status.label : 'New enquiry',
        icon: _editing ? leadStatusIcon(_lead!.status) : Icons.bolt_rounded,
      ),
      saving: _saving,
      onSave: _save,
      saveLabel: _editing ? 'Save changes' : 'Create lead',
      error: _formError,
      extra: [
        for (final d in _dups) _DuplicateTile(d, () => _openDuplicate(d)),
        if (_dups.isNotEmpty) const SizedBox(height: 14),
      ],
      sections: [
        FormSection(
          icon: Icons.contact_phone_rounded,
          color: LeadColors.indigo,
          title: 'Contact',
          subtitle: 'Who is enquiring',
          children: [
            AppLabeledField(
              label: 'Name',
              controller: _name,
              icon: Icons.person_rounded,
              iconColor: LeadColors.indigo,
              hintText: 'e.g. Asha Rao',
              errorText: _errors['name'],
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Phone',
              controller: _phone,
              icon: Icons.call_rounded,
              iconColor: LeadColors.green,
              hintText: 'e.g. 9876543210',
              errorText: _errors['phone'],
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Email (optional)',
              controller: _email,
              icon: Icons.mail_rounded,
              iconColor: LeadColors.sky,
              errorText: _errors['email'],
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            LeadChipGroup<String>(
              label: 'GENDER (OPTIONAL)',
              icon: Icons.wc_rounded,
              color: LeadColors.fuchsia,
              options: [for (final g in leadGenderOptions) g.$1],
              value: _gender,
              allowClear: true,
              labelOf: (v) => leadGenderOptions.firstWhere((g) => g.$1 == v).$2,
              onChanged: (v) => setState(() => _gender = v),
            ),
          ],
        ),
        FormSection(
          icon: Icons.campaign_rounded,
          color: LeadColors.teal,
          title: 'Enquiry',
          subtitle: 'Where they came from and what they want',
          children: [
            LeadChipGroup<LeadSource>(
              label: 'SOURCE',
              icon: Icons.campaign_rounded,
              color: LeadColors.teal,
              options: LeadSource.values,
              value: _source,
              labelOf: (s) => s.label,
              iconOf: leadSourceIcon,
              colorOf: leadSourceColor,
              onChanged: (s) => setState(() => _source = s ?? _source),
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Source detail (optional)',
              controller: _sourceDetail,
              icon: Icons.notes_rounded,
              iconColor: LeadColors.teal,
              hintText: 'e.g. Instagram reel, referred by Ravi',
              errorText: _errors['sourceDetail'],
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 14),
            LeadValueField(
              label: 'Interested plan',
              icon: Icons.card_membership_rounded,
              color: LeadColors.violet,
              text: _plan?.name,
              hint: 'Not decided',
              onTap: _pickPlan,
              onClear: () => setState(() => _plan = null),
            ),
            const SizedBox(height: 14),
            LeadValueField(
              label: 'Branch',
              icon: Icons.storefront_rounded,
              color: LeadColors.amber,
              text: _branch?.name,
              hint: 'Not set',
              onTap: _pickBranch,
              onClear: () => setState(() => _branch = null),
            ),
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Goal / interest (optional)',
              controller: _interest,
              icon: Icons.flag_rounded,
              iconColor: LeadColors.rose,
              hintText: 'e.g. Weight loss, strength training',
              errorText: _errors['interest'],
              minLines: 1,
              maxLines: 3,
            ),
          ],
        ),
        FormSection(
          icon: Icons.event_repeat_rounded,
          color: LeadColors.amber,
          title: 'Follow-up',
          subtitle: 'When to reach out and who owns it',
          children: [
            if (canFollowUp) ...[
              LeadValueField(
                label: 'Next follow-up',
                icon: Icons.alarm_rounded,
                color: LeadColors.amber,
                text: _followUp == null ? null : fmtWhen(_followUp),
                hint: 'Pick date & time',
                error: _errors['nextFollowUpAt'],
                trailingIcon: Icons.calendar_month_rounded,
                onTap: () async {
                  final d = await pickDateTime(context, initial: _followUp);
                  if (d != null) setState(() => _followUp = d);
                },
                onClear: () => setState(() => _followUp = null),
              ),
              const SizedBox(height: 14),
            ],
            LeadValueField(
              label: 'Expected join date',
              icon: Icons.event_available_rounded,
              color: LeadColors.green,
              text: _joinDate == null ? null : fmtDay(_joinDate),
              hint: 'Pick a date',
              error: _errors['expectedJoinDate'],
              trailingIcon: Icons.calendar_month_rounded,
              onTap: () async {
                final d = await pickDate(context, initial: _joinDate);
                if (d != null) setState(() => _joinDate = d);
              },
              onClear: () => setState(() => _joinDate = null),
            ),
            if (canAssign) ...[
              const SizedBox(height: 14),
              LeadValueField(
                label: 'Assigned to',
                icon: Icons.person_add_alt_rounded,
                color: LeadColors.indigo,
                text: _assignee?.name,
                hint: 'Me (default)',
                onTap: _pickAssignee,
                onClear: () => setState(() => _assignee = null),
              ),
            ],
          ],
        ),
        FormSection(
          icon: Icons.sticky_note_2_rounded,
          color: LeadColors.fuchsia,
          title: 'Notes',
          subtitle: 'Anything the next person should know',
          children: [
            AppLabeledField(
              label: 'Notes (optional)',
              controller: _notes,
              icon: Icons.edit_note_rounded,
              iconColor: LeadColors.fuchsia,
              errorText: _errors['notes'],
              minLines: 3,
              maxLines: 6,
            ),
          ],
        ),
      ],
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
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.warningSoft,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: AppColors.warning.withValues(alpha: 0.5)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  const Icon(
                    Icons.copy_all_rounded,
                    size: 20,
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
                          '$what · same ${dup.matchedOn.join(' & ')} · tap to open',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
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
