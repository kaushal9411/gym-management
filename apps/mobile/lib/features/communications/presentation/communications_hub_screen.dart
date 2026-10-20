import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/count_format.dart';
import '../../../models/comm_channel.dart';
import '../../../models/comm_overview.dart';
import '../../../repositories/communications_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamAdaptive, TeamCenter, teamSideInset, teamSnack;
import '../comm_access.dart';
import '../comm_constants.dart';
import '../comm_logic.dart';
import 'widgets/comm_widgets.dart';

/// Communications hub — the staff app's "Communications" menu entry (separate
/// from Notifications, Announcements, Templates and the Message log, which
/// stay as they are). Design frame 1.
///
/// Full-width [ListHero] with the monthly allowance at a glance (SMS,
/// WhatsApp, Email — remaining count and a used-share bar from
/// `GET /communications/overview`), three doors — **Send message**,
/// **Automations** ("9 reminders · 8 on") and **History** — and the five most
/// recent sends with a status pill.
///
/// Gating: the screen and the menu entry need `notifications:view`. Send
/// needs `notifications:send`: without it the tile is dimmed, says why, and a
/// tap explains instead of navigating. Automations and History are open to
/// every viewer (automation edits need `notifications:manage`, enforced on
/// that screen). The pushed route reloads on every return from the doors, so
/// it is not subject to the IndexedStack tab-cache trap.
///
/// Dropped vs the design: nothing. The design's sample numbers are replaced by
/// the real overview; a paid channel the gym cannot use shows "Off".
class CommunicationsHubScreen extends StatefulWidget {
  const CommunicationsHubScreen({super.key});

  @override
  State<CommunicationsHubScreen> createState() =>
      _CommunicationsHubScreenState();
}

