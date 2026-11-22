import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_leave.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'apply_leave_screen.dart';
import 'hr_palette.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/leave_filter_sheet.dart';
import 'widgets/team_leave_calendar.dart';
import 'widgets/hr_form_kit.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **Leaves** - the web "Leaves" page: the requests inbox and the team
/// calendar (`hr:leave_manage`).
///
/// *Requests* (`GET /hr/leaves`, PENDING first): status chips carry the
/// server's `counts`; a filter sheet narrows by employee, leave type and an
/// overlapping date range. Each pending card has **Approve** (remark optional)
/// and **Reject** (remark REQUIRED, >= 3 characters); swiping right / left only
/// *opens the same prompts*, so a swipe never decides anything by itself. An
/// approved card has **Cancel approved leave** (remark REQUIRED; restores the
/// balance and the attendance rows). Tapping a card opens the decision sheet
/// (balance + who else is off). Nobody can decide their own request - the
/// buttons are hidden on it (the API answers 403 too). **Apply on behalf**
/// (header button) picks an employee and opens the apply form for them.
///
/// *Team calendar*: a month grid of who is off when (approved + pending) with
/// holidays; tap a day for the people.
///
/// Uses [PaginatedListCubit]; it is recreated when the status chip or a filter
/// changes, and the list reloads after every decision.
/// Route argument of the Leaves screen (`AppRoutes.hrApprovals`).
class HrLeavesArgs {
  const HrLeavesArgs({this.openCalendar = false});

  final bool openCalendar;
}

