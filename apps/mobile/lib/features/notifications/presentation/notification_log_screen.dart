import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/message_log_item.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'notification_ui.dart';

/// Web's `MESSAGE_LOG_CHANNEL_META` / `STATUS_META`: label + colour per API
/// value (email indigo, SMS orange, WhatsApp amber; sent teal, failed red,
/// skipped slate / magenta).
const _channels = <(String, String)>[
  ('', 'All channels'),
  ('EMAIL', 'Email'),
  ('SMS', 'SMS'),
  ('WHATSAPP', 'WhatsApp'),
];
const _statuses = <(String, String)>[
  ('', 'All statuses'),
  ('SENT', 'Sent'),
  ('FAILED', 'Failed'),
  ('SKIPPED_DISABLED', 'Skipped — disabled'),
  ('SKIPPED_QUOTA', 'Skipped — quota'),
];

String messageChannelLabel(String c) => switch (c) {
      'EMAIL' => 'Email',
      'SMS' => 'SMS',
      'WHATSAPP' => 'WhatsApp',
      _ => c,
    };

Color messageChannelColor(String c) => switch (c) {
      'EMAIL' => TeamColors.indigo,
      'SMS' => kNotifOrange,
      'WHATSAPP' => TeamColors.amber,
      _ => TeamColors.slate,
    };

IconData messageChannelIcon(String c) => switch (c) {
      'EMAIL' => Icons.mail_outline_rounded,
      'SMS' => Icons.sms_outlined,
      'WHATSAPP' => Icons.chat_outlined,
      _ => Icons.send_rounded,
    };

String messageStatusLabel(String s) => switch (s) {
      'SENT' => 'Sent',
      'FAILED' => 'Failed',
      'SKIPPED_DISABLED' => 'Skipped — disabled',
      'SKIPPED_QUOTA' => 'Skipped — quota',
      _ => s,
    };

Color messageStatusColor(String s) => switch (s) {
      'SENT' => TeamColors.teal,
      'FAILED' => TeamColors.rose,
      'SKIPPED_QUOTA' => TeamColors.fuchsia,
      _ => TeamColors.slate,
    };

/// Message log — web's `/notifications/log`: every Email, SMS and WhatsApp
/// notification actually sent for the gym, with its delivery status and full
/// content (`GET /notifications/message-log`).
///
/// Same as web: hero + the Inbox / Message log / Settings tabs, the channel
/// and status filters (server params), the records (channel, recipient,
/// subject or preview, status, sent at) with Load more, and a detail sheet
/// with the full content, the failure / skip reason and the provider
/// reference. Needs `notifications:view` (the key web's page and the route
/// check); without it the screen shows "No access to the message log" and
/// makes no request. Pull to refresh. Web's numbered pagination is replaced
/// by Load more.
class NotificationLogScreen extends StatefulWidget {
  const NotificationLogScreen({super.key});

  @override
  State<NotificationLogScreen> createState() => _NotificationLogScreenState();
}

class _NotificationLogScreenState extends State<NotificationLogScreen> {
  late final NotificationAccess _access;
  late final PaginatedListCubit<MessageLogItem> _list;
  String _channel = '';
  String _status = '';
  int _total = 0;

  @override
  void initState() {
    super.initState();
    _access = NotificationAccess.of(context);
    final repo = getIt<TenantNotificationRepository>();
    _list = PaginatedListCubit<MessageLogItem>((page) async {
      final r = await repo.messageLog(
        page: page,
        channel: _channel.isEmpty ? null : _channel,
        status: _status.isEmpty ? null : _status,
      );
      if (mounted) setState(() => _total = r.total);
      return r;
    });
    if (_access.canView) _list.load();
  }

  @override
  void dispose() {
    _list.close();
    super.dispose();
  }