class _CommunicationsHubScreenState extends State<CommunicationsHubScreen> {
  late final CommAccess _access;
  CommOverview? _overview;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _access = CommAccess.of(context);
    if (_access.canView) {
      _load();
    } else {
      _loading = false;
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = _overview == null;
      _error = null;
    });
    try {
      final o = await getIt<CommunicationsRepository>().overview();
      if (mounted) setState(() => _overview = o);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load Communications.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _go(String route, {Object? extra}) async {
    await context.push<Object?>(route, extra: extra);
    if (mounted) unawaited(_load());
  }

  void _send() {
    if (!_access.canSend) {
      teamSnack(context, CommAccess.sendReason, error: true);
      return;
    }
    _go(AppRoutes.communicationsSend);
  }

  Widget _hero(double top) {
    final o = _overview;
    final quotas = <ChannelQuota>[
      if (o != null)
        for (final c in const [
          CommChannel.sms,
          CommChannel.whatsapp,
          CommChannel.email,
        ])
          if (o.quota(c) case final q?) q,
    ];
    return ListHero(
      title: 'Communications',
      subtitle: 'Reach members on the right channel.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => Navigator.of(context).maybePop(),
      ),
      chips: [for (final q in quotas) _QuotaMini(quota: q)],
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
                title: 'No access to Communications',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    final o = _overview;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_error != null && o == null) ...[
                        _OverviewError(message: _error!, onRetry: _load),
                        const SizedBox(height: 12),
                      ],
                      _tiles(o),
                      CommSectionLabel(
                        'Recent',
                        trailing: o != null && o.recent.isNotEmpty
                            ? CommPress(
                                onTap: () =>
                                    _go(AppRoutes.communicationsHistory),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 4,
                                    horizontal: 4,
                                  ),
                                  child: Text(
                                    'See all',
                                    style: AppText.body(
                                      size: 12.5,
                                      weight: FontWeight.w800,
                                      color: AppColors.staffB,
                                    ),
                                  ),
                                ),
                              )
                            : null,
                      ),
                      _recent(o),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tiles(CommOverview? o) {
    final automationsLine = o == null
        ? 'Reminders that send themselves'
        : '${o.automationsTotal} reminders · ${o.automationsEnabled} on';
    final send = _DoorTile(
      icon: Icons.send_rounded,
      title: 'Send message',
      subtitle: _access.canSend
          ? 'Pick members, write, send'
          : 'You need permission to send',
      colors: const [kCommBrand, kCommBrand2],
      enabled: _access.canSend,
      onTap: _send,
    );
    final automations = _DoorTile(
      icon: Icons.settings_suggest_outlined,
      title: 'Automations',
      subtitle: automationsLine,
      colors: const [kInAppColor, kEmailColor],
      onTap: () => _go(AppRoutes.communicationsAutomations),
    );
    final history = _DoorTile(
      icon: Icons.history_rounded,
      title: 'History',
      subtitle: 'Every send and its result',
      colors: const [kSmsColor, kCommWarm],
      onTap: () => _go(AppRoutes.communicationsHistory),
    );
    return LayoutBuilder(
      builder: (context, c) {
        final tiles = [
          CommReveal(index: 0, child: send),
          CommReveal(index: 1, child: automations),
          CommReveal(index: 2, child: history),
        ];
        if (c.maxWidth >= 640) {
          return IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < tiles.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  Expanded(child: tiles[i]),
                ],
              ],
            ),
          );
        }
        return Column(
          children: [
            for (var i = 0; i < tiles.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              tiles[i],
            ],
          ],
        );
      },
    );
  }

  Widget _recent(CommOverview? o) {
    if (_loading && o == null) {
      return const CommSkeletonList(rows: 3, rowHeight: 58);
    }
    if (o == null) return const SizedBox.shrink();
    if (o.recent.isEmpty) {
      return CommCard(
        child: Column(
          children: [
            Icon(Icons.forum_outlined, color: AppColors.inkFaint, size: 30),
            const SizedBox(height: 8),
            Text(
              'No messages sent yet',
              style: AppText.body(size: 14, weight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              _access.canSend
                  ? 'Your sends will show up here with their results.'
                  : 'Sends made by your team will show up here.',
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }
    return TeamAdaptive(
      gap: 10,
      rowSpacing: 8,
      children: [
        for (var i = 0; i < o.recent.length; i++)
          CommReveal(
            index: i + 3,
            child: CommPress(
              onTap: () => _go(
                AppRoutes.communicationsHistoryDetail,
                extra: o.recent[i].id,
              ),
              child: CommCard(
                radius: 14,
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            o.recent[i].displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            campaignSubtitle(o.recent[i]),
                            maxLines: 1,
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
                    CommPill(
                      text: campaignPillText(o.recent[i]),
                      tone: campaignTone(o.recent[i]),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// "SMS left 240" mini meter on the hero (the design's `.qm`).
class _QuotaMini extends StatelessWidget {
  const _QuotaMini({required this.quota});

  final ChannelQuota quota;

  @override
  Widget build(BuildContext context) {
    final q = quota;
    final value = !q.enabled
        ? 'Off'
        : q.unlimited
            ? 'Unlimited'
            : groupDigits(q.remaining ?? 0);
    final label = q.channel == CommChannel.email
        ? 'Email left'
        : '${q.channel.label} left';
    final fraction = q.enabled && !q.unlimited ? q.usedFraction : 0.0;
    return Semantics(
      label: '$label $value',
      child: Container(
        width: 100,
        padding: const EdgeInsets.fromLTRB(9, 7, 9, 8),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 9.5,
                weight: FontWeight.w700,
                color: Colors.white.withValues(alpha: 0.85),
              ).copyWith(letterSpacing: 0.5),
            ),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.tabular(
                size: 14,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 4),
            CommMeter(
              fraction: fraction,
              color: Colors.white,
              height: 3,
              track: Colors.white.withValues(alpha: 0.28),
            ),
          ],
        ),
      ),
    );
  }
}

/// One of the three big doors (the design's `.tile`).
class _DoorTile extends StatelessWidget {
  const _DoorTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.onTap,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> colors;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return CommPress(
      onTap: onTap,
      semanticLabel: '$title. $subtitle',
      child: Opacity(
        opacity: enabled ? 1 : 0.55,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: colors),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  enabled ? icon : Icons.lock_outline_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 15, weight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
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
    );
  }
}

class _OverviewError extends StatelessWidget {
  const _OverviewError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return CommCard(
      color: AppColors.dangerSoft,
      borderColor: AppColors.danger.withValues(alpha: 0.4),
      radius: AppRadii.field,
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, color: AppColors.danger),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w600,
                color: AppColors.danger,
              ),
            ),
          ),
          const SizedBox(width: 8),
          CommPress(
            onTap: onRetry,
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: Text(
                'Retry',
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: AppColors.danger,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
