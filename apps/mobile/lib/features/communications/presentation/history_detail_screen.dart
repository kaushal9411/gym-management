import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/comm_failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/count_format.dart';
import '../../../models/comm_campaign.dart';
import '../../../models/comm_channel.dart';
import '../../../repositories/communications_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../reports/presentation/widgets/load_more_button.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show
        TeamAdaptive,
        TeamCenter,
        TeamOutlineButton,
        confirmTeam,
        teamSideInset,
        teamSnack;
import '../comm_access.dart';
import '../comm_constants.dart';
import '../comm_logic.dart';
import 'widgets/comm_widgets.dart';

enum _RecipientFilter { all, failed, skipped }

/// One send's result (design frame 7).
///
/// [ListHero] with the campaign name and "38 members · Email, SMS · 15 Oct,
/// 8:00 am", a summary card ("34 of 38 delivered" with a stacked bar —
/// sent / failed / skipped / waiting — and a legend), per-channel counts, then
/// **who got it and who did not**: All / Failed / Skipped filters (skipped
/// splits by reason: opted out, no contact, over limit, channel off) over
/// `GET .../recipients` with Load more.
///
/// Counts are message level (one per member x channel). While the campaign is
/// SENDING the screen polls (every 3 s, slowing to 15 s after two minutes) and
/// stops when it finishes; messages held for quiet hours are explained.
/// Actions need `notifications:send`: **Send again to failed only**
/// (SENT / PARTIAL / FAILED with failures) and **Cancel send** (DRAFT /
/// SCHEDULED / SENDING), each behind a confirmation. 409 state conflicts
/// refresh the screen with the server's wording.
class HistoryDetailScreen extends StatefulWidget {
  const HistoryDetailScreen({super.key, required this.campaignId});

  final String campaignId;

  @override
  State<HistoryDetailScreen> createState() => _HistoryDetailScreenState();
}

class _HistoryDetailScreenState extends State<HistoryDetailScreen> {
  late final CommAccess _access;
  CampaignDetail? _detail;
  bool _loading = true;
  String? _error;
  bool _busy = false;
  late PaginatedListCubit<CampaignRecipient> _recipients;
  int _recipientTotal = 0;
  _RecipientFilter _filter = _RecipientFilter.all;
  String? _skipReason;
  CommChannel? _channel;
  Timer? _poll;
  DateTime? _pollStart;

  CommunicationsRepository get _repo => getIt<CommunicationsRepository>();

