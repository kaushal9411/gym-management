import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';

/// Body Measurements catalog — mirrors web's `/measurements` list.
/// Deliberately NOT the full member roster: only members who already have
/// at least one measurement recorded (there's no reusable template the way
/// Workout/Diet Plans have, so "who actually has history" is the only
/// useful catalog view here). Tapping a row opens
/// `MemberMeasurementsDetailScreen` — a focused view of just that member's
/// measurement history, not the full Member Detail screen. The "+" opens
/// `NewMeasurementScreen` (create-and-assign in one step, for a member with
/// no history yet).
class MeasuredMembersScreen extends StatefulWidget {
  const MeasuredMembersScreen({super.key});

  @override
  State<MeasuredMembersScreen> createState() => _MeasuredMembersScreenState();
}

class _MeasuredMembersScreenState extends State<MeasuredMembersScreen> {
  List<MeasuredMemberOption>? _members;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final members = await getIt<BodyMeasurementRepository>().listMembers();
      if (!mounted) return;
      setState(() => _members = members);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final members = _members;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Body Measurements', style: AppText.display(size: 18)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                child: IconButton(
                  padding: EdgeInsets.zero,
                  icon: const Icon(
                    Icons.add_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                  onPressed: () => context
                      .push(AppRoutes.newMeasurement)
                      .then((_) => _load()),
                ),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: members == null
            ? (_error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView())
            : members.isEmpty
                ? const AppEmptyState(
                    icon: Icons.straighten_outlined,
                    title: 'No measurements recorded yet',
                    message: 'Tap + to record a member\'s first measurement.',
                  )
                : RefreshIndicator(
                    color: AppColors.staffB,
                    backgroundColor: AppColors.surface2,
                    onRefresh: _load,
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(18, 8, 18, 90),
                      itemCount: members.length,
                      itemBuilder: (context, i) => _MemberRow(
                        entry: members[i],
                        onChanged: _load,
                      ),
                    ),
                  ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({required this.entry, required this.onChanged});

  final MeasuredMemberOption entry;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.memberMeasurementsDetail, extra: entry.memberId)
              .then((_) => onChanged()),
          child: AppCard(
            child: Row(
              children: [
                UserAvatar(avatarUrl: entry.profilePhotoUrl, name: entry.memberName),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              entry.memberName,
                              style: AppText.body(size: 14, weight: FontWeight.w700),
                            ),
                          ),
                          AppPill(label: '${entry.count}', tone: AppPillTone.neutral),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        entry.latest.summary,
                        style: AppText.body(size: 11, color: AppColors.inkFaint),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        '${entry.memberCode} · ${entry.branchName}',
                        style: AppText.body(size: 10, color: AppColors.inkFaint),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
