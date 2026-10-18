import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import 'lead_actions.dart';
import 'lead_form_screen.dart';
import 'lead_ui.dart';
import 'widgets/lead_convert_sheet.dart';
import 'widgets/lead_widgets.dart';

/// Lead detail — `GET /leads/:id` (+ activities newest-first,
/// `convertedMember`). Gradient hero (spinning-ring avatar, status / source /
/// branch pills, call / WhatsApp / edit, Convert CTA), summary tiles, an
/// animated pipeline stepper with the stage actions, then two tabs:
/// **Activity** (composer + timeline) and **Details** (contact, interest &
/// plan, source, notes, conversion / lost, key dates — every field web's
/// side panels show). Every action is permission-gated through [leadsCan]:
/// Edit/Stage/Reopen/Log = `leads:update`, Convert = `leads:convert`,
/// Assign = `leads:assign`, Delete = `leads:delete` (a receptionist sees
/// none of the last two).
///
/// CONVERTED is reachable only through Convert (the API 422s a status
/// change to it); a CONVERTED lead is terminal here — only the timeline and
/// the member link remain. The 6 demo CONVERTED leads have no member, so the
/// member link is optional.
///
/// Dropped vs web: nothing — web's "Reopen" (always back to New) is covered
/// by the stage picker (any open stage); web has no restore for deleted
/// leads and neither does the API.
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

class _DetailView extends StatefulWidget {
  const _DetailView();

  @override
  State<_DetailView> createState() => _DetailViewState();
}

class _DetailViewState extends State<_DetailView> {
  int _tab = 0;

  Future<void> _stage(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    await pickAndChangeStage(
      context,
      lead,
      (status, reason, note) => cubit.changeStatus(
        status,
        lostReason: reason,
        lostNote: note,
      ),
    );
  }

  Future<void> _markLost(BuildContext context) async {
    final cubit = context.read<LeadDetailCubit>();
    final r = await showLeadSheet<({LeadLostReason reason, String? note})>(
      context,
      (_) => const LeadLostSheet(),
    );
    if (r == null || !context.mounted) return;
    final err = await cubit.changeStatus(
      LeadStatus.lost,
      lostReason: r.reason,
      lostNote: r.note,
    );
    if (context.mounted) {
      leadToast(context, err ?? 'Marked as lost', error: err != null);
    }
  }

  Future<void> _reschedule(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final when =
        await pickDateTime(context, initial: lead.nextFollowUpAt?.toLocal());
    if (when == null || !context.mounted) return;
    final err = await cubit.addActivity(
      LeadActivityType.followUp,
      note: 'Follow-up rescheduled',
      nextFollowUpAt: when,
    );
    if (context.mounted) {
      leadToast(
        context,
        err ?? 'Follow-up set for ${fmtWhen(when)}',
        error: err != null,
      );
    }
  }

  Future<void> _assign(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    try {
      final list = await getIt<LeadRepository>().assignees();
      if (!context.mounted) return;
      final res = await pickOne<LeadAssignee>(
        context,
        title: 'Assign to',
        icon: Icons.person_add_alt_rounded,
        options: [
          const PickerOption<LeadAssignee>(null, 'Unassigned'),
          for (final a in list) PickerOption(a, a.name, sub: a.role),
        ],
      );
      if (res == null || !context.mounted) return;
      final err = await cubit.assign(res.picked?.id);
      if (context.mounted) {
        leadToast(context, err ?? 'Assignment updated', error: err != null);
      }
    } on ApiException catch (e) {
      if (context.mounted) leadToast(context, e.message, error: true);
    } on Object {
      if (context.mounted) {
        leadToast(context, 'Could not load staff', error: true);
      }
    }
  }

