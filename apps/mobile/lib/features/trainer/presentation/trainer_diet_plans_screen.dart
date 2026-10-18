import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/diet_plan_summary.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../diet/presentation/diet_plans_list_screen.dart'
    show filterDietPlans;
import '../../diet/presentation/widgets/diet_plan_card.dart';
import '../../plans/presentation/plan_ui.dart' show PlanHeroChip;
import '../../team/presentation/widgets/team_ui.dart';

class DietPlanFormArgs {
  const DietPlanFormArgs({required this.member});

  final GymMember member;
}

class MealBuilderArgs {
  const MealBuilderArgs({required this.planId, required this.member});

  final String planId;
  final GymMember member;
}

/// Reached from [AssignPlanScreen]'s "Diet plan" row - the Trainer's
/// per-client entry into diet plans (the other entry is the Owner / Manager
/// catalog; both share `DietPlanRepository`). Same gradient [ListHero] as the
/// catalog list, search + status filters and the same rich plan cards
/// (duration, kcal, goal, members, trainer); tapping a card opens the plan to
/// assign it to [member], and "+" creates a new plan first. Lists every
/// non-deleted plan, exactly what it listed before (it used to show only the
/// first page). Controls are unchanged (this flow has never been gated per
/// action; the server still enforces `diets:*`).
class TrainerDietPlansScreen extends StatefulWidget {
  const TrainerDietPlansScreen({required this.member, super.key});

  final GymMember member;

  @override
  State<TrainerDietPlansScreen> createState() => _TrainerDietPlansScreenState();
}

class _TrainerDietPlansScreenState extends State<TrainerDietPlansScreen> {
  List<DietPlanSummary>? _all;
  bool _loading = true;
  String? _error;

  String _search = '';
  String _status = '';

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
      final all =
          await getIt<DietPlanRepository>().listAll(includeDeleted: false);
      if (!mounted) return;
      setState(() {
        _all = all;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load diet plans ($e)');
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

  Future<void> _createPlan() async {
    await context.push<bool>(
      AppRoutes.trainerDietPlanForm,
      extra: DietPlanFormArgs(member: widget.member),
    );
    if (mounted) _load(silent: true);
  }

  Future<void> _open(DietPlanSummary plan) async {
    await context.push(
      AppRoutes.trainerDietPlanDetail,
      extra: MealBuilderArgs(planId: plan.id, member: widget.member),
    );
    if (mounted) _load(silent: true);
  }

  int _count(String status) {
    final all = _all ?? const <DietPlanSummary>[];
    return switch (status) {
      'active' => all.where((p) => p.isActive).length,
      'inactive' => all.where((p) => !p.isActive).length,
      _ => all.length,
    };
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final all = _all;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(silent: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: ListHero(
                title: 'Diet plans',
                subtitle: 'Assign to ${widget.member.name}'
                    '${all == null ? '' : ' · ${all.length} '
                        '${all.length == 1 ? 'plan' : 'plans'}'}',
                topInset: top,
                side: 18 + teamSideInset(context),
                leading: ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
                trailing: [
                  ListHeroButton(icon: Icons.add_rounded, onTap: _createPlan),
                ],
                chips: [
                  for (final f in const [
                    (label: 'All', value: ''),
                    (label: 'Active', value: 'active'),
                    (label: 'Inactive', value: 'inactive'),
                  ])
                    PlanHeroChip(
                      label: '${f.label} · ${_count(f.value)}',
                      selected: _status == f.value,
                      onTap: () => setState(() => _status = f.value),
                    ),
                ],
              ),
            ),
            if (all != null)
              SliverToBoxAdapter(
                child: TeamCenter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                    child: TeamSearchField(
                      hint: 'Search name or goal…',
                      onSearch: (v) => setState(() => _search = v),
                    ),
                  ),
                ),
              ),
            ..._body(),
          ],
        ),
      ),
    );
  }

  List<Widget> _body() {
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
    final items = filterDietPlans(
      _all ?? const [],
      search: _search,
      status: _status,
    );
    if (items.isEmpty) {
      final filtered = _search.isNotEmpty || _status.isNotEmpty;
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppEmptyState(
            icon: Icons.restaurant_outlined,
            title: filtered
                ? 'No diet plans match these filters'
                : 'No diet plans yet',
            message: filtered
                ? 'Try clearing a filter or the search.'
                : 'Create one to assign to ${widget.member.name}.',
          ),
        ),
      ];
    }
    return [
      teamCardSliver<DietPlanSummary>(
        context,
        items: items,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (p, i) => DietPlanCard(
          key: ValueKey('plan-${p.id}'),
          plan: p,
          primaryLabel: 'Choose plan',
          onTap: () => _open(p),
          onMenu: (_) => _open(p),
        ),
      ),
    ];
  }
}
