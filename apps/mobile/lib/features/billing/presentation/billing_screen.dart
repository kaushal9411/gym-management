import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/subscription_plan_info.dart';
import '../../../repositories/billing_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _subscriptionStatusTones = {
  'ACTIVE': AppPillTone.success,
  'TRIALING': AppPillTone.roleTint,
  'PAST_DUE': AppPillTone.warning,
  'GRACE': AppPillTone.warning,
  'CANCELED': AppPillTone.danger,
  'SUSPENDED': AppPillTone.danger,
};


/// Design frame "16. Billing" — the plan card, a "Usage this cycle" card
/// and a button through to the history frame (16a). The frame's "Manage
/// plan" button is not built: upgrade/downgrade/cancel run through a
/// payment-gateway checkout that has no mobile flow in this pass.
///
/// The usage numerators aren't part of `GET /subscription` (which carries
/// only the plan's limits), so they're the real `total`s from the
/// branches/staff/members list endpoints.
class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  TenantSubscription? _subscription;
  ({int branches, int staff, int members})? _usage;
  bool _loadedSubscription = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final subscription =
          await getIt<BillingRepository>().currentSubscription();
      if (!mounted) return;
      setState(() {
        _subscription = subscription;
        _loadedSubscription = true;
      });
      final (branches, staff, members) = await (
        getIt<BranchRepository>().list(limit: 1),
        getIt<StaffRepository>().list(),
        getIt<MemberRepository>().list(),
      ).wait;
      if (!mounted) return;
      setState(
        () => _usage = (
          branches: branches.total,
          staff: staff.total,
          members: members.total,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadedSubscription = true;
      });
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
            Text('FitCloud subscription', style: AppText.eyebrow()),
            Text('Billing', style: AppText.display(size: 18)),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : !_loadedSubscription
                ? const AppLoadingView()
                : _buildContent(),
      ),
    );
  }

  Widget _buildContent() {
    final subscription = _subscription;
    final usage = _usage;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        if (subscription == null)
          AppCard(
            child: Text(
              'No active subscription on file for this gym.',
              style: AppText.body(color: AppColors.inkFaint),
            ),
          )
        else
          _SubscriptionCard(subscription: subscription),
        if (subscription != null && usage != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Usage this cycle', style: AppText.eyebrow()),
                const SizedBox(height: 8),
                _UsageRow(
                  label: 'Branches',
                  used: usage.branches,
                  limit: subscription.plan.maxBranches,
                ),
                _UsageRow(
                  label: 'Staff',
                  used: usage.staff,
                  limit: subscription.plan.maxStaff,
                ),
                _UsageRow(
                  label: 'Members',
                  used: usage.members,
                  limit: subscription.plan.maxMembers,
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        AppButton(
          label: 'View billing history',
          variant: AppButtonVariant.ghost,
          onPressed: () => context.push(AppRoutes.billingHistory),
        ),
      ],
    );
  }
}

class _SubscriptionCard extends StatelessWidget {
  const _SubscriptionCard({required this.subscription});

  final TenantSubscription subscription;

  @override
  Widget build(BuildContext context) {
    final plan = subscription.plan;
    final price = subscription.billingCycle == 'YEARLY'
        ? plan.priceYearly
        : plan.priceMonthly;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                plan.name,
                style: AppText.body(size: 16, weight: FontWeight.w800),
              ),
              AppPill(
                label: subscription.status.replaceAll('_', ' '),
                tone: _subscriptionStatusTones[subscription.status] ??
                    AppPillTone.neutral,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${plan.currency} ${price.toStringAsFixed(2)} / ${subscription.billingCycle == 'YEARLY' ? 'year' : 'month'}',
            style: AppText.tabular(
              size: 15,
              weight: FontWeight.w700,
              color: AppColors.staffPillFg,
            ),
          ),
          const SizedBox(height: 10),
          if (subscription.currentPeriodEnd != null)
            Text(
              '${subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} ${_formatDate(subscription.currentPeriodEnd!)}',
              style: AppText.body(
                size: 12,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          if (subscription.trialEndsAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Trial ends ${_formatDate(subscription.trialEndsAt!)}',
                style: AppText.body(
                  size: 12,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({
    required this.label,
    required this.used,
    required this.limit,
  });

  final String label;
  final int used;
  final int limit;

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
          Text(
            '$used / $limit',
            style: AppText.tabular(size: 13, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