  @override
  void initState() {
    super.initState();
    _access = CommAccess.of(context);
    _recipients = _newRecipients();
    if (_access.canView) {
      _load();
    } else {
      _loading = false;
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    _recipients.close();
    super.dispose();
  }

  PaginatedListCubit<CampaignRecipient> _newRecipients() =>
      PaginatedListCubit<CampaignRecipient>((page) async {
        final status = switch (_filter) {
          _RecipientFilter.all => null,
          _RecipientFilter.failed => kRecipientFailed,
          _RecipientFilter.skipped => _skipReason,
        };
        final r = await _repo.recipients(
          widget.campaignId,
          status: status,
          channel: _channel,
          page: page,
        );
        if (mounted) setState(() => _recipientTotal = r.total);
        return r;
      });

  Future<void> _load({bool silent = false}) async {
    if (!mounted) return;
    if (!silent) {
      setState(() {
        _loading = _detail == null;
        _error = null;
      });
    }
    try {
      final d = await _repo.campaign(widget.campaignId);
      if (!mounted) return;
      final was = _detail?.campaign.status;
      setState(() {
        _detail = d;
        _error = null;
      });
      if (!silent || was != d.campaign.status) _recipients.load();
      _syncPolling();
    } on ApiException catch (e) {
      if (mounted && !silent) setState(() => _error = e.message);
    } catch (_) {
      if (mounted && !silent) {
        setState(() => _error = 'Could not load this send. Try again.');
      }
    } finally {
      if (mounted && !silent) setState(() => _loading = false);
    }
  }

  void _syncPolling() {
    final sending = _detail?.campaign.status == CampaignStatus.sending;
    if (!sending) {
      _poll?.cancel();
      _poll = null;
      _pollStart = null;
      return;
    }
    if (_poll != null) return;
    _pollStart = DateTime.now();
    void schedule() {
      final elapsed = DateTime.now().difference(_pollStart ?? DateTime.now());
      _poll = Timer(campaignPollInterval(elapsed), () async {
        _poll = null;
        await _load(silent: true);
        if (mounted && _detail?.campaign.status == CampaignStatus.sending) {
          schedule();
        }
      });
    }

    schedule();
  }

  void _setFilter(_RecipientFilter f, {String? reason}) {
    final d = _detail;
    setState(() {
      _filter = f;
      _skipReason = f == _RecipientFilter.skipped
          ? (reason ?? d?.skipReasons.firstOrNull)
          : null;
    });
    _recipients.load();
  }

  void _setChannel(CommChannel? c) {
    if (c == _channel) return;
    setState(() => _channel = c);
    _recipients.load();
  }

  Future<void> _retry() async {
    final c = _detail!.campaign;
    final ok = await confirmTeam(
      context,
      title: 'Send again to failed only?',
      message: 'The ${groupDigits(c.failedCount)} failed '
          '${c.failedCount == 1 ? 'message' : 'messages'} go back in the '
          'queue. Members who already received it, opted out or have no '
          'contact are not messaged again.',
      confirmLabel: 'Send again',
    );
    if (!ok || !mounted) return;
    await _act(() async {
      final r = await _repo.retryFailed(widget.campaignId);
      if (mounted) {
        teamSnack(
          context,
          r.retried == 0
              ? 'Nothing to retry.'
              : 'Retrying ${groupDigits(r.retried)} '
                  '${r.retried == 1 ? 'message' : 'messages'}.',
        );
      }
    });
  }

  Future<void> _cancel() async {
    final ok = await confirmTeam(
      context,
      title: 'Cancel this send?',
      message: 'Messages that have not left yet will not be sent. Messages '
          'already handed over still finish.',
      confirmLabel: 'Cancel send',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _act(() async {
      await _repo.cancelCampaign(widget.campaignId);
      if (mounted) teamSnack(context, 'Send cancelled.');
    });
  }

  /// Runs a mutation with a double-tap guard; the busy flag always resets and
  /// failures show the specific message (a 409 also refreshes the screen).
  Future<void> _act(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
    } on ApiException catch (e) {
      final f = CommFailure.from(e);
      if (mounted) teamSnack(context, f.message, error: true);
    } catch (_) {
      if (mounted) {
        teamSnack(
          context,
          'Something went wrong. Please try again.',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (mounted) await _load(silent: true);
  }

  Widget _hero(double top) {
    final c = _detail?.campaign;
    return ListHero(
      title: c?.displayName ?? 'Send details',
      subtitle: c == null
          ? null
          : '${groupDigits(c.recipientCount)} '
              '${c.recipientCount == 1 ? 'member' : 'members'} · '
              '${c.channels.map((x) => x.label).join(', ')} · '
              '${commDateTime(c.when)}',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => Navigator.of(context).maybePop(),
      ),
      chips: [
        if (c != null)
          ListHeroChip(
            icon: switch (c.status) {
              CampaignStatus.sent => Icons.check_circle_outline_rounded,
              CampaignStatus.sending => Icons.sync_rounded,
              CampaignStatus.scheduled => Icons.schedule_rounded,
              CampaignStatus.failed => Icons.error_outline_rounded,
              _ => Icons.info_outline_rounded,
            },
            label: campaignPillText(c),
          ),
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
                icon: Icons.lock_outline_rounded,
                title: 'No access to History',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    final d = _detail;
    if (d == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            _hero(top),
            Expanded(
              child: _loading
                  ? const Padding(
                      padding: EdgeInsets.all(16),
                      child: CommSkeletonList(rows: 3, rowHeight: 90),
                    )
                  : AppErrorView(
                      message: _error ?? 'This send is unavailable.',
                      onRetry: _load,
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
        onRefresh: () async {
          await _load(silent: true);
          _recipients.load();
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: _summary(d),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                  child: _filters(d),
                ),
              ),
            ),
            _recipientsSliver(),
          ],
        ),
      ),
    );
  }

  Widget _summary(CampaignDetail d) {
    final c = d.campaign;
    final total = c.messageCount;
    final waiting = c.queuedCount;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (c.failureReason != null && c.failureReason!.isNotEmpty) ...[
          CommNotice(
            text: c.failureReason!,
            tone: CommTone.bad,
            icon: Icons.error_outline_rounded,
          ),
          const SizedBox(height: 10),
        ],
        CommCard(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: groupDigits(c.sentCount),
                      style: AppText.display(size: 28, weight: FontWeight.w800),
                    ),
                    TextSpan(
                      text: ' of ${groupDigits(total)} delivered',
                      style: AppText.body(
                        size: 14,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              _StackBar(
                parts: [
                  (c.sentCount, AppColors.success),
                  (c.failedCount, AppColors.danger),
                  (c.skippedCount, kSmsColor),
                  (waiting, kCommBrand),
                  (c.cancelledCount, AppColors.inkFaint),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _Legend(c.sentCount, 'sent', AppColors.success),
                  _Legend(c.failedCount, 'failed', AppColors.danger),
                  for (final r in d.skipReasons)
                    _Legend(
                      d.skipped(r),
                      recipientStatusLabel(r).toLowerCase(),
                      kSmsColor,
                    ),
                  _Legend(waiting, 'waiting', kCommBrand),
                  _Legend(c.cancelledCount, 'cancelled', AppColors.inkFaint),
                ],
              ),
            ],
          ),
        ),
        if (d.heldCount > 0) ...[
          const SizedBox(height: 10),
          CommNotice(
            text: '${groupDigits(d.heldCount)} SMS/WhatsApp '
                '${d.heldCount == 1 ? 'message is' : 'messages are'} held for '
                'quiet hours'
                '${d.nextReleaseAt == null ? '' : ' and go out ${commDateTime(d.nextReleaseAt)}'}.',
            tone: CommTone.run,
            icon: Icons.bedtime_outlined,
          ),
        ],
        for (final n in c.notices) ...[
          const SizedBox(height: 10),
          CommNotice(
            text: n,
            tone: CommTone.neutral,
            icon: Icons.info_outline_rounded,
          ),
        ],
        if (d.breakdown.length > 1) ...[
          const SizedBox(height: 10),
          TeamAdaptive(
            gap: 8,
            rowSpacing: 8,
            children: [for (final b in d.breakdown) _BreakdownRow(b)],
          ),
        ],
        if (_access.canSend &&
            (c.status.canRetryFailed && c.failedCount > 0 ||
                c.status.canCancel)) ...[
          const SizedBox(height: 12),
          if (c.status.canRetryFailed && c.failedCount > 0)
            TeamOutlineButton(
              label: _busy ? 'Working…' : 'Send again to failed only',
              icon: Icons.replay_rounded,
              onTap: _busy ? null : _retry,
            ),
          if (c.status.canCancel)
            Padding(
              padding: EdgeInsets.only(
                top: c.status.canRetryFailed && c.failedCount > 0 ? 8 : 0,
              ),
              child: TeamOutlineButton(
                label: _busy ? 'Working…' : 'Cancel send',
                icon: Icons.cancel_outlined,
                onTap: _busy ? null : _cancel,
              ),
            ),
        ],
      ],
    );
  }

  Widget _filters(CampaignDetail d) {
    final c = d.campaign;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CommSectionLabel('Who got it'),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            CommChip(
              label: 'All',
              selected: _filter == _RecipientFilter.all,
              onTap: () => _setFilter(_RecipientFilter.all),
            ),
            if (c.failedCount > 0)
              CommChip(
                label: 'Failed',
                selected: _filter == _RecipientFilter.failed,
                onTap: () => _setFilter(_RecipientFilter.failed),
              ),
            if (d.skipReasons.isNotEmpty)
              CommChip(
                label: 'Skipped',
                selected: _filter == _RecipientFilter.skipped,
                onTap: () => _setFilter(_RecipientFilter.skipped),
              ),
          ],
        ),
        if (_filter == _RecipientFilter.skipped &&
            d.skipReasons.length > 1) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final r in d.skipReasons)
                CommChip(
                  label: '${recipientStatusLabel(r)} · ${d.skipped(r)}',
                  selected: _skipReason == r,
                  color: kSmsColor,
                  onTap: () => _setFilter(_RecipientFilter.skipped, reason: r),
                ),
            ],
          ),
        ],
        if (c.channels.length > 1) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              CommChip(
                label: 'Any channel',
                selected: _channel == null,
                onTap: () => _setChannel(null),
              ),
              for (final ch in c.channels)
                CommChip(
                  label: ch.label,
                  selected: _channel == ch,
                  color: ch.color,
                  onTap: () => _setChannel(ch),
                ),
            ],
          ),
        ],
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _recipientsSliver() {
    return BlocBuilder<PaginatedListCubit<CampaignRecipient>,
        PaginatedListState<CampaignRecipient>>(
      bloc: _recipients,
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 24),
                child: CommSkeletonList(rows: 3, rowHeight: 52),
              ),
            ),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 320,
              child: AppErrorView(message: message, onRetry: _recipients.load),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          const SliverToBoxAdapter(
            child: SizedBox(
              height: 220,
              child: AppEmptyState(
                icon: Icons.people_outline_rounded,
                title: 'No one here',
                message: 'No messages match this filter.',
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
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                child: Column(
                  children: [
                    CommCard(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Column(
                        children: [
                          for (var i = 0; i < items.length; i++)
                            _RecipientRow(items[i], first: i == 0),
                        ],
                      ),
                    ),
                    if (hasMore)
                      LoadMoreButton(
                        loading: loadingMore,
                        onPressed: _recipients.loadMore,
                        shownCount: items.length,
                        totalCount: _recipientTotal < items.length
                            ? items.length
                            : _recipientTotal,
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

class _StackBar extends StatelessWidget {
  const _StackBar({required this.parts});

  final List<(int, Color)> parts;

  @override
  Widget build(BuildContext context) {
    final active = parts.where((p) => p.$1 > 0).toList();
    return ClipRRect(
      borderRadius: BorderRadius.circular(9),
      child: Container(
        height: 9,
        color: AppColors.line,
        child: Row(
          children: [
            for (final p in active)
              Expanded(flex: p.$1, child: Container(color: p.$2)),
          ],
        ),
      ),
    );
  }
}

class _Legend extends StatelessWidget {
  const _Legend(this.count, this.label, this.color);

  final int count;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          groupDigits(count),
          style: AppText.body(size: 12, weight: FontWeight.w800),
        ),
        const SizedBox(width: 3),
        Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}

class _BreakdownRow extends StatelessWidget {
  const _BreakdownRow(this.b);

  final ChannelBreakdown b;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      '${groupDigits(b.sent)} sent',
      if (b.failed > 0) '${groupDigits(b.failed)} failed',
      if (b.skipped > 0) '${groupDigits(b.skipped)} skipped',
      if (b.queued > 0) '${groupDigits(b.queued)} waiting',
    ];
    return CommCard(
      radius: 14,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          ChannelDot(channel: b.channel, size: 30),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  b.channel.label,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                Text(
                  parts.join(' · '),
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RecipientRow extends StatelessWidget {
  const _RecipientRow(this.r, {required this.first});

  final CampaignRecipient r;
  final bool first;

  @override
  Widget build(BuildContext context) {
    final tone = switch (r.status) {
      'SENT' => CommTone.ok,
      'FAILED' => CommTone.bad,
      'QUEUED' => CommTone.run,
      'CANCELLED' => CommTone.neutral,
      _ => CommTone.warn,
    };
    final detail = [
      if (r.channel != null) r.channel!.label,
      if (r.error != null && r.error!.isNotEmpty)
        r.error!
      else
        recipientStatusLabel(r.status).toLowerCase(),
    ].join(' · ');
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        border: first ? null : Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r.memberName.isEmpty ? r.memberCode : r.memberName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
                Text(
                  detail,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          CommPill(text: recipientStatusLabel(r.status), tone: tone),
        ],
      ),
    );
  }
}
