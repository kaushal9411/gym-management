import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/count_format.dart';
import '../../../models/comm_campaign.dart';
import '../../../repositories/communications_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamAdaptive, TeamCenter, TeamSearchField, teamSideInset;
import '../comm_access.dart';
import '../comm_logic.dart';
import 'widgets/comm_widgets.dart';

/// History — every send and its result (design frame 7, list half).
///
/// [ListHero] ("N sends" chip), status chips with the server's per-status
/// counts, a debounced search over name / title, and campaign cards (name,
/// "412 members · 15 Oct", channel dots, status pill) with Load more. Tap opens
/// the detail. Pull to refresh; skeleton / empty / error-with-retry states.
/// Needs `notifications:view`; without it the screen explains and makes no
/// request.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late final CommAccess _access;
  late final PaginatedListCubit<CommCampaign> _list;
  CampaignStatus? _status;
  String _search = '';
  CampaignCounts? _counts;
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _access = CommAccess.of(context);
    final repo = getIt<CommunicationsRepository>();
    _list = PaginatedListCubit<CommCampaign>((page) async {
      final r = await repo.campaigns(
        status: _status,
        search: _search,
        page: page,
      );
      if (mounted) {
        setState(() {
          _counts = r.counts ?? _counts;
          _total = r.page.total;
        });
      }
      return r.page;
    });
    if (_access.canView) _list.load();
  }

  @override
  void dispose() {
    _list.close();
    super.dispose();
  }

  Widget _hero(double top) => ListHero(
        title: 'History',
        subtitle: 'Every send and its result.',
        topInset: top,
        side: 18 + teamSideInset(context),
        leading: ListHeroButton(
          icon: Icons.arrow_back_rounded,
          onTap: () => Navigator.of(context).maybePop(),
        ),
        chips: [
          if (_access.canView && _counts != null)
            ListHeroChip(
              icon: Icons.history_rounded,
              label: '${groupDigits(_counts!.all)} '
                  '${_counts!.all == 1 ? 'send' : 'sends'}',
            ),
          if (_counts != null && _counts!.sending > 0)
            ListHeroChip(
              icon: Icons.sync_rounded,
              label: '${_counts!.sending} sending',
            ),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    if (!_access.canView) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            _hero(top),
            const Expanded(
              child: AppEmptyState(
                icon: Icons.lock_outline_rounded,
                title: 'No access to History',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _list.load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TeamSearchField(
                        hint: 'Search by name or title',
                        onSearch: (v) {
                          if (v == _search) return;
                          setState(() => _search = v);
                          _list.load();
                        },
                      ),
                      const SizedBox(height: 10),
                      FilterChipsRow<CampaignStatus?>(
                        selected: _status,
                        onSelected: (v) {
                          if (v == _status) return;
                          setState(() => _status = v);
                          _list.load();
                        },
                        options: [
                          FilterChipOption(null, 'All', count: _counts?.all),
                          for (final s in const [
                            CampaignStatus.sending,
                            CampaignStatus.scheduled,
                            CampaignStatus.sent,
                            CampaignStatus.partial,
                            CampaignStatus.failed,
                            CampaignStatus.cancelled,
                            CampaignStatus.draft,
                          ])
                            FilterChipOption(
                              s,
                              s.label,
                              count: _counts?.forStatus(s),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            _body(),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    return BlocBuilder<PaginatedListCubit<CommCampaign>,
        PaginatedListState<CommCampaign>>(
      bloc: _list,
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 6, 16, 24),
                child: CommSkeletonList(rows: 5, rowHeight: 74),
              ),
            ),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 340,
              child: AppErrorView(message: message, onRetry: _list.load),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          SliverToBoxAdapter(
            child: SizedBox(
              height: 340,
              child: AppEmptyState(
                icon: Icons.forum_outlined,
                title: _status == null && _search.isEmpty
                    ? 'No messages sent yet'
                    : 'Nothing matches',
                message: _status == null && _search.isEmpty
                    ? (_access.canSend
                        ? 'Send your first message from the Communications '
                            'screen.'
                        : 'Sends made by your team will show up here.')
                    : 'Try another status or search.',
              ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
                child: Column(
                  children: [
                    TeamAdaptive(
                      gap: 10,
                      rowSpacing: 10,
                      children: [
                        for (var i = 0; i < items.length; i++)
                          CommReveal(
                            index: i.clamp(0, 6),
                            child: _CampaignCard(
                              campaign: items[i],
                              onTap: () async {
                                await context.push<Object?>(
                                  AppRoutes.communicationsHistoryDetail,
                                  extra: items[i].id,
                                );
                                if (mounted) _list.load();
                              },
                            ),
                          ),
                      ],
                    ),
                    if (hasMore)
                      LoadMoreButton(
                        loading: loadingMore,
                        onPressed: _list.loadMore,
                        shownCount: items.length,
                        totalCount:
                            _total < items.length ? items.length : _total,
                      ),
                  ],
                ),
              ),
            ),
          ),
      },
    );
  }
}

class _CampaignCard extends StatelessWidget {
  const _CampaignCard({required this.campaign, required this.onTap});

  final CommCampaign campaign;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = campaign;
    return CommPress(
      onTap: onTap,
      semanticLabel: '${c.displayName}, ${campaignPillText(c)}',
      child: CommCard(
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    c.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 14, weight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 8),
                CommPill(text: campaignPillText(c), tone: campaignTone(c)),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              campaignSubtitle(c),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final ch in c.channels)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: ChannelDot(channel: ch, size: 20),
                  ),
                const Spacer(),
                if (c.messageCount > 0)
                  Text(
                    '${groupDigits(c.sentCount)} of '
                    '${groupDigits(c.messageCount)} delivered',
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w700,
                      color: AppColors.inkSoft,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
