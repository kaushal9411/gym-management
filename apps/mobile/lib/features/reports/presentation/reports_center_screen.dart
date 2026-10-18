import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/reports/reports_overview_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../models/reports_overview.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'hub/hub_catalog.dart';
import 'hub/hub_insights.dart';
import 'hub/hub_scheduled.dart';
import 'kit/kit.dart';

/// Reports Center — web's `/reports` hub, redesigned (Owner "Reports" tab).
///
/// Page order = web: gradient [ListHero] (Revenue / Net profit / New members
/// / Check-ins headlines; Analytics and Schedule buttons) -> Period bar
/// (Today / 7 days / This month / Last month / 90 days / Custom, branch,
/// Compare) -> 9 KPI tiles with sparklines and deltas -> eleven insight
/// panels (trend with Daily / Weekly / Cumulative, revenue vs expenses vs
/// net, member-status donut, weekday attendance, peak-hours heatmap, plan
/// distribution, payment-method donut, branch comparison, top trainers,
/// expiring buckets, health-ratio gauges) -> the Report catalogue (search,
/// category chips, every report and analytics view) -> Scheduled Reports.
/// Everything comes from `GET /reports/overview` (and `GET /reports/scheduled`
/// for the last panel); nothing is invented.
///
/// **Gating** (see [HubAccess]): insights and the period bar need
/// `reports:view` (a 403 — no permission or a plan-gated module — hides them
/// and the catalogue stays); report tiles `reports:view`; analytics tiles and
/// the hero's Analytics button `analytics:view`; the Scheduled panel
/// `reports:view`, its "Schedule a report" `reports:export`.
///
/// This screen is an `IndexedStack` tab, so `initState` runs once at shell
/// construction and never again on a tab switch: pull-to-refresh and the
/// period bar reload it.
///
/// Dropped vs web: chart hover tooltips (tap / drag inspection instead), the
/// header-branch seeding (starts at "All branches"), "Schedule report"
/// scrolling to the panel (opens the Scheduled Reports screen instead).
class ReportsCenterScreen extends StatefulWidget {
  const ReportsCenterScreen({super.key});

  @override
  State<ReportsCenterScreen> createState() => _ReportsCenterScreenState();
}

class _ReportsCenterScreenState extends State<ReportsCenterScreen> {
  late final ReportsOverviewCubit _overview;
  late final RptPeriodController _controls;
  String _lastScope = '';

  HubAccess get _access => HubAccess.of(context);

  @override
  void initState() {
    super.initState();
    _overview = getIt<ReportsOverviewCubit>();
    _controls = RptPeriodController()..addListener(_onControls);
    _lastScope = _controls.scope;
    if (_access.canViewReports) {
      unawaited(_controls.loadBranches());
      _load();
    } else {
      _overview.hide();
    }
  }

  @override
  void dispose() {
    _controls
      ..removeListener(_onControls)
      ..dispose();
    _overview.close();
    super.dispose();
  }

  void _onControls() {
    if (_controls.scope != _lastScope) {
      _lastScope = _controls.scope;
      _load();
    }
    if (mounted) setState(() {});
  }

  void _load() {
    if (!_access.canViewReports || !_controls.rangeReady) return;
    final r = _controls.range;
    unawaited(
      _overview.load(from: r.from, to: r.to, branchId: _controls.branchId),
    );
  }

  Future<void> _refresh() async {
    _load();
    await _overview.stream
        .firstWhere((s) => s is! ReportsOverviewLoading)
        .timeout(const Duration(seconds: 20), onTimeout: () => _overview.state);
  }

