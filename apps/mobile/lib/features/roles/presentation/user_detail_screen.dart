import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/iam_user.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

const _tabNames = ['Profile', 'Access', 'Permissions'];

const _staffRoleNames = {'MANAGER', 'TRAINER', 'RECEPTIONIST'};

/// User profile (`GET /users/:id`) — web's `/users/[id]` page redesigned in the
/// Member-profile language: animated gradient hero, six summary tiles and three
/// tabs.
///
/// - **Profile** — account details + emergency contact (edit → account
///   screen), account status actions (suspend / deactivate / restore / delete).
/// - **Access** — assigned roles (edit → roles screen) and branch access with
///   primary + expiry (edit → branches screen).
/// - **Permissions** — the effective-access summary (roles + grants − revokes,
///   per resource) and the per-user GRANT / DENY overrides (edit → overrides
///   screen).
///
/// Editing needs `users:manage`; people can't suspend, delete or re-role
/// themselves (same guard as web).
class UserDetailScreen extends StatefulWidget {
  const UserDetailScreen({required this.userId, super.key});

  final String userId;

  @override
  State<UserDetailScreen> createState() => _UserDetailScreenState();
}

class _UserDetailScreenState extends State<UserDetailScreen> {
  IamUser? _user;
  bool _busy = false;
  String? _error;
  int _tab = 0;

