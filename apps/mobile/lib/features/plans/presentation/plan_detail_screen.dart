import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'plan_actions.dart';
import 'plan_ui.dart';

const _tabNames = ['Overview', 'Pricing', 'Features', 'Manage'];

/// Membership plan profile (`GET /membership-plans/:id`), redesigned to
/// mirror web's `/memberships/[planId]` page and the Branch / Staff / Member
/// profiles: animated gradient hero (price, status, edit / duplicate /
/// activate), four summary tiles and four tabs.
///
/// - **Overview** — description and notes, the ✓ / ✗ "what's included"
///   checklist and the branches the plan is valid at.
/// - **Pricing** — the price -> discount -> tax -> registration fee -> total
///   breakdown card plus the individual numbers (savings, per month).
/// - **Features** — the quotas (PT sessions, group classes, guest passes) as
///   animated tiles and the freeze rules.
/// - **Manage** — the lifecycle actions web puts in the hero (Duplicate,
///   Activate / Deactivate, Delete; gated by `memberships:create` / `update`
///   / `delete`) and the record dates.
///
/// Soft-deleted plans 404 on this endpoint, so the list opens a restore
/// sheet for them instead of this screen. Pops with a plan id when Duplicate
/// created a draft (the list opens it), else with null.
///
/// Dropped vs. web: nothing with an endpoint. Web has no "members on this
/// plan" list either — and the member list endpoint can't filter by plan —
/// so only `memberCount` (ACTIVE memberships) is shown.
class PlanDetailScreen extends StatefulWidget {
  const PlanDetailScreen({super.key, required this.planId});

  final String planId;

  @override
  State<PlanDetailScreen> createState() => _PlanDetailScreenState();
}

