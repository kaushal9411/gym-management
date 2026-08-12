import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

const _roleTones = {
  StaffRole.manager: AppPillTone.success,
  StaffRole.trainer: AppPillTone.roleTint,
  StaffRole.receptionist: AppPillTone.warning,
};

/// Design frame "5b. Staff detail". The design's "Performance" card
/// (assigned clients / avg. progress) is Trainer-specific and would need
/// cross-referencing workout/diet assignment data — omitted rather than
/// faked; Contact + role/status + Edit role + Remove staff are all real.
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
    }
  }

  Future<void> _editRole() async {
    final current = _staff!.role;
    final selected = await showModalBottomSheet<StaffRole>(
      context: context,
      backgroundColor: AppColors.surface2,
      builder: (context) {
        var value = current;
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Change role', style: AppText.display(size: 16)),
                  const SizedBox(height: 14),
                  CategoryChipSelector<StaffRole>(
                    options: StaffRole.values,
                    labelOf: (r) => r.label,
                    value: value,
                    onChanged: (r) => setSheetState(() => value = r),
                  ),
                  const SizedBox(height: 20),
                  AppButton(
                    label: 'Save',
                    onPressed: () => context.pop(value),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    if (selected == null || selected == current) return;
    setState(() => _busy = true);
    try {
      await getIt<StaffRepository>().assignRole(widget.staffId, selected);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _removeStaff() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: const Text('Remove staff member?'),
        content: Text(
          '${_staff!.name} will lose access immediately. This can be undone from the web console.',
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(true),
            child: const Text(
              'Remove',
              style: TextStyle(color: AppColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await getIt<StaffRepository>().softDelete(widget.staffId);
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(_staff?.name ?? 'Staff', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _staff == null
                ? const AppLoadingView()
                : _buildContent(_staff!),
      ),
    );
  }

  Widget _buildContent(StaffMember staff) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(18),
          gradientOverlay: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: const BoxDecoration(
                  gradient: AppColors.staffGrad,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  staff.name.isEmpty ? '?' : staff.name[0].toUpperCase(),
                  style: AppText.body(
                    size: 16,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppPill(
                    label: staff.role.label,
                    tone: _roleTones[staff.role] ?? AppPillTone.neutral,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${staff.status == 'ACTIVE' ? 'Active' : staff.status} · joined ${_formatDate(staff.joiningDate)}',
                    style: AppText.body(size: 12, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Contact', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              _ContactRow(
                label: 'Branch',
                value: staff.primaryBranch?.branchName ?? '—',
              ),
              _ContactRow(label: 'Phone', value: staff.phone ?? '—'),
              _ContactRow(label: 'Email', value: staff.email),
              _ContactRow(label: 'Employee ID', value: staff.employeeId),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: 'Edit role',
                size: AppButtonSize.small,
                loading: _busy,
                onPressed: _editRole,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: AppButton(
                label: 'Remove staff',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                foregroundColor: AppColors.danger,
                loading: _busy,
                onPressed: _removeStaff,
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.label, required this.value});

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
