import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/portal_payment.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../finance/presentation/widgets/analytics_parts.dart';

AppPillTone paymentStatusTone(String status) => switch (status) {
      'SUCCESS' => AppPillTone.success,
      'PENDING' || 'PARTIALLY_REFUNDED' => AppPillTone.warning,
      'FAILED' || 'CANCELLED' || 'REFUNDED' => AppPillTone.danger,
      _ => AppPillTone.neutral,
    };

/// The member's own payments (`GET /portal/payments`), paginated through
/// `PaginatedListCubit` with a Load-more button. Pushed route, so it reloads
/// on every visit (not subject to the IndexedStack tab-cache trap).
///
/// Dropped: tapping a row to open a payment detail — the member plane has no
/// per-payment endpoint (only the invoice detail, which already lists its
/// payments); the invoice number on the row is shown as plain text for that
/// reason. No receipt download either (no file-saving package).
class MemberPaymentsScreen extends StatelessWidget {
  const MemberPaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<PortalPayment>>(
      create: (_) => PaginatedListCubit<PortalPayment>(
        (page) => getIt<MemberPortalRepository>().payments(page: page),
      )..load(),
      child: const MemberPaymentsView(),
    );
  }
}

class MemberPaymentsView extends StatelessWidget {
  const MemberPaymentsView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Payments', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: BlocBuilder<PaginatedListCubit<PortalPayment>,
            PaginatedListState<PortalPayment>>(
          builder: (context, state) {
            final cubit = context.read<PaginatedListCubit<PortalPayment>>();
            return switch (state) {
              PaginatedListLoading() =>
                const AppLoadingView(role: AppRole.member),
              PaginatedListError(:final message) => AppErrorView(
                  message: message,
                  role: AppRole.member,
                  onRetry: cubit.load,
                ),
              PaginatedListLoaded(:final items) when items.isEmpty =>
                const AppEmptyState(
                  icon: Icons.payments_outlined,
                  title: 'No payments yet',
                  message: 'Payments you make to the gym will be listed here.',
                ),
              PaginatedListLoaded(
                :final items,
                :final hasMore,
                :final loadingMore,
              ) =>
                RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: cubit.load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    itemCount: items.length + (hasMore ? 1 : 0),
                    itemBuilder: (context, i) {
                      if (i == items.length) {
                        return Center(
                          child: loadingMore
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: CircularProgressIndicator(
                                    color: AppColors.memberB,
                                  ),
                                )
                              : TextButton(
                                  onPressed: cubit.loadMore,
                                  child: const Text('Load more'),
                                ),
                        );
                      }
                      return StaggeredReveal(
                        index: i < 8 ? i : 0,
                        child: PaymentRow(payment: items[i]),
                      );
                    },
                  ),
                ),
            };
          },
        ),
      ),
    );
  }
}

class PaymentRow extends StatelessWidget {
  const PaymentRow({required this.payment, super.key});

  final PortalPayment payment;

  @override
  Widget build(BuildContext context) {
    final p = payment;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  p.paymentNumber,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  [
                    prettyEnum(p.method),
                    shortDate(p.paymentDate),
                    if (p.invoiceNumber != null) p.invoiceNumber!,
                  ].join(' · '),
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
                if (p.hasRefund) ...[
                  const SizedBox(height: 4),
                  Text(
                    '-₹${p.totalRefunded.toStringAsFixed(2)} refunded',
                    style: AppText.body(
                      size: 11.5,
                      color: AppColors.warning,
                      weight: FontWeight.w700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${p.amount.toStringAsFixed(2)}',
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              AppPill(
                label: prettyEnum(p.status),
                tone: paymentStatusTone(p.status),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
