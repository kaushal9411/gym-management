import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Active', value: true),
  (label: 'Inactive', value: false),
];

/// Design frame "7. Membership plans" — search + status filter + roster,
/// matching web's `/memberships` list (`GET /membership-plans`). Tapping a
/// card opens the same create/edit form in edit mode (web's merged
/// detail+edit page); the "⋯" menu mirrors web's row dropdown
/// (Duplicate/Activate-Deactivate/Delete/Restore).
class MembershipPlansScreen extends StatefulWidget {
  const MembershipPlansScreen({super.key});

  @override
  State<MembershipPlansScreen> createState() => _MembershipPlansScreenState();
}

class _MembershipPlansScreenState extends State<MembershipPlansScreen> {
  final _searchController = TextEditingController();
  bool? _isActive;
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<MembershipPlan>(
    (page) => getIt<MembershipPlanRepository>().list(
      page: page,
      limit: 50,
      search: _searchController.text.trim(),
      isActive: _isActive,
    ),
  );

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _cubit.load);
  }

  void _onStatusChanged(bool? isActive) {
    setState(() => _isActive = isActive);
    _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<MembershipPlan>>.value(
      value: _cubit,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: BlocBuilder<PaginatedListCubit<MembershipPlan>,
              PaginatedListState<MembershipPlan>>(
            builder: (context, state) {
              final count = state is PaginatedListLoaded<MembershipPlan>
                  ? '${state.items.length} plans'
                  : 'Loading…';
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(count, style: AppText.eyebrow()),
                  Text('Membership Plans', style: AppText.display(size: 18)),
                ],
              );
            },
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () => context
                        .push(AppRoutes.membershipPlanForm)
                        .then((_) => _cubit.load()),
                  ),
                ),
              ),
            ),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  style: AppText.body(size: 14, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: 'Search plans…',
                    hintStyle:
                        AppText.body(size: 14, color: AppColors.inkFaint),
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      color: AppColors.inkFaint,
                    ),
                    filled: true,
                    fillColor: AppColors.surface2,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    for (final f in _statusFilters) ...[
                      _FilterChip(
                        label: f.label,
                        selected: _isActive == f.value,
                        onTap: () => _onStatusChanged(f.value),
                      ),
                      const SizedBox(width: 8),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: BlocBuilder<PaginatedListCubit<MembershipPlan>,
                      PaginatedListState<MembershipPlan>>(
                    builder: (context, state) {
                      return switch (state) {
                        PaginatedListLoading() => const AppLoadingView(),
                        PaginatedListError(:final message) => AppErrorView(
                            message: message,
                            onRetry: _cubit.load,
                          ),
                        PaginatedListLoaded(:final items) when items.isEmpty =>
                          const AppEmptyState(
                            icon: Icons.card_membership_outlined,
                            title: 'No plans found',
                            message:
                                'Tap + to create your first membership plan.',
                          ),
                        PaginatedListLoaded(:final items) => RefreshIndicator(
                            color: AppColors.staffB,
                            backgroundColor: AppColors.surface2,
                            onRefresh: () async => _cubit.load(),
                            child: ListView.builder(
                              padding: const EdgeInsets.only(bottom: 90),
                              itemCount: items.length,
                              itemBuilder: (context, i) => _PlanCard(
                                plan: items[i],
                                onChanged: _cubit.load,
                              ),
                            ),
                          ),
                      };
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatefulWidget {
  const _PlanCard({required this.plan, required this.onChanged});

  final MembershipPlan plan;
  final VoidCallback onChanged;

  @override
  State<_PlanCard> createState() => _PlanCardState();
}

class _PlanCardState extends State<_PlanCard> {
  bool _busy = false;

  Future<void> _runAction(
    Future<void> Function() action,
    String snackbarMessage,
  ) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(snackbarMessage)));
      widget.onChanged();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _duplicate() async {
    setState(() => _busy = true);
    try {
      final created =
          await getIt<MembershipPlanRepository>().duplicate(widget.plan.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Duplicated as "${created.name}" (inactive draft).'),
        ),
      );
      widget.onChanged();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String action, {required bool destructive}) async {
    final label = '${action[0].toUpperCase()}${action.substring(1)}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text('$label "${widget.plan.name}"?'),
        content: Text(
          action == 'delete'
              ? 'This soft-deletes the plan — it can no longer be assigned '
                  'to members until restored.'
              : 'This action can be reversed later if needed.',
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(true),
            child: Text(
              label,
              style: TextStyle(
                color: destructive ? AppColors.danger : AppColors.staffPillFg,
              ),
            ),
          ),
        ],
      ),
    );
    return confirmed ?? false;
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    final deleted = plan.deletedAt != null;
    final repo = getIt<MembershipPlanRepository>();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.membershipPlanForm, extra: plan)
              .then((_) => widget.onChanged()),
          child: AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        plan.name,
                        style: AppText.body(size: 15, weight: FontWeight.w700),
                      ),
                    ),
                    AppPill(
                      label: deleted
                          ? 'Deleted'
                          : (plan.isActive ? 'Active' : 'Inactive'),
                      tone: deleted
                          ? AppPillTone.neutral
                          : (plan.isActive
                              ? AppPillTone.success
                              : AppPillTone.danger),
                    ),
                    if (_busy)
                      const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      )
                    else
                      PopupMenuButton<String>(
                        padding: EdgeInsets.zero,
                        icon: const Icon(
                          Icons.more_vert_rounded,
                          size: 18,
                          color: AppColors.inkFaint,
                        ),
                        color: AppColors.surface2,
                        onSelected: (value) async {
                          switch (value) {
                            case 'duplicate':
                              await _duplicate();
                            case 'activate':
                              if (await _confirm(
                                'activate',
                                destructive: false,
                              )) {
                                await _runAction(
                                  () => repo.activate(plan.id),
                                  'Plan activated.',
                                );
                              }
                            case 'deactivate':
                              if (await _confirm(
                                'deactivate',
                                destructive: false,
                              )) {
                                await _runAction(
                                  () => repo.deactivate(plan.id),
                                  'Plan deactivated.',
                                );
                              }
                            case 'restore':
                              if (await _confirm(
                                'restore',
                                destructive: false,
                              )) {
                                await _runAction(
                                  () => repo.restore(plan.id),
                                  'Plan restored.',
                                );
                              }
                            case 'delete':
                              if (await _confirm(
                                'delete',
                                destructive: true,
                              )) {
                                await _runAction(
                                  () => repo.delete(plan.id),
                                  'Plan deleted.',
                                );
                              }
                          }
                        },
                        itemBuilder: (context) => [
                          const PopupMenuItem(
                            value: 'duplicate',
                            child: Text('Duplicate'),
                          ),
                          if (deleted)
                            const PopupMenuItem(
                              value: 'restore',
                              child: Text('Restore'),
                            )
                          else ...[
                            PopupMenuItem(
                              value: plan.isActive ? 'deactivate' : 'activate',
                              child: Text(
                                plan.isActive ? 'Deactivate' : 'Activate',
                              ),
                            ),
                            const PopupMenuItem(
                              value: 'delete',
                              child: Text(
                                'Delete',
                                style: TextStyle(color: AppColors.danger),
                              ),
                            ),
                          ],
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${Formatters.currency(plan.finalPrice)}'
                  '${plan.finalPrice != plan.price ? ' (base ${Formatters.currency(plan.price)})' : ''}'
                  ' · ${plan.durationLabel} · ${plan.perksSummary}',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${plan.planCode} · ${plan.memberCount} member'
                  '${plan.memberCount == 1 ? '' : 's'}',
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
