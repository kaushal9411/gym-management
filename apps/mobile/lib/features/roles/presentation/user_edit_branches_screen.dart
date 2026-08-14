import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../models/iam_user.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/iam_user_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// `PUT /users/:id/branches` replaces the whole branch-access set. The
/// per-branch `expiresAt` the API supports isn't exposed here — the design
/// has no frame for it and it's an edge case (temporary access) not worth
/// the extra picker UI in this pass; every assignment saved from mobile is
/// open-ended, same simplification as skipping it elsewhere would.
class UserEditBranchesScreen extends StatefulWidget {
  const UserEditBranchesScreen({required this.user, super.key});

  final IamUser user;

  @override
  State<UserEditBranchesScreen> createState() =>
      _UserEditBranchesScreenState();
}

String? _findPrimaryId(List<UserBranchAccess> branches) {
  for (final b in branches) {
    if (b.isPrimary) return b.branchId;
  }
  return null;
}

class _UserEditBranchesScreenState extends State<UserEditBranchesScreen> {
  List<Branch>? _branches;
  late bool _allBranches = widget.user.allBranches;
  late final Set<String> _selected =
      widget.user.branches.map((b) => b.branchId).toSet();
  late String? _primaryId = _findPrimaryId(widget.user.branches);
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await getIt<BranchRepository>().list(limit: 100);
      if (!mounted) return;
      setState(() => _branches = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<IamUserRepository>().setBranches(
        widget.user.id,
        allBranches: _allBranches,
        branches: _allBranches
            ? const []
            : _selected
                .map(
                  (id) => BranchAssignmentDraft(
                    branchId: id,
                    isPrimary: id == _primaryId,
                  ),
                )
                .toList(),
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Edit branch access', style: AppText.display(size: 18)),
            Text(widget.user.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _branches == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 12),
                    ],
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surface2,
                        borderRadius: BorderRadius.circular(AppRadii.card),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              'All branches',
                              style: AppText.body(
                                size: 14,
                                weight: FontWeight.w700,
                              ),
                            ),
                          ),
                          Switch(
                            value: _allBranches,
                            activeThumbColor: AppColors.staffPillFg,
                            onChanged: (v) =>
                                setState(() => _allBranches = v),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (!_allBranches) ...[
                      Text('Assigned branches', style: AppText.eyebrow()),
                      const SizedBox(height: 8),
                      Expanded(
                        child: ListView.separated(
                          itemCount: _branches!.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (context, i) {
                            final branch = _branches![i];
                            final selected = _selected.contains(branch.id);
                            final isPrimary = _primaryId == branch.id;
                            return Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: AppColors.surface2,
                                borderRadius:
                                    BorderRadius.circular(AppRadii.card),
                                border: Border.all(
                                  color: selected
                                      ? AppColors.staffPillFg
                                      : AppColors.line,
                                ),
                              ),
                              child: Row(
                                children: [
                                  Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius:
                                          BorderRadius.circular(AppRadii.tile),
                                      onTap: () => setState(() {
                                        if (selected) {
                                          _selected.remove(branch.id);
                                          if (_primaryId == branch.id) {
                                            _primaryId = _selected.isEmpty
                                                ? null
                                                : _selected.first;
                                          }
                                        } else {
                                          _selected.add(branch.id);
                                          _primaryId ??= branch.id;
                                        }
                                      }),
                                      child: Padding(
                                        padding: const EdgeInsets.all(4),
                                        child: Icon(
                                          selected
                                              ? Icons.check_box_rounded
                                              : Icons
                                                  .check_box_outline_blank_rounded,
                                          size: 20,
                                          color: selected
                                              ? AppColors.staffPillFg
                                              : AppColors.inkFaint,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      branch.name,
                                      style: AppText.body(
                                        size: 14,
                                        weight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  if (selected)
                                    Material(
                                      color: Colors.transparent,
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(
                                          AppRadii.pill,
                                        ),
                                        onTap: () => setState(
                                          () => _primaryId = branch.id,
                                        ),
                                        child: AppPillLike(
                                          label: 'Primary',
                                          active: isPrimary,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 12),
                    ] else
                      const Spacer(),
                    AppButton(
                      label: 'Save branch access',
                      loading: _saving,
                      onPressed: _save,
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

/// A tappable pill toggle — the design system's `AppPill` is display-only,
/// so this small local variant adds the tap affordance the "mark primary"
/// action needs.
class AppPillLike extends StatelessWidget {
  const AppPillLike({required this.label, required this.active, super.key});

  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        gradient: active ? AppColors.staffGrad : null,
        color: active ? null : AppColors.surface3,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: AppText.body(
          size: 11,
          weight: FontWeight.w800,
          color: active ? Colors.white : AppColors.inkFaint,
        ),
      ),
    );
  }
}
