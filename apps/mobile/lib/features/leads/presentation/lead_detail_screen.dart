import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/leads/lead_detail_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/lead.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import 'lead_form_screen.dart';
import 'lead_ui.dart';
import 'widgets/lead_convert_sheet.dart';

/// Lead detail — `GET /leads/:id` (+ activities newest-first,
/// `convertedMember`). Header (call / WhatsApp, source, status, assignee,
/// age, follow-up badge), pipeline stepper, action buttons, activity
/// composer and timeline. Every action is permission-gated through
/// [leadsCan]: Edit/Stage/Reopen/Log = `leads:update`, Convert =
/// `leads:convert`, Assign = `leads:assign`, Delete = `leads:delete`
/// (a receptionist sees none of the last two).
///
/// CONVERTED is reachable only through Convert (the API 422s a status
/// change to it); a CONVERTED lead is terminal here — only the timeline and
/// the member link remain. The 6 demo CONVERTED leads have no member, so the
/// member link is optional.
///
/// Dropped vs web: inline follow-up reschedule chips (the composer's
/// "Next follow-up" covers it), activity outcome field, lost-note on the
/// header card for converted leads.
class LeadDetailScreen extends StatelessWidget {
  const LeadDetailScreen({super.key, required this.leadId});

  final String leadId;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => LeadDetailCubit(getIt<LeadRepository>(), leadId)..load(),
      child: const _DetailView(),
    );
  }
}

class _DetailView extends StatelessWidget {
  const _DetailView();

  void _toast(BuildContext c, String m) =>
      ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _stage(
    BuildContext context,
    Lead lead, {
    bool reopen = false,
  }) async {
    final cubit = context.read<LeadDetailCubit>();
    final options = reopen
        ? LeadStatus.pipeline.where((s) => s.isOpen).toList()
        : [
            ...LeadStatus.pipeline.where((s) => s.isOpen && s != lead.status),
            LeadStatus.lost,
          ];
    final res = await pickOne<LeadStatus>(
      context,
      title: reopen ? 'Reopen lead as' : 'Move to stage',
      options: [for (final s in options) PickerOption(s, s.label)],
    );
    final target = res?.picked;
    if (target == null || !context.mounted) return;
    LeadLostReason? reason;
    String? note;
    if (target == LeadStatus.lost) {
      final r = await _askLostReason(context);
      if (r == null || !context.mounted) return;
      reason = r.reason;
      note = r.note;
    }
    final err = await cubit.changeStatus(
      target,
      lostReason: reason,
      lostNote: note,
    );
    if (context.mounted) {
      _toast(context, err ?? 'Moved to ${target.label}');
    }
  }