class _PlanDetailScreenState extends State<PlanDetailScreen> {
  MembershipPlan? _plan;
  List<BranchOption> _branches = const [];
  String? _error;
  bool _busy = false;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
    _loadBranches();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final plan = await getIt<MembershipPlanRepository>().getById(
        widget.planId,
      );
      if (!mounted) return;
      setState(() => _plan = plan);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this plan ($e)');
    }
  }

  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // Names are garnish; counts still show without branches:view.
    }
  }

  Map<String, String> get _branchNames => {
        for (final b in _branches) b.id: b.name,
      };

  Future<void> _edit(MembershipPlan p) =>
      context.push(AppRoutes.membershipPlanForm, extra: p).then((_) => _load());

  Future<void> _run(PlanAction action) async {
    final p = _plan!;
    setState(() => _busy = true);
    try {
      final r = await runPlanAction(context, p, action);
      if (!mounted || !r.ok) return;
      if (action == PlanAction.delete) {
        context.pop();
        return;
      }
      if (action == PlanAction.duplicate && r.created != null) {
        context.pop(r.created!.id);
        return;
      }
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<PlanAction> _actions(MembershipPlan p) => availablePlanActions(
        p,
        canCreate: teamCan(context, 'memberships:create'),
        canUpdate: teamCan(context, 'memberships:update'),
        canDelete: teamCan(context, 'memberships:delete'),
        canRestore: teamCan(context, 'memberships:restore'),
      );

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final p = _plan;
    final hero = p != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Membership plan' : 'Membership Plans'),
        actions: [if (p != null && _error == null) _overflow(p)],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : p == null
                ? const AppLoadingView()
                : _content(p),
      ),
    );
  }

  Widget _overflow(MembershipPlan p) {
    final canUpdate = teamCan(context, 'memberships:update');
    final actions = _actions(p);
    if (!canUpdate && actions.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      enabled: !_busy,
      onSelected: (v) {
        if (v == 'edit') {
          _edit(p);
        } else {
          _run(PlanAction.values.firstWhere((a) => a.name == v));
        }
      },
      itemBuilder: (_) => [
        if (canUpdate)
          const PopupMenuItem(value: 'edit', child: Text('Edit plan')),
        for (final a in actions)
          PopupMenuItem(
            value: a.name,
            child: Text(
              a.label,
              style: a == PlanAction.delete
                  ? const TextStyle(color: AppColors.danger)
                  : null,
            ),
          ),
      ],
    );
  }

  Widget _content(MembershipPlan p) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canUpdate = teamCan(context, 'memberships:update');
    final canCreate = teamCan(context, 'memberships:create');
    final tone = planTone(p);
    final b = p.breakdown;

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          PlanHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      SpinningRing(
                        size: 104,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF312E81), Color(0xFFC026D3)],
                            ),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.card_membership_rounded,
                              size: 44,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 4,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: PulseDot(color: tone, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    p.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    [
                      if (p.planCode.isNotEmpty) p.planCode,
                      if (p.category != null) p.category!,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                FadeUp(
                  index: 3,
                  child: Column(
                    children: [
                      PriceCountUp(
                        value: p.finalPrice,
                        style: AppText.display(size: 34, color: Colors.white),
                      ),
                      Text(
                        b.hasAdjustment
                            ? 'for ${p.durationLabel} · base ${planMoney(p.price)}'
                            : 'for ${p.durationLabel}',
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 4,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(planStatus(p), dot: tone),
                      TeamHeroPill(
                        p.durationLabel,
                        icon: Icons.timelapse_rounded,
                      ),
                      TeamHeroPill(
                        '${p.memberCount} '
                        '${p.memberCount == 1 ? 'member' : 'members'}',
                        icon: Icons.groups_rounded,
                      ),
                      TeamHeroPill(
                        planBranchAccess(p, names: _branchNames),
                        icon: Icons.storefront_rounded,
                      ),
                    ],
                  ),
                ),
                if (canUpdate || canCreate) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 5,
                    child: Row(
                      children: [
                        if (canUpdate)
                          TeamHeroAction(
                            label: 'Edit',
                            icon: Icons.edit_rounded,
                            onTap: _busy ? null : () => _edit(p),
                          ),
                        if (canCreate) ...[
                          if (canUpdate) const SizedBox(width: 8),
                          TeamHeroAction(
                            label: 'Duplicate',
                            icon: Icons.copy_rounded,
                            onTap:
                                _busy ? null : () => _run(PlanAction.duplicate),
                          ),
                        ],
                        if (canUpdate) ...[
                          const SizedBox(width: 8),
                          TeamHeroAction(
                            label: p.isActive ? 'Deactivate' : 'Activate',
                            icon: p.isActive
                                ? Icons.pause_circle_rounded
                                : Icons.play_circle_rounded,
                            onTap: _busy
                                ? null
                                : () => _run(
                                      p.isActive
                                          ? PlanAction.deactivate
                                          : PlanAction.activate,
                                    ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              14,
              16 + teamSideInset(context),
              14,
            ),
            child: TeamSummaryGrid(
              tiles: [
                TeamSummaryTile(
                  index: 0,
                  icon: Icons.payments_rounded,
                  color: TeamColors.green,
                  label: 'Plan price',
                  text: planMoney(p.finalPrice),
                  hint: b.hasAdjustment
                      ? 'Base ${planMoney(p.price)}'
                      : 'No discount or tax',
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.timelapse_rounded,
                  color: TeamColors.teal,
                  label: 'Duration',
                  text: p.durationLabel,
                  hint: '~${p.approxDays} days',
                ),
                TeamSummaryTile(
                  index: 2,
                  icon: Icons.groups_rounded,
                  color: TeamColors.violet,
                  label: 'Members',
                  number: p.memberCount,
                  hint: 'Active memberships',
                ),
                TeamSummaryTile(
                  index: 3,
                  icon: Icons.how_to_reg_rounded,
                  color: TeamColors.rose,
                  label: 'Total at sign-up',
                  text: planMoney(p.totalWithJoiningFee),
                  hint: p.joiningFee > 0
                      ? 'Incl. ${planMoney(p.joiningFee)} fee'
                      : 'No registration fee',
                ),
              ],
            ),
          ),
          TeamTabBar(
            names: _tabNames,
            index: _tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 14),
          Padding(
            padding:
                EdgeInsets.symmetric(horizontal: 16 + teamSideInset(context)),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.04, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: Column(
                key: ValueKey(_tab),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: switch (_tab) {
                  0 => _overview(p, canUpdate),
                  1 => _pricing(p, canUpdate),
                  2 => _features(p, canUpdate),
                  _ => _manage(p),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Lays [cards] in one column, or two independent columns on a wide
  /// screen (no equal-height rows: the cards contain LayoutBuilders, which
  /// can't live inside an IntrinsicHeight).
  List<Widget> _grid(List<Widget> cards) => [
        LayoutBuilder(
          builder: (context, c) {
            Widget stack(List<Widget> items) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) const SizedBox(height: 14),
                      items[i],
                    ],
                  ],
                );
            final animated = [
              for (var i = 0; i < cards.length; i++)
                FadeUp(index: i, child: cards[i]),
            ];
            if (c.maxWidth < 720) return stack(animated);
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: stack([
                    for (var i = 0; i < animated.length; i += 2) animated[i],
                  ]),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: stack([
                    for (var i = 1; i < animated.length; i += 2) animated[i],
                  ]),
                ),
              ],
            );
          },
        ),
      ];

  // ── Overview ──────────────────────────────────────────────────────────────

  List<Widget> _overview(MembershipPlan p, bool canUpdate) {
    void edit() => _edit(p);
    final names = _branchNames;
    return _grid([
      TeamSectionCard(
        icon: Icons.notes_rounded,
        color: TeamColors.indigo,
        title: 'About this plan',
        subtitle: 'What members see',
        onEdit: canUpdate ? edit : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              p.description ?? 'No description yet.',
              style: AppText.body(
                size: 13,
                weight: FontWeight.w600,
                color:
                    p.description == null ? AppColors.inkFaint : AppColors.ink,
              ),
            ),
            const SizedBox(height: 12),
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.tag_rounded,
                  label: 'Plan code',
                  value: p.planCode,
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.sell_rounded,
                  label: 'Category',
                  value: p.category,
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.format_list_numbered_rounded,
                  label: 'Display order',
                  value: '${p.displayOrder}',
                  color: TeamColors.amber,
                ),
                TeamFieldTile(
                  icon: Icons.sticky_note_2_rounded,
                  label: 'Internal notes',
                  value: p.notes,
                  color: TeamColors.rose,
                  maxLines: 4,
                ),
              ],
            ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.fact_check_rounded,
        color: TeamColors.green,
        title: "What's included",
        subtitle: p.perksSummary,
        onEdit: canUpdate ? edit : null,
        child: Column(
          children: [
            for (final k in planPerks(p, branchNames: names))
              PlanPerkRow(perk: k),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.storefront_rounded,
        color: TeamColors.teal,
        title: 'Branch access',
        subtitle: p.gymAccessAllBranches
            ? 'Valid everywhere'
            : 'Limited to selected branches',
        onEdit: canUpdate ? edit : null,
        child: p.gymAccessAllBranches
            ? const TeamCheckRow(
                label: 'Valid at all branches, including new ones',
                ok: true,
                color: TeamColors.teal,
              )
            : p.accessBranchIds.isEmpty
                ? const TeamCheckRow(
                    label: 'No branches selected - nobody can use this plan',
                    ok: false,
                  )
                : Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final id in p.accessBranchIds)
                        TeamTag(
                          label: names[id] ??
                              'Branch ${id.substring(0, id.length < 8 ? id.length : 8)}',
                          color: TeamColors.teal,
                          icon: Icons.place_rounded,
                        ),
                    ],
                  ),
      ),
    ]);
  }

  // ── Pricing ───────────────────────────────────────────────────────────────

  List<Widget> _pricing(MembershipPlan p, bool canUpdate) {
    final b = p.breakdown;
    final perMonth = planPricePerMonth(p);
    String pct(double v) =>
        v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
    return _grid([
      PlanPriceCard(
        breakdown: b,
        name: p.name,
        durationLabel: p.durationLabel,
        perMonth: perMonth,
      ),
      TeamSectionCard(
        icon: Icons.calculate_rounded,
        color: TeamColors.amber,
        title: 'Price details',
        subtitle: 'Discount first, then tax',
        onEdit: canUpdate ? () => _edit(p) : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.sell_rounded,
              label: 'Base price',
              value: planMoney(p.price),
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.local_offer_rounded,
              label: 'Discount',
              value: p.discountPercentage > 0
                  ? '${pct(p.discountPercentage)}% (-${planMoney(b.discountAmount)})'
                  : 'None',
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.account_balance_rounded,
              label: 'Tax',
              value: p.taxPercentage > 0
                  ? '${pct(p.taxPercentage)}% (+${planMoney(b.taxAmount)})'
                  : 'None',
              color: TeamColors.amber,
            ),
            TeamFieldTile(
              icon: Icons.how_to_reg_rounded,
              label: 'Registration fee',
              value: p.joiningFee > 0 ? planMoney(p.joiningFee) : 'None',
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.savings_rounded,
              label: 'Member saves',
              value: b.discountAmount > 0 ? planMoney(b.discountAmount) : '—',
              color: TeamColors.teal,
            ),
            TeamFieldTile(
              icon: Icons.calendar_month_rounded,
              label: 'Per month',
              value: perMonth == null ? '—' : '~${planMoney(perMonth)}',
              color: TeamColors.violet,
            ),
          ],
        ),
      ),
    ]);
  }

  // ── Features ──────────────────────────────────────────────────────────────

  List<Widget> _features(MembershipPlan p, bool canUpdate) {
    return _grid([
      TeamSectionCard(
        icon: Icons.speed_rounded,
        color: TeamColors.violet,
        title: 'Quotas',
        subtitle: 'Included for the whole membership',
        onEdit: canUpdate ? () => _edit(p) : null,
        child: Row(
          children: [
            _Quota(
              icon: Icons.sports_gymnastics_rounded,
              color: TeamColors.violet,
              label: 'PT sessions',
              value: p.ptSessionsIncluded,
            ),
            const SizedBox(width: 8),
            _Quota(
              icon: Icons.groups_rounded,
              color: TeamColors.teal,
              label: 'Group classes',
              value: p.groupClassesIncluded,
            ),
            const SizedBox(width: 8),
            _Quota(
              icon: Icons.person_add_alt_1_rounded,
              color: TeamColors.rose,
              label: 'Guest passes',
              value: p.guestPasses,
            ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.checklist_rounded,
        color: TeamColors.green,
        title: 'Perks & rules',
        subtitle: p.perksSummary,
        onEdit: canUpdate ? () => _edit(p) : null,
        child: Column(
          children: [
            for (final k in planPerks(p, branchNames: _branchNames))
              PlanPerkRow(perk: k),
            if (p.freezeAllowed)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  p.freezeDaysLimit == null
                      ? 'Members can freeze with no day cap.'
                      : 'Members can freeze for up to '
                          '${p.freezeDaysLimit} days in total.',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        ),
      ),
    ]);
  }

  // ── Manage ────────────────────────────────────────────────────────────────

  List<Widget> _manage(MembershipPlan p) {
    final actions = _actions(p);
    return _grid([
      TeamSectionCard(
        icon: Icons.tune_rounded,
        color: TeamColors.indigo,
        title: 'Manage plan',
        subtitle: 'Changes apply to new assignments only',
        child: actions.isEmpty
            ? Text(
                'You do not have permission to change this plan.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (final a in actions)
                    TeamActionTile(
                      icon: a.icon,
                      label: a.label,
                      color: a.color,
                      busy: _busy,
                      hint: switch (a) {
                        PlanAction.duplicate =>
                          'Creates an inactive "${p.name} (Copy)"',
                        PlanAction.activate =>
                          'Members can be assigned to it again',
                        PlanAction.deactivate =>
                          'Stops new assignments; current members keep it',
                        PlanAction.delete =>
                          'Soft-delete; restorable, members untouched',
                        PlanAction.restore => null,
                      },
                      onTap: () => _run(a),
                    ),
                ],
              ),
      ),
      TeamSectionCard(
        icon: Icons.history_rounded,
        color: TeamColors.sky,
        title: 'Record',
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.add_circle_rounded,
              label: 'Created',
              value: fmtDate(p.createdAt),
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.update_rounded,
              label: 'Last updated',
              value: fmtDate(p.updatedAt),
              color: TeamColors.amber,
            ),
            TeamFieldTile(
              icon: Icons.groups_rounded,
              label: 'Active members',
              value: '${p.memberCount}',
              color: TeamColors.violet,
            ),
            TeamFieldTile(
              icon: Icons.tag_rounded,
              label: 'Plan code',
              value: p.planCode,
              color: TeamColors.indigo,
            ),
          ],
        ),
      ),
    ]);
  }
}

/// A big animated quota number (PT sessions, group classes, guest passes).
class _Quota extends StatelessWidget {
  const _Quota({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    final on = value > 0;
    final c = on ? color : AppColors.inkFaint;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
        decoration: BoxDecoration(
          color: c.withValues(alpha: on ? 0.10 : 0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: c.withValues(alpha: on ? 0.28 : 0.12)),
        ),
        child: Column(
          children: [
            Icon(icon, size: 20, color: c),
            const SizedBox(height: 6),
            CountUp(value: value, style: AppText.display(size: 22, color: c)),
            const SizedBox(height: 2),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
