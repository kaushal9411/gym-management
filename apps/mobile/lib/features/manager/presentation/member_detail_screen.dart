import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7. Member detail".
class MemberDetailScreen extends StatefulWidget {
  const MemberDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  GymMember? _member;
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
      final member = await getIt<MemberRepository>().getById(widget.memberId);
      if (!mounted) return;
      setState(() => _member = member);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _resume() async {
    setState(() => _busy = true);
    try {
      await getIt<MemberRepository>().resume(widget.memberId);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title:
            Text(_member?.name ?? 'Member', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _member == null
                ? const AppLoadingView()
                : _buildContent(_member!),
      ),
    );
  }

  Widget _buildContent(GymMember member) {
    final membership = member.currentMembership;
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
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                membership?.planName ?? 'No active plan',
                style: AppText.eyebrow(color: AppColors.staffPillFg),
              ),
              const SizedBox(height: 4),
              Text(
                membership != null
                    ? 'Expires ${_formatDate(membership.endDate)}'
                    : member.status,
                style: AppText.display(size: 18),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (member.status == 'FROZEN')
          AppButton(
            label: 'Resume membership',
            loading: _busy,
            onPressed: _resume,
          )
        else
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Renew',
                  size: AppButtonSize.small,
                  onPressed: membership == null
                      ? null
                      : () => context
                          .push(AppRoutes.memberRenew, extra: member)
                          .then((_) => _load()),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppButton(
                  label: 'Freeze',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  onPressed: () => context
                      .push(AppRoutes.memberFreeze, extra: member.id)
                      .then((_) => _load()),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppButton(
                  label: 'Upgrade',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  onPressed: () => context
                      .push(AppRoutes.memberUpgrade, extra: member)
                      .then((_) => _load()),
                ),
              ),
            ],
          ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Details', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              _DetailRow(label: 'Member ID', value: member.memberId),
              _DetailRow(label: 'Branch', value: member.branch.name),
              _DetailRow(
                label: 'Trainer',
                value: member.trainer?.name ?? 'Unassigned',
              ),
              _DetailRow(label: 'Phone', value: member.phone ?? '—'),
              _DetailRow(label: 'Email', value: member.email ?? '—'),
            ],
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
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
