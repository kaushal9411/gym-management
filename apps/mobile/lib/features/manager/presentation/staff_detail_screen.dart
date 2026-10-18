import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/staff_actions.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'team_screen.dart' show roleColor, roleIcon, workStatusColor;
import 'widgets/member_detail_anim.dart';

const _tabNames = ['Overview', 'Employment', 'Access'];

const _genderLabels = {
  'MALE': 'Male',
  'FEMALE': 'Female',
  'OTHER': 'Other',
  'PREFER_NOT_TO_SAY': 'Prefer not to say',
};

const _employmentLabels = {
  'FULL_TIME': 'Full-time',
  'PART_TIME': 'Part-time',
  'CONTRACT': 'Contract',
  'INTERN': 'Intern',
};

const _salaryLabels = {
  'MONTHLY': 'Monthly',
  'HOURLY': 'Hourly',
  'DAILY': 'Daily',
  'PER_SESSION': 'Per session',
};

const _weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Staff profile (`GET /staff/:id`), redesigned to mirror web's `/staff/[id]`
/// page and the Member profile: animated gradient hero, summary tiles and
/// three tabs — Overview (personal / address / emergency / notes), Employment
/// (type, work status, salary, shift, weekly off) and Access (role, branches,
/// account & security, lifecycle "danger zone"). Every edit and status action
/// is gated by the same `staff:*` permission web uses; the server enforces
/// them again.
///
/// The old design's trainer "Performance" card is still omitted — no endpoint
/// backs it.
class StaffDetailScreen extends StatefulWidget {
  const StaffDetailScreen({super.key, required this.staffId});

  final String staffId;

  @override
  State<StaffDetailScreen> createState() => _StaffDetailScreenState();
}

