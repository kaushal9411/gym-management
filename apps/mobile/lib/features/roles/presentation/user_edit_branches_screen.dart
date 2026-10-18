import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/iam_user.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// `PUT /users/:id/branches` replaces the whole branch-access set: either
/// "all branches" or a list of branches with one primary and an optional
/// per-branch expiry date (temporary access), exactly as web's branch access
/// cards do.
class UserEditBranchesScreen extends StatefulWidget {
  const UserEditBranchesScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditBranchesScreen> createState() => _UserEditBranchesScreenState();
}

class _UserEditBranchesScreenState extends State<UserEditBranchesScreen> {
  List<BranchOption>? _options;
  late bool _all = widget.user.allBranches;
  late final Set<String> _selected =
      widget.user.branches.map((b) => b.branchId).toSet();
  late String? _primary = _initialPrimary();
  late final Map<String, DateTime?> _expiry = {
    for (final b in widget.user.branches) b.branchId: b.expiresAt,
  };
  bool _saving = false;
  String? _error;
  String? _loadError;

  String? _initialPrimary() {
    for (final b in widget.user.branches) {
      if (b.isPrimary) return b.branchId;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final all = await getIt<BranchRepository>().assignable();
      final known = {for (final b in all) b.id};
      final extra = [
        for (final b in widget.user.branches)
          if (!known.contains(b.branchId))
            BranchOption(id: b.branchId, name: b.branchName),
      ];
      if (!mounted) return;
      setState(() => _options = [...all, ...extra]);
    } on ApiException catch (e) {
      if (mounted) setState(() => _loadError = e.message);
    } catch (e) {
      if (mounted) setState(() => _loadError = '$e');
    }
  }

  void _toggle(String id) {
    setState(() {
      if (!_selected.add(id)) {
        _selected.remove(id);
        _expiry.remove(id);
        if (_primary == id) {
          _primary = _selected.isEmpty ? null : _selected.first;
        }
      } else {
        _primary ??= id;
      }
    });
  }

  Future<void> _pickExpiry(String id) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _expiry[id] ?? now.add(const Duration(days: 30)),
      firstDate: now,
      lastDate: DateTime(now.year + 10),
      helpText: 'Access expires on',
    );
    if (picked != null) setState(() => _expiry[id] = picked);
  }

  Future<void> _save() async {
    if (!_all && _selected.isEmpty) {
      setState(
        () => _error = 'Pick at least one branch, or choose All '
            'branches',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>().setBranches(
        widget.user.id,
        allBranches: _all,
        branches: _all
            ? const []
            : [
                for (final id in _selected)
                  BranchAssignmentDraft(
                    branchId: id,
                    isPrimary: id == (_primary ?? _selected.first),
                    expiresAt: _expiry[id] == null
                        ? null
                        : DateTime(
                            _expiry[id]!.year,
                            _expiry[id]!.month,
                            _expiry[id]!.day,
                            23,
                            59,
                            59,
                          ),
                  ),
              ],
      );
      if (!mounted) return;
      teamSnack(context, 'Branch access updated.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final options = _options;
    if (options == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('Branch access'),
        ),
        body: _loadError != null
            ? AppErrorView(message: _loadError!, onRetry: _load)
            : const AppLoadingView(),
      );
    }
    return TeamEditScaffold(
      name: widget.user.name,
      subtitle: widget.user.email,
      avatarUrl: widget.user.avatarUrl,
      title: 'Branch access',
      icon: Icons.account_tree_rounded,
      color: TeamColors.amber,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.public_rounded,
          color: TeamColors.amber,
          title: 'Scope',
          children: [
            TeamToggleRow(
              title: 'All branches',
              subtitle: 'Access to every branch, including future ones',
              icon: Icons.all_inclusive_rounded,
              color: TeamColors.amber,
              value: _all,
              onChanged: (v) => setState(() => _all = v),
            ),
          ],
        ),
        if (!_all)
          TeamFormSection(
            icon: Icons.account_tree_rounded,
            color: TeamColors.teal,
            title: 'Specific branches',
            subtitle: '${_selected.length} selected · tap the star for primary',
            children: [
              for (final b in options)
                Column(
                  children: [
                    TeamChoiceCard(
                      title: b.name,
                      icon: Icons.place_rounded,
                      color: TeamColors.teal,
                      multi: true,
                      selected: _selected.contains(b.id),
                      onTap: () => _toggle(b.id),
                    ),
                    if (_selected.contains(b.id))
                      Padding(
                        padding: const EdgeInsets.fromLTRB(6, 6, 6, 0),
                        child: Row(
                          children: [
                            GestureDetector(
                              onTap: () => setState(() => _primary = b.id),
                              child: TeamTag(
                                label: (_primary ?? _selected.first) == b.id
                                    ? 'Primary'
                                    : 'Make primary',
                                color: TeamColors.amber,
                                icon: (_primary ?? _selected.first) == b.id
                                    ? Icons.star_rounded
                                    : Icons.star_outline_rounded,
                              ),
                            ),
                            const SizedBox(width: 8),
                            GestureDetector(
                              onTap: () => _pickExpiry(b.id),
                              child: TeamTag(
                                label: _expiry[b.id] == null
                                    ? 'No expiry'
                                    : 'Until ${fmtDate(_expiry[b.id])}',
                                color: TeamColors.sky,
                                icon: Icons.event_rounded,
                              ),
                            ),
                            if (_expiry[b.id] != null) ...[
                              const SizedBox(width: 6),
                              GestureDetector(
                                onTap: () =>
                                    setState(() => _expiry[b.id] = null),
                                child: Icon(
                                  Icons.close_rounded,
                                  size: 16,
                                  color: AppColors.inkFaint,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              if (options.isEmpty)
                Text(
                  'No branches found.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
            ],
          ),
      ],
    );
  }
}