  Future<({LeadLostReason reason, String? note})?> _askLostReason(
    BuildContext context,
  ) {
    return showModalBottomSheet<({LeadLostReason reason, String? note})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => const _LostSheet(),
    );
  }

  Future<void> _assign(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    try {
      final list = await getIt<LeadRepository>().assignees();
      if (!context.mounted) return;
      final res = await pickOne<LeadAssignee>(
        context,
        title: 'Assign to',
        options: [
          const PickerOption<LeadAssignee>(null, 'Unassigned'),
          for (final a in list) PickerOption(a, a.name, sub: a.role),
        ],
      );
      if (res == null || !context.mounted) return;
      final err = await cubit.assign(res.picked?.id);
      if (context.mounted) _toast(context, err ?? 'Assignment updated');
    } on ApiException catch (e) {
      if (context.mounted) _toast(context, e.message);
    }
  }

  Future<void> _delete(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: const Text('Delete lead?'),
        content: Text(
          '${lead.name} and their activity history will be removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final err = await cubit.delete();
    if (!context.mounted) return;
    if (err == null) {
      _toast(context, 'Lead deleted');
      context.pop();
    } else {
      _toast(context, err);
    }
  }

  Future<void> _edit(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final saved = await context.push<Lead>(
      AppRoutes.leadForm,
      extra: LeadFormArgs(lead: lead),
    );
    if (saved != null) await cubit.load();
  }

  Future<void> _convert(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final member = await showModalBottomSheet<ConvertedMember>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: AppColors.surface,
      builder: (_) => LeadConvertSheet(lead: lead, onSubmit: cubit.convert),
    );
    if (member == null || !context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: const Text('Member created'),
        content: Text(
          '${member.name}${member.memberId.isEmpty ? '' : ' (${member.memberId})'} '
          'is now a member.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Done'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.push(AppRoutes.memberDetail, extra: member.id);
            },
            child: const Text('Open member'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<LeadDetailCubit, LeadDetailState>(
      builder: (context, state) {
        final lead = state is LeadDetailLoaded ? state.lead : null;
        final busy = state is LeadDetailLoaded && state.busy;
        final canDelete = leadsCan(context, 'leads:delete');
        final canAssign = leadsCan(context, 'leads:assign');
        final canUpdate = leadsCan(context, 'leads:update');
        final canConvert = leadsCan(context, 'leads:convert');
        return Scaffold(
          backgroundColor: AppColors.bg,
          appBar: AppBar(
            backgroundColor: AppColors.bg,
            elevation: 0,
            title: Text(lead?.name ?? 'Lead'),
            actions: [
              if (lead != null &&
                  canUpdate &&
                  lead.status != LeadStatus.converted)
                IconButton(
                  tooltip: 'Edit lead',
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: busy ? null : () => _edit(context, lead),
                ),
              if (lead != null && (canAssign || canDelete))
                PopupMenuButton<String>(
                  tooltip: 'More',
                  color: AppColors.surface2,
                  onSelected: (v) => v == 'assign'
                      ? _assign(context, lead)
                      : _delete(context, lead),
                  itemBuilder: (_) => [
                    if (canAssign)
                      const PopupMenuItem(
                        value: 'assign',
                        child: Text('Assign'),
                      ),
                    if (canDelete)
                      const PopupMenuItem(
                        value: 'delete',
                        child: Text(
                          'Delete lead',
                          style: TextStyle(color: AppColors.danger),
                        ),
                      ),
                  ],
                ),
            ],
          ),
          body: switch (state) {
            LeadDetailLoading() => const AppLoadingView(),
            LeadDetailError(:final message) => AppErrorView(
                message: message,
                onRetry: () => context.read<LeadDetailCubit>().load(),
              ),
            LeadDetailLoaded(:final lead) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () => context.read<LeadDetailCubit>().load(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
                  children: [
                    _Header(lead: lead),
                    const SizedBox(height: 12),
                    _Stepper(lead: lead),
                    const SizedBox(height: 12),
                    _Actions(
                      lead: lead,
                      busy: busy,
                      canUpdate: canUpdate,
                      canConvert: canConvert,
                      canAssign: canAssign,
                      onStage: () => _stage(context, lead),
                      onReopen: () => _stage(context, lead, reopen: true),
                      onConvert: () => _convert(context, lead),
                      onAssign: () => _assign(context, lead),
                    ),
                    if (canUpdate) ...[
                      const SizedBox(height: 14),
                      _Composer(lead: lead, busy: busy),
                    ],
                    const SizedBox(height: 18),
                    Text('ACTIVITY', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    if (lead.activities.isEmpty)
                      Text(
                        'No activity yet.',
                        style:
                            AppText.body(size: 13, color: AppColors.inkFaint),
                      )
                    else
                      for (final a in lead.activities) _ActivityTile(a),
                  ],
                ),
              ),
          },
        );
      },
    );
  }
}

BoxDecoration _card() => BoxDecoration(
      color: AppColors.surface2,
      borderRadius: BorderRadius.circular(AppRadii.card),
      border: Border.all(color: AppColors.line),
    );

class _Header extends StatelessWidget {
  const _Header({required this.lead});

  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final member = lead.convertedMember;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(lead.name, style: AppText.display(size: 20)),
              ),
              LeadStatusPill(lead.status),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  lead.phone,
                  style: AppText.body(size: 14, weight: FontWeight.w700),
                ),
              ),
              if (lead.phone.isNotEmpty) ...[
                LeadIconAction(
                  icon: Icons.call_rounded,
                  tooltip: 'Call',
                  color: AppColors.success,
                  onTap: () => leadCall(context, lead.phone),
                ),
                const SizedBox(width: 8),
                LeadIconAction(
                  icon: Icons.chat_rounded,
                  tooltip: 'WhatsApp',
                  color: AppColors.success,
                  onTap: () => leadWhatsApp(context, lead.phone),
                ),
              ],
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              LeadMetaChip(
                Icons.campaign_outlined,
                lead.sourceDetail == null || lead.sourceDetail!.isEmpty
                    ? lead.source.label
                    : '${lead.source.label} · ${lead.sourceDetail}',
              ),
              LeadMetaChip(
                Icons.person_outline_rounded,
                lead.assignedTo?.name ?? 'Unassigned',
              ),
              if (leadAgeText(lead).isNotEmpty)
                LeadMetaChip(Icons.schedule_rounded, leadAgeText(lead)),
              if (lead.branch != null)
                LeadMetaChip(Icons.storefront_outlined, lead.branch!.name),
              if (lead.interestedPlan != null)
                LeadMetaChip(
                  Icons.card_membership_outlined,
                  lead.interestedPlan!.name,
                ),
              if (lead.email != null && lead.email!.isNotEmpty)
                LeadMetaChip(Icons.mail_outline_rounded, lead.email!),
              if (lead.expectedJoinDate != null)
                LeadMetaChip(
                  Icons.event_outlined,
                  'Joins ${fmtDay(lead.expectedJoinDate)}',
                ),
            ],
          ),
          if (lead.isOpen && lead.nextFollowUpAt != null) ...[
            const SizedBox(height: 10),
            FollowUpBadge(lead),
          ],
          if (lead.interest != null && lead.interest!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Goal: ${lead.interest}',
              style: AppText.body(size: 13, color: AppColors.inkSoft),
            ),
          ],
          if (lead.notes != null && lead.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              lead.notes!,
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            ),
          ],
          if (lead.status == LeadStatus.lost) ...[
            const SizedBox(height: 10),
            Text(
              'Lost: ${lead.lostReason == null ? 'no reason recorded' : LeadLostReason.labelOf(lead.lostReason!)}'
              '${lead.lostNote == null || lead.lostNote!.isEmpty ? '' : ' — ${lead.lostNote}'}',
              style: AppText.body(
                size: 13,
                color: AppColors.danger,
                weight: FontWeight.w600,
              ),
            ),
          ],
          if (lead.status == LeadStatus.converted) ...[
            const SizedBox(height: 10),
            if (member != null)
              Material(
                color: AppColors.successSoft,
                borderRadius: BorderRadius.circular(AppRadii.field),
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  onTap: () =>
                      context.push(AppRoutes.memberDetail, extra: member.id),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.verified_rounded,
                          color: AppColors.success,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Member ${member.name}'
                            '${member.memberId.isEmpty ? '' : ' · ${member.memberId}'}',
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w700,
                              color: AppColors.success,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: AppColors.success,
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              Text(
                'Converted${lead.convertedAt == null ? '' : ' on ${fmtDay(lead.convertedAt)}'}'
                ' — no linked member record.',
                style: AppText.body(size: 13, color: AppColors.success),
              ),
          ],
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.lead});

  final Lead lead;

  @override
  Widget build(BuildContext context) {
    final steps = LeadStatus.pipeline;
    final idx =
        lead.status == LeadStatus.lost ? -1 : steps.indexOf(lead.status);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: _card(),
      child: SizedBox(
        height: 68,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: steps.length,
          separatorBuilder: (_, __) => Container(
            width: 14,
            height: 2,
            margin: const EdgeInsets.only(top: 13),
            color: AppColors.line,
          ),
          itemBuilder: (_, i) {
            final done = idx >= 0 && i <= idx;
            final current = i == idx;
            final c = lead.status == LeadStatus.lost
                ? AppColors.inkFaint
                : leadStatusColor(steps[i]);
            return SizedBox(
              width: 66,
              child: Column(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: done ? c : Colors.transparent,
                      border: Border.all(
                        color: done || current ? c : AppColors.line,
                        width: 2,
                      ),
                    ),
                    child: done
                        ? const Icon(
                            Icons.check_rounded,
                            size: 16,
                            color: Colors.white,
                          )
                        : null,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    steps[i].label,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 10,
                      weight: current ? FontWeight.w800 : FontWeight.w600,
                      color: current ? AppColors.ink : AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({
    required this.lead,
    required this.busy,
    required this.canUpdate,
    required this.canConvert,
    required this.canAssign,
    required this.onStage,
    required this.onReopen,
    required this.onConvert,
    required this.onAssign,
  });

  final Lead lead;
  final bool busy;
  final bool canUpdate;
  final bool canConvert;
  final bool canAssign;
  final VoidCallback onStage;
  final VoidCallback onReopen;
  final VoidCallback onConvert;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    final buttons = <Widget>[
      if (canUpdate && lead.isOpen)
        AppButton(
          label: 'Change stage',
          icon: Icons.swap_horiz_rounded,
          variant: AppButtonVariant.ghost,
          fullWidth: false,
          loading: false,
          onPressed: busy ? null : onStage,
        ),
      if (canUpdate && lead.status == LeadStatus.lost)
        AppButton(
          label: 'Reopen',
          icon: Icons.restart_alt_rounded,
          variant: AppButtonVariant.ghost,
          fullWidth: false,
          onPressed: busy ? null : onReopen,
        ),
      if (canConvert && lead.status != LeadStatus.converted)
        AppButton(
          label: 'Convert to member',
          icon: Icons.how_to_reg_rounded,
          fullWidth: false,
          onPressed: busy ? null : onConvert,
        ),
      if (canAssign && lead.status != LeadStatus.converted)
        AppButton(
          label: 'Assign',
          icon: Icons.person_add_alt_rounded,
          variant: AppButtonVariant.ghost,
          fullWidth: false,
          onPressed: busy ? null : onAssign,
        ),
    ];
    if (buttons.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 8, children: buttons);
  }
}

class _Composer extends StatefulWidget {
  const _Composer({required this.lead, required this.busy});

  final Lead lead;
  final bool busy;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final _note = TextEditingController();
  LeadActivityType _type = LeadActivityType.call;
  DateTime? _next;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _log() async {
    final note = _note.text.trim();
    if (_type == LeadActivityType.note && note.isEmpty) {
      setState(() => _error = 'A note needs some text');
      return;
    }
    if (_type == LeadActivityType.followUp && _next == null) {
      setState(() => _error = 'Pick the follow-up date and time');
      return;
    }
    setState(() => _error = null);
    final err = await context.read<LeadDetailCubit>().addActivity(
          _type,
          note: note,
          nextFollowUpAt: _next,
        );
    if (!mounted) return;
    if (err != null) {
      setState(() => _error = err);
    } else {
      setState(() {
        _note.clear();
        _next = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = widget.lead.isOpen;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: _card(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('LOG ACTIVITY', style: AppText.eyebrow()),
          const SizedBox(height: 10),
          CategoryChipSelector<LeadActivityType>(
            options: LeadActivityType.manual,
            labelOf: (t) => t.label,
            value: _type,
            onChanged: (t) => setState(() => _type = t),
          ),
          const SizedBox(height: 12),
          AppLabeledField(
            label: _type == LeadActivityType.note ? 'Note' : 'Note (optional)',
            controller: _note,
            minLines: 2,
            maxLines: 4,
            errorText: _error,
          ),
          if (open) ...[
            const SizedBox(height: 12),
            LeadPickerField(
              label: _type == LeadActivityType.followUp
                  ? 'Follow-up at'
                  : 'Next follow-up (optional)',
              value: _next == null ? null : fmtWhen(_next),
              onTap: () async {
                final d = await pickDateTime(context, initial: _next);
                if (d != null) setState(() => _next = d);
              },
              onClear: () => setState(() => _next = null),
            ),
          ],
          const SizedBox(height: 14),
          AppButton(
            label: 'Log activity',
            loading: widget.busy,
            onPressed: widget.busy ? null : _log,
          ),
        ],
      ),
    );
  }
}

IconData _activityIcon(LeadActivityType? t) => switch (t) {
      LeadActivityType.call => Icons.call_rounded,
      LeadActivityType.whatsapp => Icons.chat_rounded,
      LeadActivityType.email => Icons.mail_outline_rounded,
      LeadActivityType.visit => Icons.directions_walk_rounded,
      LeadActivityType.trial => Icons.fitness_center_rounded,
      LeadActivityType.followUp => Icons.event_repeat_rounded,
      LeadActivityType.note => Icons.sticky_note_2_outlined,
      LeadActivityType.statusChange => Icons.swap_horiz_rounded,
      LeadActivityType.assignment => Icons.person_add_alt_rounded,
      LeadActivityType.created => Icons.add_circle_outline_rounded,
      LeadActivityType.converted => Icons.verified_rounded,
      null => Icons.circle_outlined,
    };

class _ActivityTile extends StatelessWidget {
  const _ActivityTile(this.a);

  final LeadActivity a;

  String get _title {
    if (a.type == LeadActivityType.statusChange) {
      final from = a.fromStatus == null
          ? ''
          : '${LeadStatus.parse(a.fromStatus).label} → ';
      return 'Stage: $from${LeadStatus.parse(a.toStatus).label}';
    }
    return a.type?.label ?? a.rawType;
  }

  @override
  Widget build(BuildContext context) {
    final system = a.isSystem;
    final who = a.createdBy?.name;
    final meta = [
      if (who != null && who.isNotEmpty) who,
      if (a.createdAt != null) fmtWhen(a.createdAt),
    ].join(' · ');
    // System events: compact, muted, no card. Manual: full card.
    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _title,
          style: AppText.body(
            size: system ? 12.5 : 13.5,
            weight: system ? FontWeight.w600 : FontWeight.w800,
            color: system ? AppColors.inkSoft : AppColors.ink,
          ),
        ),
        if (a.note != null && a.note!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              a.note!,
              style: AppText.body(size: 13, color: AppColors.inkSoft),
            ),
          ),
        if (a.scheduledFor != null)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              'Scheduled ${fmtWhen(a.scheduledFor)}',
              style: AppText.body(size: 12, color: AppColors.warning),
            ),
          ),
        if (meta.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              meta,
              style: AppText.body(size: 11, color: AppColors.inkFaint),
            ),
          ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: EdgeInsets.all(system ? 8 : 12),
        decoration: system
            ? BoxDecoration(
                border: Border(
                  left: BorderSide(
                    color: AppColors.line.withValues(alpha: 0.9),
                    width: 2,
                  ),
                ),
              )
            : _card(),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              _activityIcon(a.type),
              size: system ? 16 : 20,
              color: system ? AppColors.inkFaint : AppColors.staffB,
            ),
            const SizedBox(width: 10),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

