import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'measurement_ui.dart';
import 'widgets/measured_member_card.dart';

/// Body Measurements catalog — mirrors web's `/measurements` page and the
/// Members / Plans / Branches design language: gradient [ListHero] (with a
/// member facepile), the four KPI tiles and three insight panels (By branch,
/// By trainer, Not measured in 30+ days) that open bottom sheets, a toolbar
/// (search + cards / compact toggle) and rich member cards.
///
/// Deliberately NOT the full member roster: only members who already have at
/// least one measurement (`GET /measurements/members`, one row per member
/// with the latest reading and an entry count), so search, the branch filter,
/// every KPI and every panel are computed on the device from that one list.
/// Tapping a card opens `MemberMeasurementsDetailScreen`; "+" opens
/// `NewMeasurementScreen` (create-and-assign in one step).
///
/// **Gating (unchanged entry point)**: reached from the Owner / Manager /
/// Receptionist / Trainer Menu tile (`measurements:view`, no feature flag).
/// The "+" / empty-state "Record measurement" are shown only with
/// `measurements:create`, as on web.
///
/// **Dropped vs. web**: web filters this page by the header's current branch;
/// mobile has no such switch, so a Branch filter button (branches present in
/// the list, shown when there is more than one) takes its place. No sort is
/// offered, because web has none.
class MeasuredMembersScreen extends StatefulWidget {
  const MeasuredMembersScreen({super.key});

  @override
  State<MeasuredMembersScreen> createState() => _MeasuredMembersScreenState();
}

class _MeasuredMembersScreenState extends State<MeasuredMembersScreen> {
  List<MeasuredMemberOption>? _all;
  bool _loading = true;
  String? _error;