  void _setChannel(String v) {
    if (v == _channel) return;
    setState(() => _channel = v);
    _list.load();
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  Widget _hero(double top) => ListHero(
        title: 'Message log',
        subtitle: 'Every Email, SMS and WhatsApp notification actually sent '
            'for your gym.',
        topInset: top,
        side: 18 + teamSideInset(context),
        leading: ListHeroButton(
          icon: Icons.arrow_back_rounded,
          onTap: () => context.pop(),
        ),
        chips: [
          if (_access.canView)
            ListHeroChip(
              icon: Icons.history_rounded,
              label: '$_total ${_total == 1 ? 'message' : 'messages'}',
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
                icon: Icons.notifications_off_outlined,
                title: 'No access to the message log',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    return BlocProvider<PaginatedListCubit<MessageLogItem>>.value(
      value: _list,
      child: Scaffold(
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
                    padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        NotificationTabs(
                          active: NotificationPage.log,
                          access: _access,
                        ),
                        const SizedBox(height: 12),
                        _chips(_channels, _channel, _setChannel, null),
                        const SizedBox(height: 8),
                        _chips(
                            _statuses, _status, _setStatus, messageStatusColor,),
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

  Widget _chips(
    List<(String, String)> options,
    String value,
    ValueChanged<String> onTap,
    Color Function(String)? color,
  ) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final o in options)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: TeamFilterChip(
                label: o.$2,
                selected: value == o.$1,
                color: o.$1.isEmpty || color == null
                    ? TeamColors.violet
                    : color(o.$1),
                onTap: () => onTap(o.$1),
              ),
            ),
        ],
      ),
    );
  }

  Widget _body() {
    return BlocBuilder<PaginatedListCubit<MessageLogItem>,
        PaginatedListState<MessageLogItem>>(
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
          const SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppEmptyState(
                icon: Icons.mark_email_unread_outlined,
                title: 'No messages',
                message: 'No messages match these filters.',
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
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++)
                      FadeUp(
                        index: i.clamp(0, 6),
                        child: _MessageCard(
                          item: items[i],
                          onTap: () => _open(items[i]),
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

  void _open(MessageLogItem m) {
    showTeamSheet<void>(
      context,
      (ctx) => TeamSheetScaffold(
        icon: messageChannelIcon(m.channel),
        title: m.subject ?? m.recipient,
        subtitle:
            '${messageChannelLabel(m.channel)} · ${fmtDateTime(m.createdAt)}',
        color: messageChannelColor(m.channel),
        child: _MessageDetail(item: m),
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.item, required this.onTap});

  final MessageLogItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final m = item;
    final c = messageChannelColor(m.channel);
    final preview = m.subject ?? m.content;
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
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: c.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child:
                      Icon(messageChannelIcon(m.channel), size: 19, color: c),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          TeamTag(
                              label: messageChannelLabel(m.channel), color: c,),
                          const SizedBox(width: 6),
                          TeamTag(
                            label: messageStatusLabel(m.status),
                            color: messageStatusColor(m.status),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        preview,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 13,
                          weight: m.subject != null
                              ? FontWeight.w800
                              : FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${m.recipient} · ${fmtDateTime(m.createdAt)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.inkFaint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MessageDetail extends StatelessWidget {
  const _MessageDetail({required this.item});

  final MessageLogItem item;

  @override
  Widget build(BuildContext context) {
    final m = item;
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 22),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                TeamTag(
                  label: messageChannelLabel(m.channel),
                  color: messageChannelColor(m.channel),
                ),
                TeamTag(
                  label: messageStatusLabel(m.status),
                  color: messageStatusColor(m.status),
                ),
                TeamTag(
                  label: m.recipient,
                  color: TeamColors.slate,
                  icon: Icons.person_outline_rounded,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface3,
                borderRadius: BorderRadius.circular(16),
              ),
              child: SelectableText(
                m.content,
                style: AppText.body(size: 13, weight: FontWeight.w500),
              ),
            ),
            if (m.errorMessage != null && m.errorMessage!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: TeamColors.rose.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      size: 16,
                      color: TeamColors.rose,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        m.errorMessage!,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: TeamColors.rose,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (m.providerRef != null && m.providerRef!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                'Provider reference: ${m.providerRef}',
                style: AppText.body(
                  size: 11.5,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
