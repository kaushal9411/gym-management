import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'PUBLISHED': AppPillTone.success,
  'DRAFT': AppPillTone.neutral,
  'SCHEDULED': AppPillTone.warning,
  'EXPIRED': AppPillTone.danger,
};

/// Not a literal design frame — the "Announcements" tile in the Menu's
/// Communication section. Backs `GET/POST /tenant-announcements` +
/// `:id/publish` — distinct from the platform-plane admin banner.
class AnnouncementsScreen extends StatelessWidget {
  const AnnouncementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<Announcement>>(
      create: (_) => PaginatedListCubit<Announcement>(
        (page) => getIt<AnnouncementRepository>().list(page: page),
      )..load(),
      child: const _AnnouncementsView(),
    );
  }
}

class _AnnouncementsView extends StatefulWidget {
  const _AnnouncementsView();

  @override
  State<_AnnouncementsView> createState() => _AnnouncementsViewState();
}

class _AnnouncementsViewState extends State<_AnnouncementsView> {
  String? _actionInFlightId;

  Future<void> _publish(String id) async {
    setState(() => _actionInFlightId = id);
    try {
      await getIt<AnnouncementRepository>().publish(id);
      if (!mounted) return;
      context.read<PaginatedListCubit<Announcement>>().load();
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
      context.read<PaginatedListCubit<Announcement>>().load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlightId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                    final cubit =
                        context.read<PaginatedListCubit<Announcement>>();
                    context
                        .push(AppRoutes.announcementForm)
                        .then((_) => cubit.load());
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<Announcement>,
          PaginatedListState<Announcement>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<Announcement>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.campaign_outlined,
                title: 'No announcements yet',
                message: 'Tap + to draft one for your members or staff.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<Announcement>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _AnnouncementCard(
                    announcement: items[i],
                    busy: _actionInFlightId == items[i].id,
                    onPublish: () => _publish(items[i].id),
                    onDelete: () => _delete(items[i].id),
                  ),
                ),
              ),
          };
        },
      ),
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
