import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/lead.dart';
import '../lead_ui.dart';

/// One lead row (list + follow-ups). Shows name, status, phone, source,
/// interested plan, assignee, follow-up badge and age; Call / WhatsApp are
/// one tap away (`tel:` / `wa.me`, same launcher as the Members cards).
/// Tapping the body opens the detail and calls [onReturn] afterwards so the
/// list reloads (pushed routes, no stale cache).
class LeadCard extends StatelessWidget {
  const LeadCard({super.key, required this.lead, this.onReturn});

  final Lead lead;
  final VoidCallback? onReturn;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          side: const BorderSide(color: AppColors.line),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.leadDetail, extra: lead.id)
              .then((_) => onReturn?.call()),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        lead.name.isEmpty ? 'Unnamed lead' : lead.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 16),
                      ),
                    ),
                    const SizedBox(width: 8),
                    LeadStatusPill(lead.status),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        lead.phone,
                        style: AppText.body(
                          size: 13,
                          color: AppColors.inkSoft,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (lead.phone.isNotEmpty) ...[
                      LeadIconAction(
                        icon: Icons.call_rounded,
                        tooltip: 'Call ${lead.name}',
                        color: AppColors.success,
                        onTap: () => leadCall(context, lead.phone),
                      ),
                      const SizedBox(width: 8),
                      LeadIconAction(
                        icon: Icons.chat_rounded,
                        tooltip: 'WhatsApp ${lead.name}',
                        color: AppColors.success,
                        onTap: () => leadWhatsApp(context, lead.phone),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 12,
                  runSpacing: 4,
                  children: [
                    LeadMetaChip(Icons.campaign_outlined, lead.source.label),
                    if (lead.interestedPlan != null)
                      LeadMetaChip(
                        Icons.card_membership_outlined,
                        lead.interestedPlan!.name,
                      ),
                    LeadMetaChip(
                      Icons.person_outline_rounded,
                      lead.assignedTo?.name ?? 'Unassigned',
                    ),
                    if (leadAgeText(lead).isNotEmpty)
                      LeadMetaChip(Icons.schedule_rounded, leadAgeText(lead)),
                  ],
                ),
                if (lead.isOpen && lead.nextFollowUpAt != null) ...[
                  const SizedBox(height: 8),
                  FollowUpBadge(lead),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
