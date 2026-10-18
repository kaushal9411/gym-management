import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/body_measurement.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../measurement_ui.dart';

/// One measured member in the list — web's `MeasuredMemberCard`. The default
/// is the rich card (tinted banner, ringed avatar, branch + age tags, Entries
/// and Trainer tiles, "View / edit"); [compact] is web's dense list row.
/// The ring / banner are green when the latest entry is <= 30 days old, amber
/// after that.
class MeasuredMemberCard extends StatelessWidget {
  const MeasuredMemberCard({
    super.key,
    required this.row,
    required this.onTap,
    this.compact = false,
  });

  final MeasuredMemberOption row;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final days = daysSince(row.latest.recordedAt);
    final tone = freshnessTone(days);
    return compact ? _compact(days, tone) : _rich(days, tone);
  }

  List<Widget> _tags(int days, Color tone) => [
        TeamTag(
          label: row.branchName,
          color: TeamColors.indigo,
          icon: Icons.apartment_rounded,
        ),
        TeamTag(
          label: ageLabel(days),
          color: tone,
          icon: Icons.schedule_rounded,
        ),
      ];

  Widget _viewButton() => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: TeamColors.cta,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          'View / edit',
          style: AppText.body(
            size: 13,
            weight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
      );

  // ── compact row ───────────────────────────────────────────────────────────

  Widget _compact(int days, Color tone) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
            child: Row(
              children: [
                MeasuredAvatar(
                  name: row.memberName,
                  url: row.profilePhotoUrl,
                  tone: tone,
                  size: 38,
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        row.memberName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        row.memberCode.isEmpty ? '—' : row.memberCode,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        row.latest.summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 6,
                        runSpacing: 4,
                        children: _tags(days, tone),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── rich card ─────────────────────────────────────────────────────────────

  Widget _stat(IconData? icon, String value, String label, Color tone) {
    return Container(
      padding: const EdgeInsets.all(9),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: tone.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 12, color: AppColors.inkSoft),
                const SizedBox(width: 4),
              ],
              Expanded(
                child: Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
              ),
            ],
          ),
          Text(
            label,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
        ],
      ),
    );
  }

  Widget _rich(int days, Color tone) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 62,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          tone,
                          Color.lerp(tone, TeamColors.fuchsia, 0.55)!,
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 46, 16, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.memberName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.display(size: 17),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${row.memberCode.isEmpty ? '—' : row.memberCode}'
                          ' · ${row.latest.summary}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: _tags(days, tone),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child:
                                  _stat(null, '${row.count}', 'Entries', tone),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _stat(
                                Icons.sports_rounded,
                                row.trainerName ?? '—',
                                'Trainer',
                                tone,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _viewButton(),
                      ],
                    ),
                  ),
                ],
              ),
              Positioned(
                left: 16,
                top: 28,
                child: MeasuredAvatar(
                  name: row.memberName,
                  url: row.profilePhotoUrl,
                  tone: tone,
                  size: 62,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
