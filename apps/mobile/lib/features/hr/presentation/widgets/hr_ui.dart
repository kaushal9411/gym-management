import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/common/paginated_list_cubit.dart';
import '../../../../bloc/common/paginated_list_state.dart';
import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/tenant_features.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_leave.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../../../../shared/widgets/motion.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_widgets.dart';

/// Permission keys of the HR module (`docs/HR-API-CONTRACT.md` §1). Used by
/// the menus, the HR hub and every in-screen action gate - one definition so a
/// typo can't hide a feature from a role.
class HrPerm {
  HrPerm._();

  static const view = 'hr:view';
  static const attendanceManage = 'hr:attendance_manage';
  static const leaveManage = 'hr:leave_manage';
  static const payrollManage = 'hr:payroll_manage';
  static const settingsManage = 'hr:settings_manage';
  static const selfAttendance = 'hr:self_attendance';
  static const selfLeave = 'hr:self_leave';
  static const selfPayslip = 'hr:self_payslip';

  /// Any of these opens "My HR".
  static const anySelf = [selfAttendance, selfLeave, selfPayslip];

  /// Any of these opens the HR admin area.
  static const anyAdmin = [view, leaveManage, attendanceManage, payrollManage];
}

/// Does the signed-in staff user hold [key]?
bool hrCan(BuildContext context, String key) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff && s.user.hasPermission(key);
}

/// The signed-in staff user's id (the server also refuses self-approval; the
/// UI hides the buttons on one's own requests).
String? hrSelfId(BuildContext context) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff ? s.user.id : null;
}

void hrSnack(BuildContext context, String message, {bool error = false}) =>
    teamSnack(context, message, error: error);

/// Standard HR page: full-width gradient hero ([ListHero], like Team & Leads),
/// pull-to-refresh, content slivers capped + centred on tablets.
class HrPage extends StatelessWidget {
  const HrPage({
    super.key,
    required this.title,
    required this.slivers,
    required this.onRefresh,
    this.subtitle,
    this.chips = const [],
    this.trailing = const [],
    this.floatingActionButton,
    this.bottomBar,
  });

  final String title;
  final String? subtitle;
  final List<Widget> chips;
  final List<Widget> trailing;
  final List<Widget> slivers;
  final Future<void> Function() onRefresh;
  final Widget? floatingActionButton;
  final Widget? bottomBar;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final inset = teamSideInset(context, maxWidth: 840);
    return Scaffold(
      backgroundColor: AppColors.bg,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomBar,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: onRefresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: ListHero(
                title: title,
                subtitle: subtitle,
                topInset: top,
                side: 18 + inset,
                leading: ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
                trailing: trailing,
                chips: chips,
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(18 + inset, 16, 18 + inset, 40),
              sliver: SliverMainAxisGroup(slivers: slivers),
            ),
          ],
        ),
      ),
    );
  }
}

/// Slivers for a [PaginatedListCubit] state: skeletons while loading, the
/// retry view on error, an empty state, then the rows + "Load more".
List<Widget> hrPagedSlivers<T>(
  BuildContext context,
  PaginatedListState<T> state, {
  required Widget Function(BuildContext, T, int) itemBuilder,
  required PaginatedListCubit<T> cubit,
  required String emptyTitle,
  String? emptyMessage,
  IconData emptyIcon = Icons.inbox_outlined,
  double skeletonHeight = 96,
}) {
  switch (state) {
    case PaginatedListLoading<T>():
      return [
        SliverToBoxAdapter(
          child: HrSkeletonList(count: 4, height: skeletonHeight),
        ),
      ];
    case PaginatedListError<T>(:final message):
      return [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 30),
            child: AppErrorView(message: message, onRetry: cubit.load),
          ),
        ),
      ];
    case PaginatedListLoaded<T>(
        :final items,
        :final hasMore,
        :final loadingMore
      ):
      if (items.isEmpty) {
        return [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 36),
              child: AppEmptyState(
                title: emptyTitle,
                message: emptyMessage,
                icon: emptyIcon,
              ),
            ),
          ),
        ];
      }
      return [
        SliverList.separated(
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) => StaggeredCard(
            index: i,
            child: itemBuilder(context, items[i], i),
          ),
        ),
        if (hasMore)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Center(
                child: loadingMore
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      )
                    : TextButton(
                        onPressed: cubit.loadMore,
                        child: Text(
                          'Load more',
                          style: AppText.body(
                            weight: FontWeight.w800,
                            color: AppColors.staffPillFg,
                          ),
                        ),
                      ),
              ),
            ),
          ),
      ];
  }
}

/// Entrance for list rows: the first page staggers in, later pages don't
/// replay (index is capped inside `FadeUp`).
class StaggeredCard extends StatelessWidget {
  const StaggeredCard({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 320 + (index.clamp(0, 8) * 45)),
      curve: Curves.easeOutCubic,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - t)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// Status filter chips with live counts (`Pending 3`).
class HrStatusChips extends StatelessWidget {
  const HrStatusChips({
    super.key,
    required this.selected,
    required this.onChanged,
    this.counts,
    this.includeAll = true,
  });