class _StaffDetailScreenState extends State<StaffDetailScreen> {
  StaffMember? _staff;
  String? _error;
  bool _busy = false;
  bool _uploading = false;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final staff = await getIt<StaffRepository>().getById(widget.staffId);
      if (!mounted) return;
      setState(() => _staff = staff);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this staff member ($e)');
    }
  }

  Future<void> _guard(Future<bool> Function() action) async {
    setState(() => _busy = true);
    try {
      if (await action()) await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _status(StaffAction a) async {
    final s = _staff!;
    setState(() => _busy = true);
    try {
      final done = await runStaffAction(context, s, a);
      if (!mounted) return;
      if (done && a == StaffAction.delete) {
        context.pop();
        return;
      }
      if (done) await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changePhoto() async {
    final url = await pickAvatarDataUrl(context);
    if (url == null || !mounted) return;
    setState(() => _uploading = true);
    try {
      await getIt<StaffRepository>().update(widget.staffId, {'avatarUrl': url});
      await _load();
      if (mounted) teamSnack(context, 'Photo updated.');
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _editRole() async {
    final s = _staff!;
    final selected = await showTeamSheet<StaffRole>(
      context,
      (sheetContext) {
        var value = s.role;
        return StatefulBuilder(
          builder: (context, setSheetState) => TeamSheetScaffold(
            icon: Icons.shield_rounded,
            title: 'Change role',
            subtitle: s.name,
            color: TeamColors.violet,
            child: Column(
              children: [
                for (final r in StaffRole.values) ...[
                  TeamChoiceCard(
                    title: r.label,
                    description: r.description,
                    icon: roleIcon(r),
                    color: roleColor(r),
                    selected: value == r,
                    onTap: () => setSheetState(() => value = r),
                  ),
                  const SizedBox(height: 8),
                ],
                const SizedBox(height: 6),
                TeamGradientButton(
                  label: 'Save role',
                  icon: Icons.check_rounded,
                  onTap: value == s.role
                      ? null
                      : () => Navigator.of(sheetContext).pop(value),
                ),
              ],
            ),
          ),
        );
      },
    );
    if (selected == null || selected == s.role || !mounted) return;
    await _guard(() async {
      try {
        await getIt<StaffRepository>().assignRole(widget.staffId, selected);
        if (mounted) teamSnack(context, 'Role updated.');
        return true;
      } catch (e) {
        if (mounted) {
          teamSnack(
            context,
            e is ApiException ? e.detailedMessage : '$e',
            error: true,
          );
        }
        return false;
      }
    });
  }

  Future<void> _push(String route, StaffMember s) =>
      context.push(route, extra: s).then((_) => _load());

  Future<void> _launch(Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) teamSnack(context, 'Could not open that app.');
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final staff = _staff;
    final hero = staff != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Staff profile' : 'Staff'),
        actions: [if (staff != null) _overflow(staff)],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : staff == null
                ? const AppLoadingView()
                : _content(staff),
      ),
    );
  }

  Widget _overflow(StaffMember s) {
    final canUpdate = teamCan(context, 'staff:update');
    final canActivate = teamCan(context, 'staff:activate');
    final canDelete = teamCan(context, 'staff:delete');
    final canRestore = teamCan(context, 'staff:restore');
    final items = <PopupMenuEntry<String>>[
      if (canUpdate)
        const PopupMenuItem(value: 'reset', child: Text('Reset password')),
      if (s.isDeleted) ...[
        if (canRestore)
          const PopupMenuItem(value: 'restore', child: Text('Restore')),
      ] else if (s.isInactive) ...[
        if (canActivate)
          const PopupMenuItem(value: 'activate', child: Text('Activate')),
      ] else if (canActivate && s.status != 'PENDING_VERIFICATION') ...[
        const PopupMenuItem(value: 'suspend', child: Text('Suspend')),
        const PopupMenuItem(value: 'deactivate', child: Text('Deactivate')),
      ],
      if (!s.isDeleted && canDelete)
        const PopupMenuItem(
          value: 'delete',
          child: Text('Delete', style: TextStyle(color: AppColors.danger)),
        ),
    ];
    if (items.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      onSelected: (v) {
        if (v == 'reset') {
          _guard(() => runResetPassword(context, s));
        } else {
          _status(StaffAction.values.firstWhere((a) => a.name == v));
        }
      },
      itemBuilder: (_) => items,
    );
  }

  Widget _content(StaffMember s) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canUpdate = teamCan(context, 'staff:update');
    final canInvite = teamCan(context, 'staff:invite');
    final hasPhone = s.phone != null && s.phone!.isNotEmpty;
    final tone = statusColor(s.status, deleted: s.isDeleted);
    final tenure = tenureOf(s.joiningDate);

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          TeamHero(
            topInset: top,
            name: s.name,
            subtitle:
                '${s.employeeId.isEmpty ? 'No employee ID' : s.employeeId}'
                ' · joined ${fmtDate(s.joiningDate)}',
            avatarUrl: s.avatarUrl,
            statusDot: tone,
            uploading: _uploading,
            onAvatarTap: canUpdate ? _changePhoto : null,
            pills: [
              TeamHeroPill(
                s.isDeleted
                    ? 'Deleted'
                    : s.status == 'PENDING_VERIFICATION'
                        ? 'Pending activation'
                        : prettyEnum(s.status),
                dot: tone,
              ),
              TeamHeroPill(s.role.label, icon: roleIcon(s.role)),
              if (s.workStatus != null)
                TeamHeroPill(
                  prettyEnum(s.workStatus),
                  icon: Icons.schedule_rounded,
                ),
              for (final b in s.branches)
                TeamHeroPill(
                  b.branchName,
                  icon: b.isPrimary ? Icons.star_rounded : Icons.place_outlined,
                ),
            ],
            actions: [
              if (hasPhone)
                TeamHeroAction(
                  label: 'Call',
                  icon: Icons.call_rounded,
                  onTap: () => _launch(Uri(scheme: 'tel', path: s.phone)),
                ),
              TeamHeroAction(
                label: 'Email',
                icon: Icons.mail_rounded,
                onTap: s.email.isEmpty
                    ? null
                    : () => _launch(Uri(scheme: 'mailto', path: s.email)),
              ),
              if (canInvite && s.status == 'PENDING_VERIFICATION')
                TeamHeroAction(
                  label: 'Resend',
                  icon: Icons.forward_to_inbox_rounded,
                  onTap: _busy
                      ? null
                      : () => _guard(() => runResendActivation(context, s)),
                ),
            ],
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              4,
              16 + teamSideInset(context),
              14,
            ),
            child: TeamSummaryGrid(
              tiles: [
                TeamSummaryTile(
                  index: 0,
                  icon: statusIcon(s.status, deleted: s.isDeleted),
                  color: tone,
                  label: 'Status',
                  text: statusLabel(s.status, deleted: s.isDeleted),
                  hint:
                      '${s.role.label} · ${prettyEnum(s.workStatus).toLowerCase()}',
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.event_available_rounded,
                  color: TeamColors.indigo,
                  label: 'Tenure',
                  number: tenure.$1,
                  suffix: ' ${tenure.$2}',
                  hint: 'Since ${fmtDate(s.joiningDate)}',
                ),
                TeamSummaryTile(
                  index: 2,
                  icon: Icons.account_tree_rounded,
                  color: TeamColors.teal,
                  label: 'Branches',
                  number: s.branches.length,
                  hint: s.primaryBranch == null
                      ? 'No primary branch'
                      : 'Primary: ${s.primaryBranch!.branchName}',
                ),
                TeamSummaryTile(
                  index: 3,
                  icon: Icons.history_rounded,
                  color: TeamColors.violet,
                  label: 'Last sign-in',
                  text: s.lastLoginAt == null
                      ? 'Never'
                      : relativeAgo(s.lastLoginAt),
                  hint: s.lastLoginAt != null
                      ? fmtDateTime(s.lastLoginAt)
                      : s.status == 'PENDING_VERIFICATION'
                          ? 'Has not activated yet'
                          : 'No sign-in recorded',
                ),
              ],
            ),
          ),
          TeamTabBar(
            names: _tabNames,
            index: _tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 14),
          Padding(
            padding:
                EdgeInsets.symmetric(horizontal: 16 + teamSideInset(context)),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.04, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: Column(
                key: ValueKey(_tab),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: switch (_tab) {
                  0 => _overview(s, canUpdate),
                  1 => _employment(s, canUpdate),
                  _ => _access(s),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── tabs ──────────────────────────────────────────────────────────────────

  List<Widget> _overview(StaffMember s, bool canUpdate) {
    void edit() => _push(AppRoutes.staffEditPersonal, s);
    final address = [s.addressLine, s.city, s.state, s.country, s.postalCode]
        .where((e) => e != null && e.isNotEmpty)
        .join(', ');
    return [
      TeamSectionCard(
        icon: Icons.person_rounded,
        color: TeamColors.indigo,
        title: 'Personal details',
        onEdit: canUpdate ? edit : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.badge_rounded,
              label: 'First name',
              value: s.firstName,
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.badge_outlined,
              label: 'Last name',
              value: s.lastName,
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.mail_rounded,
              label: 'Email',
              value: s.email,
              color: TeamColors.sky,
            ),
            TeamFieldTile(
              icon: Icons.call_rounded,
              label: 'Phone',
              value: s.phone,
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.numbers_rounded,
              label: 'Employee ID',
              value: s.employeeId,
              color: TeamColors.violet,
            ),
            TeamFieldTile(
              icon: Icons.wc_rounded,
              label: 'Gender',
              value: _genderLabels[s.gender],
              color: TeamColors.fuchsia,
            ),
            TeamFieldTile(
              icon: Icons.cake_rounded,
              label: 'Date of birth',
              value: s.dateOfBirth == null
                  ? null
                  : fmtDate(parseIsoDate(s.dateOfBirth)),
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.event_rounded,
              label: 'Joining date',
              value: fmtDate(s.joiningDate),
              color: TeamColors.amber,
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.home_rounded,
        color: TeamColors.teal,
        title: 'Address',
        onEdit: canUpdate ? edit : null,
        child: TeamFieldTile(
          icon: Icons.place_rounded,
          label: 'Address',
          value: address,
          color: TeamColors.teal,
          maxLines: 5,
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.emergency_rounded,
        color: TeamColors.rose,
        title: 'Emergency contact',
        onEdit: canUpdate ? edit : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.person_outline_rounded,
              label: 'Name',
              value: s.emergencyContactName,
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.call_rounded,
              label: 'Phone',
              value: s.emergencyContactPhone,
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.family_restroom_rounded,
              label: 'Relation',
              value: s.emergencyContactRelation,
              color: TeamColors.rose,
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.sticky_note_2_rounded,
        color: TeamColors.amber,
        title: 'Notes',
        onEdit: canUpdate ? edit : null,
        child: TeamFieldTile(
          icon: Icons.notes_rounded,
          label: 'Notes',
          value: s.notes,
          color: TeamColors.amber,
          maxLines: 10,
        ),
      ),
    ];
  }

  List<Widget> _employment(StaffMember s, bool canUpdate) {
    final off = s.weeklyOffDays.toSet();
    return [
      TeamSectionCard(
        icon: Icons.work_rounded,
        color: TeamColors.violet,
        title: 'Employment',
        onEdit:
            canUpdate ? () => _push(AppRoutes.staffEditEmployment, s) : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.assignment_ind_rounded,
              label: 'Employment type',
              value: _employmentLabels[s.employmentType],
              color: TeamColors.violet,
            ),
            TeamFieldTile(
              icon: Icons.schedule_rounded,
              label: 'Work status',
              value: prettyEnum(s.workStatus),
              color: workStatusColor(s.workStatus),
            ),
            TeamFieldTile(
              icon: Icons.payments_rounded,
              label: 'Salary type',
              value: _salaryLabels[s.salaryType],
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.currency_rupee_rounded,
              label: 'Salary amount',
              value: s.salaryAmount == null
                  ? null
                  : '${AppCurrency.symbol}${s.salaryAmount!.toStringAsFixed(s.salaryAmount! % 1 == 0 ? 0 : 2)}',
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.wb_twilight_rounded,
              label: 'Shift',
              value: s.shift,
              color: TeamColors.amber,
            ),
            TeamFieldTile(
              icon: Icons.event_rounded,
              label: 'Joining date',
              value: fmtDate(s.joiningDate),
              color: TeamColors.sky,
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.weekend_rounded,
        color: TeamColors.teal,
        title: 'Weekly off',
        subtitle:
            off.isEmpty ? 'No fixed days off' : '${off.length} day(s) off',
        onEdit:
            canUpdate ? () => _push(AppRoutes.staffEditEmployment, s) : null,
        child: Row(
          children: [
            for (var i = 0; i < _weekdays.length; i++)
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(left: i == 0 ? 0 : 5),
                  child: PopIn(
                    index: i,
                    child: _DayDot(
                      label: _weekdays[i],
                      on: off.contains(_weekdays[i]),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ];
  }

  List<Widget> _access(StaffMember s) {
    final canRole = teamCan(context, 'staff:assign-role');
    final canBranch = teamCan(context, 'staff:assign-branch');
    final canUpdate = teamCan(context, 'staff:update');
    final canInvite = teamCan(context, 'staff:invite');
    final canActivate = teamCan(context, 'staff:activate');
    final canDelete = teamCan(context, 'staff:delete');
    final canRestore = teamCan(context, 'staff:restore');
    final rc = roleColor(s.role);

    final showLifecycle = !s.isInactive && canActivate;
    final showDelete = !s.isDeleted && canDelete;

    return [
      TeamSectionCard(
        icon: Icons.shield_rounded,
        color: rc,
        title: 'Role',
        subtitle: 'One of the three staff roles',
        onEdit: canRole && !s.isDeleted ? _editRole : null,
        editLabel: 'Change',
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [rc, Color.lerp(rc, TeamColors.fuchsia, 0.5)!],
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(roleIcon(s.role), color: Colors.white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.role.label,
                    style: AppText.body(size: 15, weight: FontWeight.w800),
                  ),
                  Text(
                    s.role.description,
                    style: AppText.body(
                      size: 12,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.account_tree_rounded,
        color: TeamColors.teal,
        title: 'Assigned branches',
        subtitle: '${s.branches.length} branch'
            '${s.branches.length == 1 ? '' : 'es'}',
        onEdit: canBranch && !s.isDeleted
            ? () => _push(AppRoutes.staffEditBranches, s)
            : null,
        child: s.branches.isEmpty
            ? Text(
                'No branches assigned',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (var i = 0; i < s.branches.length; i++)
                    FadeUp(
                      index: i,
                      child: Container(
                        margin: EdgeInsets.only(top: i == 0 ? 0 : 8),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: TeamColors.teal.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: TeamColors.teal.withValues(alpha: 0.22),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              s.branches[i].isPrimary
                                  ? Icons.star_rounded
                                  : Icons.place_rounded,
                              size: 18,
                              color: s.branches[i].isPrimary
                                  ? TeamColors.amber
                                  : TeamColors.teal,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                s.branches[i].branchName,
                                style: AppText.body(
                                  size: 13.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                            if (s.branches[i].isPrimary)
                              const TeamTag(
                                label: 'Primary',
                                color: TeamColors.amber,
                              ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.lock_rounded,
        color: TeamColors.green,
        title: 'Account & security',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _kv(
              'Account status',
              statusLabel(s.status, deleted: s.isDeleted),
              statusColor(s.status, deleted: s.isDeleted),
            ),
            _kv(
              'Activation',
              s.status == 'PENDING_VERIFICATION'
                  ? 'Awaiting activation'
                  : 'Activated',
              s.status == 'PENDING_VERIFICATION'
                  ? TeamColors.amber
                  : TeamColors.green,
            ),
            _kv('Last sign-in', fmtDateTime(s.lastLoginAt), null),
            _kv('Profile updated', fmtDate(s.updatedAt), null),
            if (canInvite && s.status == 'PENDING_VERIFICATION') ...[
              const SizedBox(height: 6),
              TeamActionTile(
                icon: Icons.forward_to_inbox_rounded,
                label: 'Resend activation email',
                hint: 'Sends a fresh link so they can set a password',
                color: TeamColors.indigo,
                busy: _busy,
                onTap: () => _guard(() => runResendActivation(context, s)),
              ),
            ],
            if (canActivate && s.status == 'PENDING_VERIFICATION')
              TeamActionTile(
                icon: Icons.key_rounded,
                label: 'Activate manually',
                hint: 'Issue a temporary password to hand over in person',
                color: TeamColors.teal,
                busy: _busy,
                onTap: () => _guard(() => runManualActivate(context, s)),
              ),
            if (canUpdate)
              TeamActionTile(
                icon: Icons.lock_reset_rounded,
                label: 'Reset password',
                hint: 'Emails them a link to set a new password',
                color: TeamColors.violet,
                busy: _busy,
                onTap: () => _guard(() => runResetPassword(context, s)),
              ),
          ],
        ),
      ),
      if (s.isInactive &&
          ((s.isDeleted && canRestore) || (!s.isDeleted && canActivate))) ...[
        const SizedBox(height: 14),
        TeamActionTile(
          icon: Icons.restore_rounded,
          label: s.isDeleted ? 'Restore account' : 'Activate account',
          hint: 'Gives ${s.name} access again',
          color: TeamColors.green,
          busy: _busy,
          onTap: () =>
              _status(s.isDeleted ? StaffAction.restore : StaffAction.activate),
        ),
      ],
      if (showLifecycle || showDelete) ...[
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.warning_amber_rounded,
          color: TeamColors.rose,
          title: 'Danger zone',
          subtitle:
              'Every step asks for confirmation; deleted accounts can be restored',
          child: Column(
            children: [
              if (showLifecycle) ...[
                TeamActionTile(
                  icon: Icons.pause_circle_outline_rounded,
                  label: 'Suspend',
                  hint: 'Blocks sign-in until restored',
                  color: TeamColors.amber,
                  busy: _busy,
                  onTap: () => _status(StaffAction.suspend),
                ),
                TeamActionTile(
                  icon: Icons.block_rounded,
                  label: 'Deactivate',
                  hint: 'Turns the account off',
                  color: TeamColors.slate,
                  busy: _busy,
                  onTap: () => _status(StaffAction.deactivate),
                ),
              ],
              if (showDelete)
                TeamActionTile(
                  icon: Icons.delete_outline_rounded,
                  label: 'Delete staff member',
                  hint: 'Soft-deletes the account',
                  color: TeamColors.rose,
                  busy: _busy,
                  onTap: () => _status(StaffAction.delete),
                ),
            ],
          ),
        ),
      ],
    ];
  }

  Widget _kv(String k, String v, Color? color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Text(
            k,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const Spacer(),
          if (color != null)
            TeamTag(label: v, color: color)
          else
            Flexible(
              child: Text(
                v,
                textAlign: TextAlign.right,
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
            ),
        ],
      ),
    );
  }
}

class _DayDot extends StatelessWidget {
  const _DayDot({required this.label, required this.on});

  final String label;
  final bool on;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        gradient: on ? TeamColors.cta : null,
        color: on ? null : AppColors.surface3,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(
            on ? Icons.bedtime_rounded : Icons.wb_sunny_rounded,
            size: 13,
            color: on ? Colors.white : AppColors.inkFaint,
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w800,
              color: on ? Colors.white : AppColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}