class _LostSheet extends StatefulWidget {
  const _LostSheet();

  @override
  State<_LostSheet> createState() => _LostSheetState();
}

class _LostSheetState extends State<_LostSheet> {
  LeadLostReason? _reason;
  final _note = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
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
              Text('Why was this lead lost?', style: AppText.display(size: 18)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final r in LeadLostReason.values)
                    ChoiceChip(
                      label: Text(r.label),
                      selected: _reason == r,
                      showCheckmark: false,
                      onSelected: (_) => setState(() {
                        _reason = r;
                        _error = null;
                      }),
                      backgroundColor: AppColors.surface2,
                      selectedColor: AppColors.dangerSoft,
                      side: BorderSide(
                        color: _reason == r ? AppColors.danger : AppColors.line,
                      ),
                      labelStyle: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color:
                            _reason == r ? AppColors.danger : AppColors.inkSoft,
                      ),
                    ),
                ],
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    _error!,
                    style: AppText.body(size: 12, color: AppColors.danger),
                  ),
                ),
              const SizedBox(height: 12),
              AppLabeledField(
                label: 'Note (optional)',
                controller: _note,
                minLines: 1,
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              AppButton(
                label: 'Mark as lost',
                onPressed: () {
                  if (_reason == null) {
                    setState(() => _error = 'Pick a reason');
                    return;
                  }
                  final n = _note.text.trim();
                  Navigator.of(context).pop(
                    (reason: _reason!, note: n.isEmpty ? null : n),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
