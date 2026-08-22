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
import '../../../models/group_class.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/status_action_menu.dart';

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Active', value: true),
  (label: 'Inactive', value: false),
];

/// Owner/Manager Classes catalog — search + status filter + roster,
/// matching web's `/classes` list, same treatment as [WorkoutPlansScreen].
/// Previously Classes had zero mobile access outside the Receptionist's
/// booking-focused calendar; this is the plan-library-first entry point
/// web has, reusing the same `ClassFormScreen`/`GroupClassRepository` the
/// Receptionist tab already uses (Classes has no `duplicate` or
/// `activate`/`deactivate` endpoints, so the ⋯ menu only ever offers
/// Delete/Restore).
class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  final _searchController = TextEditingController();
  bool? _isActive;
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<GroupClass>(
    (page) => getIt<GroupClassRepository>().list(
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
    return BlocProvider<PaginatedListCubit<GroupClass>>.value(
      value: _cubit,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: BlocBuilder<PaginatedListCubit<GroupClass>,
              PaginatedListState<GroupClass>>(
            builder: (context, state) {
              final count = state is PaginatedListLoaded<GroupClass>
                  ? '${state.items.length} classes'
                  : 'Loading…';
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(count, style: AppText.eyebrow()),
                  Text('Classes', style: AppText.display(size: 18)),
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
                        .push(AppRoutes.classForm)
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
                    hintText: 'Search classes…',
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
                  child: BlocBuilder<PaginatedListCubit<GroupClass>,
                      PaginatedListState<GroupClass>>(
                    builder: (context, state) {
                      return switch (state) {
                        PaginatedListLoading() => const AppLoadingView(),
                        PaginatedListError(:final message) => AppErrorView(
                            message: message,
                            onRetry: _cubit.load,
                          ),
                        PaginatedListLoaded(:final items) when items.isEmpty =>
                          const AppEmptyState(
                            icon: Icons.calendar_month_outlined,
                            title: 'No classes found',
                            message: 'Tap + to create your first class.',
                          ),
                        PaginatedListLoaded(:final items) => RefreshIndicator(
                            color: AppColors.staffB,
                            backgroundColor: AppColors.surface2,
                            onRefresh: () async => _cubit.load(),
                            child: ListView.builder(
                              padding: const EdgeInsets.only(bottom: 90),
                              itemCount: items.length,
                              itemBuilder: (context, i) => _ClassCard(
                                groupClass: items[i],
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

class _ClassCard extends StatefulWidget {
  const _ClassCard({required this.groupClass, required this.onChanged});

  final GroupClass groupClass;
  final VoidCallback onChanged;

  @override
  State<_ClassCard> createState() => _ClassCardState();
}

class _ClassCardState extends State<_ClassCard> {
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

  @override
  Widget build(BuildContext context) {
    final cls = widget.groupClass;
    final deleted = cls.deletedAt != null;
    final repo = getIt<GroupClassRepository>();

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.classForm, extra: cls.id)
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
                        cls.name,
                        style: AppText.body(size: 15, weight: FontWeight.w700),
                      ),
                    ),
                    AppPill(
                      label: deleted
                          ? 'Deleted'
                          : (cls.isActive ? 'Active' : 'Inactive'),
                      tone: deleted
                          ? AppPillTone.neutral
                          : (cls.isActive
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
                      StatusActionMenu(
                        subjectName: cls.name,
                        isDeleted: deleted,
                        isActive: cls.isActive,
                        canDuplicate: false,
                        showActivateDeactivate: false,
                        onDelete: () => _runAction(
                          () => repo.delete(cls.id),
                          'Class deleted.',
                        ),
                        onRestore: () => _runAction(
                          () => repo.restore(cls.id),
                          'Class restored.',
                        ),
                        deleteDescription:
                            'This soft-deletes the class — its schedule '
                            'stops generating new sessions until restored.',
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    cls.branch?.name ?? 'No branch',
                    cls.trainer?.name ?? 'Unassigned',
                    '${cls.capacity} capacity',
                  ].join(' · '),
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
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
