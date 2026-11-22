import 'package:flutter/material.dart';
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
import 'hr_palette.dart';
import 'widgets/hr_ui.dart';
import 'widgets/hr_widgets.dart';

/// **My leaves** - `GET /hr/me/leaves` (`hr:self_leave`), newest first, with
/// a status filter. Each card shows the dates, day-part, days, status chip and
/// - once decided - the approver's remark. Tap for the timeline; PENDING (or a
/// not-yet-started APPROVED) requests can be cancelled (`canCancel` from the
/// API decides, with an optional remark).
class MyLeavesScreen extends StatefulWidget {
  const MyLeavesScreen({super.key});

  @override
  State<MyLeavesScreen> createState() => _MyLeavesScreenState();
}

class _MyLeavesScreenState extends State<MyLeavesScreen> {
  LeaveStatus? _status;
  late PaginatedListCubit<HrLeaveRequest> _cubit = _make();

  PaginatedListCubit<HrLeaveRequest> _make() => PaginatedListCubit(
        (page) => getIt<HrRepository>().myLeaves(page: page, status: _status),
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

  Future<void> _apply() async {
    final done = await context.push<bool>(AppRoutes.hrApplyLeave);
    if (done == true && mounted) _cubit.load();
  }

  Future<void> _cancel(HrLeaveRequest r) async {
    final remark = await askHrRemark(
      context,
      title: 'Cancel this request?',
      subtitle: '${r.leaveType.name} · ${hrDate(r.startDate)}'
          '${r.isSingleDay ? '' : ' – ${hrDate(r.endDate)}'}',
      confirmLabel: 'Cancel request',
      color: HrPalette.absent,
      icon: Icons.event_busy_rounded,
      hint: 'Reason (optional)',
      required: false,
      maxLength: 300,
    );
    if (remark == null || !mounted) return;
    try {
      await getIt<HrRepository>().cancelMyLeave(r.id, remark: remark);
      if (!mounted) return;
      hrSnack(context, 'Request cancelled');
      _cubit.load();
    } on ApiException catch (e) {
      if (mounted) hrSnack(context, e.message, error: true);
      _cubit.load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<HrLeaveRequest>>.value(
      value: _cubit,
      child: BlocBuilder<PaginatedListCubit<HrLeaveRequest>,
          PaginatedListState<HrLeaveRequest>>(
        builder: (context, state) {
          final items = state is PaginatedListLoaded<HrLeaveRequest>
              ? state.items
              : const <HrLeaveRequest>[];
          final pending =
              items.where((r) => r.status == LeaveStatus.pending).length;
          return HrPage(
            title: 'My leaves',
            subtitle: 'Requests, decisions and remarks',
            onRefresh: _cubit.load,
            chips: [
              if (items.isNotEmpty)
                ListHeroChip(
                  icon: Icons.event_note_rounded,
                  label: '${items.length} shown',
                ),
              if (pending > 0)
                ListHeroChip(
                  icon: Icons.hourglass_top_rounded,
                  label: '$pending pending',
                ),
            ],
            floatingActionButton: FloatingActionButton.extended(
              onPressed: _apply,
              backgroundColor: HrPalette.onLeave,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: Text(
                'Apply leave',
                style: AppText.body(
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: HrStatusChips(
                    selected: _status,
                    onChanged: _setStatus,
                  ),
                ),
              ),
              ...hrPagedSlivers<HrLeaveRequest>(
                context,
                state,
                cubit: _cubit,
                emptyTitle: _status == null
                    ? 'No leave requests yet'
                    : 'No ${_status!.label.toLowerCase()} requests',
                emptyMessage: 'Tap "Apply leave" to request time off.',
                emptyIcon: Icons.beach_access_outlined,
                itemBuilder: (context, r, i) => HrLeaveCard(
                  request: r,
                  onTap: () => showLeaveDetailSheet(
                    context,
                    r,
                    onCancel: r.canCancel ? () => _cancel(r) : null,
                  ),
                  actions: r.canCancel
                      ? Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () => _cancel(r),
                            icon: const Icon(
                              Icons.close_rounded,
                              size: 16,
                              color: AppColors.danger,
                            ),
                            label: Text(
                              'Cancel request',
                              style: AppText.body(
                                size: 12.5,
                                weight: FontWeight.w800,
                                color: AppColors.danger,
                              ),
                            ),
                          ),
                        )
                      : null,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Leave timeline sheet: who asked and when, then the decision with the
/// approver's remark. Shared by My leaves, Approvals and the employee detail.
Future<void> showLeaveDetailSheet(
  BuildContext context,
  HrLeaveRequest r, {
  VoidCallback? onCancel,
}) {
  final hue = HrPalette.leaveType(r.leaveType.colorHex);
  final statusColor = HrPalette.leave(r.status);
  final dates = r.isSingleDay
      ? hrDateWd(r.startDate)
      : '${hrDate(r.startDate)} – ${hrDateY(r.endDate)}';
  return showTeamSheet<void>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.beach_access_rounded,
      color: hue,
      title: r.leaveType.name,
      subtitle: r.employee.name,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              HrChip(
                label: r.status.label,
                color: statusColor,
                icon: HrPalette.leaveGlyph(r.status),
              ),
              const SizedBox(width: 8),
              HrChip(
                label: '${hrDays(r.days)} ${r.days == 1 ? 'day' : 'days'}',
                color: hue,
                dense: true,
              ),
            ],
          ),
          const SizedBox(height: 10),
          HrInfoRow(label: 'Dates', value: dates, icon: Icons.event_rounded),
          HrInfoRow(
            label: 'Part of day',
            value: r.dayPart.label,
            icon: HrPalette.dayPart(r.dayPart),
          ),
          HrInfoRow(
            label: 'Pay',
            value: r.leaveType.isPaid ? 'Paid leave' : 'Unpaid leave',
            icon: Icons.payments_outlined,
          ),
          if (r.reason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'REASON',
              style: AppText.eyebrow(),
            ),
            const SizedBox(height: 4),
            Text(r.reason, style: AppText.body(size: 13.5)),
          ],
          const SizedBox(height: 14),
          Text('TIMELINE', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          _TimelineStep(
            color: HrPalette.pending,
            icon: Icons.send_rounded,
            title: r.appliedOnBehalf
                ? 'Applied by ${r.appliedBy?.name ?? 'HR'}'
                : 'Requested',
            when: r.createdAt,
            last: r.status == LeaveStatus.pending,
          ),
          if (r.status != LeaveStatus.pending)
            _TimelineStep(
              color: statusColor,
              icon: HrPalette.leaveGlyph(r.status),
              title: switch (r.status) {
                LeaveStatus.approved =>
                  'Approved${r.decidedBy == null ? '' : ' by ${r.decidedBy!.name}'}',
                LeaveStatus.rejected =>
                  'Rejected${r.decidedBy == null ? '' : ' by ${r.decidedBy!.name}'}',
                _ => 'Cancelled'
                    '${r.decidedBy == null ? '' : ' by ${r.decidedBy!.name}'}',
              },
              when: r.cancelledAt ?? r.decidedAt,
              remark: r.decisionRemark,
              last: true,
            )
          else
            Padding(
              padding: const EdgeInsets.only(left: 38, top: 2),
              child: Text(
                'Waiting for a decision',
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ),
          if (onCancel != null) ...[
            const SizedBox(height: 16),
            TeamOutlineButton(
              label: 'Cancel this request',
              icon: Icons.close_rounded,
              onTap: () {
                Navigator.of(ctx).pop();
                onCancel();
              },
            ),
          ],
        ],
      ),
    ),
  );
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.color,
    required this.icon,
    required this.title,
    required this.when,
    this.remark,
    this.last = false,
  });

  final Color color;
  final IconData icon;
  final String title;
  final DateTime? when;
  final String? remark;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 30,
            child: Column(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.18),
                    shape: BoxShape.circle,
                    border: Border.all(color: color, width: 1.4),
                  ),
                  child: Icon(icon, size: 14, color: color),
                ),
                if (!last)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 2),
                      color: AppColors.line,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: last ? 0 : 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                  if (when != null)
                    Text(
                      '${hrDateY(hrToIst(when!))} · ${hrTime(hrToIst(when!))}',
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  if (remark != null && remark!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    HrRemark(remark: remark!, color: color),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
