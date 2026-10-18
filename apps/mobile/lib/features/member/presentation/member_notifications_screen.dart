import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_notification.dart';
import '../../../repositories/member_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamColors, TeamTag, teamSnack;
import 'widgets/member_dash_ui.dart';

/// Category → (icon, colour, label), web's `CAT` map.
({IconData icon, Color color, String label}) notificationCategory(String c) =>
    switch (c) {
      'ANNOUNCEMENT' => (
          icon: Icons.campaign_outlined,
          color: const Color(0xFFF97316),
          label: 'Announcements',
        ),
      'MEMBERSHIP' => (
          icon: Icons.badge_outlined,
          color: TeamColors.violet,
          label: 'Membership',
        ),
      'PAYMENT' => (
          icon: Icons.credit_card_rounded,
          color: TeamColors.green,
          label: 'Payments',
        ),
      'ATTENDANCE' => (
          icon: Icons.event_available_rounded,
          color: TeamColors.sky,
          label: 'Attendance',
        ),
      'WORKOUT' => (
          icon: Icons.fitness_center_rounded,
          color: TeamColors.fuchsia,
          label: 'Workout',
        ),
      'DIET' => (
          icon: Icons.restaurant_rounded,
          color: TeamColors.teal,
          label: 'Diet',
        ),
      'STAFF' => (
          icon: Icons.person_outline_rounded,
          color: TeamColors.sky,
          label: 'From staff',
        ),
      'SYSTEM' => (
          icon: Icons.info_outline_rounded,
          color: TeamColors.slate,
          label: 'System',
        ),
      'SUBSCRIPTION' => (
          icon: Icons.credit_card_rounded,
          color: TeamColors.violet,
          label: 'Subscription',
        ),
      'MEMBER' => (
          icon: Icons.celebration_outlined,
          color: TeamColors.violet,
          label: 'Account',
        ),
      _ => (
          icon: Icons.notifications_outlined,
          color: TeamColors.slate,
          label: 'General',
        ),
    };

/// The categories a member can filter by (web's `CHIPS`).
const _chipCategories = [
  'ANNOUNCEMENT',
  'MEMBERSHIP',
  'PAYMENT',
  'ATTENDANCE',
  'WORKOUT',
  'DIET',
  'STAFF',
  'GENERAL',
];

/// Notifications — web's `/portal/notifications`, redesigned for the member
/// plane.
///
/// Hero ("N unread updates" / "You're all caught up", an "N new" / "All read"
/// chip, and a **Mark all read** button), an All / Unread switch and category
/// chips (Everything, Announcements, Membership, Payments, Attendance,
/// Workout, Diet, From staff, General). Notifications are grouped by day
/// (Today / Yesterday / date); each card shows the category icon and tag, the
/// full title and body, the relative time and an unread marker; tapping an
/// unread one marks it read. Both filters are the server's `unreadOnly` /
/// `category` params, never filtered after paging. Load more shows how many
/// are left. The unread figure is the server's `unreadCount`.
class MemberNotificationsScreen extends StatefulWidget {
  const MemberNotificationsScreen({super.key});

  @override
  State<MemberNotificationsScreen> createState() =>
      _MemberNotificationsScreenState();
}

class _MemberNotificationsScreenState extends State<MemberNotificationsScreen> {

