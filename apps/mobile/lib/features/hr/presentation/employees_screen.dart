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
import '../../../models/hr_admin.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'employee_detail_screen.dart';
import 'hr_palette.dart';
import 'widgets/hr_calendar_card.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **Employees** - `GET /hr/employees` (`hr:view`): everyone with a staff
/// profile, searchable by name / email / employee id. Each card shows today's
/// status and punches, the effective shift, pending leaves and a leave-balance
/// dot per type. Salary is never returned here (it only appears on the detail
/// for `hr:payroll_manage`). Tap for the employee's HR detail.
class EmployeesScreen extends StatefulWidget {
  const EmployeesScreen({super.key});

  @override
  State<EmployeesScreen> createState() => _EmployeesScreenState();
}

class _EmployeesScreenState extends State<EmployeesScreen> {
  String _search = '';
  late PaginatedListCubit<HrEmployee> _cubit = _make();

  PaginatedListCubit<HrEmployee> _make() => PaginatedListCubit(
        (page) => getIt<HrRepository>().employees(page: page, search: _search),
      )..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  void _onSearch(String v) {
    if (v == _search) return;
    final old = _cubit;
    setState(() {
      _search = v;
      _cubit = _make();
    });
    old.close();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<HrEmployee>>.value(
      value: _cubit,
      child: BlocBuilder<PaginatedListCubit<HrEmployee>,
          PaginatedListState<HrEmployee>>(
        builder: (context, state) {
          final items = state is PaginatedListLoaded<HrEmployee>
              ? state.items
              : const <HrEmployee>[];
          return HrPage(
            title: 'Employees',
            subtitle: 'Attendance, leave and pay per person',
            onRefresh: _cubit.load,
            chips: [
              if (items.isNotEmpty)
                ListHeroChip(
                  icon: Icons.groups_rounded,
                  label: '${items.length} shown',
                ),
            ],
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: TeamSearchField(
                    hint: 'Search name, email or employee ID',
                    onSearch: _onSearch,
                  ),
                ),
              ),
              ...hrPagedSlivers<HrEmployee>(
                context,
                state,
                cubit: _cubit,
                emptyTitle: 'No employees found',
                emptyMessage: _search.isEmpty
                    ? 'Staff added in Team & Access appear here.'
                    : 'Try a different search.',
                emptyIcon: Icons.badge_outlined,
                skeletonHeight: 110,
                itemBuilder: (context, e, i) => _EmployeeCard(
                  e: e,
                  onTap: () async {
                    await context.push<void>(
                      AppRoutes.hrEmployeeDetail,
                      extra: HrEmployeeArgs(userId: e.userId, name: e.name),
                    );
                    if (mounted) _cubit.load();
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _EmployeeCard extends StatelessWidget {
  const _EmployeeCard({required this.e, required this.onTap});

  final HrEmployee e;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.status(e.todayStatus);
    return Semantics(
      button: true,
      label: '${e.name}, ${e.todayStatus.label} today'
          '${e.pendingLeaves > 0 ? ', ${e.pendingLeaves} pending leaves' : ''}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    HrAvatar(employee: e.ref, size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            e.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.display(size: 15),
                          ),
                          Text(
                            '${e.ref.employeeId} · ${e.ref.roleLabel}',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w700,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        HrDayStatusChip(status: e.todayStatus),
                        if (e.todayCheckIn != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              'In ${hrTime12(e.todayCheckIn)}',
                              style: AppText.body(
                                size: 10.5,
                                weight: FontWeight.w800,
                                color: c,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (e.shift != null)
                      _Meta(
                        Icons.schedule_rounded,
                        '${e.shift!.name} ${hrTime12(e.shift!.startTime)}–'
                        '${hrTime12(e.shift!.endTime)}',
                      ),
                    if (e.branches.isNotEmpty)
                      _Meta(
                        Icons.storefront_outlined,
                        e.branches.map((b) => b.name).join(', '),
                      ),
                    if (e.pendingLeaves > 0)
                      HrChip(
                        label: '${e.pendingLeaves} pending',
                        icon: Icons.hourglass_top_rounded,
                        color: HrPalette.pending,
                        dense: true,
                      ),
                  ],
                ),
                if (e.leaveBalances.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final b in e.leaveBalances)
                        HrChip(
                          label: '${b.code} '
                              '${b.available == null ? '∞' : hrDays(b.available!)}',
                          color: AppColors.inkSoft,
                          dense: true,
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: AppColors.inkFaint),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ),
            ),
          ),
        ],
      );
}