  bool get _canManage => teamCan(context, 'users:manage');
  bool get _isSelf => teamSelfId(context) == widget.userId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final user = await getIt<IamUserRepository>().getById(widget.userId);
      if (!mounted) return;
      setState(() => _user = user);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this user ($e)');
    }
  }

  Future<void> _act(String action) async {
    final u = _user!;
    final verb = switch (action) {
      'suspend' => 'Suspend',
      'deactivate' => 'Deactivate',
      'restore' => 'Restore',
      _ => 'Delete',
    };
    final ok = await confirmTeam(
      context,
      title: '$verb ${u.name}?',
      message: action == 'delete'
          ? 'This soft-deletes the account. It can be restored later.'
          : 'This action can be reversed later if needed.',
      confirmLabel: verb,
      destructive: action == 'delete' || action == 'suspend',
    );
    if (!ok || !mounted) return;
    setState(() => _busy = true);
    final repo = getIt<IamUserRepository>();
    try {
      switch (action) {
        case 'suspend':
          await repo.suspend(u.id);
        case 'deactivate':
          await repo.deactivate(u.id);
        case 'restore':
          await repo.restore(u.id);
        default:
          await repo.delete(u.id);
      }
      if (!mounted) return;
      if (action == 'delete') {
        teamSnack(context, '${u.name} deleted (soft).');
        context.pop();
        return;
      }
      teamSnack(
        context,
        '${u.name} ${switch (action) {
          'suspend' => 'suspended',
          'deactivate' => 'deactivated',
          _ => 'restored',
        }}.',
      );
      await _load();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _push(String route, IamUser u) =>
      context.push(route, extra: u).then((_) => _load());

  @override
  Widget build(BuildContext context) {
    final user = _user;
    final hero = user != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'User profile' : 'User'),
        actions: [if (user != null) _overflow(user)],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : user == null
                ? const AppLoadingView()
                : _content(user),
      ),
    );
  }

  Widget _overflow(IamUser u) {
    if (!_canManage || _isSelf) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      onSelected: _act,
      itemBuilder: (_) => [
        if (u.needsRestore)
          const PopupMenuItem(value: 'restore', child: Text('Restore'))
        else ...[
          const PopupMenuItem(value: 'suspend', child: Text('Suspend')),
          const PopupMenuItem(value: 'deactivate', child: Text('Deactivate')),
        ],
        if (!u.isDeleted)
          const PopupMenuItem(
            value: 'delete',
            child: Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
      ],
    );
  }

  Widget _content(IamUser u) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final tone = statusColor(u.status, deleted: u.isDeleted);
    final branchChips = u.allBranches
        ? ['All branches']
        : u.branches.map((b) => b.branchName).toList();
    final shown = branchChips.take(3).toList();

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          TeamHero(
            topInset: top,
            name: u.name,
            subtitle: [
              u.email,
              if (u.phone != null && u.phone!.isNotEmpty) u.phone!,
            ].join(' · '),
            avatarUrl: u.avatarUrl,
            statusDot: tone,
            pills: [
              TeamHeroPill(
                statusLabel(u.status, deleted: u.isDeleted),
                dot: tone,
              ),
              for (final r in u.roles)
                TeamHeroPill(
                  displayRoleName(r.name),
                  icon: iamRoleIcon(r.name),
                ),
              for (final b in shown)
                TeamHeroPill(b, icon: Icons.place_outlined),
              if (branchChips.length > shown.length)
                TeamHeroPill('+${branchChips.length - shown.length} more'),
              TeamHeroPill(
                'Last sign-in ${u.lastLoginAt == null ? 'never' : fmtDateTime(u.lastLoginAt)}',
                icon: Icons.schedule_rounded,
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
                  icon: statusIcon(u.status, deleted: u.isDeleted),
                  color: tone,
                  label: 'Status',
                  text: statusLabel(u.status, deleted: u.isDeleted),
                  hint: u.emailVerifiedAt == null
                      ? 'Email not verified'
                      : 'Email verified',
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.shield_rounded,
                  color: TeamColors.violet,
                  label: 'Roles',
                  number: u.roles.length,
                  hint: u.roles.isEmpty
                      ? 'None assigned'
                      : u.roles.map((r) => displayRoleName(r.name)).join(', '),
                ),
                TeamSummaryTile(
                  index: 2,
                  icon: Icons.account_tree_rounded,
                  color: TeamColors.amber,
                  label: 'Branches',
                  text: u.allBranches ? 'All' : '${u.branches.length}',
                  hint: u.allBranches ? 'Every branch' : 'Specific branches',
                ),
                TeamSummaryTile(
                  index: 3,
                  icon: u.mfaEnabled
                      ? Icons.shield_moon_rounded
                      : Icons.shield_outlined,
                  color: u.mfaEnabled ? TeamColors.green : TeamColors.rose,
                  label: 'Two-factor',
                  text: u.mfaEnabled ? 'On' : 'Off',
                  hint: u.mfaEnabled ? 'Extra sign-in step' : 'Password only',
                ),
                TeamSummaryTile(
                  index: 4,
                  icon: Icons.key_rounded,
                  color: TeamColors.indigo,
                  label: 'Effective permissions',
                  number: u.effectivePermissions.length,
                  hint: '${u.permissionOverrides.length} override'
                      '${u.permissionOverrides.length == 1 ? '' : 's'}',
                ),
                TeamSummaryTile(
                  index: 5,
                  icon: Icons.history_rounded,
                  color: TeamColors.sky,
                  label: 'Last sign-in',
                  text: relativeAgo(u.lastLoginAt),
                  hint: 'Created ${fmtDate(u.createdAt)}',
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
                  0 => _profile(u),
                  1 => _access(u),
                  _ => _permissions(u),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── tabs ──────────────────────────────────────────────────────────────────

  List<Widget> _profile(IamUser u) {
    final canEdit = _canManage && !u.isDeleted;
    final isStaff = u.roles.any((r) => _staffRoleNames.contains(r.name));
    return [
      TeamSectionCard(
        icon: Icons.manage_accounts_rounded,
        color: TeamColors.indigo,
        title: 'Account details',
        onEdit: canEdit ? () => _push(AppRoutes.userEditProfile, u) : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.person_rounded,
              label: 'Name',
              value: u.name,
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.mail_rounded,
              label: 'Email',
              value: u.email,
              color: TeamColors.sky,
            ),
            TeamFieldTile(
              icon: Icons.call_rounded,
              label: 'Phone',
              value: u.phone,
              color: TeamColors.green,
            ),
            TeamFieldTile(
              icon: Icons.mark_email_read_rounded,
              label: 'Email verified',
              value: u.emailVerifiedAt == null
                  ? 'Not yet'
                  : fmtDate(u.emailVerifiedAt),
              color: TeamColors.teal,
            ),
            TeamFieldTile(
              icon: Icons.event_rounded,
              label: 'Created',
              value: fmtDate(u.createdAt),
              color: TeamColors.amber,
            ),
            TeamFieldTile(
              icon: Icons.update_rounded,
              label: 'Updated',
              value: fmtDate(u.updatedAt),
              color: TeamColors.violet,
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.emergency_rounded,
        color: TeamColors.rose,
        title: 'Emergency contact',
        onEdit: canEdit ? () => _push(AppRoutes.userEditProfile, u) : null,
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.person_outline_rounded,
              label: 'Name',
              value: u.emergencyContactName,
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.call_rounded,
              label: 'Phone',
              value: u.emergencyContactPhone,
              color: TeamColors.rose,
            ),
            TeamFieldTile(
              icon: Icons.family_restroom_rounded,
              label: 'Relation',
              value: u.emergencyContactRelation,
              color: TeamColors.rose,
            ),
          ],
        ),
      ),
      if (isStaff && teamCan(context, 'staff:view')) ...[
        const SizedBox(height: 14),
        TeamActionTile(
          icon: Icons.badge_rounded,
          label: 'Open staff profile',
          hint: 'Employment, salary and branch assignments',
          color: TeamColors.violet,
          onTap: () => context.push(AppRoutes.staffDetail, extra: u.id),
        ),
      ],
      if (_canManage && !_isSelf) ...[
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.manage_history_rounded,
          color: TeamColors.rose,
          title: 'Account status',
          subtitle: 'Every step asks for confirmation',
          child: Column(
            children: [
              if (u.needsRestore)
                TeamActionTile(
                  icon: Icons.restore_rounded,
                  label: 'Restore',
                  hint: 'Gives ${u.name} access again',
                  color: TeamColors.green,
                  busy: _busy,
                  onTap: () => _act('restore'),
                )
              else ...[
                TeamActionTile(
                  icon: Icons.pause_circle_outline_rounded,
                  label: 'Suspend',
                  hint: 'Blocks sign-in until restored',
                  color: TeamColors.amber,
                  busy: _busy,
                  onTap: () => _act('suspend'),
                ),
                TeamActionTile(
                  icon: Icons.block_rounded,
                  label: 'Deactivate',
                  hint: 'Turns the account off',
                  color: TeamColors.slate,
                  busy: _busy,
                  onTap: () => _act('deactivate'),
                ),
              ],
              if (!u.isDeleted)
                TeamActionTile(
                  icon: Icons.delete_outline_rounded,
                  label: 'Delete user',
                  hint: 'Soft-deletes the account',
                  color: TeamColors.rose,
                  busy: _busy,
                  onTap: () => _act('delete'),
                ),
            ],
          ),
        ),
      ],
    ];
  }

  List<Widget> _access(IamUser u) {
    final canEdit = _canManage && !u.isDeleted;
    return [
      TeamSectionCard(
        icon: Icons.shield_rounded,
        color: TeamColors.violet,
        title: 'Roles',
        subtitle: _isSelf ? "You can't change your own roles" : null,
        onEdit: canEdit && !_isSelf
            ? () => _push(AppRoutes.userEditRoles, u)
            : null,
        child: u.roles.isEmpty
            ? Text(
                'No roles assigned',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (var i = 0; i < u.roles.length; i++)
                    FadeUp(
                      index: i,
                      child: Container(
                        margin: EdgeInsets.only(top: i == 0 ? 0 : 8),
                        padding: const EdgeInsets.all(11),
                        decoration: BoxDecoration(
                          color: iamRoleColor(u.roles[i].name)
                              .withValues(alpha: 0.09),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: iamRoleColor(u.roles[i].name)
                                .withValues(alpha: 0.25),
                          ),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              iamRoleIcon(u.roles[i].name),
                              size: 20,
                              color: iamRoleColor(u.roles[i].name),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                displayRoleName(u.roles[i].name),
                                style: AppText.body(
                                  size: 13.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                            TeamTag(
                              label: u.roles[i].isSystem ? 'System' : 'Custom',
                              color: iamRoleColor(u.roles[i].name),
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
        icon: Icons.account_tree_rounded,
        color: TeamColors.amber,
        title: 'Branch access',
        subtitle:
            u.allBranches ? 'All branches' : '${u.branches.length} selected',
        onEdit: canEdit ? () => _push(AppRoutes.userEditBranches, u) : null,
        child: u.allBranches
            ? Row(
                children: [
                  const Icon(
                    Icons.all_inclusive_rounded,
                    color: TeamColors.amber,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Every branch, including future ones',
                    style: AppText.body(size: 13, weight: FontWeight.w700),
                  ),
                ],
              )
            : u.branches.isEmpty
                ? Text(
                    'No branch access',
                    style: AppText.body(size: 13, color: AppColors.inkFaint),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < u.branches.length; i++)
                        FadeUp(
                          index: i,
                          child: Container(
                            margin: EdgeInsets.only(top: i == 0 ? 0 : 8),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: TeamColors.amber.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: TeamColors.amber.withValues(alpha: 0.22),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  u.branches[i].isPrimary
                                      ? Icons.star_rounded
                                      : Icons.place_rounded,
                                  size: 18,
                                  color: TeamColors.amber,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        u.branches[i].branchName,
                                        style: AppText.body(
                                          size: 13.5,
                                          weight: FontWeight.w800,
                                        ),
                                      ),
                                      if (u.branches[i].expiresAt != null)
                                        Text(
                                          'Access until '
                                          '${fmtDate(u.branches[i].expiresAt)}',
                                          style: AppText.body(
                                            size: 11,
                                            color: AppColors.inkFaint,
                                            weight: FontWeight.w600,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (u.branches[i].isPrimary)
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
    ];
  }

  List<Widget> _permissions(IamUser u) {
    final canEdit = _canManage && !u.isDeleted;
    final byResource = <String, int>{};
    for (final key in u.effectivePermissions) {
      final resource = key.split(':').first;
      byResource[resource] = (byResource[resource] ?? 0) + 1;
    }
    final rows = byResource.entries.toList()
      ..sort((a, b) {
        final c = b.value.compareTo(a.value);
        return c != 0 ? c : a.key.compareTo(b.key);
      });
    final grants =
        u.permissionOverrides.where((o) => o.mode == 'GRANT').toList();
    final revokes =
        u.permissionOverrides.where((o) => o.mode != 'GRANT').toList();
    final max = rows.isEmpty ? 1 : rows.first.value;

    return [
      TeamSectionCard(
        icon: Icons.key_rounded,
        color: TeamColors.green,
        title: 'Effective access',
        subtitle: 'Roles + grants − revokes — exactly what the API enforces',
        trailing: TeamTag(
          label: '${u.effectivePermissions.length} permissions',
          color: TeamColors.green,
        ),
        child: rows.isEmpty
            ? Text(
                'No permissions.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (var i = 0; i < rows.length; i++)
                    Padding(
                      padding: EdgeInsets.only(top: i == 0 ? 0 : 9),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  rows[i].key.replaceAll('-', ' '),
                                  style: AppText.body(
                                    size: 12.5,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Text(
                                '${rows[i].value}',
                                style: AppText.body(
                                  size: 12,
                                  weight: FontWeight.w800,
                                  color: TeamColors
                                      .rotation[i % TeamColors.rotation.length],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          GrowBar(
                            ratio: rows[i].value / max,
                            height: 6,
                            track: AppColors.surface3,
                            colors: [
                              TeamColors
                                  .rotation[i % TeamColors.rotation.length],
                              TeamColors
                                  .rotation[i % TeamColors.rotation.length]
                                  .withValues(alpha: 0.5),
                            ],
                          ),
                        ],
                      ),
                    ),
                ],
              ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.tune_rounded,
        color: TeamColors.fuchsia,
        title: 'Permission overrides',
        subtitle: 'Everything else inherits from their roles',
        onEdit: canEdit ? () => _push(AppRoutes.userEditPermissions, u) : null,
        child: u.permissionOverrides.isEmpty
            ? Row(
                children: [
                  const Icon(
                    Icons.check_circle_outline_rounded,
                    color: TeamColors.green,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'No overrides — access comes entirely from their roles.',
                      style: AppText.body(
                        size: 12.5,
                        color: AppColors.inkSoft,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 6,
                    children: [
                      TeamTag(
                        label: '${grants.length} grant'
                            '${grants.length == 1 ? '' : 's'}',
                        color: TeamColors.green,
                        icon: Icons.add_circle_outline_rounded,
                      ),
                      TeamTag(
                        label: '${revokes.length} revoke'
                            '${revokes.length == 1 ? '' : 's'}',
                        color: TeamColors.rose,
                        icon: Icons.remove_circle_outline_rounded,
                      ),
                    ],
                  ),
                  if (grants.isNotEmpty) ...[
                    const TeamGroupLabel('Granted on top of roles'),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final o in grants)
                          TeamTag(label: o.key, color: TeamColors.green),
                      ],
                    ),
                  ],
                  if (revokes.isNotEmpty) ...[
                    const TeamGroupLabel('Revoked from roles'),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final o in revokes)
                          TeamTag(label: o.key, color: TeamColors.rose),
                      ],
                    ),
                  ],
                ],
              ),
      ),
    ];
  }
}
