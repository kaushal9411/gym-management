import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "8a. Branch detail". The design's "Capacity used 148/180"
/// gauge is real here — `memberCount / capacity` from the live branch
/// record — but the design's "Manager"/"Hours" detail rows are dropped:
/// `BranchDto` has no manager assignment or business-hours summary field
/// to show (operating hours exist but aren't in this simplified DTO read).
class BranchDetailScreen extends StatefulWidget {
  const BranchDetailScreen({super.key, required this.branchId});

  final String branchId;

  @override
  State<BranchDetailScreen> createState() => _BranchDetailScreenState();
}

class _BranchDetailScreenState extends State<BranchDetailScreen> {
  Branch? _branch;
  String? _error;
  bool _actionInFlight = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final branch = await getIt<BranchRepository>().getById(widget.branchId);
      if (!mounted) return;
      setState(() => _branch = branch);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _runAction(Future<void> Function() action) async {
    setState(() => _actionInFlight = true);
    try {
      await action();
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _actionInFlight = false);
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete this branch?'),
        content: Text(
          '${_branch!.name} will be removed from the active branch list. This can be undone by support.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child:
                const Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await _runAction(
      () => getIt<BranchRepository>().softDelete(widget.branchId),
    );
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(_branch?.name ?? 'Branch'),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _branch == null
                ? const AppLoadingView()
                : _buildContent(_branch!),
      ),
    );
  }

  Widget _buildContent(Branch branch) {
    final usageRatio = branch.capacity != null && branch.capacity! > 0
        ? (branch.memberCount / branch.capacity!).clamp(0.0, 1.0)
        : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      children: [
        GlassCard(
          gradientOverlay: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Capacity used',
                style: AppText.eyebrow(color: AppColors.staffPillFg),
              ),
              const SizedBox(height: 4),
              Text(
                branch.capacity != null
                    ? '${branch.memberCount} / ${branch.capacity}'
                    : '${branch.memberCount} members',
                style: AppText.display(size: 22),
              ),
              if (usageRatio != null) ...[
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  child: LinearProgressIndicator(
                    value: usageRatio,
                    minHeight: 6,
                    backgroundColor: Colors.white.withValues(alpha: 0.1),
                    valueColor: const AlwaysStoppedAnimation(AppColors.staffB),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            if (branch.isDefault)
              const AppPill(label: 'Default branch', tone: AppPillTone.roleTint)
            else if (branch.isActive)
              const AppPill(label: 'Active', tone: AppPillTone.success)
            else
              const AppPill(label: 'Inactive', tone: AppPillTone.danger),
          ],
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Details', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              _DetailRow(label: 'Branch code', value: branch.branchCode),
              _DetailRow(label: 'City', value: branch.city ?? '—'),
              _DetailRow(label: 'Phone', value: branch.phone ?? '—'),
              _DetailRow(label: 'Staff', value: '${branch.staffCount}'),
              _DetailRow(label: 'Timezone', value: branch.timezone),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: 'Edit branch',
                size: AppButtonSize.small,
                loading: _actionInFlight,
                onPressed: () => context
                    .push(AppRoutes.branchForm, extra: branch)
                    .then((_) => _load()),
              ),
            ),
            if (!branch.isDefault) ...[
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Set default',
                  role: AppRole.staff,
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  loading: _actionInFlight,
                  onPressed: () => _runAction(
                    () => getIt<BranchRepository>().setDefault(branch.id),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            if (!branch.isDefault)
              Expanded(
                child: AppButton(
                  label: branch.isActive ? 'Deactivate' : 'Activate',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  loading: _actionInFlight,
                  onPressed: () => _runAction(
                    () => getIt<BranchRepository>()
                        .setActive(branch.id, active: !branch.isActive),
                  ),
                ),
              ),
            if (!branch.isDefault) const SizedBox(width: 10),
            Expanded(
              child: AppButton(
                label: 'Delete',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                foregroundColor: AppColors.danger,
                loading: _actionInFlight,
                onPressed: branch.isDefault ? null : _confirmDelete,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}
