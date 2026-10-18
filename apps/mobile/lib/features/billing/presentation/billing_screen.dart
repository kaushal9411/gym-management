import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/subscription_plan_info.dart';
import '../../../repositories/billing_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'billing_ui.dart';
import 'cancel_subscription_sheet.dart';
import 'plan_comparison.dart';

/// Billing & Subscription — web's `/billing` overview, redesigned for the phone
/// and tablet.
///
/// Same order as web: gradient hero (current plan / status / renews-on / next
/// amount + "Change plan" and "Cancel subscription"), the cancel-at-period-end
/// notice, the subscription summary (plan + price + period progress, and the
/// details panel: cycle, period start, renews/ends, trial end, grace end),
/// then the plan comparison + checkout ("Change plan" / "Choose a plan"). The
/// other three web sections (History, Invoices, Address) are reached from the
/// section tiles that stand in for web's tab bar.
///
/// **Kept from before the redesign** (mobile behaviour that web lacks): the
/// "Usage this cycle" card — `GET /subscription` carries plan *limits* only,
/// so the numerators are the real `total`s from the branches / staff / members
/// list endpoints. **Added** (web has it, endpoint exists, no native plumbing
/// needed): Cancel subscription (at period end / immediately,
/// `POST /subscription/cancel`).
///
/// Gating: unchanged — the Owner and Manager Menu tile needs `billing:read`;
/// nothing inside is hidden per permission (web doesn't either; the API
/// enforces `billing:manage` and the 403 message is shown).
///
/// **Not on mobile**: nothing from web's overview is dropped.
class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  final _plansKey = GlobalKey();
  TenantSubscription? _subscription;
  ({int branches, int staff, int members})? _usage;
  bool _loaded = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final subscription =
          await getIt<BillingRepository>().currentSubscription();
      if (!mounted) return;
      setState(() {
        _subscription = subscription;
        _loaded = true;
      });
      if (subscription == null) return;
      final (branches, staff, members) = await (
        getIt<BranchRepository>().list(limit: 1),
        getIt<StaffRepository>().list(),
        getIt<MemberRepository>().list(),
      ).wait;
      if (!mounted) return;
      setState(
        () => _usage = (
          branches: branches.total,
          staff: staff.total,
          members: members.total,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      // A failed usage lookup must not hide a subscription that did load.
      if (_subscription == null) {
        setState(() {
          _error = e.message;
          _loaded = true;
        });
      }
    } catch (e) {
      if (!mounted) return;
      if (_subscription == null) {
        setState(() {
          _error = 'Could not load your subscription ($e)';
          _loaded = true;
        });
      }
    }
  }

  Future<void> _scrollToPlans() async {
    final ctx = _plansKey.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _cancel(TenantSubscription sub) async {
    final result = await showCancelSubscriptionSheet(context);
    if (result == null || !mounted) return;
    teamSnack(
      context,
      result == CancelResult.immediately
          ? 'Subscription cancelled'
          : 'Subscription will cancel at period end',
    );
    _load();
  }

  List<BillingHeroStat> _stats(TenantSubscription s) => [
        BillingHeroStat(value: s.plan.name, label: 'Current plan'),
        BillingHeroStat(
          value: prettyEnum(s.status),
          label: 'Status',
          dot: billingStatusColor(s.status),
        ),
        BillingHeroStat(
          value: billingDate(s.currentPeriodEnd),
          label: s.cancelAtPeriodEnd ? 'Ends on' : 'Renews on',
        ),
        if (!s.cancelAtPeriodEnd)
          BillingHeroStat(
            value: billingMoney(s.cyclePrice, s.plan.currency),
            label: 'Next amount',
          ),
      ];

  @override
  Widget build(BuildContext context) {
    final appName = context.watch<PlatformConfigCubit>().state.appName;
    final top = MediaQuery.of(context).padding.top;
    final sub = _subscription;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: BillingHero(
                topInset: top,
                subtitle: 'Manage your $appName plan, payment, and invoices.',
                statsLoading: !_loaded,
                stats: sub == null ? const [] : _stats(sub),
                onBack: () => context.pop(),
                actions: [
                  if (sub != null) ...[
                    BillingHeroButton(
                      key: const ValueKey('billing-change-plan'),
                      label: 'Change plan',
                      icon: Icons.swap_horiz_rounded,
                      solid: true,
                      onTap: _scrollToPlans,
                    ),
                    if (sub.isCancellable)
                      BillingHeroButton(
                        key: const ValueKey('billing-cancel'),
                        label: 'Cancel subscription',
                        icon: Icons.cancel_outlined,
                        onTap: () => _cancel(sub),
                      ),
                  ],
                ],
              ),
            ),
            if (_error != null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: AppErrorView(message: _error!, onRetry: _load),
              )
            else
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 32),
                    child: _content(sub),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _content(TenantSubscription? sub) {
    if (!_loaded) return const _SummarySkeleton();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (sub == null)
          const BillingEmptyBlock(
            icon: Icons.auto_awesome_rounded,
            title: 'No subscription yet',
            message: 'Pick a plan below to activate your gym — your members, '
                'schedules and data are all waiting exactly where you left '
                'them.',
          )
        else ...[
          if (sub.cancelAtPeriodEnd) ...[
            FormAlert(
              message: 'This subscription will cancel on '
                  '${billingDate(sub.currentPeriodEnd)}.',
            ),
            const SizedBox(height: 12),
          ],
          _SummaryRow(subscription: sub),
          if (_usage != null) ...[
            const SizedBox(height: 14),
            _UsageCard(usage: _usage!, plan: sub.plan),
          ],
        ],
        const SizedBox(height: 14),
        const _SectionTiles(),
        const SizedBox(height: 26),
        Column(
          key: _plansKey,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              sub == null ? 'Choose a plan' : 'Change plan',
              style: AppText.display(size: 21),
            ),
            const SizedBox(height: 2),
            Text(
              'Tax is calculated at checkout from your billing address.',
              style: AppText.body(
                size: 12.5,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
            PlanComparisonList(
              currentPlanSlug: sub?.plan.slug,
              currentSortOrder: sub?.plan.sortOrder,
              onChanged: _load,
            ),
          ],
        ),
      ],
    );
  }
}