  Future<void> _delete(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        icon: Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: LeadColors.rose.withValues(alpha: 0.16),
          ),
          child: const Icon(
            Icons.delete_forever_rounded,
            color: LeadColors.rose,
            size: 26,
          ),
        ),
        title: const Text('Delete lead?'),
        content: Text(
          '${lead.name} and their activity history will be removed from the '
          'pipeline and reports.',
          textAlign: TextAlign.center,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep lead'),
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
      leadToast(context, 'Lead deleted');
      context.pop();
    } else {
      leadToast(context, err, error: true);
    }
  }

  Future<void> _edit(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final saved = await context.push<Lead>(
      AppRoutes.leadForm,
      extra: LeadFormArgs(lead: lead),
    );
    if (saved != null) await cubit.refresh();
  }

  Future<void> _convert(BuildContext context, Lead lead) async {
    final cubit = context.read<LeadDetailCubit>();
    final member = await showLeadSheet<ConvertedMember>(
      context,
      (_) => LeadConvertSheet(lead: lead, onSubmit: cubit.convert),
    );
    if (member == null || !context.mounted) return;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        icon: PopIn(
          index: 0,
          child: Container(
            width: 60,
            height: 60,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [LeadColors.green, LeadColors.teal],
              ),
            ),
            child: const Icon(
              Icons.verified_rounded,
              color: Colors.white,
              size: 30,
            ),
          ),
        ),
        title: const Text('Member created'),
        content: Text(
          '${member.name}${member.memberId.isEmpty ? '' : ' (${member.memberId})'} '
          'is now a member.',
          textAlign: TextAlign.center,
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
        final hero = lead != null;
        final top = MediaQuery.of(context).padding.top + kToolbarHeight - 8;
        return Scaffold(
          backgroundColor: AppColors.bg,
          extendBodyBehindAppBar: hero,
          appBar: AppBar(
            backgroundColor: hero ? Colors.transparent : AppColors.bg,
            foregroundColor: hero ? Colors.white : null,
            elevation: 0,
            scrolledUnderElevation: 0,
            title: Text(
              'Lead',
              style: AppText.display(
                size: 18,
                color: hero ? Colors.white : null,
              ),
            ),
            actions: [
              if (lead != null && (canAssign || canDelete))
                PopupMenuButton<String>(
                  tooltip: 'More',
                  color: AppColors.surface2,
                  icon:
                      const Icon(Icons.more_vert_rounded, color: Colors.white),
                  onSelected: (v) => v == 'assign'
                      ? _assign(context, lead)
                      : _delete(context, lead),
                  itemBuilder: (_) => [
                    if (canAssign && lead.status != LeadStatus.converted)
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
                edgeOffset: top,
                onRefresh: () => context.read<LeadDetailCubit>().refresh(),
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 40),
                  children: [
                    _Hero(
                      lead: lead,
                      topInset: top,
                      canEdit: canUpdate && lead.status != LeadStatus.converted,
                      canConvert:
                          canConvert && lead.status != LeadStatus.converted,
                      busy: busy,
                      onEdit: () => _edit(context, lead),
                      onConvert: () => _convert(context, lead),
                    ),
                    const SizedBox(height: 14),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: _SummaryTiles(
                        lead: lead,
                        onFollowUp: canUpdate && lead.isOpen && !busy
                            ? () => _reschedule(context, lead)
                            : null,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: FadeUp(
                        index: 2,
                        child: _PipelinePanel(
                          lead: lead,
                          busy: busy,
                          canUpdate: canUpdate,
                          canAssign: canAssign,
                          onStage: () => _stage(context, lead),
                          onLost: () => _markLost(context),
                          onAssign: () => _assign(context, lead),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    LeadTabBar(
                      tabs: const ['Activity', 'Details'],
                      selected: _tab,
                      onSelected: (i) => setState(() => _tab = i),
                    ),
                    const SizedBox(height: 14),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Column(
                        key: ValueKey(_tab),
                        children: _tab == 0
                            ? [
                                if (canUpdate) ...[
                                  FadeUp(
                                    index: 0,
                                    child: _Composer(lead: lead, busy: busy),
                                  ),
                                  const SizedBox(height: 14),
                                ],
                                FadeUp(
                                  index: 1,
                                  child: _Timeline(lead.activities),
                                ),
                              ]
                            : _detailPanels(context, lead),
                      ),
                    ),
                  ],
                ),
              ),
          },
        );
      },
    );
  }

  List<Widget> _detailPanels(BuildContext context, Lead lead) {
    final member = lead.convertedMember;
    final panels = <Widget>[
      LeadPanel(
        icon: Icons.contact_phone_rounded,
        color: LeadColors.indigo,
        title: 'Contact',
        child: LeadFieldGrid(
          tiles: [
            LeadFieldTile(
              icon: Icons.call_rounded,
              label: 'Phone',
              value: lead.phone,
              color: LeadColors.green,
              onTap: () => leadCall(context, lead.phone),
            ),
            LeadFieldTile(
              icon: Icons.mail_rounded,
              label: 'Email',
              value: lead.email,
              color: LeadColors.sky,
              onTap: lead.email == null
                  ? null
                  : () => leadEmail(context, lead.email!),
            ),
            LeadFieldTile(
              icon: Icons.wc_rounded,
              label: 'Gender',
              value: _genderLabel(lead.gender),
              color: LeadColors.fuchsia,
            ),
            LeadFieldTile(
              icon: Icons.storefront_rounded,
              label: 'Branch',
              value: lead.branch?.name,
              color: LeadColors.amber,
            ),
          ],
        ),
      ),
      LeadPanel(
        icon: Icons.track_changes_rounded,
        color: LeadColors.violet,
        title: 'Interest & plan',
        child: LeadFieldGrid(
          tiles: [
            LeadFieldTile(
              icon: Icons.card_membership_rounded,
              label: 'Interested plan',
              value: lead.interestedPlan?.name,
              color: LeadColors.violet,
            ),
            LeadFieldTile(
              icon: Icons.event_available_rounded,
              label: 'Expected join',
              value: lead.expectedJoinDate == null
                  ? null
                  : fmtDay(lead.expectedJoinDate),
              color: LeadColors.green,
            ),
            LeadFieldTile(
              icon: Icons.flag_rounded,
              label: 'Goal / interest',
              value: lead.interest,
              color: LeadColors.rose,
              maxLines: 6,
            ),
          ],
        ),
      ),
      LeadPanel(
        icon: leadSourceIcon(lead.source),
        color: leadSourceColor(lead.source),
        title: 'Source',
        child: LeadFieldGrid(
          tiles: [
            LeadFieldTile(
              icon: leadSourceIcon(lead.source),
              label: 'Channel',
              value: lead.source.label,
              color: leadSourceColor(lead.source),
            ),
            LeadFieldTile(
              icon: Icons.notes_rounded,
              label: 'Detail',
              value: lead.sourceDetail,
              color: leadSourceColor(lead.source),
              maxLines: 4,
            ),
          ],
        ),
      ),
      LeadPanel(
        icon: Icons.sticky_note_2_rounded,
        color: LeadColors.amber,
        title: 'Notes',
        child: lead.notes == null || lead.notes!.isEmpty
            ? const LeadEmptyLine('No notes.')
            : Text(
                lead.notes!,
                style: AppText.body(size: 13.5, color: AppColors.inkSoft),
              ),
      ),
      if (lead.status == LeadStatus.converted)
        LeadPanel(
          icon: Icons.verified_rounded,
          color: LeadColors.green,
          title: 'Conversion',
          child: Column(
            children: [
              LeadFieldGrid(
                tiles: [
                  LeadFieldTile(
                    icon: Icons.event_rounded,
                    label: 'Converted on',
                    value: lead.convertedAt == null
                        ? null
                        : fmtDay(lead.convertedAt),
                    color: LeadColors.green,
                  ),
                  LeadFieldTile(
                    icon: Icons.badge_rounded,
                    label: 'Member',
                    value: member == null
                        ? 'Not linked to a member record'
                        : '${member.name}'
                            '${member.memberId.isEmpty ? '' : ' (${member.memberId})'}',
                    color: LeadColors.teal,
                    onTap: member == null
                        ? null
                        : () => context.push(
                              AppRoutes.memberDetail,
                              extra: member.id,
                            ),
                  ),
                ],
              ),
            ],
          ),
        ),
      if (lead.status == LeadStatus.lost)
        LeadPanel(
          icon: Icons.cancel_rounded,
          color: LeadColors.rose,
          title: 'Lost',
          child: LeadFieldGrid(
            tiles: [
              LeadFieldTile(
                icon: Icons.flag_rounded,
                label: 'Reason',
                value: lead.lostReason == null
                    ? null
                    : LeadLostReason.labelOf(lead.lostReason!),
                color: LeadColors.rose,
              ),
              LeadFieldTile(
                icon: Icons.event_busy_rounded,
                label: 'Lost on',
                value: lead.lostAt == null ? null : fmtDay(lead.lostAt),
                color: LeadColors.rose,
              ),
              LeadFieldTile(
                icon: Icons.notes_rounded,
                label: 'Note',
                value: lead.lostNote,
                color: LeadColors.rose,
                maxLines: 6,
              ),
            ],
          ),
        ),
      LeadPanel(
        icon: Icons.calendar_month_rounded,
        color: LeadColors.indigo,
        title: 'Key dates',
        child: LeadFieldGrid(
          tiles: [
            LeadFieldTile(
              icon: Icons.alarm_rounded,
              label: 'Next follow-up',
              value: lead.nextFollowUpAt == null
                  ? null
                  : fmtWhen(lead.nextFollowUpAt),
              color: leadFollowUpColor(lead.followUpState),
            ),
            LeadFieldTile(
              icon: Icons.history_rounded,
              label: 'Last activity',
              value: lead.lastActivityAt == null
                  ? null
                  : fmtWhen(lead.lastActivityAt),
              color: LeadColors.teal,
            ),
            LeadFieldTile(
              icon: Icons.add_circle_rounded,
              label: 'Created',
              value: lead.createdAt == null
                  ? null
                  : '${fmtWhen(lead.createdAt)}'
                      '${lead.createdBy == null ? '' : ' by ${lead.createdBy!.name}'}',
              color: LeadColors.slate,
              maxLines: 3,
            ),
            LeadFieldTile(
              icon: Icons.update_rounded,
              label: 'Updated',
              value: lead.updatedAt == null ? null : fmtWhen(lead.updatedAt),
              color: LeadColors.slate,
            ),
          ],
        ),
      ),
    ];
    return [
      for (var i = 0; i < panels.length; i++) ...[
        if (i > 0) const SizedBox(height: 12),
        FadeUp(index: i, child: panels[i]),
      ],
    ];
  }

  static String? _genderLabel(String? g) {
    if (g == null) return null;
    for (final o in leadGenderOptions) {
      if (o.$1 == g) return o.$2;
    }
    return g;
  }
}