class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key, this.openCalendar = false});

  /// Open on the team calendar instead of the requests list.
  final bool openCalendar;

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  late bool _calendar = widget.openCalendar;
  int _calKey = 0;
  HrLeaveFilter _filter = HrLeaveFilter.none;
  LeaveStatus? _status = LeaveStatus.pending;
  HrLeaveCounts? _counts;
  late PaginatedListCubit<HrLeaveRequest> _cubit = _make();

  PaginatedListCubit<HrLeaveRequest> _make() => PaginatedListCubit(
        (page) async {
          final r = await getIt<HrRepository>().leaves(
            page: page,
            status: _status,
            userId: _filter.employee?.userId,
            leaveTypeId: _filter.type?.id,
            from: _filter.from,
            to: _filter.to,
          );
          if (mounted && page == 1) setState(() => _counts = r.counts);
          return r.page;
        },
      )..load();

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  void _setStatus(LeaveStatus? s) {
    if (s == _status) return;
    final old = _cubit;
    setState(() {
      _status = s;
      _cubit = _make();
    });
    old.close();
  }

  void _remake() {
    final old = _cubit;
    setState(() => _cubit = _make());
    old.close();
  }

  Future<void> _openFilter() async {
    final f = await showLeaveFilterSheet(context, current: _filter);
    if (f == null || !mounted) return;
    setState(() => _filter = f);
    _remake();
  }

  Future<void> _applyOnBehalf() async {
    final who = await showHrEmployeePicker(
      context,
      title: 'Apply leave for…',
      excludeUserId: hrSelfId(context),
    );
    if (who == null || !mounted) return;
    final done = await context.push<bool>(
      AppRoutes.hrApplyLeave,
      extra: HrApplyLeaveArgs(onBehalfOf: who),
    );
    if (done == true && mounted) {
      _cubit.load();
      setState(() => _calKey++);
    }
  }

  /// Cancels an APPROVED request (remark REQUIRED).
  Future<void> _cancelApproved(HrLeaveRequest r) async {
    final remark = await askHrRemark(
      context,
      title: 'Cancel approved leave?',
      subtitle: '${r.employee.name} · ${r.leaveType.name}',
      confirmLabel: 'Cancel leave',
      color: HrPalette.rejected,
      icon: Icons.event_busy_rounded,
      hint: 'Why is the approved leave being cancelled',
      maxLength: 300,
    );
    if (remark == null || !mounted) return;
    try {
      await getIt<HrRepository>().cancelLeave(r.id, remark: remark);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      hrSnack(context, 'Leave cancelled and attendance restored');
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.detailedMessage, error: true);
    }
    if (mounted) {
      _cubit.load();
      setState(() => _calKey++);
    }
  }

  /// Prompts for the remark, then approves or rejects. Returns whether the
  /// request was decided.
  Future<bool> _decide(HrLeaveRequest r, {required bool approve}) async {
    final when = r.isSingleDay
        ? hrDate(r.startDate)
        : '${hrDate(r.startDate)} – ${hrDate(r.endDate)}';
    final remark = await askHrRemark(
      context,
      title: approve ? 'Approve leave?' : 'Reject leave?',
      subtitle: '${r.employee.name} · ${r.leaveType.name} · $when',
      confirmLabel: approve ? 'Approve' : 'Reject',
      color: approve ? HrPalette.approved : HrPalette.rejected,
      icon: approve ? Icons.check_circle_rounded : Icons.cancel_rounded,
      hint:
          approve ? 'Remark for the employee (optional)' : 'Why is it rejected',
      required: !approve,
      maxLength: 500,
    );
    if (remark == null || !mounted) return false;
    try {
      final repo = getIt<HrRepository>();
      if (approve) {
        await repo.approveLeave(
          r.id,
          remark: remark.isEmpty ? null : remark,
        );
      } else {
        await repo.rejectLeave(r.id, remark: remark);
      }
      if (!mounted) return true;
      HapticFeedback.mediumImpact();
      hrSnack(
        context,
        approve
            ? 'Approved ${r.employee.name}\'s leave'
            : 'Rejected ${r.employee.name}\'s leave',
      );
      _cubit.load();
      return true;
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.detailedMessage, error: true);
      _cubit.load();
      return false;
    }
  }

  Future<void> _open(HrLeaveRequest r) async {
    final updated = await showLeaveDecisionSheet(
      context,
      r,
      selfUserId: hrSelfId(context),
    );
    if (updated != null && mounted) {
      hrSnack(context, 'Leave ${updated.status.label.toLowerCase()}');
      _cubit.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final self = hrSelfId(context);
    return BlocProvider<PaginatedListCubit<HrLeaveRequest>>.value(
      value: _cubit,
      child: BlocBuilder<PaginatedListCubit<HrLeaveRequest>,
          PaginatedListState<HrLeaveRequest>>(
        builder: (context, state) {
          return HrPage(
            title: 'Leaves',
            subtitle: 'Approve, reject and see who is off when',
            onRefresh: () async {
              await _cubit.load();
              if (mounted) setState(() => _calKey++);
            },
            trailing: [
              ListHeroButton(
                icon: Icons.person_add_alt_1_rounded,
                onTap: _applyOnBehalf,
              ),
            ],
            chips: [
              ListHeroChip(
                icon: Icons.hourglass_top_rounded,
                label: '${_counts?.pending ?? 0} pending',
              ),
              if (_counts != null)
                ListHeroChip(
                  icon: Icons.check_circle_rounded,
                  label: '${_counts!.approved} approved',
                ),
            ],
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      for (final v in const [false, true])
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Semantics(
                            button: true,
                            selected: _calendar == v,
                            label: v ? 'Team calendar view' : 'Requests view',
                            excludeSemantics: true,
                            child: TeamFilterChip(
                              key: Key(
                                v
                                    ? 'leaves-view-calendar'
                                    : 'leaves-view-requests',
                              ),
                              label: v ? 'Team calendar' : 'Requests',
                              selected: _calendar == v,
                              color: HrPalette.run,
                              onTap: () => setState(() => _calendar = v),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              if (_calendar)
                SliverToBoxAdapter(
                  child: HrTeamLeaveCalendar(reloadKey: _calKey),
                )
              else ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Row(
                      children: [
                        Expanded(
                          child: HrStatusChips(
                            selected: _status,
                            counts: _counts,
                            onChanged: _setStatus,
                          ),
                        ),
                        const SizedBox(width: 8),
                        _FilterButton(
                          count: _filter.count,
                          onTap: _openFilter,
                        ),
                      ],
                    ),
                  ),
                ),
                ...hrPagedSlivers<HrLeaveRequest>(
                  context,
                  state,
                  cubit: _cubit,
                  emptyTitle: _status == LeaveStatus.pending
                      ? 'All caught up'
                      : 'Nothing here',
                  emptyMessage: _status == LeaveStatus.pending
                      ? 'No leave requests are waiting for a decision.'
                      : 'No requests with this status.',
                  emptyIcon: Icons.task_alt_rounded,
                  itemBuilder: (context, r, i) {
                    final mine = r.employee.userId == self;
                    final decidable = r.status == LeaveStatus.pending && !mine;
                    final card = HrLeaveCard(
                      request: r,
                      showEmployee: true,
                      onTap: () => _open(r),
                      actions: decidable
                          ? Row(
                              children: [
                                Expanded(
                                  child: _InlineAction(
                                    key: Key('reject-${r.id}'),
                                    label: 'Reject',
                                    icon: Icons.close_rounded,
                                    color: HrPalette.rejected,
                                    onTap: () => _decide(r, approve: false),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: _InlineAction(
                                    key: Key('approve-${r.id}'),
                                    label: 'Approve',
                                    icon: Icons.check_rounded,
                                    color: HrPalette.approved,
                                    filled: true,
                                    onTap: () => _decide(r, approve: true),
                                  ),
                                ),
                              ],
                            )
                          : (r.status == LeaveStatus.approved && !mine
                              ? _InlineAction(
                                  key: Key('cancel-${r.id}'),
                                  label: 'Cancel approved leave',
                                  icon: Icons.event_busy_rounded,
                                  color: HrPalette.rejected,
                                  onTap: () => _cancelApproved(r),
                                )
                              : (mine && r.status == LeaveStatus.pending
                                  ? Text(
                                      'Your own request - another approver decides.',
                                      style: AppText.body(
                                        size: 11.5,
                                        weight: FontWeight.w700,
                                        color: AppColors.inkFaint,
                                      ),
                                    )
                                  : null)),
                    );
                    if (!decidable) return card;
                    return Dismissible(
                      key: ValueKey('swipe-${r.id}'),
                      background: const _SwipeBg(
                        color: HrPalette.approved,
                        icon: Icons.check_circle_rounded,
                        label: 'Approve',
                        alignment: Alignment.centerLeft,
                      ),
                      secondaryBackground: const _SwipeBg(
                        color: HrPalette.rejected,
                        icon: Icons.cancel_rounded,
                        label: 'Reject',
                        alignment: Alignment.centerRight,
                      ),
                      // The swipe only opens the prompt; the list reloads from
                      // the server afterwards, so the row is never removed here.
                      confirmDismiss: (direction) async {
                        await _decide(
                          r,
                          approve: direction == DismissDirection.startToEnd,
                        );
                        return false;
                      },
                      child: card,
                    );
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _InlineAction extends StatelessWidget {
  const _InlineAction({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.filled = false,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: filled ? color : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 16, color: filled ? Colors.white : color),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w900,
                    color: filled ? Colors.white : color,
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

class _SwipeBg extends StatelessWidget {
  const _SwipeBg({
    required this.color,
    required this.icon,
    required this.label,
    required this.alignment,
  });

  final Color color;
  final IconData icon;
  final String label;
  final Alignment alignment;

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: 22),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 8),
          Text(
            label,
            style: AppText.body(
              weight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

/// Filter button with a badge showing how many filters are set.
class _FilterButton extends StatelessWidget {
  const _FilterButton({required this.count, required this.onTap});

  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final on = count > 0;
    return Semantics(
      button: true,
      label: on ? 'Filters, $count active' : 'Filters',
      excludeSemantics: true,
      child: Material(
        color: on ? HrPalette.run : AppColors.surface3,
        borderRadius: BorderRadius.circular(99),
        child: InkWell(
          key: const Key('leaves-filter'),
          borderRadius: BorderRadius.circular(99),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.filter_list_rounded,
                  size: 16,
                  color: on ? Colors.white : AppColors.inkSoft,
                ),
                if (on) ...[
                  const SizedBox(width: 4),
                  Text(
                    '$count',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w900,
                      color: Colors.white,
                    ),
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