class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();

  @override
  Widget build(BuildContext context) {
    Widget block() => Container(
          height: 150,
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.line),
          ),
        );
    return Column(
      children: [block(), const SizedBox(height: 14), block()],
    );
  }
}

/// web's plan card (price + period progress) and details panel side by side
/// (1.4 : 1) on wide screens, stacked on phones.
class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.subscription});

  final TenantSubscription subscription;

  @override
  Widget build(BuildContext context) {
    final plan = _PlanCardPanel(subscription: subscription);
    final details = _DetailsPanel(subscription: subscription);
    return LayoutBuilder(
      builder: (context, c) {
        if (c.maxWidth < 700) {
          return Column(children: [plan, const SizedBox(height: 14), details]);
        }
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(flex: 14, child: plan),
              const SizedBox(width: 14),
              Expanded(flex: 10, child: details),
            ],
          ),
        );
      },
    );
  }
}

class _PlanCardPanel extends StatelessWidget {
  const _PlanCardPanel({required this.subscription});

  final TenantSubscription subscription;

  @override
  Widget build(BuildContext context) {
    final s = subscription;
    final progress = billingPeriodProgress(
      start: s.currentPeriodStart,
      end: s.currentPeriodEnd,
    );
    return TeamSectionCard(
      icon: Icons.workspace_premium_rounded,
      color: TeamColors.indigo,
      title: s.plan.name,
      subtitle: s.plan.description.isEmpty ? null : s.plan.description,
      trailing: BillingStatusPill(status: s.status),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  billingMoney(s.cyclePrice, s.plan.currency),
                  key: const ValueKey('billing-price'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(size: 34, color: TeamColors.indigo),
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '/ ${s.isYearly ? 'year' : 'month'}',
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
            ],
          ),
          if (progress != null) ...[
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    '${progress.daysLeft} '
                    '${progress.daysLeft == 1 ? 'day' : 'days'} remaining',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 13, weight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    '${progress.elapsedPct.round()}% of period used',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            GrowBar(
              ratio: progress.elapsedPct / 100,
              colors: const [TeamColors.indigo, TeamColors.fuchsia],
              height: 10,
              track: AppColors.surface3,
            ),
            const SizedBox(height: 6),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  billingDate(s.currentPeriodStart),
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                Text(
                  billingDate(s.currentPeriodEnd),
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
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

class _DetailsPanel extends StatelessWidget {
  const _DetailsPanel({required this.subscription});

  final TenantSubscription subscription;

  @override
  Widget build(BuildContext context) {
    final s = subscription;
    final rows = <(IconData, String, String)>[
      (
        Icons.credit_card_rounded,
        'Billing cycle',
        s.isYearly ? 'Yearly' : 'Monthly',
      ),
      (
        Icons.event_available_rounded,
        'Period started',
        billingDate(s.currentPeriodStart),
      ),
      (
        Icons.event_repeat_rounded,
        s.cancelAtPeriodEnd ? 'Ends on' : 'Renews on',
        billingDate(s.currentPeriodEnd),
      ),
      if (s.status == 'TRIALING')
        (Icons.hourglass_top_rounded, 'Trial ends', billingDate(s.trialEndsAt)),
      if (s.graceEndsAt != null)
        (
          Icons.shield_outlined,
          'Grace period ends',
          billingDate(s.graceEndsAt),
        ),
    ];
    return TeamSectionCard(
      icon: Icons.receipt_long_rounded,
      color: TeamColors.violet,
      title: 'Subscription details',
      subtitle: 'From your current subscription',
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++)
            BillingDetailRow(
              icon: rows[i].$1,
              label: rows[i].$2,
              value: rows[i].$3,
              last: i == rows.length - 1,
            ),
        ],
      ),
    );
  }
}

/// "Usage this cycle" — kept from before the redesign (web has no such card).
class _UsageCard extends StatelessWidget {
  const _UsageCard({required this.usage, required this.plan});

