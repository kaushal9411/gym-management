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
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'ACTIVE': AppPillTone.success,
  'FROZEN': AppPillTone.danger,
  'INACTIVE': AppPillTone.neutral,
};

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Active', value: 'ACTIVE'),
  (label: 'Frozen', value: 'FROZEN'),
];

/// Design frame "6. Members list" — search + status filter + roster
/// (`GET /members`, branch-scoped server-side for Manager/Receptionist).
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  final _searchController = TextEditingController();
  String? _status;
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<GymMember>(
    (page) => getIt<MemberRepository>().list(
      page: page,
      search: _searchController.text.trim(),
      status: _status,
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

  void _onStatusChanged(String? status) {
    setState(() => _status = status);
    _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<GymMember>>.value(
      value: _cubit,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: BlocBuilder<PaginatedListCubit<GymMember>,
                      PaginatedListState<GymMember>>(
                    builder: (context, state) {
                      final count = state is PaginatedListLoaded<GymMember>
                          ? '${state.items.length} shown'
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(count, style: AppText.eyebrow()),
                          Text('Members', style: AppText.display(size: 22)),
                        ],
                      );
                    },
                  ),
                ),
                Container(
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
                        .push(AppRoutes.memberForm)
                        .then((_) => _cubit.load()),
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
                hintText: 'Search members…',
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
            Row(
              children: [
                for (final f in _statusFilters) ...[
                  _FilterChip(
                    label: f.label,
                    selected: _status == f.value,
                    onTap: () => _onStatusChanged(f.value),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: BlocBuilder<PaginatedListCubit<GymMember>,
                  PaginatedListState<GymMember>>(
                builder: (context, state) {
                  return switch (state) {
                    PaginatedListLoading() => const AppLoadingView(),
                    PaginatedListError(:final message) => AppErrorView(
                        message: message,
                        onRetry: _cubit.load,
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      const AppEmptyState(
                        icon: Icons.people_alt_outlined,
                        title: 'No members found',
                        message: 'Tap + to add your first member.',
                      ),
                    PaginatedListLoaded(:final items) => RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: () async => _cubit.load(),
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: items.length,
                          itemBuilder: (context, i) =>
                              _MemberCard(member: items[i]),
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

class _MemberCard extends StatelessWidget {
  const _MemberCard({required this.member});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(AppRoutes.memberDetail, extra: member.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: const BoxDecoration(
                  color: AppColors.staffSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  member.name.isEmpty ? '?' : member.name[0].toUpperCase(),
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w800,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      member.name,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    Text(
                      '${member.memberId} · ${member.currentMembership?.planName ?? 'No plan'}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              AppPill(
                label: member.status,
                tone: _statusTones[member.status] ?? AppPillTone.neutral,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