  @override
  Widget build(BuildContext context) {
    // Watched so a permission change rebuilds.
    context.watch<SessionCubit>();
    final access = _access;
    return BlocProvider<ReportsOverviewCubit>.value(
      value: _overview,
      child: BlocBuilder<ReportsOverviewCubit, ReportsOverviewState>(
        builder: (context, state) {
          final data = state is ReportsOverviewLoaded ? state.data : null;
          return RefreshIndicator(
            color: AppColors.staffB,
            backgroundColor: AppColors.surface2,
            onRefresh: _refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(child: _hero(context, access, data)),
                SliverToBoxAdapter(
                  child: TeamCenter(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        18,
                        14,
                        18,
                        AppSpacing.screenBottomWithNav,
                      ),
                      child: _body(context, access, state, data),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _hero(BuildContext context, HubAccess access, ReportsOverview? d) {
    final k = d?.kpis;
    final r = _controls.range;
    return ListHero(
      title: 'Reports Center',
      subtitle: access.canViewReports
          ? 'Performance, attendance and member trends · '
              '${rptShortDate(r.from)} – ${rptShortDate(r.to)}'
          : 'Reports and analytics',
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.menu_rounded,
        onTap: () => SlideDrawerController.of(context)?.open(),
      ),
      trailing: [
        if (access.canViewAnalytics)
          ListHeroButton(
            icon: Icons.insights_rounded,
            onTap: () => context.push(AppRoutes.analytics),
          ),
        if (access.canExport)
          ListHeroButton(
            icon: Icons.event_note_rounded,
            onTap: () => context.push(AppRoutes.scheduledReports),
          ),
      ],
      chips: k == null
          ? const []
          : [
              ListHeroChip(
                icon: Icons.payments_rounded,
                label:
                    'Revenue ${rptFormatValue(RptFormat.money, k.revenue.value, compact: true)}',
              ),
              ListHeroChip(
                icon: Icons.trending_up_rounded,
                label:
                    'Net ${rptFormatValue(RptFormat.money, k.netProfit.value, compact: true)}',
              ),
              ListHeroChip(
                icon: Icons.person_add_alt_1_rounded,
                label: '${rptGrouped(k.newMembers.value)} new members',
              ),
              ListHeroChip(
                icon: Icons.how_to_reg_rounded,
                label: '${rptGrouped(k.checkIns.value)} check-ins',
              ),
            ],
    );
  }

  Widget _body(
    BuildContext context,
    HubAccess access,
    ReportsOverviewState state,
    ReportsOverview? data,
  ) {
    final showInsights =
        access.canViewReports && state is! ReportsOverviewForbidden;
    final nothing = filterHubEntries(access).isEmpty && !access.canViewReports;
    if (nothing) {
      return const Padding(
        padding: EdgeInsets.only(top: 48),
        child: RptChartEmpty(
          height: 160,
          message: "You don't have access to reports.",
          icon: Icons.lock_outline_rounded,
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (showInsights) ...[
          RptReveal(child: RptPeriodBar(controller: _controls)),
          const SizedBox(height: 14),
          if (!_controls.rangeReady)
            const RptChartCard(
              empty: true,
              emptyText: 'Pick a valid date range (start on or before end, '
                  'at most 366 days).',
              minHeight: 120,
              child: SizedBox.shrink(),
            )
          else ...[
            RptKpiGrid(
              loading: data == null && state is ReportsOverviewLoading,
              kpis: data != null
                  ? hubKpis(data, compare: _controls.compare)
                  : [
                      for (final l in const [
                        'Revenue',
                        'Expenses',
                        'Net profit',
                        'New members',
                      ])
                        RptKpi(label: l, value: 0),
                    ],
            ),
            const SizedBox(height: 14),
            if (state is ReportsOverviewError)
              RptChartCard(
                title: 'Insights',
                icon: Icons.insights_rounded,
                color: RptColors.violet,
                error: true,
                errorText: state.message,
                onRetry: _load,
                minHeight: 80,
                child: const SizedBox.shrink(),
              )
            else if (data != null)
              HubInsights(
                data: data,
                compare: _controls.compare,
                previousLabel: _controls.previousLabel,
                canOpenExpiring: access.canViewReports,
              )
            else
              const RptChartCard(
                  loading: true, minHeight: 260, child: SizedBox(),),
          ],
          const SizedBox(height: 24),
        ],
        HubCatalogue(access: access),
        if (access.canViewReports) ...[
          const SizedBox(height: 8),
          RptReveal(child: HubScheduledPanel(access: access)),
        ],
      ],
    );
  }
}