  List<TenantNotification> _items = const [];
  int _total = 0;
  int _unread = 0;
  bool _loading = true;
  bool _more = false;
  bool _markingAll = false;
  String? _error;
  bool _unreadOnly = false;
  String? _category;
  int _pageNo = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool more = false}) async {
    final repo = getIt<MemberNotificationRepository>();
    if (!more) _pageNo = 1;
    setState(() {
      if (more) {
        _more = true;
      } else {
        _loading = _items.isEmpty;
      }
      _error = null;
    });
    try {
      final r = await repo.list(
        page: _pageNo,
        unreadOnly: _unreadOnly,
        category: _category,
      );
      final unread = await repo.unreadCount().catchError((_) => _unread);
      if (!mounted) return;
      setState(() {
        _items = more ? [..._items, ...r.items] : r.items;
        _total = r.total;
        _unread = unread;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load notifications ($e)');
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _more = false;
        });
      }
    }
  }

  void _filter(
      {bool? unreadOnly, String? category, bool clearCategory = false,}) {
    setState(() {
      if (unreadOnly != null) _unreadOnly = unreadOnly;
      if (category != null || clearCategory) _category = category;
      _items = const [];
    });
    _load();
  }

  Future<void> _markAll() async {
    setState(() => _markingAll = true);
    try {
      await getIt<MemberNotificationRepository>().markAllRead();
      if (mounted) await _load();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } finally {
      if (mounted) setState(() => _markingAll = false);
    }
  }

  Future<void> _tap(TenantNotification n) async {
    if (!n.isUnread) return;
    try {
      await getIt<MemberNotificationRepository>().markRead(n.id);
      if (mounted) await _load();
    } on ApiException {
      // Non-fatal — the notification stays as it was.
    }
  }

  String _dayLabel(DateTime d) {
    final l = d.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final day = DateTime(l.year, l.month, l.day);
    final diff = today.difference(day).inDays;
    if (diff == 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    const w = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${w[l.weekday - 1]}, ${l.day} ${m[l.month - 1]}';
  }

  String _ago(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) {
      return '${diff.inHours} hr${diff.inHours == 1 ? '' : 's'} ago';
    }
    if (diff.inDays == 1) return 'yesterday';
    return '${diff.inDays} days ago';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : _error != null && _items.isEmpty
              ? AppErrorView(
                  message: _error!,
                  onRetry: _load,
                  role: AppRole.member,
                )
              : RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: _load,
                  child: _content(),
                ),
    );
  }

  Widget _content() {
    final groups = <String, List<TenantNotification>>{};
    for (final n in _items) {
      groups.putIfAbsent(_dayLabel(n.createdAt), () => []).add(n);
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 28),
      children: [
        MemberPageHero(
          eyebrow: 'Inbox',
          title: 'Notifications',
          subtitle: _unread > 0
              ? '$_unread unread ${_unread == 1 ? 'update' : 'updates'}'
              : "You're all caught up",
          chips: [_unread > 0 ? '$_unread new' : 'All read'],
          actions: [
            MemberHeroButton(
              icon: Icons.done_all_rounded,
              label: _markingAll ? 'Marking…' : 'Mark all read',
              solid: _unread > 0,
              onTap: () {
                if (_unread > 0 && !_markingAll) _markAll();
              },
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  children: [
                    for (final t in [
                      (false, 'All'),
                      (true, _unread > 0 ? 'Unread ($_unread)' : 'Unread'),
                    ])
                      Expanded(
                        child: GestureDetector(
                          key: ValueKey('notif-read-${t.$1}'),
                          onTap: () => _filter(unreadOnly: t.$1),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _unreadOnly == t.$1
                                  ? AppColors.surface2
                                  : null,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              t.$2,
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w800,
                                color: _unreadOnly == t.$1
                                    ? AppColors.ink
                                    : AppColors.inkFaint,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final c in <String?>[null, ..._chipCategories])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: _catChip(c),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (_items.isEmpty)
                MemberSection(
                  title: _unreadOnly
                      ? 'No unread notifications'
                      : 'Nothing here yet',
                  icon: Icons.notifications_none_rounded,
                  color: TeamColors.slate,
                  child: MemberEmpty(
                    icon: _unreadOnly
                        ? Icons.notifications_off_outlined
                        : Icons.notifications_none_rounded,
                    title: _unreadOnly
                        ? 'No unread notifications'
                        : 'Nothing here yet',
                    message: 'Updates about your membership, payments, and gym '
                        'announcements will show up here.',
                  ),
                )
              else ...[
                for (final e in groups.entries) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 4, 0, 8),
                    child: Text(e.key.toUpperCase(), style: AppText.eyebrow()),
                  ),
                  for (var i = 0; i < e.value.length; i++)
                    StaggeredReveal(
                      index: i < 6 ? i : 0,
                      child: _card(e.value[i]),
                    ),
                ],
                if (_items.length < _total)
                  Center(
                    child: TextButton(
                      key: const ValueKey('notif-more'),
                      onPressed: _more
                          ? null
                          : () {
                              _pageNo++;
                              _load(more: true);
                            },
                      child: Text(
                        _more
                            ? 'Loading…'
                            : 'Load more (${_total - _items.length} left)',
                      ),
                    ),
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _catChip(String? c) {
    final meta = c == null ? null : notificationCategory(c);
    final active = _category == c;
    final color = meta?.color ?? AppColors.memberB;
    return GestureDetector(
      key: ValueKey('notif-cat-${c ?? 'all'}'),
      onTap: () =>
          c == null ? _filter(clearCategory: true) : _filter(category: c),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: active ? color.withValues(alpha: 0.16) : AppColors.surface2,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: active ? color : AppColors.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (meta != null) ...[
              Icon(meta.icon,
                  size: 15, color: active ? color : AppColors.inkSoft,),
              const SizedBox(width: 5),
            ],
            Text(
              meta?.label ?? 'Everything',
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: active ? color : AppColors.inkSoft,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _card(TenantNotification n) {
    final meta = notificationCategory(n.category);
    final unread = n.isUnread;
    final color = unread ? meta.color : TeamColors.slate;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: () => _tap(n),
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: unread
                  ? AppColors.surface2
                  : AppColors.surface2.withValues(alpha: 0.6),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: unread
                    ? meta.color.withValues(alpha: 0.45)
                    : AppColors.line,
              ),
            ),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (unread) Container(width: 4, color: meta.color),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(meta.icon, size: 19, color: color),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        n.title,
                                        style: AppText.body(
                                          size: 13.5,
                                          weight: unread
                                              ? FontWeight.w800
                                              : FontWeight.w600,
                                          color: unread
                                              ? AppColors.ink
                                              : AppColors.inkFaint,
                                        ),
                                      ),
                                    ),
                                    if (unread)
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: meta.color,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  n.body,
                                  style: AppText.body(
                                    size: 12.5,
                                    color: unread
                                        ? AppColors.inkSoft
                                        : AppColors.inkFaint,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    TeamTag(
                                        label: meta.label, color: meta.color,),
                                    Text(
                                      _ago(n.createdAt),
                                      style: AppText.body(
                                        size: 11,
                                        color: AppColors.inkFaint,
                                        weight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