  final LeaveStatus? selected;
  final ValueChanged<LeaveStatus?> onChanged;
  final HrLeaveCounts? counts;
  final bool includeAll;

  @override
  Widget build(BuildContext context) {
    String label(String name, int? n) => n == null ? name : '$name · $n';
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          if (includeAll) ...[
            TeamFilterChip(
              label: label('All', counts?.all),
              selected: selected == null,
              onTap: () => onChanged(null),
            ),
            const SizedBox(width: 8),
          ],
          for (final s in LeaveStatus.values) ...[
            TeamFilterChip(
              label: label(s.label, counts?.of(s)),
              selected: selected == s,
              color: HrPalette.leave(s),
              onTap: () => onChanged(s),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

/// Leave request card: type hue edge, dates + day-part, days, status chip,
/// reason, and the approver's remark. [actions] sits under the body.
class HrLeaveCard extends StatelessWidget {
  const HrLeaveCard({
    super.key,
    required this.request,
    this.showEmployee = false,
    this.onTap,
    this.actions,
  });

  final HrLeaveRequest request;
  final bool showEmployee;
  final VoidCallback? onTap;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final r = request;
    final hue = HrPalette.leaveType(r.leaveType.colorHex);
    final statusColor = HrPalette.leave(r.status);
    final dates = r.isSingleDay
        ? hrDateWd(r.startDate)
        : '${hrDate(r.startDate)} – ${hrDate(r.endDate)}';
    return Semantics(
      container: true,
      label: '${showEmployee ? '${r.employee.name}, ' : ''}'
          '${r.leaveType.name}, $dates, ${hrDays(r.days)} days, '
          '${r.status.label}',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 5, color: hue),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              if (showEmployee) ...[
                                UserAvatar(
                                  avatarUrl: r.employee.avatarUrl,
                                  name: r.employee.name,
                                  size: 34,
                                ),
                                const SizedBox(width: 10),
                              ],
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      showEmployee
                                          ? r.employee.name
                                          : r.leaveType.name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: AppText.display(size: 15),
                                    ),
                                    Row(
                                      children: [
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            color: hue,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                        const SizedBox(width: 5),
                                        Flexible(
                                          child: Text(
                                            showEmployee
                                                ? r.leaveType.name
                                                : dates,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: AppText.body(
                                              size: 12,
                                              weight: FontWeight.w700,
                                              color: AppColors.inkSoft,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              HrChip(
                                label: r.status.label,
                                color: statusColor,
                                icon: HrPalette.leaveGlyph(r.status),
                                dense: true,
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              if (showEmployee)
                                _Tag(Icons.event_rounded, dates),
                              _Tag(
                                HrPalette.dayPart(r.dayPart),
                                r.dayPart.label,
                              ),
                              _Tag(
                                Icons.timelapse_rounded,
                                '${hrDays(r.days)} '
                                '${r.days == 1 ? 'day' : 'days'}',
                              ),
                              if (!r.leaveType.isPaid)
                                const _Tag(
                                  Icons.money_off_rounded,
                                  'Unpaid',
                                ),
                              if (r.appliedOnBehalf)
                                const _Tag(
                                  Icons.supervisor_account_rounded,
                                  'Applied by HR',
                                ),
                            ],
                          ),
                          if (r.reason.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(
                              r.reason,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 12.5,
                                color: AppColors.inkSoft,
                              ),
                            ),
                          ],
                          if (r.decisionRemark != null &&
                              r.decisionRemark!.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _RemarkBubble(
                              who: r.decidedBy?.name,
                              remark: r.decisionRemark!,
                              color: statusColor,
                            ),
                          ],
                          if (actions != null) ...[
                            const SizedBox(height: 10),
                            actions!,
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.inkFaint),
        const SizedBox(width: 4),
        Text(
          text,
          style: AppText.body(
            size: 11.5,
            weight: FontWeight.w700,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}

/// The approver's remark as a speech-bubble strip.
class _RemarkBubble extends StatelessWidget {
  const _RemarkBubble({
    required this.who,
    required this.remark,
    required this.color,
  });

  final String? who;
  final String remark;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.format_quote_rounded, size: 16, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (who != null)
                  Text(
                    '$who',
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w800,
                      color: color,
                    ),
                  ),
                Text(remark, style: AppText.body(size: 12.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The remark strip, reusable from detail sheets.
class HrRemark extends StatelessWidget {
  const HrRemark({
    super.key,
    required this.remark,
    required this.color,
    this.who,
  });

  final String remark;
  final String? who;
  final Color color;

  @override
  Widget build(BuildContext context) =>
      _RemarkBubble(who: who, remark: remark, color: color);
}

/// Bottom sheet asking for a remark. Returns the trimmed text, or `null` when
/// dismissed. With [required], the confirm button stays disabled until the
/// remark is at least [minLength] characters (reject / cancel / manual mark).
Future<String?> askHrRemark(
  BuildContext context, {
  required String title,
  required String confirmLabel,
  required Color color,
  IconData icon = Icons.edit_note_rounded,
  String? subtitle,
  String hint = 'Add a remark',
  bool required = true,
  int minLength = 3,
  int maxLength = 500,
}) {
  return showTeamSheet<String>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: icon,
      title: title,
      subtitle: subtitle,
      color: color,
      child: _RemarkForm(
        hint: hint,
        confirmLabel: confirmLabel,
        color: color,
        required: required,
        minLength: minLength,
        maxLength: maxLength,
      ),
    ),
  );
}

class _RemarkForm extends StatefulWidget {
  const _RemarkForm({
    required this.hint,
    required this.confirmLabel,
    required this.color,
    required this.required,
    required this.minLength,
    required this.maxLength,
  });

  final String hint;
  final String confirmLabel;
  final Color color;
  final bool required;
  final int minLength;
  final int maxLength;

  @override
  State<_RemarkForm> createState() => _RemarkFormState();
}

class _RemarkFormState extends State<_RemarkForm> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  bool get _valid =>
      !widget.required || _c.text.trim().length >= widget.minLength;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          key: const Key('hr-remark-field'),
          controller: _c,
          autofocus: true,
          minLines: 3,
          maxLines: 5,
          maxLength: widget.maxLength,
          textCapitalization: TextCapitalization.sentences,
          onChanged: (_) => setState(() {}),
          style: AppText.body(),
          decoration: InputDecoration(
            hintText: widget.hint + (widget.required ? ' (required)' : ''),
            hintStyle: AppText.body(color: AppColors.inkFaint),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: widget.color, width: 1.6),
            ),
          ),
        ),
        const SizedBox(height: 10),
        TeamGradientButton(
          label: widget.confirmLabel,
          gradient: LinearGradient(
            colors: [widget.color, widget.color.withValues(alpha: 0.75)],
          ),
          onTap:
              _valid ? () => Navigator.of(context).pop(_c.text.trim()) : null,
        ),
      ],
    );
  }
}

/// A small circular avatar for an [HrEmployeeRef].
class HrAvatar extends StatelessWidget {
  const HrAvatar({super.key, required this.employee, this.size = 40});

