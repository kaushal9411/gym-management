import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/lead.dart';
import '../lead_actions.dart';
import '../lead_ui.dart';

/// One lead (list, board, follow-ups). Status-coloured accent edge, gradient
/// avatar, name + phone, status pill, source / plan / assignee tags, the
/// follow-up badge and age. Call / WhatsApp (and, with `leads:update`, a
/// stage mover) are one tap away. Tapping the body opens the detail and
/// calls [onReturn] afterwards so the host list reloads (pushed routes, no
/// stale cache).
class LeadCard extends StatelessWidget {
  const LeadCard({
    super.key,
    required this.lead,
    this.onReturn,
    this.compact = false,
    this.showFollowUpActions = false,
  });

  final Lead lead;
  final VoidCallback? onReturn;

  /// Board column variant: no action row.
  final bool compact;

  /// Follow-ups list: Log call / Reschedule instead of the stage mover.
  final bool showFollowUpActions;

  Future<void> _stage(BuildContext context) async {
    final moved = await quickChangeStage(context, lead);
    if (moved) onReturn?.call();
  }

  Future<void> _logCall(BuildContext context) async {
    if (await quickLogCall(context, lead)) onReturn?.call();
  }

  Future<void> _reschedule(BuildContext context) async {
    if (await quickReschedule(context, lead)) onReturn?.call();
  }

  @override
  Widget build(BuildContext context) {
    final color = leadStatusColor(lead.status);
    final canUpdate = leadsCan(context, 'leads:update');
    final plan = lead.interestedPlan;
    final hasPhone = lead.phone.isNotEmpty;
    final lostLabel = lead.status == LeadStatus.lost && lead.lostReason != null
        ? LeadLostReason.labelOf(lead.lostReason!)
        : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => context
                .push(AppRoutes.leadDetail, extra: lead.id)
                .then((_) => onReturn?.call()),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 5,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [color, color.withValues(alpha: 0.35)],
                      ),
                    ),
                  ),
                  Expanded(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            color.withValues(alpha: 0.1),
                            Colors.transparent,
                          ],
                        ),
                      ),
                      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              LeadAvatar(
                                name: lead.name,
                                size: compact ? 36 : 44,
                                color: color,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      lead.name.isEmpty
                                          ? 'Unnamed lead'
                                          : lead.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.display(
                                        size: compact ? 14.5 : 16,
                                      ),
                                    ),
                                    Text(
                                      lead.phone,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.body(
                                        size: 12.5,
                                        color: AppColors.inkSoft,
                                        weight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (!compact) ...[
                                const SizedBox(width: 6),
                                LeadStatusPill(lead.status),
                              ],
                            ],
                          ),
                          if (compact) ...[
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: LeadStatusPill(lead.status),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              LeadTagChip(
                                icon: leadSourceIcon(lead.source),
                                label: lead.source.label,
                                color: leadSourceColor(lead.source),
                              ),
                              if (plan != null)
                                LeadTagChip(
                                  icon: Icons.card_membership_rounded,
                                  label: plan.name,
                                  color: LeadColors.violet,
                                ),
                              LeadTagChip(
                                icon: Icons.person_rounded,
                                label: lead.assignedTo?.name ?? 'Unassigned',
                                color: lead.assignedTo == null
                                    ? LeadColors.slate
                                    : LeadColors.teal,
                              ),
                              if (lead.isOpen && lead.nextFollowUpAt != null)
                                FollowUpBadge(lead),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              if (leadAgeText(lead).isNotEmpty)
                                LeadMetaChip(
                                  Icons.schedule_rounded,
                                  leadAgeText(lead),
                                ),
                              if (lostLabel != null) ...[
                                const SizedBox(width: 10),
                                Flexible(
                                  child: Text(
                                    'Lost: $lostLabel',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppText.body(
                                      size: 11.5,
                                      weight: FontWeight.w700,
                                      color: LeadColors.rose,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (!compact) ...[
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                if (hasPhone) ...[
                                  LeadIconAction(
                                    icon: Icons.call_rounded,
                                    tooltip: 'Call ${lead.name}',
                                    color: LeadColors.green,
                                    onTap: () => leadCall(context, lead.phone),
                                  ),
                                  LeadIconAction(
                                    icon: Icons.chat_rounded,
                                    tooltip: 'WhatsApp ${lead.name}',
                                    color: LeadColors.teal,
                                    onTap: () =>
                                        leadWhatsApp(context, lead.phone),
                                  ),
                                ],
                                if (showFollowUpActions &&
                                    canUpdate &&
                                    lead.isOpen) ...[
                                  _MiniAction(
                                    label: 'Log call',
                                    icon: Icons.phone_callback_rounded,
                                    color: LeadColors.teal,
                                    onTap: () => _logCall(context),
                                  ),
                                  _MiniAction(
                                    label: 'Reschedule',
                                    icon: Icons.event_repeat_rounded,
                                    color: LeadColors.violet,
                                    onTap: () => _reschedule(context),
                                  ),
                                ] else if (canUpdate &&
                                    lead.status != LeadStatus.converted)
                                  _MiniAction(
                                    label: lead.status == LeadStatus.lost
                                        ? 'Reopen'
                                        : 'Move stage',
                                    icon: lead.status == LeadStatus.lost
                                        ? Icons.restart_alt_rounded
                                        : Icons.swap_horiz_rounded,
                                    color: LeadColors.indigo,
                                    onTap: () => _stage(context),
                                  ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
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

class _MiniAction extends StatelessWidget {
  const _MiniAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: color.withValues(alpha: 0.4)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
