import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7a. Renew". The design's "Amount" field + "Confirm &
/// charge" wording implies a payment step, but `POST
/// /:id/membership/renew` only extends the membership period (no amount
/// param) — recording the actual payment is a separate Finance action, so
/// this screen sticks to what the endpoint really does.
///
/// This is also where the Member Detail card's "Choose a plan" button
/// (shown when the member has no active membership at all) lands — that
/// case can't call `renew` (nothing to renew), so it branches to the same
/// "pick any plan from the catalog" flow as Upgrade/Downgrade, backed by
/// `PUT /members/:id/membership` (`MemberRepository.assignMembership`).
class MemberRenewScreen extends StatelessWidget {
  const MemberRenewScreen({super.key, required this.member});

  final GymMember member;

  @override
  Widget build(BuildContext context) {
    if (member.currentMembership == null) {
      return _AssignPlanScreen(member: member);
    }
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

  static String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
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

/// "Choose a plan" for a member with no active membership — every active
/// plan in the tenant's catalog is selectable (same "no tier restriction"
/// shape as `MemberUpgradeScreen`/`MemberDowngradeScreen`), calling
/// `PUT /members/:id/membership`, which just records the assignment.
class _AssignPlanScreen extends StatefulWidget {
  const _AssignPlanScreen({required this.member});

  final GymMember member;

  @override
  State<_AssignPlanScreen> createState() => _AssignPlanScreenState();
}

class _AssignPlanScreenState extends State<_AssignPlanScreen> {
  List<MembershipPlan>? _plans;
  String? _selectedPlanId;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    try {
      final result = await getIt<MembershipPlanRepository>().list(limit: 50);
      if (!mounted) return;
      setState(() {
        _plans = result.items.where((p) => p.isActive).toList();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _confirm() async {
    if (_selectedPlanId == null) {
      setState(() => _error = 'Select a plan to assign');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>()
          .assignMembership(widget.member.id, _selectedPlanId!);
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
              '${widget.member.name} · ${widget.member.memberId}',
              style: AppText.eyebrow(),
            ),
            Text('Choose a Plan', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _plans == null
            ? const AppLoadingView()
            : Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 8),
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 12),
                    ],
                    if (_plans!.isEmpty)
                      Text(
                        'No active plans in the catalog.',
                        style: AppText.body(color: AppColors.inkFaint),
                      )
                    else
                      Expanded(
                        child: ListView.builder(
                          itemCount: _plans!.length,
                          itemBuilder: (context, i) {
                            final plan = _plans![i];
                            final selected = _selectedPlanId == plan.id;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.card),
                                  onTap: () => setState(
                                    () => _selectedPlanId = plan.id,
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface2,
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.card,
                                      ),
                                      border: Border.all(
                                        color: selected
                                            ? AppColors.staffB
                                            : AppColors.line,
                                        width: selected ? 2 : 1,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          plan.name,
                                          style: AppText.body(
                                            size: 14,
                                            weight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '₹${plan.price.toStringAsFixed(0)} · '
                                          '${plan.durationLabel} · '
                                          '${plan.perksSummary}',
                                          style: AppText.body(
                                            size: 12,
                                            color: AppColors.inkFaint,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 16),
                    AppButton(
                      label: 'Assign plan',
                      loading: _loading,
                      onPressed: _plans!.isEmpty ? null : _confirm,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }
}
