import 'package:flutter/material.dart';
import '../../../shared/widgets/list_hero.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/leads/lead_follow_ups_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import 'lead_ui.dart';
import 'widgets/lead_card.dart';

/// Follow-ups — `GET /leads/follow-ups?scope&bucket`. Open leads only,
/// soonest first. Gradient header with the server bucket counts (tap a tile
/// to switch bucket), a Mine / Everyone toggle, and cards with the web
/// panel's quick actions: Dial / WhatsApp, **Log call** and **Reschedule**
/// (both `leads:update`), plus tap-through to the lead.
class LeadFollowUpsScreen extends StatelessWidget {
  const LeadFollowUpsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) {
        final repo = getIt<LeadRepository>();
        return LeadFollowUpsCubit(
          (scope, bucket) =>
              repo.followUps(scope: scope, bucket: bucket, limit: 100),
        )..load();
      },
      child: const _Body(),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body();

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<LeadFollowUpsCubit>();
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Follow-ups'),
      ),
      body: BlocBuilder<LeadFollowUpsCubit, LeadFollowUpsState>(
        builder: (context, state) {
          final data = state is LeadFollowUpsLoaded ? state.data : null;
          return RefreshIndicator(
            color: AppColors.staffB,
            backgroundColor: AppColors.surface2,
            edgeOffset: top,
            onRefresh: cubit.load,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: MeshHeroBackground(
                    radius: const BorderRadius.vertical(
                      bottom: Radius.circular(30),
                    ),
                    child: SizedBox(
                      width: double.infinity,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(16, top + 2, 16, 18),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(
                            minHeight: kListHeroBelowAppBar,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              FadeUp(
                                index: 0,
                                child: Text(
                                  'Who to call next',
                                  style: AppText.display(
                                    size: 24,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              FadeUp(
                                index: 1,
                                child: Text(
                                  state.mineOnly
                                      ? 'Leads assigned to you'
                                      : 'Everyone in your branch scope',
                                  style: AppText.body(
                                    size: 12.5,
                                    weight: FontWeight.w600,
                                    color: Colors.white.withValues(alpha: 0.88),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 14),
                              FadeUp(
                                index: 2,
                                child: Row(
                                  children: [
                                    _BucketTile(
                                      label: 'Overdue',
                                      count: data?.overdue,
                                      icon: Icons.alarm_rounded,
                                      selected: state.bucket == 'overdue',
                                      onTap: () =>
                                          cubit.load(bucket: 'overdue'),
                                    ),
                                    const SizedBox(width: 8),
                                    _BucketTile(
                                      label: 'Today',
                                      count: data?.today,
                                      icon: Icons.today_rounded,
                                      selected: state.bucket == 'today',
                                      onTap: () => cubit.load(bucket: 'today'),
                                    ),
                                    const SizedBox(width: 8),
                                    _BucketTile(
                                      label: 'Upcoming',
                                      count: data?.upcoming,
                                      icon: Icons.event_rounded,
                                      selected: state.bucket == 'upcoming',
                                      onTap: () =>
                                          cubit.load(bucket: 'upcoming'),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _Pill(
                          label: data == null ? 'Due' : 'Due · ${data.due}',
                          icon: Icons.bolt_rounded,
                          color: LeadColors.rose,
                          selected: state.bucket == 'due',
                          onTap: () => cubit.load(bucket: 'due'),
                        ),
                        _Pill(
                          label: 'Mine',
                          icon: Icons.person_rounded,
                          color: LeadColors.indigo,
                          selected: state.mineOnly,
                          onTap: () => cubit.load(mineOnly: true),
                        ),
                        _Pill(
                          label: 'Everyone',
                          icon: Icons.groups_rounded,
                          color: LeadColors.indigo,
                          selected: !state.mineOnly,
                          onTap: () => cubit.load(mineOnly: false),
                        ),
                      ],
                    ),
                  ),
                ),
                ...switch (state) {
                  LeadFollowUpsLoading() => const [
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppLoadingView(),
                      ),
                    ],
                  LeadFollowUpsError(:final message) => [
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: AppErrorView(
                          message: message,
                          onRetry: cubit.load,
                        ),
                      ),
                    ],
                  LeadFollowUpsLoaded(:final data) => data.items.isEmpty
                      ? const [
                          SliverFillRemaining(
                            hasScrollBody: false,
                            child: AppEmptyState(
                              title: 'Nothing to follow up',
                              message: 'No leads in this bucket. Nice.',
                              icon: Icons.event_available_outlined,
                            ),
                          ),
                        ]
                      : [
                          SliverPadding(
                            padding: const EdgeInsets.fromLTRB(18, 0, 18, 40),
                            sliver: SliverList.builder(
                              itemCount: data.items.length,
                              itemBuilder: (_, i) => LeadCard(
                                lead: data.items[i],
                                showFollowUpActions: true,
                                onReturn: cubit.load,
                              ),
                            ),
                          ),
                        ],
                },
              ],
            ),
          );
        },
      ),
    );
  }
}

class _BucketTile extends StatelessWidget {
  const _BucketTile({
    required this.label,
    required this.count,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int? count;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            color: Colors.white.withValues(alpha: selected ? 0.3 : 0.14),
            border: Border.all(
              color: Colors.white.withValues(alpha: selected ? 0.85 : 0.3),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 16, color: Colors.white),
              const SizedBox(height: 6),
              if (count == null)
                Text(
                  '–',
                  style: AppText.display(size: 24, color: Colors.white),
                )
              else
                CountUp(
                  value: count!,
                  style: AppText.display(size: 24, color: Colors.white),
                ),
              Text(
                label,
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w700,
                  color: Colors.white.withValues(alpha: 0.9),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(99),
          color: selected ? color.withValues(alpha: 0.18) : AppColors.surface,
          border: Border.all(
            color: selected ? color : AppColors.line,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: selected ? color : AppColors.inkFaint),
            const SizedBox(width: 5),
            Text(
              label,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: selected ? color : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
