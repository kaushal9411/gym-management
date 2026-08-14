import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/member_payment.dart';
import '../../../repositories/payment_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const paymentStatusTones = {
  'SUCCESS': AppPillTone.success,
  'PENDING': AppPillTone.warning,
  'FAILED': AppPillTone.danger,
  'REFUNDED': AppPillTone.neutral,
  'PARTIALLY_REFUNDED': AppPillTone.warning,
  'CANCELLED': AppPillTone.neutral,
};

/// The ledger behind design frame "14. Payment detail". The design has no
/// payments-list frame of its own — frame 14 sits in the Owner section with
/// no navigation source drawn — so this list is the minimal entry point,
/// built to match the Income/Expenses list frames it sits beside in the
/// Menu's Finance section.
class PaymentsScreen extends StatelessWidget {
  const PaymentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<MemberPayment>>(
      create: (_) => PaginatedListCubit<MemberPayment>(
        (page) => getIt<PaymentRepository>().list(page: page),
      )..load(),
      child: const _PaymentsView(),
    );
  }
}

class _PaymentsView extends StatelessWidget {
  const _PaymentsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: BlocBuilder<PaginatedListCubit<MemberPayment>,
            PaginatedListState<MemberPayment>>(
          builder: (context, state) {
            final count = state is PaginatedListLoaded<MemberPayment>
                ? '${state.items.length} recorded'
                : '';
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(count, style: AppText.eyebrow()),
                Text('Payments', style: AppText.display(size: 18)),
              ],
            );
          },
        ),
      ),
      body: SafeArea(
        top: false,
        child: BlocBuilder<PaginatedListCubit<MemberPayment>,
            PaginatedListState<MemberPayment>>(
          builder: (context, state) {
            final cubit = context.read<PaginatedListCubit<MemberPayment>>();
            return switch (state) {
              PaginatedListLoading() => const AppLoadingView(),
              PaginatedListError(:final message) =>
                AppErrorView(message: message, onRetry: cubit.load),
              PaginatedListLoaded(:final items) when items.isEmpty =>
                const AppEmptyState(
                  icon: Icons.payments_outlined,
                  title: 'No payments yet',
                  message: 'Recorded payments appear here.',
                ),
              PaginatedListLoaded(:final items) => RefreshIndicator(
                  color: AppColors.staffB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: cubit.load,
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                    itemCount: items.length,
                    itemBuilder: (context, i) => _PaymentCard(
                      payment: items[i],
                      onTap: () async {
                        await context.push(
                          AppRoutes.paymentDetail,
                          extra: items[i].id,
                        );
                        if (context.mounted) cubit.load();
                      },
                    ),
                  ),
                ),
            };
          },
        ),
      ),
    );
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({required this.payment, required this.onTap});

  final MemberPayment payment;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      payment.memberName,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${payment.paymentNumber} · ${payment.method} · '
                      '${payment.paymentDate.day}/${payment.paymentDate.month}/'
                      '${payment.paymentDate.year}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    Formatters.currency(payment.finalAmount),
                    style: AppText.tabular(size: 13, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  AppPill(
                    label: payment.status.replaceAll('_', ' '),
                    tone: paymentStatusTones[payment.status] ??
                        AppPillTone.neutral,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
