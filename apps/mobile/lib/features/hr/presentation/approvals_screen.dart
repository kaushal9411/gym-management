import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/hr_enums.dart';
import '../../../models/hr_leave.dart';
import '../../../repositories/hr_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import 'hr_palette.dart';
import 'widgets/hr_sheets.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **Approvals inbox** - `GET /hr/leaves` (`hr:leave_manage`), PENDING first.
///
/// Status chips carry the server's `counts`. Each card has **Approve**
/// (remark optional) and **Reject** (remark REQUIRED, >= 3 characters) buttons;
/// swiping right / left opens the same prompts, so a swipe never decides
/// anything by itself. Tapping a card opens the full decision sheet (the
/// applicant's balance for that type + who else is off on those dates).
/// Nobody can decide their own request: the buttons are hidden on it (and the
/// API answers 403 anyway).
///
/// Uses [PaginatedListCubit]; the cubit is recreated when the status chip
/// changes, and the list reloads after every decision.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  LeaveStatus? _status = LeaveStatus.pending;
  HrLeaveCounts? _counts;
  late PaginatedListCubit<HrLeaveRequest> _cubit = _make();

  PaginatedListCubit<HrLeaveRequest> _make() => PaginatedListCubit(
        (page) async {
          final r = await getIt<HrRepository>().leaves(
            page: page,
            status: _status,
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
            title: 'Approvals',
            subtitle: 'Leave requests waiting on you',
            onRefresh: _cubit.load,
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
                  padding: const EdgeInsets.only(bottom: 14),
                  child: HrStatusChips(
                    selected: _status,
                    counts: _counts,
                    onChanged: _setStatus,
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
                        : (mine && r.status == LeaveStatus.pending
                            ? Text(
                                'Your own request - another approver decides.',
                                style: AppText.body(
                                  size: 11.5,
                                  weight: FontWeight.w700,
                                  color: AppColors.inkFaint,
                                ),
                              )
                            : null),
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
