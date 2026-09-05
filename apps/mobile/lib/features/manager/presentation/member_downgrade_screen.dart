import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/gym_member.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Mirrors web's "Downgrade to" membership card action
/// (`POST /members/:id/membership/downgrade`) — same shape as
/// `MemberUpgradeScreen`, membership plans here have no tier/sortOrder
/// field to distinguish "lower" from "higher", so both screens offer the
/// same "every other active plan" list, matching what the backend itself
/// allows.
class MemberDowngradeScreen extends StatefulWidget {
  const MemberDowngradeScreen({super.key, required this.member});

  final GymMember member;

  @override
  State<MemberDowngradeScreen> createState() => _MemberDowngradeScreenState();
}

class _MemberDowngradeScreenState extends State<MemberDowngradeScreen> {
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
        _plans = result.items
            .where(
              (p) =>
                  p.isActive && p.id != widget.member.currentMembership?.planId,
            )
            .toList();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _confirm() async {
    if (_selectedPlanId == null) {
      setState(() => _error = 'Select a plan to downgrade to');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>()
          .downgrade(widget.member.id, _selectedPlanId!);
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
              'currently ${widget.member.currentMembership?.planName ?? '—'}',
              style: AppText.eyebrow(),
            ),
            Text('Downgrade Plan', style: AppText.display(size: 18)),
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
                        'No other active plans to downgrade to.',
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
                                          '${AppCurrency.symbol}${plan.price.toStringAsFixed(0)} · ${plan.durationLabel} · ${plan.perksSummary}',
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
                      label: 'Confirm downgrade',
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
