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
import '../../../models/announcement_stats.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/comm_kit.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../income/presentation/income_filters.dart';
import '../../income/presentation/income_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/analytics/analytics_logic.dart'
    show analyticsShortDate, previousRange;
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'announcement_rich_text.dart';
import 'announcement_ui.dart';
import 'widgets/announcement_insights.dart';

/// Announcements — web's `/announcements` page, redesigned for the phone and
/// tablet.
///
/// Same order as web: a gradient hero (Published this period / Scheduled /
/// Drafts chips, "+" to create), the Period bar (period chips incl. Custom,
/// Compare — no branch: announcements carry their own), five KPI tiles and the
/// insights (publishing trend, by status, audience, by branch, upcoming,
/// expiring soon, recent reach — all from `GET /tenant-announcements/stats`;
/// hidden if that call fails, the list keeps working), then the list: status
/// chips with the server's counts, an audience switch, search, and the cards
/// with Load more. Every list filter is a server parameter.
///
/// A card shows web's fields: status, audience, branch, title, the body (rich
/// text rendered, "Read more" for long ones), the Scheduled / Published /
/// Expires timeline chips with relative times, the author, and the actions —
/// Edit (draft / scheduled), Schedule and Publish now (draft / scheduled),
/// Delete.
///
/// Gating (see [AnnouncementAccess]): menu tile and route unchanged
/// (`announcements:view` + flag `notifications`); "+" needs
/// `announcements:create`, Edit `announcements:update`, Schedule / Publish now
/// `announcements:publish`, Delete `announcements:delete` — each hidden without
/// its key, exactly like web.
///
/// **Dropped vs web**: numbered pagination (Load more), chart hover tooltips
/// (tap / drag inspection).
class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  late final AnnouncementAccess _access;
  late final PaginatedListCubit<Announcement> _list;
  final ValueNotifier<AnnouncementCounts?> _counts = ValueNotifier(null);
  int _total = 0;

  IncomePeriod _period = IncomePeriod.thisMonth;
  DateTimeRange? _custom;
  bool _compare = true;

  AnnouncementStats? _stats;
  bool _statsLoading = true;
  bool _statsError = false;
  int _scope = 0;

  String _status = '';
  AnnouncementAudience? _audience;
  String _search = '';

  final Set<String> _busy = {};

  ({String from, String to}) get _range => incomeRange(_period, _custom);
  bool get _rangeReady => _range.from.compareTo(_range.to) <= 0;
  String get _previousLabel => _period.previousLabel;

  @override
  void initState() {
    super.initState();
    _access = AnnouncementAccess.of(context);
    final repo = getIt<AnnouncementRepository>();
    _list = PaginatedListCubit<Announcement>((page) async {
      final r = await repo.listWithCounts(
        page: page,
        status: _status.isEmpty ? null : _status,
        audience: _audience,
        search: _search,
      );
      if (r.counts != null) _counts.value = r.counts;
      if (mounted) setState(() => _total = r.page.total);
      return r.page;
    });
    if (_access.canView) {
      _list.load();
      _loadStats();
    }
  }

  @override
  void dispose() {
    _list.close();
    _counts.dispose();
    super.dispose();
  }

  Future<void> _loadStats({bool silent = false}) async {
    if (!_rangeReady) return;
    final scope = ++_scope;
    if (!silent) {
      setState(() {
        _statsLoading = true;
        _statsError = false;
      });
    }
    final r = _range;
    try {
      final s = await getIt<AnnouncementRepository>().stats(
        dateFrom: r.from,
        dateTo: r.to,
      );
      if (!mounted || scope != _scope) return;
      setState(() {
        _stats = s;
        _statsLoading = false;
        _statsError = false;
      });
    } catch (_) {
      if (!mounted || scope != _scope) return;
      if (!silent) {
        setState(() {
          _statsLoading = false;
          _statsError = true;
        });
      }
    }
  }

  Future<void> _refresh() async {
    await Future.wait([_list.load(), _loadStats(silent: true)]);
  }

  void _setPeriod(IncomePeriod p) {
    _period = p;
    _stats = null;
    _loadStats();
  }

  Future<void> _pickCustom() async {
    final now = DateTime.now();
    final r = _range;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _period == IncomePeriod.custom
          ? _custom
          : DateTimeRange(
              start: DateTime.parse(r.from),
              end: DateTime.parse(r.to),
            ),
    );
    if (picked == null) return;
    _custom = picked;
    _period = IncomePeriod.custom;
    _stats = null;
    _loadStats();
  }

  String get _customLabel {
    final c = _custom;
    if (c == null) return 'Custom…';
    return '${dayMonth(c.start)} – ${dayMonth(c.end)}';
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  void _setAudience(AnnouncementAudience? v) {
    if (v == _audience) return;
    setState(() => _audience = v);
    _list.load();
  }

  Future<void> _create() async {
    final saved = await context.push<bool>(AppRoutes.announcementForm);
    if (saved == true && mounted) _refresh();
  }

  Future<void> _edit(Announcement a) async {
    final saved = await context.push<bool>(
      AppRoutes.announcementForm,
      extra: a,
    );
    if (saved == true && mounted) _refresh();
  }

  Future<void> _schedule(Announcement a) async {
    final saved = await context.push<bool>(
      AppRoutes.scheduleAnnouncement,
      extra: a,
    );
    if (saved == true && mounted) _refresh();
  }

  Future<void> _publish(Announcement a) async {
    if (_busy.contains(a.id)) return;
    setState(() => _busy.add(a.id));
    try {
      await getIt<AnnouncementRepository>().publish(a.id);
      if (!mounted) return;
      teamSnack(context, 'Announcement published.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not publish ($e)', error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(a.id));
    }
  }

  Future<void> _delete(Announcement a) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this announcement?',
      message: "This action can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busy.add(a.id));
    try {
      await getIt<AnnouncementRepository>().delete(a.id);
      if (!mounted) return;
      teamSnack(context, 'Announcement deleted.');
      await _refresh();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not delete ($e)', error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(a.id));
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  Widget _hero(double top) {
    final s = _stats;
    return ListHero(
      title: 'Announcements',
      subtitle: 'Broadcast news to your members and staff, schedule it ahead '
          'and see what is going out next.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (_access.canCreate)
          ListHeroButton(icon: Icons.add_rounded, onTap: _create),
      ],
      chips: [
        if (s != null && !_statsError) ...[
          ListHeroChip(
            icon: Icons.check_circle_outline_rounded,
            label: '${s.published.value.round()} published ${_period.noun}',
          ),
          ListHeroChip(
            icon: Icons.event_rounded,
            label: '${s.scheduled} scheduled',
          ),
          ListHeroChip(
            icon: Icons.edit_note_rounded,
            label: '${s.drafts} ${s.drafts == 1 ? 'draft' : 'drafts'}',
          ),
        ],
      ],
    );
  }

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
                icon: Icons.campaign_outlined,
                title: 'No access to announcements',
                message: "You don't have permission to view announcements.",
              ),
            ),
          ],
        ),
      );
    }
    final showInsights = !_statsError;
    return BlocProvider<PaginatedListCubit<Announcement>>.value(
      value: _list,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(child: _hero(top)),
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (showInsights) ...[
                          IncomePeriodBar(
                            period: _period,
                            customLabel: _customLabel,
                            onPeriod: _setPeriod,
                            onCustom: _pickCustom,
                            compare: _compare,
                            onCompare: (v) => setState(() => _compare = v),
                          ),
                          if (_compare && _rangeReady) ...[
                            const SizedBox(height: 8),
                            _compareNote(),
                          ],
                          const SizedBox(height: 14),
                          if (_stats != null) ...[
                            AnnouncementKpis(
                              stats: _stats!,
                              compare: _compare,
                              previousLabel: _previousLabel,
                            ),
                            const SizedBox(height: 14),
                          ],
                          AnnouncementInsights(
                            stats: _stats,
                            loading: _statsLoading,
                            compare: _compare,
                            previousLabel: _previousLabel,
                          ),
                        ],
                        _controls(),
                        const SizedBox(height: 10),
                      ],
                    ),
                  ),
                ),
              ),
              _body(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _compareNote() {
    final p = previousRange(_range.from, _range.to);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        'Previous period: ${analyticsShortDate(p.from)} – '
        '${analyticsShortDate(p.to)}.',
        style: AppText.body(
          size: 11.5,
          color: AppColors.inkFaint,
          weight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _controls() {
    return ValueListenableBuilder<AnnouncementCounts?>(
      valueListenable: _counts,
      builder: (context, counts, _) {
        int? count(String s) => switch (s) {
              '' => counts?.all,
              'DRAFT' => counts?.draft,
              'SCHEDULED' => counts?.scheduled,
              'PUBLISHED' => counts?.published,
              'EXPIRED' => counts?.expired,
              _ => null,
            };
        Widget statusChip(String value, String label, Color color) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TeamFilterChip(
                label:
                    count(value) == null ? label : '$label · ${count(value)}',
                selected: _status == value,
                color: color,
                onTap: () => _setStatus(value),
              ),
            );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 4),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  statusChip('', 'All', TeamColors.violet),
                  for (final st in kAnnouncementStatuses)
                    statusChip(
                      st,
                      announcementStatusLabel(st),
                      announcementStatusColor(st),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                CommSegmented<AnnouncementAudience?>(
                  color: TeamColors.fuchsia,
                  value: _audience,
                  onChanged: _setAudience,
                  options: const [
                    (null, 'All'),
                    (AnnouncementAudience.members, 'Members'),
                    (AnnouncementAudience.staff, 'Staff'),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            TeamSearchField(
              hint: 'Search title or body…',
              onSearch: (v) {
                if (v == _search) return;
                _search = v;
                _list.load();
                setState(() {});
              },
            ),
          ],
        );
      },
    );
  }

  Widget _body() {
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
          SliverToBoxAdapter(child: _empty()),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      FadeUp(
                        index: i.clamp(0, 6),
                        child: _AnnouncementCard(
                          announcement: items[i],
                          access: _access,
                          busy: _busy.contains(items[i].id),
                          onEdit: () => _edit(items[i]),
                          onSchedule: () => _schedule(items[i]),
                          onPublish: () => _publish(items[i]),
                          onDelete: () => _delete(items[i]),
                        ),
                      ),
                    if (hasMore)
                      Center(
                        child: LoadMoreButton(
                          loading: loadingMore,
                          onPressed: _list.loadMore,
                          shownCount: items.length,
                          totalCount:
                              _total < items.length ? items.length : _total,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
      },
    );
  }

  /// Web's `EMPTY_COPY` per status tab.
  Widget _empty() {
    final filtered =
        _status.isNotEmpty || _audience != null || _search.isNotEmpty;
    final (title, message) = switch (_status) {
      'DRAFT' => (
          'No drafts',
          'Drafts you save will wait here until you publish or schedule them.',
        ),
      'SCHEDULED' => (
          'Nothing scheduled',
          'Schedule a draft to have it go out automatically.',
        ),
      'PUBLISHED' => (
          'Nothing published yet',
          'Published announcements show up here.',
        ),
      'EXPIRED' => (
          'No expired announcements',
          'Announcements move here after their expiry date.',
        ),
      _ => (
          'No announcements',
          'Create one to broadcast news to your gym.',
        ),
    };
    return SizedBox(
      height: 280,
      child: AppEmptyState(
        icon: Icons.campaign_outlined,
        title: filtered ? title : 'No announcements',
        message: _search.isNotEmpty ? 'Nothing matches "$_search".' : message,
      ),
    );
  }
}

class _AnnouncementCard extends StatefulWidget {
  const _AnnouncementCard({
    required this.announcement,
    required this.access,
    required this.busy,
    required this.onEdit,
    required this.onSchedule,
    required this.onPublish,
    required this.onDelete,
  });

  final Announcement announcement;
  final AnnouncementAccess access;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onSchedule;
  final VoidCallback onPublish;
  final VoidCallback onDelete;

  @override
  State<_AnnouncementCard> createState() => _AnnouncementCardState();
}

class _AnnouncementCardState extends State<_AnnouncementCard> {
  bool _expanded = false;

  static const _previewChars = 180;

  Widget _timeline(IconData icon, String text, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.13),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                text,
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: color,
                ),
              ),
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    final a = widget.announcement;
    final acc = widget.access;
    final now = DateTime.now();
    final statusColor = announcementStatusColor(a.status);
    final aud = a.audience;
    final long = announcementPlainLength(a.body) > _previewChars;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 6, color: statusColor),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        TeamTag(
                          label: announcementStatusLabel(a.status),
                          color: statusColor,
                        ),
                        TeamTag(
                          label: audienceShort(aud),
                          color: audienceColor(aud),
                          icon: audienceIcon(aud),
                        ),
                        TeamTag(
                          label: a.branchName ?? 'All branches',
                          color: TeamColors.slate,
                          icon: Icons.place_outlined,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      a.title,
                      style: AppText.display(size: 16.5),
                    ),
                    const SizedBox(height: 6),
                    AnnouncementBody(
                      html: a.body,
                      maxLines: _expanded ? null : 3,
                    ),
                    if (long)
                      GestureDetector(
                        onTap: () => setState(() => _expanded = !_expanded),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            _expanded ? 'Show less' : 'Read more',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w800,
                              color: TeamColors.indigo,
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (a.status == 'SCHEDULED' && a.publishAt != null)
                          _timeline(
                            Icons.event_rounded,
                            'Publishes ${annDateTime(a.publishAt!)} · '
                            '${annRelative(a.publishAt!, now)}',
                            TeamColors.amber,
                          ),
                        if (a.status == 'PUBLISHED' && a.publishedAt != null)
                          _timeline(
                            Icons.check_circle_outline_rounded,
                            'Published ${annDateTime(a.publishedAt!)}',
                            TeamColors.green,
                          ),
                        if (a.expiresAt != null)
                          _timeline(
                            Icons.hourglass_bottom_rounded,
                            a.status == 'EXPIRED'
                                ? 'Expired ${annDay(a.expiresAt!)}'
                                : 'Expires ${annDay(a.expiresAt!)} · '
                                    '${annExpiryRelative(a.expiresAt!, now)}',
                            a.status == 'EXPIRED'
                                ? TeamColors.rose
                                : kAnnouncementOrange,
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Divider(height: 1, color: AppColors.line),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Icon(
                          Icons.person_outline_rounded,
                          size: 15,
                          color: AppColors.inkFaint,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            a.createdByName ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (widget.busy)
                          const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                    Wrap(
                      alignment: WrapAlignment.end,
                      children: [
                        if (acc.canUpdate && a.isPending)
                          _action(Icons.edit_rounded, 'Edit', widget.onEdit),
                        if (acc.canPublish && a.isPending) ...[
                          _action(
                            Icons.event_rounded,
                            'Schedule',
                            widget.onSchedule,
                          ),
                          _action(
                            Icons.send_rounded,
                            'Publish now',
                            widget.onPublish,
                          ),
                        ],
                        if (acc.canDelete)
                          _action(
                            Icons.delete_outline_rounded,
                            'Delete',
                            widget.onDelete,
                            color: AppColors.danger,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _action(
    IconData icon,
    String label,
    VoidCallback onTap, {
    Color? color,
  }) =>
      TextButton.icon(
        onPressed: widget.busy ? null : onTap,
        icon: Icon(icon, size: 16, color: color ?? AppColors.inkSoft),
        label: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w800,
            color: color ?? AppColors.inkSoft,
          ),
        ),
        style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
      );
}
