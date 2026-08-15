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
import '../../../models/exercise.dart';
import '../../../repositories/exercise_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "5. Exercise library" — the Trainer shell's "Workouts" tab
/// root. Workout PLANS themselves (frame "6. Workout builder") aren't a
/// separate bottom-tab destination in the design; they're reached through
/// the client-assignment flow (My Clients → Assign → Workout plan).
class ExerciseLibraryScreen extends StatefulWidget {
  const ExerciseLibraryScreen({super.key});

  @override
  State<ExerciseLibraryScreen> createState() => _ExerciseLibraryScreenState();
}

class _ExerciseLibraryScreenState extends State<ExerciseLibraryScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<Exercise>(
    (page) => getIt<ExerciseRepository>().list(
      page: page,
      search: _searchController.text.trim(),
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

  Future<void> _addExercise() async {
    final created = await context.push<bool>(AppRoutes.exerciseForm);
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
                  child: BlocBuilder<PaginatedListCubit<Exercise>,
                      PaginatedListState<Exercise>>(
                    builder: (context, state) {
                      final count = state is PaginatedListLoaded<Exercise>
                          ? '${state.items.length} exercises'
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(count, style: AppText.eyebrow()),
                          Text('Exercises', style: AppText.display(size: 22)),
                        ],
                      );
                    },
                  ),
                ),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: _addExercise,
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
                hintText: 'Search exercises…',
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
            const SizedBox(height: 12),
            Expanded(
              child: BlocBuilder<PaginatedListCubit<Exercise>,
                  PaginatedListState<Exercise>>(
                builder: (context, state) {
                  return switch (state) {
                    PaginatedListLoading() => const AppLoadingView(),
                    PaginatedListError(:final message) => AppErrorView(
                        message: message,
                        onRetry: _cubit.load,
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      const AppEmptyState(
                        icon: Icons.fitness_center_outlined,
                        title: 'No exercises yet',
                        message: 'Add your first exercise to the library.',
                      ),
                    PaginatedListLoaded(:final items) => RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: () async => _cubit.load(),
                        child: GridView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            childAspectRatio: 1.5,
                          ),
                          itemCount: items.length,
                          itemBuilder: (context, i) {
                            final exercise = items[i];
                            return _ExerciseCard(
                              exercise: exercise,
                              onTap: () async {
                                final changed = await context.push<bool>(
                                  AppRoutes.exerciseDetail,
                                  extra: exercise,
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

class _ExerciseCard extends StatelessWidget {
  const _ExerciseCard({required this.exercise, required this.onTap});

  final Exercise exercise;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final setsReps =
        exercise.defaultSets != null && exercise.defaultReps != null
            ? '${exercise.defaultSets}×${exercise.defaultReps}'
            : null;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                exercise.name,
                style: AppText.body(size: 13, weight: FontWeight.w700),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                exercise.muscleGroup ?? exercise.category ?? '—',
                style: AppText.body(size: 11, color: AppColors.inkFaint),
              ),
              if (setsReps != null) ...[
                const SizedBox(height: 6),
                AppPill(label: setsReps, tone: AppPillTone.roleTint),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
