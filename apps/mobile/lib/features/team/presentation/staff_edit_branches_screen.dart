import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/branch_option.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/staff_branch_picker.dart';
import 'widgets/team_ui.dart';

/// `PUT /staff/:id/branches` — replaces the whole branch set. Staff must keep
/// at least one branch and exactly one primary (needs `staff:assign-branch`).
class StaffEditBranchesScreen extends StatefulWidget {
  const StaffEditBranchesScreen({super.key, required this.staff});

  final StaffMember staff;

  @override
  State<StaffEditBranchesScreen> createState() =>
      _StaffEditBranchesScreenState();
}

class _StaffEditBranchesScreenState extends State<StaffEditBranchesScreen> {
  StaffMember get s => widget.staff;

  List<BranchOption>? _options;
  late Set<String> _ids = s.branches.map((b) => b.branchId).toSet();
  late String? _primary = s.primaryBranch?.branchId;
  bool _saving = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final all = await getIt<BranchRepository>().assignable();
      // Keep branches the person already has even if they're no longer in the
      // assignable (active) list, so saving doesn't silently drop them.
      final known = {for (final b in all) b.id};
      final extra = [
        for (final b in s.branches)
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

  Future<void> _save() async {
    if (_ids.isEmpty || _primary == null || !_ids.contains(_primary)) {
      setState(
        () => _error = 'Assign at least one branch and mark one as '
            'primary.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<StaffRepository>().assignBranches(
        s.id,
        primaryBranchId: _primary!,
        branchIds: _ids.toList(),
      );
      if (!mounted) return;
      teamSnack(context, 'Branch assignments updated.');
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
    if (_options == null) {
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
      name: s.name,
      subtitle: '${s.role.label} · ${s.employeeId}',
      avatarUrl: s.avatarUrl,
      title: 'Branch access',
      icon: Icons.account_tree_rounded,
      color: TeamColors.teal,
      saving: _saving,
      onSave: _save,
      error: _error,
      sections: [
        TeamFormSection(
          icon: Icons.account_tree_rounded,
          color: TeamColors.teal,
          title: 'Assigned branches',
          subtitle: '${_ids.length} selected · mark one as primary',
          children: [
            StaffBranchPicker(
              options: _options!,
              branchIds: _ids,
              primaryId: _primary,
              onChanged: (ids, primary) => setState(() {
                _ids = ids;
                _primary = primary;
              }),
            ),
          ],
        ),
      ],
    );
  }
}