  String _search = '';
  String _branch = '';
  bool _compact = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final rows = await getIt<BodyMeasurementRepository>().listMembers();
      if (!mounted) return;
      setState(() {
        _all = rows;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load body measurements.');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_all != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  // ── derived data ──────────────────────────────────────────────────────────

  String _branchKey(MeasuredMemberOption r) =>
      r.branchId.isEmpty ? r.branchName : r.branchId;

  /// Branches present in the list: (key, name), A-Z.
  List<(String, String)> get _branches {
    final m = <String, String>{};
    for (final r in _all ?? const <MeasuredMemberOption>[]) {
      m[_branchKey(r)] = r.branchName;
    }
    return m.entries.map((e) => (e.key, e.value)).toList()
      ..sort((a, b) => a.$2.toLowerCase().compareTo(b.$2.toLowerCase()));
  }

  /// Rows after the branch filter — what the hero, KPIs and panels describe
  /// (web applies the branch before everything else).
  List<MeasuredMemberOption> get _scoped => [
        for (final r in _all ?? const <MeasuredMemberOption>[])
          if (_branch.isEmpty || _branchKey(r) == _branch) r,
      ];

  List<MeasuredMemberOption> get _visible {
    final q = _search.toLowerCase();
    if (q.isEmpty) return _scoped;
    return [
      for (final r in _scoped)
        if (r.memberName.toLowerCase().contains(q) ||
            r.memberCode.toLowerCase().contains(q))
          r,
    ];
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _open(MeasuredMemberOption r) async {
    await context.push(AppRoutes.memberMeasurementsDetail, extra: r.memberId);
    if (mounted) _load(silent: true);
  }

  Future<void> _add() async {
    await context.push(AppRoutes.newMeasurement);
    if (mounted) _load(silent: true);
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.$1, b.$2)],
      current: _branch.isEmpty ? null : _branch,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    setState(() => _branch = v);
  }

  // ── sheets ────────────────────────────────────────────────────────────────

  /// A member-per-row sheet; [detail] gives the second line, [trailing] the
  /// right-hand text.
  void _openMembersSheet({
    required String title,
    required IconData icon,
    required Color color,
    required List<MeasuredMemberOption> rows,
    required String Function(MeasuredMemberOption r) detail,
    String? subtitle,
  }) {
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: icon,
        title: title,
        subtitle: subtitle ??
            '${rows.length} ${rows.length == 1 ? 'member' : 'members'}',
        color: color,
        child: rows.isEmpty
            ? Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  'Nothing here right now.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
              )
            : Column(
                children: [
                  for (final r in rows)
                    TeamPersonRow(
                      name: r.memberName,
                      detail: detail(r),
                      color: color,
                      avatarUrl: r.profilePhotoUrl,
                      onTap: () {
                        Navigator.of(sheetContext).pop();
                        _open(r);
                      },
                    ),
                ],
              ),
      ),
    );
  }

  // ── KPIs + insights ───────────────────────────────────────────────────────

  int _totalEntries(List<MeasuredMemberOption> rows) =>
      rows.fold(0, (a, r) => a + r.count);

  List<MeasuredMemberOption> _thisWeek(List<MeasuredMemberOption> rows) => [
        for (final r in rows)
          if (daysSince(r.latest.recordedAt) <= 7) r,
      ];

  List<MeasuredMemberOption> _stale(List<MeasuredMemberOption> rows) => [
        for (final r in rows)
          if (daysSince(r.latest.recordedAt) > kMeasurementStaleDays) r,
      ]..sort(
          (a, b) => daysSince(b.latest.recordedAt)
              .compareTo(daysSince(a.latest.recordedAt)),
        );

  /// Average entries per member, one decimal ("2.5"); "0" when empty.
  String _avgText(List<MeasuredMemberOption> rows) {
    if (rows.isEmpty) return '0';
    final avg = (_totalEntries(rows) / rows.length * 10).round() / 10;
    return fmtNum(avg);
  }

  List<TeamKpi> _kpis(List<MeasuredMemberOption> rows) => [
        TeamKpi(
          label: 'Members tracked',
          value: rows.length,
          color: TeamColors.indigo,
          icon: Icons.groups_rounded,
        ),
        TeamKpi(
          label: 'Total entries logged',
          value: _totalEntries(rows),
          color: TeamColors.violet,
          icon: Icons.checklist_rounded,
        ),
        TeamKpi(
          label: 'Measured this week',
          value: _thisWeek(rows).length,
          color: TeamColors.green,
          icon: Icons.event_available_rounded,
        ),
        TeamKpi(
          label: 'Avg entries / member',
          value: 0,
          text: _avgText(rows),
          color: TeamColors.teal,
          icon: Icons.straighten_rounded,
        ),
      ];

  void _onKpi(int i, List<MeasuredMemberOption> rows) {
    final byCount = [...rows]..sort((a, b) => b.count.compareTo(a.count));
    String entries(MeasuredMemberOption r) =>
        '${r.count} ${r.count == 1 ? 'entry' : 'entries'} · '
        '${r.latest.summary}';
    switch (i) {
      case 0:
        _openMembersSheet(
          title: 'Members tracked',
          icon: Icons.groups_rounded,
          color: TeamColors.indigo,
          rows: rows,
          detail: (r) => '${r.memberCode} · ${r.branchName}',
        );
      case 1:
        _openMembersSheet(
          title: 'Total entries logged',
          icon: Icons.checklist_rounded,
          color: TeamColors.violet,
          rows: byCount,
          detail: entries,
          subtitle: '${_totalEntries(rows)} entries across ${rows.length} '
              '${rows.length == 1 ? 'member' : 'members'}',
        );
      case 2:
        _openMembersSheet(
          title: 'Measured this week',
          icon: Icons.event_available_rounded,
          color: TeamColors.green,
          rows: _thisWeek(rows),
          detail: (r) => '${ageLabel(daysSince(r.latest.recordedAt))} · '
              '${r.latest.summary}',
        );
      default:
        _openMembersSheet(
          title: 'Avg entries / member',
          icon: Icons.straighten_rounded,
          color: TeamColors.teal,
          rows: byCount,
          detail: entries,
          subtitle: '${_avgText(rows)} on average',
        );
    }
  }

  Widget _insights(List<MeasuredMemberOption> rows) {
    List<(String, int)> grouped(String Function(MeasuredMemberOption) key) {
      final counts = <String, int>{};
      for (final r in rows) {
        counts[key(r)] = (counts[key(r)] ?? 0) + 1;
      }
      return (counts.entries.toList()
            ..sort((a, b) => b.value.compareTo(a.value)))
          .take(6)
          .map((e) => (e.key, e.value))
          .toList();
    }

    String trainer(MeasuredMemberOption r) => r.trainerName ?? 'Unassigned';
    List<MeasuredMemberOption> sortedBy(
      String Function(MeasuredMemberOption) key,
    ) =>
        [...rows]..sort(
            (a, b) => key(a).toLowerCase().compareTo(key(b).toLowerCase()),
          );

    final stale = _stale(rows);
    final panels = <Widget>[
      TeamInsightCard(
        icon: Icons.apartment_rounded,
        title: 'By branch',
        color: TeamColors.indigo,
        onTap: () => _openMembersSheet(
          title: 'By branch',
          icon: Icons.apartment_rounded,
          color: TeamColors.indigo,
          rows: sortedBy((r) => r.branchName),
          detail: (r) => r.branchName,
        ),
        child: TeamBarRows(
          rows: grouped((r) => r.branchName),
          colors: const [TeamColors.indigo, TeamColors.violet],
        ),
      ),
      TeamInsightCard(
        icon: Icons.sports_rounded,
        title: 'By trainer',
        color: TeamColors.violet,
        onTap: () => _openMembersSheet(
          title: 'By trainer',
          icon: Icons.sports_rounded,
          color: TeamColors.violet,
          rows: sortedBy(trainer),
          detail: trainer,
        ),
        child: TeamBarRows(
          rows: grouped(trainer),
          colors: const [TeamColors.violet, TeamColors.fuchsia],
        ),
      ),
      TeamInsightCard(
        icon: Icons.event_busy_rounded,
        title: 'Not measured in $kMeasurementStaleDays+ days',
        color: TeamColors.amber,
        trailing: stale.isEmpty ? null : '${stale.length}',
        onTap: stale.isEmpty
            ? null
            : () => _openMembersSheet(
                  title: 'Not measured in $kMeasurementStaleDays+ days',
                  icon: Icons.event_busy_rounded,
                  color: TeamColors.amber,
                  rows: stale,
                  detail: (r) => '${daysSince(r.latest.recordedAt)} days ago',
                ),
        child: stale.isEmpty
            ? Text(
                "Everyone's up to date.",
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (final r in stale.take(6))
                    TeamPersonRow(
                      name: r.memberName,
                      detail: '${daysSince(r.latest.recordedAt)} days ago',
                      color: TeamColors.amber,
                      avatarUrl: r.profilePhotoUrl,
                      onTap: () => _open(r),
                    ),
                ],
              ),
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        if (c.maxWidth < 900) return TeamAdaptive(children: panels);
        // Wide: web's three-across row.
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < panels.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: panels[i]),
              ],
            ],
          ),
        );
      },
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final canCreate = MeasurementAccess.of(context).canCreate;
    final scoped = _scoped;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top, canCreate, scoped)),
            if (_all != null && _all!.isNotEmpty)
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TeamKpiGrid(
                          tiles: _kpis(scoped),
                          loading: false,
                          onTap: (i) => _onKpi(i, scoped),
                        ),
                        const SizedBox(height: 14),
                        _insights(scoped),
                        const SizedBox(height: 14),
                        _toolbar(),
                      ],
                    ),
                  ),
                ),
              ),
            ..._body(canCreate),
          ],
        ),
      ),
    );
  }

  List<Widget> _body(bool canCreate) {
    if (_loading && _all == null) {
      return const [
        SliverFillRemaining(hasScrollBody: false, child: AppLoadingView()),
      ];
    }
    if (_error != null && _all == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _error!, onRetry: _load),
        ),
      ];
    }
    if ((_all ?? const <MeasuredMemberOption>[]).isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.straighten_outlined,
            title: 'No measurements recorded yet',
            message: canCreate
                ? "Record a member's first measurement to see it here."
                : "A trainer, manager, or owner hasn't logged any yet.",
          ),
        ),
      ];
    }
    final items = _visible;
    if (items.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.straighten_outlined,
            title: 'No members match this search.',
            message: 'Try a different name or member ID.',
          ),
        ),
      ];
    }
    return [
      teamCardSliver<MeasuredMemberOption>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (r, i) => _Rise(
          index: i,
          child: MeasuredMemberCard(
            key: ValueKey('measured-${r.memberId}'),
            row: r,
            compact: _compact,
            onTap: () => _open(r),
          ),
        ),
      ),
    ];
  }

  Widget _toolbar() {
    final branches = _branches;
    final branchLabel = _branch.isEmpty
        ? 'All branches'
        : branches.firstWhere((b) => b.$1 == _branch).$2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          hint: 'Search name or member ID…',
          onSearch: (v) => setState(() => _search = v),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            if (branches.length > 1) ...[
              Expanded(
                child: TeamToolbarButton(
                  icon: Icons.apartment_rounded,
                  label: branchLabel,
                  active: _branch.isNotEmpty,
                  onTap: _pickBranch,
                ),
              ),
              const SizedBox(width: 8),
            ] else
              const Spacer(),
            MeasurementViewToggle(
              compact: _compact,
              onChanged: (v) => setState(() => _compact = v),
            ),
          ],
        ),
      ],
    );
  }

  Widget _hero(double top, bool canCreate, List<MeasuredMemberOption> rows) {
    final loaded = _all != null;
    return ListHero(
      title: 'Body Measurements',
      subtitle: 'Members with a recorded measurement history.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (canCreate) ListHeroButton(icon: Icons.add_rounded, onTap: _add),
      ],
      chips: [
        if (loaded)
          ListHeroChip(
            icon: Icons.groups_rounded,
            label: '${rows.length} ${rows.length == 1 ? 'member' : 'members'}',
          ),
        if (loaded && rows.isNotEmpty) _Facepile(rows: rows),
      ],
    );
  }
}

/// Up to six overlapping member photos + "+N more" (web's hero facepile).
class _Facepile extends StatelessWidget {
  const _Facepile({required this.rows});

  final List<MeasuredMemberOption> rows;

  @override
  Widget build(BuildContext context) {
    final shown = rows.take(6).toList();
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 28.0 + (shown.length - 1) * 20,
          height: 30,
          child: Stack(
            children: [
              for (var i = 0; i < shown.length; i++)
                Positioned(
                  left: i * 20.0,
                  child: Container(
                    padding: const EdgeInsets.all(1.5),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                    child: UserAvatar(
                      avatarUrl: shown[i].profilePhotoUrl,
                      name: shown[i].memberName,
                      size: 24,
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (rows.length > shown.length) ...[
          const SizedBox(width: 8),
          Text(
            '+${rows.length - shown.length} more',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.92),
            ),
          ),
        ],
      ],
    );
  }
}

/// Rises into place; capped delay so rows far down the list don't wait.
class _Rise extends StatelessWidget {
  const _Rise({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 380 + (index.clamp(0, 6)) * 60),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