  final ({int branches, int staff, int members}) usage;
  final SubscriptionPlanInfo plan;

  @override
  Widget build(BuildContext context) {
    final rows = [
      ('Branches', Icons.storefront_rounded, usage.branches, plan.maxBranches),
      ('Staff', Icons.badge_rounded, usage.staff, plan.maxStaff),
      ('Members', Icons.groups_rounded, usage.members, plan.maxMembers),
    ];
    return TeamSectionCard(
      icon: Icons.speed_rounded,
      color: TeamColors.teal,
      title: 'Usage this cycle',
      subtitle: 'Against your plan limits',
      child: LayoutBuilder(
        builder: (context, c) {
          final items = [
            for (final r in rows)
              _UsageRow(label: r.$1, icon: r.$2, used: r.$3, limit: r.$4),
          ];
          if (c.maxWidth < 560) {
            return Column(
              children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 14),
                  items[i],
                ],
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const SizedBox(width: 20),
                Expanded(child: items[i]),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({
    required this.label,
    required this.icon,
    required this.used,
    required this.limit,
  });

  final String label;
  final IconData icon;
  final int used;
  final int limit;

  @override
  Widget build(BuildContext context) {
    final ratio = limit > 0 ? used / limit : 0.0;
    final color = ratio >= 1
        ? TeamColors.rose
        : ratio >= 0.8
            ? TeamColors.amber
            : TeamColors.teal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 15, color: AppColors.inkFaint),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                label,
                style: AppText.body(
                  size: 13,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
            ),
            Text(
              '$used / $limit',
              style: AppText.tabular(size: 13, weight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 7),
        GrowBar(
          ratio: ratio,
          colors: [color, Color.lerp(color, TeamColors.fuchsia, 0.4)!],
          height: 8,
          track: AppColors.surface3,
        ),
      ],
    );
  }
}

/// Stand-in for web's Overview / History / Invoices / Address tab bar: the
/// three other sections as tiles.
class _SectionTiles extends StatelessWidget {
  const _SectionTiles();

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _NavTile(
        key: const ValueKey('billing-nav-history'),
        icon: Icons.history_rounded,
        color: TeamColors.indigo,
        title: 'Payment history',
        subtitle: 'Every payment attempt',
        onTap: () => context.push(AppRoutes.billingHistory),
      ),
      _NavTile(
        key: const ValueKey('billing-nav-invoices'),
        icon: Icons.receipt_long_rounded,
        color: TeamColors.teal,
        title: 'Invoices',
        subtitle: 'Your subscription invoices',
        onTap: () => context.push(AppRoutes.billingInvoices),
      ),
      _NavTile(
        key: const ValueKey('billing-nav-address'),
        icon: Icons.location_on_rounded,
        color: TeamColors.amber,
        title: 'Billing address',
        subtitle: 'Tax & invoice details',
        onTap: () => context.push(AppRoutes.billingAddress),
      ),
    ];
    return LayoutBuilder(
      builder: (context, c) {
        if (c.maxWidth < 560) {
          return Column(
            children: [
              for (var i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(height: 10),
                tiles[i],
              ],
            ],
          );
        }
        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: tiles[i]),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color.withValues(alpha: 0.14), Colors.transparent],
            ),
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(13),
                  gradient: LinearGradient(
                    colors: [
                      color,
                      Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                    ],
                  ),
                ),
                child: Icon(icon, size: 20, color: Colors.white),
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
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
