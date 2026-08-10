import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/recent_activity.dart';

class RecentActivityTile extends StatelessWidget {
  const RecentActivityTile({super.key, required this.activity});

  final RecentActivity activity;

  @override
  Widget build(BuildContext context) {
    late final IconData icon;
    late final Color bg;
    late final Color fg;
    switch (activity.type) {
      case RecentActivityType.payment:
        icon = Icons.currency_rupee_rounded;
        bg = AppColors.successSoft;
        fg = AppColors.success;
      case RecentActivityType.checkIn:
        icon = Icons.login_rounded;
        bg = AppColors.staffSoft;
        fg = AppColors.staffPillFg;
      case RecentActivityType.newMember:
        icon = Icons.person_add_alt_1_rounded;
        bg = AppColors.memberSoft;
        fg = AppColors.memberPillFg;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
            alignment: Alignment.center,
            child: Icon(icon, size: 15, color: fg),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity.label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${activity.detail} · ${Formatters.relativeTime(activity.occurredAt)}',
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
