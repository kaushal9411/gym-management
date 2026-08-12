import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7a. Renew". The design's "Amount" field + "Confirm &
/// charge" wording implies a payment step, but `POST
/// /:id/membership/renew` only extends the membership period (no amount
/// param) — recording the actual payment is a separate Finance action, so
/// this screen sticks to what the endpoint really does.
class MemberRenewScreen extends StatelessWidget {
  const MemberRenewScreen({super.key, required this.member});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    final membership = member.currentMembership!;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '${member.name} · ${member.memberId}',
              style: AppText.eyebrow(),
            ),
            Text('Renew Membership', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Current plan', style: AppText.eyebrow()),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          membership.planName,
                          style: AppText.body(
                            size: 14,
                            weight: FontWeight.w700,
                          ),
                        ),
                        AppPill(
                          label: 'Ends ${_formatDate(membership.endDate)}',
                          tone: AppPillTone.warning,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Renewing keeps the same plan and extends the membership '
                'period starting from the current end date.',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
              const Spacer(),
              const SizedBox(height: 16),
              _RenewButton(member: member),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class _RenewButton extends StatefulWidget {
  const _RenewButton({required this.member});

  final GymMember member;

  @override
  State<_RenewButton> createState() => _RenewButtonState();
}

class _RenewButtonState extends State<_RenewButton> {
  bool _loading = false;
  String? _error;

  Future<void> _confirm() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>().renew(widget.member.id);
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null) ...[
          FormAlert(message: _error!),
          const SizedBox(height: 12),
        ],
        AppButton(
          label: 'Confirm renewal',
          loading: _loading,
          onPressed: _confirm,
        ),
      ],
    );
  }
}