// ── hero ─────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({
    required this.lead,
    required this.topInset,
    required this.canEdit,
    required this.canConvert,
    required this.busy,
    required this.onEdit,
    required this.onConvert,
  });

  final Lead lead;
  final double topInset;
  final bool canEdit;
  final bool canConvert;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onConvert;

  @override
  Widget build(BuildContext context) {
    final color = leadStatusColor(lead.status);
    final hasPhone = lead.phone.isNotEmpty;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        const Positioned.fill(
          child: MeshHeroBackground(
            radius: BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox.expand(),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16, 8 + topInset, 16, 22),
          child: SizedBox(
            width: double.infinity,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      SpinningRing(
                        size: 104,
                        child:
                            LeadAvatar(name: lead.name, size: 96, color: color),
                      ),
                      Positioned(
                        left: 4,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: PulseDot(color: color, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    lead.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    [
                      lead.phone,
                      if (lead.email != null && lead.email!.isNotEmpty)
                        lead.email!,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      LeadStatusPill(lead.status, onDark: true),
                      LeadHeroPill(
                        lead.sourceDetail == null || lead.sourceDetail!.isEmpty
                            ? lead.source.label
                            : '${lead.source.label} · ${lead.sourceDetail}',
                        icon: leadSourceIcon(lead.source),
                      ),
                      if (lead.branch != null)
                        LeadHeroPill(
                          lead.branch!.name,
                          icon: Icons.place_outlined,
                        ),
                      LeadHeroPill(
                        lead.assignedTo?.name ?? 'Unassigned',
                        icon: Icons.person_rounded,
                      ),
                      if (lead.isOpen && lead.nextFollowUpAt != null)
                        FollowUpBadge(lead, onDark: true),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                FadeUp(
                  index: 4,
                  child: Row(
                    children: [
                      if (hasPhone)
                        Expanded(
                          child: LeadHeroAction(
                            label: 'Call',
                            icon: Icons.call_rounded,
                            onTap: () => leadCall(context, lead.phone),
                          ),
                        ),
                      if (hasPhone) const SizedBox(width: 8),
                      if (hasPhone)
                        Expanded(
                          child: LeadHeroAction(
                            label: 'WhatsApp',
                            icon: Icons.chat_rounded,
                            onTap: () => leadWhatsApp(context, lead.phone),
                          ),
                        ),
                      if (hasPhone && canEdit) const SizedBox(width: 8),
                      if (canEdit)
                        Expanded(
                          child: LeadHeroAction(
                            label: 'Edit',
                            icon: Icons.edit_rounded,
                            onTap: busy ? null : onEdit,
                          ),
                        ),
                    ],
                  ),
                ),
                if (canConvert) ...[
                  const SizedBox(height: 10),
                  FadeUp(
                    index: 5,
                    child: ShimmerButton(
                      colors: const [
                        LeadColors.green,
                        LeadColors.teal,
                      ],
                      onTap: busy ? null : onConvert,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      child: Row(
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
                              size: 14.5,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── summary tiles ────────────────────────────────────────────────────────

class _SummaryTiles extends StatelessWidget {
  const _SummaryTiles({required this.lead, required this.onFollowUp});

  final Lead lead;
  final VoidCallback? onFollowUp;

  @override
  Widget build(BuildContext context) {
    final age = lead.ageDays();
    final manual = lead.activities.where((a) => !a.isSystem).length;
    final fuColor = leadFollowUpColor(lead.followUpState);
    final fuText = !lead.isOpen
        ? 'Closed'
        : lead.nextFollowUpAt == null
            ? 'None set'
            : switch (lead.followUpState) {
                'overdue' => 'Overdue',
                'today' => 'Today',
                _ => fmtWhen(lead.nextFollowUpAt),
              };
    return Row(
      children: [
        Expanded(
          child: FadeUp(
            index: 0,
            child: _Tile(
              icon: Icons.hourglass_bottom_rounded,
              color: LeadColors.indigo,
              label: 'Days as lead',
              value: age == null
                  ? const Text('–')
                  : CountUp(
                      value: age,
                      style:
                          AppText.display(size: 22, color: LeadColors.indigo),
                    ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FadeUp(
            index: 1,
            child: _Tile(
              icon: Icons.forum_rounded,
              color: LeadColors.teal,
              label: 'Touchpoints',
              value: CountUp(
                value: manual,
                style: AppText.display(size: 22, color: LeadColors.teal),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FadeUp(
            index: 2,
            child: _Tile(
              icon: Icons.alarm_rounded,
              color: fuColor,
              label: onFollowUp == null ? 'Follow-up' : 'Follow-up · tap',
              onTap: onFollowUp,
              value: Text(
                fuText,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 15, color: fuColor),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final Widget value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          height: 84,
          padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color.withValues(alpha: 0.16), Colors.transparent],
            ),
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: 0.24)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 16, color: color),
              const Spacer(),
              value,
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 10,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── pipeline ─────────────────────────────────────────────────────────────

/// Highest open-pipeline index this lead ever reached (from the timeline),
/// so a LOST lead still shows how far it got.
int _reachedIndex(Lead lead) {
  var idx = 0;
  for (final a in lead.activities) {
    for (final st in [a.toStatus, a.fromStatus]) {
      if (st == null) continue;
      final i = LeadStatus.pipeline.indexOf(LeadStatus.parse(st));
      if (i > idx) idx = i;
    }
  }
  return idx;
}

class _PipelinePanel extends StatelessWidget {
  const _PipelinePanel({
    required this.lead,
    required this.busy,
    required this.canUpdate,
    required this.canAssign,
    required this.onStage,
    required this.onLost,
    required this.onAssign,
  });

  final Lead lead;
  final bool busy;
  final bool canUpdate;
  final bool canAssign;
  final VoidCallback onStage;
  final VoidCallback onLost;
  final VoidCallback onAssign;

  @override
  Widget build(BuildContext context) {
    final steps = LeadStatus.pipeline;
    final lost = lead.status == LeadStatus.lost;
    final cur = lost ? _reachedIndex(lead) : steps.indexOf(lead.status);
    final color = leadStatusColor(lead.status);
    final subtitle = lost
        ? 'Lost — reopen to continue'
        : lead.status == LeadStatus.converted
            ? 'Joined as a member'
            : 'Where this lead is in the funnel';
    final member = lead.convertedMember;
    final buttons = <Widget>[
      if (canUpdate && lead.isOpen)
        _PillButton(
          label: 'Move stage',
          icon: Icons.swap_horiz_rounded,
          color: LeadColors.indigo,
          onTap: busy ? null : onStage,
        ),
      if (canUpdate && lead.isOpen)
        _PillButton(
          label: 'Mark lost',
          icon: Icons.cancel_rounded,
          color: LeadColors.rose,
          onTap: busy ? null : onLost,
        ),
      if (canUpdate && lost)
        _PillButton(
          label: 'Reopen',
          icon: Icons.restart_alt_rounded,
          color: LeadColors.teal,
          onTap: busy ? null : onStage,
        ),
      if (canAssign && lead.status != LeadStatus.converted)
        _PillButton(
          label: 'Assign',
          icon: Icons.person_add_alt_rounded,
          color: LeadColors.violet,
          onTap: busy ? null : onAssign,
        ),
    ];
    return LeadPanel(
      icon: leadStatusIcon(lead.status),
      color: color,
      title: 'Pipeline progress',
      subtitle: subtitle,
      badge: lead.status.label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, c) {
              final w = c.maxWidth / steps.length;
              return SizedBox(
                height: 64,
                child: Stack(
                  children: [
                    for (var i = 0; i < steps.length - 1; i++)
                      Positioned(
                        top: 14,
                        left: w * i + w / 2 + 14,
                        width: w - 28,
                        child: Container(
                          height: 3,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            color: i < cur
                                ? (lost
                                    ? LeadColors.slate
                                    : leadStatusColor(steps[i + 1]))
                                : AppColors.line,
                          ),
                        ),
                      ),
                    for (var i = 0; i < steps.length; i++)
                      Positioned(
                        left: w * i,
                        width: w,
                        top: 0,
                        child: PopIn(
                          index: i,
                          child: _StepNode(
                            status: steps[i],
                            done: i <= cur,
                            current: !lost && i == cur,
                            muted: lost,
                          ),
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
          if (lost && lead.lostReason != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Lost: ${LeadLostReason.labelOf(lead.lostReason!)}'
                '${lead.lostNote == null || lead.lostNote!.isEmpty ? '' : ' — ${lead.lostNote}'}',
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: LeadColors.rose,
                ),
              ),
            ),
          if (lead.status == LeadStatus.converted) ...[
            const SizedBox(height: 4),
            if (member != null)
              Material(
                color: LeadColors.green.withValues(alpha: 0.12),
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
                          color: LeadColors.green,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Member ${member.name}'
                            '${member.memberId.isEmpty ? '' : ' · ${member.memberId}'}',
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w800,
                              color: LeadColors.green,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: LeadColors.green,
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
                style: AppText.body(size: 13, color: LeadColors.green),
              ),
          ],
          if (buttons.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 8, children: buttons),
          ],
        ],
      ),
    );
  }
}

class _StepNode extends StatelessWidget {
  const _StepNode({
    required this.status,
    required this.done,
    required this.current,
    required this.muted,
  });

  final LeadStatus status;
  final bool done;
  final bool current;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final c = muted ? LeadColors.slate : leadStatusColor(status);
    return Column(
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: done
                ? LinearGradient(
                    colors: [c, Color.lerp(c, LeadColors.fuchsia, 0.4)!],
                  )
                : null,
            color: done ? null : AppColors.surface2,
            border: Border.all(
              color: done || current ? c : AppColors.line,
              width: 2,
            ),
            boxShadow: current
                ? [
                    BoxShadow(
                      color: c.withValues(alpha: 0.5),
                      blurRadius: 12,
                      spreadRadius: 1,
                    ),
                  ]
                : null,
          ),
          child: Icon(
            done ? leadStatusIcon(status) : Icons.circle_outlined,
            size: done ? 15 : 10,
            color: done ? Colors.white : AppColors.inkFaint,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          status.label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: AppText.body(
            size: 9.5,
            weight: current ? FontWeight.w800 : FontWeight.w600,
            color: current ? AppColors.ink : AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}

class _PillButton extends StatelessWidget {
  const _PillButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.5 : 1,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: color.withValues(alpha: 0.45)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── composer ─────────────────────────────────────────────────────────────

class _Composer extends StatefulWidget {
  const _Composer({required this.lead, required this.busy});

  final Lead lead;
  final bool busy;

  @override
  State<_Composer> createState() => _ComposerState();
}

class _ComposerState extends State<_Composer> {
  final _note = TextEditingController();
  final _outcome = TextEditingController();
  LeadActivityType _type = LeadActivityType.call;
  DateTime? _next;
  String? _error;

  @override
  void dispose() {
    _note.dispose();
    _outcome.dispose();
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
    final label = _type.label;
    final err = await context.read<LeadDetailCubit>().addActivity(
          _type,
          note: note,
          outcome: _outcome.text.trim(),
          nextFollowUpAt: _next,
        );
    if (!mounted) return;
    if (err != null) {
      setState(() => _error = err);
    } else {
      leadToast(context, '$label logged');
      setState(() {
        _note.clear();
        _outcome.clear();
        _next = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final open = widget.lead.isOpen;
    return LeadPanel(
      icon: Icons.add_comment_rounded,
      color: LeadColors.violet,
      title: 'Log activity',
      subtitle: 'Calls, visits, notes and follow-ups',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LeadChipGroup<LeadActivityType>(
            label: 'TYPE',
            icon: Icons.category_rounded,
            color: LeadColors.violet,
            options: [
              for (final t in LeadActivityType.manual)
                if (open || t != LeadActivityType.followUp) t,
            ],
            value: _type,
            labelOf: (t) => t.label,
            iconOf: leadActivityIcon,
            colorOf: leadActivityColor,
            onChanged: (t) => setState(() => _type = t ?? _type),
          ),
          const SizedBox(height: 12),
          AppLabeledField(
            label: _type == LeadActivityType.note ? 'Note' : 'Note (optional)',
            controller: _note,
            icon: Icons.sticky_note_2_rounded,
            iconColor: leadActivityColor(_type),
            hintText: _type == LeadActivityType.note
                ? 'Write a note…'
                : 'What was discussed?',
            minLines: 2,
            maxLines: 4,
            errorText: _error,
          ),
          const SizedBox(height: 12),
          AppLabeledField(
            label: 'Outcome (optional)',
            controller: _outcome,
            icon: Icons.fact_check_rounded,
            iconColor: LeadColors.green,
            hintText: 'Interested, call back…',
            inputFormatters: [LengthLimitingTextInputFormatter(120)],
          ),
          if (open) ...[
            const SizedBox(height: 12),
            LeadValueField(
              label: _type == LeadActivityType.followUp
                  ? 'Follow-up at'
                  : 'Next follow-up (optional)',
              icon: Icons.alarm_rounded,
              color: LeadColors.amber,
              text: _next == null ? null : fmtWhen(_next),
              hint: 'Pick date & time',
              trailingIcon: Icons.calendar_month_rounded,
              onTap: () async {
                final d = await pickDateTime(context, initial: _next);
                if (d != null) setState(() => _next = d);
              },
              onClear: () => setState(() => _next = null),
            ),
          ],
          const SizedBox(height: 14),
          ShimmerButton(
            colors: const [
              LeadColors.indigo,
              LeadColors.violet,
              LeadColors.fuchsia,
            ],
            onTap: widget.busy ? null : _log,
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: widget.busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    'Log activity',
                    style: AppText.body(
                      size: 14.5,
                      weight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

// ── timeline ─────────────────────────────────────────────────────────────

class _Timeline extends StatelessWidget {
  const _Timeline(this.activities);

  final List<LeadActivity> activities;

  @override
  Widget build(BuildContext context) {
    return LeadPanel(
      icon: Icons.history_rounded,
      color: LeadColors.indigo,
      title: 'Activity',
      badge: '${activities.length} events',
      child: activities.isEmpty
          ? const LeadEmptyLine('No activity yet.')
          : Column(
              children: [
                for (var i = 0; i < activities.length; i++)
                  _ActivityTile(
                    activities[i],
                    last: i == activities.length - 1,
                  ),
              ],
            ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile(this.a, {required this.last});

  final LeadActivity a;
  final bool last;

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
    final c = leadActivityColor(a.type);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 34,
            child: Column(
              children: [
                Container(
                  width: system ? 24 : 32,
                  height: system ? 24 : 32,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: c.withValues(alpha: system ? 0.12 : 0.18),
                    border: Border.all(color: c.withValues(alpha: 0.5)),
                  ),
                  child: Icon(
                    leadActivityIcon(a.type),
                    size: system ? 12 : 16,
                    color: c,
                  ),
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 3),
                      color: AppColors.line,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 10),
              child: system
                  ? Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: _body(context, c, system),
                    )
                  : Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: c.withValues(alpha: 0.07),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: c.withValues(alpha: 0.2)),
                      ),
                      child: _body(context, c, system),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _body(BuildContext context, Color c, bool system) {
    final meta = [
      if (a.createdBy?.name != null && a.createdBy!.name.isNotEmpty)
        a.createdBy!.name,
      if (a.createdAt != null) relativeTime(a.createdAt),
    ].join(' · ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          _title,
          style: AppText.body(
            size: system ? 12.5 : 13.5,
            weight: system ? FontWeight.w700 : FontWeight.w800,
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
        if (a.outcome != null && a.outcome!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: LeadTagChip(
              icon: Icons.fact_check_rounded,
              label: a.outcome!,
              color: LeadColors.green,
              maxWidth: 260,
            ),
          ),
        if (a.scheduledFor != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: LeadTagChip(
              icon: Icons.event_rounded,
              label: 'Scheduled ${fmtWhen(a.scheduledFor)}',
              color: LeadColors.amber,
              maxWidth: 260,
            ),
          ),
        if (meta.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              meta,
              style: AppText.body(size: 11, color: AppColors.inkFaint),
            ),
          ),
      ],
    );
  }
}
