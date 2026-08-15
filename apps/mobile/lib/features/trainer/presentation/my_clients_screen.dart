import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "4. My clients" — members with this Trainer as their
/// assigned trainer (`GET /members?trainerId={self}`). The design's inline
/// "Push Day · 78% complete / On track" per-row progress would need one
/// extra API call per client to compute (`GET
/// /workout-plans/members/:id`) — not done for a list of N clients;
/// real progress lives one tap away on the Client Progress screen instead.
class MyClientsScreen extends StatefulWidget {
  const MyClientsScreen({super.key});

  @override
  State<MyClientsScreen> createState() => _MyClientsScreenState();
}

class _MyClientsScreenState extends State<MyClientsScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  PaginatedListCubit<GymMember>? _cubit;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit?.close();
    super.dispose();
  }

  PaginatedListCubit<GymMember> _cubitFor(String trainerId) {
    return _cubit ??= PaginatedListCubit<GymMember>(
      (page) => getIt<MemberRepository>().list(
        page: page,
        search: _searchController.text.trim(),
        trainerId: trainerId,
      ),
    )..load();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _cubit?.load());
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is! SessionAuthenticatedStaff) return const SizedBox.shrink();
    final cubit = _cubitFor(session.user.id);

    return BlocProvider<PaginatedListCubit<GymMember>>.value(
      value: cubit,
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
                          ? '${state.items.length} assigned'
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(count, style: AppText.eyebrow()),
                          Text('My clients', style: AppText.display(size: 22)),
                        ],
                      );
                    },
                  ),
                ),
                Container(
                  width: 38,
                  height: 38,
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    session.user.initials,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: Colors.white,
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
                hintText: 'Search clients…',
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
              child: BlocBuilder<PaginatedListCubit<GymMember>,
                  PaginatedListState<GymMember>>(
                builder: (context, state) {
                  return switch (state) {
                    PaginatedListLoading() => const AppLoadingView(),
                    PaginatedListError(:final message) => AppErrorView(
                        message: message,
                        onRetry: () => cubit.load(),
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      const AppEmptyState(
                        icon: Icons.groups_outlined,
                        title: 'No clients assigned yet',
                        message:
                            'Members show up here once a Manager assigns you as their trainer.',
                      ),
                    PaginatedListLoaded(:final items) => RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: () async => cubit.load(),
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: items.length,
                          itemBuilder: (context, i) =>
                              _ClientCard(member: items[i]),
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

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.member});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(AppRoutes.clientProgress, extra: member),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
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
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      member.memberId,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              AppButton(
                label: 'Assign',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                fullWidth: false,
                onPressed: () =>
                    context.push(AppRoutes.assignPlan, extra: member),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
