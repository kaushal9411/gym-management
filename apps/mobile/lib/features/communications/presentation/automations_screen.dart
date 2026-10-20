import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/comm_failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/comm_automation.dart';
import '../../../models/comm_channel.dart';
import '../../../repositories/communications_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamAdaptive, TeamCenter, showTeamSheet, teamSideInset, teamSnack;
import '../comm_access.dart';
import '../comm_constants.dart';
import '../comm_logic.dart';
import 'automation_edit_sheet.dart';
import 'widgets/comm_widgets.dart';

/// Automations — reminders that send themselves (design frame 6).
///
/// [ListHero] ("N reminders · M on"), then one card per rule (the API always
/// returns the same nine): name, timing summary ("7, 3, 1 days before"), an
/// on/off switch and the five channel dots (unused ones faded). The switch
/// saves immediately (`PUT`, awaiting the response — no optimistic update — and
/// showing a spinner on that switch meanwhile); tapping the card opens the edit
/// sheet ([AutomationEditSheet]).
///
/// Gating: viewing needs `notifications:view`; switches, saving and the test
/// need `notifications:manage` — without it the switches are locked, a note
/// says why, and the sheet is read-only. Skeleton / error-with-retry /
/// pull-to-refresh as everywhere; a failed switch shows the specific reason in
/// a snackbar and leaves the switch where the server has it.
class AutomationsScreen extends StatefulWidget {
  const AutomationsScreen({super.key});

  @override
  State<AutomationsScreen> createState() => _AutomationsScreenState();
}

class _AutomationsScreenState extends State<AutomationsScreen> {
  late final CommAccess _access;
  AutomationList? _data;
  bool _loading = true;
  String? _error;
  final _busy = <String>{};

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
      _loading = _data == null;
      _error = null;
    });
    try {
      final d = await getIt<CommunicationsRepository>().automations();
      if (mounted) setState(() => _data = d);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not load automations.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _replace(AutomationRule updated) {
    final d = _data;
    if (d == null) return;
    setState(() {
      _data = AutomationList(
        quietHours: d.quietHours,
        items: [for (final r in d.items) r.key == updated.key ? updated : r],
      );
    });
  }

  Future<void> _toggle(AutomationRule r, bool value) async {
    if (_busy.contains(r.key)) return;
    if (value && r.channels.isEmpty) {
      teamSnack(context, 'Choose at least one channel first.', error: true);
      await _open(r);
      return;
    }
    setState(() => _busy.add(r.key));
    try {
      final updated = await getIt<CommunicationsRepository>().updateAutomation(
        r.key,
        enabled: value,
        channels: r.channels,
        offsets: r.timing.editable ? r.offsets : null,
      );
      _replace(updated);
    } on ApiException catch (e) {
      final f = CommFailure.from(e, permission: 'notifications:manage');
      if (mounted) teamSnack(context, f.message, error: true);
    } catch (_) {
      if (mounted) {
        teamSnack(context, 'Could not save. Please try again.', error: true);
      }
    } finally {
      if (mounted) setState(() => _busy.remove(r.key));
    }
  }

  Future<void> _open(AutomationRule r) async {
    final saved = await showTeamSheet<AutomationRule>(
      context,
      (_) => AutomationEditSheet(rule: r, access: _access),
    );
    if (saved != null && mounted) {
      _replace(saved);
      teamSnack(context, '${saved.label} saved.');
    }
  }

  Widget _hero(double top) {
    final d = _data;
    return ListHero(
      title: 'Automations',
      subtitle: 'Reminders that send themselves.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => Navigator.of(context).maybePop(),
      ),
      chips: [
        if (d != null)
          ListHeroChip(
            icon: Icons.bolt_rounded,
            label: '${d.items.length} reminders · ${d.enabledCount} on',
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
                title: 'No access to Automations',
                message: "You don't have permission to view notifications.",
              ),
            ),
          ],
        ),
      );
    }
    final d = _data;
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
                  child: d == null
                      ? (_loading
                          ? const CommSkeletonList(rows: 5, rowHeight: 78)
                          : SizedBox(
                              height: 340,
                              child: AppErrorView(
                                message: _error ?? 'Automations unavailable.',
                                onRetry: _load,
                              ),
                            ))
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (!_access.canManage) ...[
                              const CommNotice(
                                text: CommAccess.manageReason,
                                tone: CommTone.neutral,
                                icon: Icons.lock_outline_rounded,
                              ),
                              const SizedBox(height: 12),
                            ],
                            TeamAdaptive(
                              gap: 10,
                              rowSpacing: 10,
                              children: [
                                for (var i = 0; i < d.items.length; i++)
                                  CommReveal(
                                    index: i.clamp(0, 6),
                                    child: _RuleCard(
                                      rule: d.items[i],
                                      busy: _busy.contains(d.items[i].key),
                                      canManage: _access.canManage,
                                      onTap: () => _open(d.items[i]),
                                      onToggle: (v) => _toggle(d.items[i], v),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              kCommQuietNote,
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w600,
                                color: AppColors.inkFaint,
                              ),
                            ),
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
}

class _RuleCard extends StatelessWidget {
  const _RuleCard({
    required this.rule,
    required this.busy,
    required this.canManage,
    required this.onTap,
    required this.onToggle,
  });

  final AutomationRule rule;
  final bool busy;
  final bool canManage;
  final VoidCallback onTap;
  final ValueChanged<bool> onToggle;

  @override
  Widget build(BuildContext context) {
    final r = rule;
    return CommPress(
      onTap: onTap,
      semanticLabel: '${r.label}. ${r.timingSummary}. '
          '${r.enabled ? 'On' : 'Off'}. Opens details.',
      child: CommCard(
        padding: const EdgeInsets.fromLTRB(13, 10, 5, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        r.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      Text(
                        r.timingSummary,
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
                CommSwitch(
                  value: r.enabled,
                  busy: busy,
                  semanticLabel: '${r.label} on or off',
                  onChanged: canManage ? onToggle : null,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                for (final c in CommChannel.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 4),
                    child: ChannelDot(
                      channel: c,
                      size: 20,
                      faded: !r.channels.contains(c),
                    ),
                  ),
                if (r.sentLast7Days > 0)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: Text(
                        '${r.sentLast7Days} sent in 7 days',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.right,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w700,
                          color: AppColors.inkSoft,
                        ),
                      ),
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
