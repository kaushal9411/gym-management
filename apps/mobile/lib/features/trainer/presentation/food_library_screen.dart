import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/food.dart';
import '../../../repositories/food_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7. Food library" — the Trainer shell's "Diet" tab root.
/// Diet PLANS themselves (frame "8. Meal builder") are reached through the
/// client-assignment flow (My Clients → Assign → Diet plan), mirroring how
/// [ExerciseLibraryScreen] relates to workout plans.
class FoodLibraryScreen extends StatefulWidget {
  const FoodLibraryScreen({super.key});

  @override
  State<FoodLibraryScreen> createState() => _FoodLibraryScreenState();
}

class _FoodLibraryScreenState extends State<FoodLibraryScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  bool _includeDeleted = false;
  late final _cubit = PaginatedListCubit<Food>(
    (page) => getIt<FoodRepository>().list(
      page: page,
      search: _searchController.text.trim(),
      includeDeleted: _includeDeleted,
    ),
  )..load();

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

  void _toggleIncludeDeleted() {
    setState(() => _includeDeleted = !_includeDeleted);
    _cubit.load();
  }

  Future<void> _addFood() async {
    final created = await context.push<bool>(AppRoutes.foodForm);
    if (created == true) _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: BlocBuilder<PaginatedListCubit<Food>,
                      PaginatedListState<Food>>(
                    builder: (context, state) {
                      final count = state is PaginatedListLoaded<Food>
                          ? '${state.items.length} foods'
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(count, style: AppText.eyebrow()),
                          Text('Foods', style: AppText.display(size: 22)),
                        ],
                      );
                    },
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: _addFood,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: AppColors.staffGrad,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.add_rounded,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Search foods…',
                hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                filled: true,
                fillColor: AppColors.surface2,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
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
            GestureDetector(
              onTap: _toggleIncludeDeleted,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  gradient: _includeDeleted ? AppColors.staffGrad : null,
                  color: _includeDeleted ? null : AppColors.surface3,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Text(
                  'Show deleted',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: _includeDeleted ? Colors.white : AppColors.inkSoft,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: BlocBuilder<PaginatedListCubit<Food>,
                  PaginatedListState<Food>>(
                builder: (context, state) {
                  return switch (state) {
                    PaginatedListLoading() => const AppLoadingView(),
                    PaginatedListError(:final message) => AppErrorView(
                        message: message,
                        onRetry: _cubit.load,
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      const AppEmptyState(
                        icon: Icons.restaurant_outlined,
                        title: 'No foods yet',
                        message: 'Add your first food to the library.',
                      ),
                    PaginatedListLoaded(:final items) => RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: () async => _cubit.load(),
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: items.length,
                          itemBuilder: (context, i) {
                            final food = items[i];
                            return _FoodCard(
                              food: food,
                              onTap: () async {
                                final changed = await context.push<bool>(
                                  AppRoutes.foodDetail,
                                  extra: food,
                                );
                                if (changed == true) _cubit.load();
                              },
                            );
                          },
                        ),
                      ),
                  };
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FoodCard extends StatelessWidget {
  const _FoodCard({required this.food, required this.onTap});

  final Food food;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final deleted = food.deletedAt != null;
    final macro = [
      if (food.calories != null) '${food.calories} kcal',
      if (food.protein != null) '${food.protein!.toStringAsFixed(0)}g protein',
    ].join(' · ');
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: deleted ? AppColors.dangerSoft : AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: deleted
                  ? AppColors.danger.withValues(alpha: 0.3)
                  : AppColors.line,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      food.name,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      food.servingSize ?? '—',
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                    if (deleted) ...[
                      const SizedBox(height: 6),
                      const AppPill(label: 'Deleted', tone: AppPillTone.danger),
                    ],
                  ],
                ),
              ),
              if (macro.isNotEmpty)
                Text(
                  macro,
                  style: AppText.body(size: 12, weight: FontWeight.w700),
                ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
