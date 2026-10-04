import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../models/announcement_stats.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'widgets/announcement_insights_header.dart';

const _statusTones = {
  'PUBLISHED': AppPillTone.success,
  'DRAFT': AppPillTone.neutral,
  'SCHEDULED': AppPillTone.warning,
  'EXPIRED': AppPillTone.danger,
};

/// Not a literal design frame — the "Announcements" tile in the Menu's
/// Communication section. Backs `GET/POST /tenant-announcements` +
/// `:id/publish` — distinct from the platform-plane admin banner.
///
/// Above the list: the animated insights header
/// (`GET /tenant-announcements/stats`, hidden without `announcements:view`),
/// status tabs whose badges are the server's `counts`, audience chips and a
/// search box — all three drive the SERVER-side `status` / `audience` /
/// `search` params. Pushed route, so it reloads on every visit.
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  late final PaginatedListCubit<Announcement> _list;
  late final AnnouncementStatsCubit _stats;
  final ValueNotifier<AnnouncementCounts?> _counts = ValueNotifier(null);
  String? _actionInFlightId;
  String _status = '';
  String _audience = '';
  String _search = '';

  bool get _canViewStats {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('announcements:view');
  }

  @override
  void initState() {
    super.initState();
    final repo = getIt<AnnouncementRepository>();
    _list = PaginatedListCubit<Announcement>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        status: _status.isEmpty ? null : _status,
        audience:
            _audience.isEmpty ? null : AnnouncementAudienceX.fromApi(_audience),
        search: _search,
      );
      if (r.counts != null) _counts.value = r.counts;
      return r.page;
    })
      ..load();
    _stats = AnnouncementStatsCubit(repo.stats);
    if (_canViewStats) {
      unawaited(_stats.load());
    } else {
      _stats.hide();
    }
  }

  @override
  void dispose() {
    _list.close();
    _stats.close();
    _counts.dispose();
    super.dispose();
  }

  Future<void> _refresh({bool silentStats = false}) async {
    if (_canViewStats) unawaited(_stats.load(null, silentStats));
    await _list.load();
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  void _setAudience(String v) {
    if (v == _audience) return;
    setState(() => _audience = v);
    _list.load();
  }

  Future<void> _publish(String id) async {
    setState(() => _actionInFlightId = id);
    try {
      await getIt<AnnouncementRepository>().publish(id);
      if (!mounted) return;
      await _refresh(silentStats: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlightId = null);
    }
  }

  Future<void> _delete(String id) async {
    setState(() => _actionInFlightId = id);
    try {
      await getIt<AnnouncementRepository>().delete(id);
      if (!mounted) return;
      await _refresh(silentStats: true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlightId = null);
    }
  }

  List<FilterChipOption<String>> _statusOptions(AnnouncementCounts? c) => [
        FilterChipOption('', 'All', count: c?.all),
        FilterChipOption('DRAFT', 'Draft', count: c?.draft),
        FilterChipOption('SCHEDULED', 'Scheduled', count: c?.scheduled),
        FilterChipOption('PUBLISHED', 'Published', count: c?.published),
        FilterChipOption('EXPIRED', 'Expired', count: c?.expired),
      ];

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<PaginatedListCubit<Announcement>>.value(value: _list),
        BlocProvider<AnnouncementStatsCubit>.value(value: _stats),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Published & drafts', style: AppText.eyebrow()),
              Text('Announcements', style: AppText.display(size: 18)),
            ],
          ),
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
                    onPressed: () {
                      context
                          .push(AppRoutes.announcementForm)
                          .then((_) => _refresh(silentStats: true));
                    },
                  ),
                ),
              ),
            ),
          ],
        ),
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(18, 4, 18, 0),
                sliver: SliverToBoxAdapter(
                  child: AnnouncementInsightsHeader(),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
                sliver: SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ValueListenableBuilder<AnnouncementCounts?>(
                        valueListenable: _counts,
                        builder: (context, counts, _) => FilterChipsRow<String>(
                          options: _statusOptions(counts),
                          selected: _status,
                          onSelected: _setStatus,
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilterChipsRow<String>(
                        options: const [
                          FilterChipOption('', 'All audiences'),
                          FilterChipOption('ALL', 'Everyone'),
                          FilterChipOption('MEMBERS', 'Members'),
                          FilterChipOption('STAFF', 'Staff'),
                        ],
                        selected: _audience,
                        onSelected: _setAudience,
                      ),
                      const SizedBox(height: 10),
                      DebouncedSearchField(
                        hint: 'Search announcements',
                        onChanged: (v) {
                          if (v == _search) return;
                          _search = v;
                          _list.load();
                        },
                      ),
                    ],
                  ),
                ),
              ),
              _buildList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    return BlocBuilder<PaginatedListCubit<Announcement>,
        PaginatedListState<Announcement>>(
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: SizedBox(height: 220, child: AppLoadingView()),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppErrorView(message: message, onRetry: _list.load),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: _status.isEmpty && _audience.isEmpty && _search.isEmpty
                  ? const AppEmptyState(
                      icon: Icons.campaign_outlined,
                      title: 'No announcements yet',
                      message: 'Tap + to draft one for your members or staff.',
                    )
                  : const AppEmptyState(
                      icon: Icons.campaign_outlined,
                      title: 'Nothing matches',
                      message: 'Try another status, audience or search.',
                    ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
            sliver: SliverList.builder(
              itemCount: items.length + (hasMore ? 1 : 0),
              itemBuilder: (context, i) {
                if (i >= items.length) {
                  return Center(
                    child: loadingMore
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(
                              color: AppColors.staffB,
                            ),
                          )
                        : TextButton(
                            onPressed: _list.loadMore,
                            child: const Text('Load more'),
                          ),
                  );
                }
                return _AnnouncementCard(
                  announcement: items[i],
                  busy: _actionInFlightId == items[i].id,
                  onPublish: () => _publish(items[i].id),
                  onDelete: () => _delete(items[i].id),
                );
              },
            ),
          ),
      },
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.announcement,
    required this.busy,
    required this.onPublish,
    required this.onDelete,
  });

  final Announcement announcement;
  final bool busy;
  final VoidCallback onPublish;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  announcement.title,
                  style: AppText.body(size: 14, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: announcement.status,
                tone: _statusTones[announcement.status] ?? AppPillTone.neutral,
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            announcement.body,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 12,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Audience: ${announcement.audience.label}',
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          if (announcement.status == 'DRAFT' ||
              announcement.status == 'SCHEDULED') ...[
            const SizedBox(height: 8),
            Row(
              children: [
                TextButton(
                  onPressed: busy ? null : onPublish,
                  child: Text(
                    'Publish now',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.staffPillFg,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: busy ? null : onDelete,
                  child: Text(
                    'Delete',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w700,
                      color: AppColors.danger,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
