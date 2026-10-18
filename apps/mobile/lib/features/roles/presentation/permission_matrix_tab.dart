import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_matrix.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Web's `/permissions` "Matrix" view (`GET /permissions/matrix`), reshaped for
/// a phone: pick a role to see its coverage per resource (animated bars that
/// expand into a ✓/✗ checklist of every permission), or open the full
/// permission × role comparison table in a sheet.
class PermissionMatrixTab extends StatefulWidget {
  const PermissionMatrixTab({super.key});

  @override
  State<PermissionMatrixTab> createState() => _PermissionMatrixTabState();
}

class _PermissionMatrixTabState extends State<PermissionMatrixTab> {
  PermissionMatrix? _matrix;
  String? _error;
  int _role = 0;
  final Set<String> _open = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final m = await getIt<TenantRoleRepository>().matrix();
      if (!mounted) return;
      setState(() {
        _matrix = m;
        if (_role >= m.roles.length) _role = 0;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  void _openCompare(PermissionMatrix m) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (_) => _CompareSheet(matrix: m),
    );
  }

  @override
  Widget build(BuildContext context) {
    final m = _matrix;
    if (m == null) {
      return _error != null
          ? AppErrorView(message: _error!, onRetry: _load)
          : const AppLoadingView();
    }
    if (m.roles.isEmpty) {
      return const AppEmptyState(
        icon: Icons.grid_view_rounded,
        title: 'No roles yet',
        message: 'Create a role to compare permissions.',
      );
    }
    final role = m.roles[_role];
    final color = iamRoleColor(role.name);
    final total = m.permissions.length;
    final have =
        m.permissions.where((p) => role.permissionKeys.contains(p.key)).length;
    final groups = m.byResource;

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          0,
          18 + teamSideInset(context),
          24,
        ),
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (var i = 0; i < m.roles.length; i++) ...[
                  TeamFilterChip(
                    label: displayRoleName(m.roles[i].name),
                    color: iamRoleColor(m.roles[i].name),
                    selected: i == _role,
                    onTap: () => setState(() {
                      _role = i;
                      _open.clear();
                    }),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),
          FadeUp(
            key: ValueKey(role.id),
            index: 0,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.28),
                    color.withValues(alpha: 0.05),
                  ],
                ),
                border: Border.all(color: color.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  AnimatedRing(
                    key: ValueKey('ring-${role.id}'),
                    value: total == 0 ? 0 : have / total,
                    size: 84,
                    stroke: 10,
                    colors: [
                      color,
                      Color.lerp(color, TeamColors.fuchsia, 0.5)!,
                    ],
                    track: color.withValues(alpha: 0.18),
                    child: Text(
                      total == 0 ? '0%' : '${(have / total * 100).round()}%',
                      style: AppText.display(size: 16),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayRoleName(role.name),
                          style: AppText.display(size: 19),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$have of $total permissions',
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w700,
                            color: AppColors.inkSoft,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TeamTag(
                          label: role.isSystem ? 'System role' : 'Custom role',
                          color: color,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          GestureDetector(
            onTap: () => _openCompare(m),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.grid_view_rounded,
                    size: 16,
                    color: TeamColors.violet,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'Compare all roles side by side',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          for (final (i, e) in groups.entries.indexed)
            _resourceCard(
              i,
              e.key,
              e.value,
              role,
              TeamColors.rotation[i % TeamColors.rotation.length],
            ),
        ],
      ),
    );
  }

  Widget _resourceCard(
    int index,
    String resource,
    List<MatrixPermission> perms,
    MatrixRole role,
    Color color,
  ) {
    final have = perms.where((p) => role.permissionKeys.contains(p.key)).length;
    final open = _open.contains(resource);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: FadeUp(
        index: index.clamp(0, 8),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withValues(alpha: 0.22)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => setState(() {
                    if (!_open.add(resource)) _open.remove(resource);
                  }),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                resource.replaceAll('-', ' '),
                                style: AppText.body(
                                  size: 13.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                            Text(
                              '$have / ${perms.length}',
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w800,
                                color: have == 0 ? AppColors.inkFaint : color,
                              ),
                            ),
                            Icon(
                              open
                                  ? Icons.expand_less_rounded
                                  : Icons.expand_more_rounded,
                              color: AppColors.inkFaint,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        GrowBar(
                          key: ValueKey('$resource-${role.id}'),
                          ratio: perms.isEmpty ? 0 : have / perms.length,
                          height: 7,
                          track: AppColors.surface3,
                          colors: [color, color.withValues(alpha: 0.55)],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (open)
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                  child: Column(
                    children: [
                      for (final p in perms)
                        TeamCheckRow(
                          label: p.key,
                          ok: role.permissionKeys.contains(p.key),
                          color: color,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Permission × role table (web's matrix), horizontally scrollable with the
/// rows lazily built.
class _CompareSheet extends StatefulWidget {
  const _CompareSheet({required this.matrix});

  final PermissionMatrix matrix;

  @override
  State<_CompareSheet> createState() => _CompareSheetState();
}

class _CompareSheetState extends State<_CompareSheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final m = widget.matrix;
    final q = _q.toLowerCase();
    final rows = q.isEmpty
        ? m.permissions
        : m.permissions.where((p) => p.key.toLowerCase().contains(q)).toList();
    const keyW = 190.0;
    const cellW = 62.0;
    final width = keyW + cellW * m.roles.length;

    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.88,
        child: Column(
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 8),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
              child: Row(
                children: [
                  const Icon(Icons.grid_view_rounded, color: TeamColors.violet),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Permission matrix',
                      style: AppText.display(size: 17),
                    ),
                  ),
                  Text(
                    '${rows.length} rows',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
              child: TeamSearchField(
                hint: 'Search permissions…',
                onSearch: (v) => setState(() => _q = v),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SizedBox(
                  width: width,
                  child: Column(
                    children: [
                      Container(
                        color: TeamColors.violet.withValues(alpha: 0.1),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          children: [
                            const SizedBox(width: keyW),
                            for (final r in m.roles)
                              SizedBox(
                                width: cellW,
                                child: Text(
                                  displayRoleName(r.name),
                                  textAlign: TextAlign.center,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 10,
                                    weight: FontWeight.w800,
                                    color: iamRoleColor(r.name),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: ListView.builder(
                          itemCount: rows.length,
                          itemBuilder: (context, i) {
                            final p = rows[i];
                            return Container(
                              height: 38,
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(
                                    color:
                                        AppColors.line.withValues(alpha: 0.6),
                                  ),
                                ),
                              ),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: keyW,
                                    child: Padding(
                                      padding: const EdgeInsets.only(left: 18),
                                      child: Text(
                                        p.key,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: AppText.body(
                                          size: 11.5,
                                          weight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                  for (final r in m.roles)
                                    SizedBox(
                                      width: cellW,
                                      child: Center(
                                        child: r.permissionKeys.contains(p.key)
                                            ? Container(
                                                width: 20,
                                                height: 20,
                                                decoration: BoxDecoration(
                                                  shape: BoxShape.circle,
                                                  color: iamRoleColor(r.name),
                                                ),
                                                child: const Icon(
                                                  Icons.check_rounded,
                                                  size: 13,
                                                  color: Colors.white,
                                                ),
                                              )
                                            : Text(
                                                '—',
                                                style: AppText.body(
                                                  size: 12,
                                                  color: AppColors.inkFaint
                                                      .withValues(alpha: 0.5),
                                                ),
                                              ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
