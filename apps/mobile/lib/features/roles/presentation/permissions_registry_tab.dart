import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/permission_group.dart';
import '../../../repositories/tenant_role_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// The web app's `/permissions` "Registry" view — the full catalog of
/// `resource:action` keys, grouped by resource, searchable. Read-only:
/// creating or editing permissions has no endpoint anywhere (web included);
/// only role / user *grants* against the fixed registry are editable (that's
/// what Roles and Users are for). Needs `permissions:read`.
class PermissionsRegistryTab extends StatefulWidget {
  const PermissionsRegistryTab({super.key});

  @override
  State<PermissionsRegistryTab> createState() => _PermissionsRegistryTabState();
}

class _PermissionsRegistryTabState extends State<PermissionsRegistryTab> {
  List<PermissionGroup>? _groups;
  String _search = '';
  String? _error;
  final Set<String> _open = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final groups = await getIt<TenantRoleRepository>().listPermissions();
      if (!mounted) return;
      setState(() => _groups = groups);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final groups = _groups;
    if (groups == null) {
      return _error != null
          ? AppErrorView(message: _error!, onRetry: _load)
          : const AppLoadingView();
    }
    final q = _search.toLowerCase();
    final total = groups.fold<int>(0, (a, g) => a + g.permissions.length);

    final cards = <Widget>[];
    for (var gi = 0; gi < groups.length; gi++) {
      final g = groups[gi];
      final color = TeamColors.rotation[gi % TeamColors.rotation.length];
      final items = q.isEmpty
          ? g.permissions
          : g.permissions
              .where(
                (p) =>
                    p.key.toLowerCase().contains(q) ||
                    (p.description ?? '').toLowerCase().contains(q),
              )
              .toList();
      if (items.isEmpty) continue;
      final open = q.isNotEmpty || _open.contains(g.resource);
      cards.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: FadeUp(
            index: cards.length,
            child: TeamSectionCard(
              icon: Icons.key_rounded,
              color: color,
              title: g.resource.replaceAll('-', ' '),
              subtitle: '${g.permissions.length} permission'
                  '${g.permissions.length == 1 ? '' : 's'}',
              trailing: IconButton(
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                  color: AppColors.inkFaint,
                ),
                onPressed: q.isNotEmpty
                    ? null
                    : () => setState(() {
                          if (!_open.add(g.resource)) _open.remove(g.resource);
                        }),
              ),
              child: open
                  ? Column(
                      children: [
                        for (final p in items)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 5),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: color.withValues(alpha: 0.13),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    p.key,
                                    style: AppText.body(
                                      size: 11.5,
                                      weight: FontWeight.w800,
                                      color: color,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    p.description ?? '',
                                    style: AppText.body(
                                      size: 11.5,
                                      color: AppColors.inkFaint,
                                      weight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    )
                  : Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final p in g.permissions.take(6))
                          TeamTag(
                            label: p.key.split(':').last,
                            color: color,
                          ),
                        if (g.permissions.length > 6)
                          TeamTag(
                            label: '+${g.permissions.length - 6}',
                            color: AppColors.inkFaint,
                          ),
                      ],
                    ),
            ),
          ),
        ),
      );
    }

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
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: TeamSearchField(
                    hint: 'Search $total permissions…',
                    onSearch: (v) => setState(() => _search = v),
                  ),
                ),
              ],
            ),
          ),
          if (cards.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: AppEmptyState(
                icon: Icons.search_off_rounded,
                title: 'No permissions match',
                message: 'Try a different search.',
              ),
            ),
          ...cards,
        ],
      ),
    );
  }
}