  final HrEmployeeRef employee;
  final double size;

  @override
  Widget build(BuildContext context) => UserAvatar(
        avatarUrl: employee.avatarUrl,
        name: employee.name,
        size: size,
      );
}

/// Status dot + label chip for a day status.
class HrDayStatusChip extends StatelessWidget {
  const HrDayStatusChip({super.key, required this.status, this.dense = true});

  final DayStatus status;
  final bool dense;

  @override
  Widget build(BuildContext context) => HrChip(
        label: status.label,
        color: HrPalette.status(status),
        icon: HrPalette.glyph(status),
        dense: dense,
      );
}

/// One info row (label left, value right) used by detail sheets.
class HrInfoRow extends StatelessWidget {
  const HrInfoRow({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.valueColor,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: AppColors.inkFaint),
            const SizedBox(width: 8),
          ],
          Text(
            label,
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w700,
              color: AppColors.inkFaint,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w800,
                color: valueColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Can the signed-in user open the Expenses list (`finance:view` + the
/// `expenses` module)? Paying a payslip records a SALARY expense there.
bool hrCanOpenExpenses(BuildContext context) {
  final s = context.read<SessionCubit>().state;
  return s is SessionAuthenticatedStaff &&
      s.user.hasPermission('finance:view') &&
      tenantAllows(s.tenant, flag: 'expenses');
}

/// "Salary expense recorded" indicator on a paid payslip. Opens the Expenses
/// list when the user may see it, otherwise it is just the indicator.
class HrExpenseLink extends StatelessWidget {
  const HrExpenseLink({super.key, this.compact = false});

  /// A one-line tag for list rows instead of the detail row.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final canOpen = hrCanOpenExpenses(context);
    final body = Row(
      mainAxisSize: compact ? MainAxisSize.min : MainAxisSize.max,
      children: [
        Icon(
          Icons.receipt_long_rounded,
          size: compact ? 13 : 16,
          color: HrPalette.money,
        ),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            compact ? 'Expense recorded' : 'Salary expense recorded',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: compact ? 11 : 13,
              weight: FontWeight.w800,
              color: HrPalette.money,
            ),
          ),
        ),
        if (canOpen) ...[
          const SizedBox(width: 2),
          const Icon(
            Icons.chevron_right_rounded,
            size: 16,
            color: HrPalette.money,
          ),
        ],
      ],
    );
    return Semantics(
      button: canOpen,
      label: 'Salary expense recorded${canOpen ? ', open expenses' : ''}',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: canOpen ? () => context.push(AppRoutes.expenses) : null,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: compact ? 2 : 8),
          child: body,
        ),
      ),
    );
  }
}
