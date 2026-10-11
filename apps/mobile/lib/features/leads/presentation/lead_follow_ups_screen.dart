import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/leads/lead_follow_ups_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/lead_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'widgets/lead_card.dart';

/// Follow-ups quick list — `GET /leads/follow-ups?scope&bucket`. Open leads
/// only, soonest first. Bucket chips carry the server `counts`; the scope
/// toggle switches between "assigned to me" and everyone's.
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
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: Text('Follow-ups', style: AppText.display(size: 18)),
        ),
        body: const _Body(),
      ),
    );
  }
}

class _Body extends StatefulWidget {
  const _Body();

  @override
  State<_Body> createState() => _BodyState();
}

class _BodyState extends State<_Body> {
  @override
  Widget build(BuildContext context) {
    final cubit = context.read<LeadFollowUpsCubit>();
    return BlocBuilder<LeadFollowUpsCubit, LeadFollowUpsState>(
      builder: (context, state) {
        final counts = state is LeadFollowUpsLoaded ? state.data : null;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 0, 6),
              child: FilterChipsRow<String>(
                selected: state.bucket,
                onSelected: (b) => cubit.load(bucket: b),
                options: [
                  FilterChipOption('due', 'Due', count: counts?.due),
                  FilterChipOption(
                    'overdue',
                    'Overdue',
                    count: counts?.overdue,
                  ),
                  FilterChipOption('today', 'Today', count: counts?.today),
                  FilterChipOption(
                    'upcoming',
                    'Upcoming',
                    count: counts?.upcoming,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
              child: Row(
                children: [
                  Text('Show', style: AppText.eyebrow()),
                  const SizedBox(width: 10),
                  SegmentedButton<bool>(
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: true, label: Text('Mine')),
                      ButtonSegment(value: false, label: Text('Everyone')),
                    ],
                    selected: {state.mineOnly},
                    onSelectionChanged: (s) => cubit.load(mineOnly: s.first),
                  ),
                ],
              ),
            ),
            Expanded(
              child: switch (state) {
                LeadFollowUpsLoading() => const AppLoadingView(),
                LeadFollowUpsError(:final message) =>
                  AppErrorView(message: message, onRetry: cubit.load),
                LeadFollowUpsLoaded(:final data) => RefreshIndicator(
                    color: AppColors.staffB,
                    backgroundColor: AppColors.surface2,
                    onRefresh: cubit.load,
                    child: data.items.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(height: 80),
                              AppEmptyState(
                                title: 'Nothing to follow up',
                                message: 'No leads in this bucket.',
                                icon: Icons.event_available_outlined,
                              ),
                            ],
                          )
                        : ListView.builder(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(18, 4, 18, 40),
                            itemCount: data.items.length,
                            itemBuilder: (_, i) => LeadCard(
                              lead: data.items[i],
                              onReturn: cubit.load,
                            ),
                          ),
                  ),
              },
            ),
          ],
        );
      },
    );
  }
}
