import 'dart:async';

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
import '../../../models/member_invoice.dart';
import '../../../repositories/invoice_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'PAID': AppPillTone.success,
  'UNPAID': AppPillTone.warning,
  'PARTIALLY_PAID': AppPillTone.warning,
  'OVERDUE': AppPillTone.danger,
  'CANCELLED': AppPillTone.neutral,
};

/// Not a literal design frame — the Receptionist Menu's "Invoices" tile
/// ("Search & download"). Backs `GET /invoices`.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<MemberInvoice>(
    (page) => getIt<InvoiceRepository>()
        .list(page: page, search: _searchController.text.trim()),
  );

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _cubit.load);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<MemberInvoice>>.value(
      value: _cubit,
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('Invoices'),
        ),
        body: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: _onSearchChanged,
                  style: AppText.body(size: 14, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: 'Search by invoice # or member…',
                    hintStyle:
                        AppText.body(size: 14, color: AppColors.inkFaint),
                    filled: true,
                    fillColor: AppColors.surface2,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: const BorderSide(color: AppColors.line),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: BlocBuilder<PaginatedListCubit<MemberInvoice>,
                      PaginatedListState<MemberInvoice>>(
                    builder: (context, state) {
                      return switch (state) {
                        PaginatedListLoading() => const AppLoadingView(),
                        PaginatedListError(:final message) => AppErrorView(
                            message: message,
                            onRetry: _cubit.load,
                          ),
                        PaginatedListLoaded(:final items) when items.isEmpty =>
                          const AppEmptyState(
                            icon: Icons.receipt_long_outlined,
                            title: 'No invoices found',
                          ),
                        PaginatedListLoaded(:final items) => ListView.builder(
                            padding: const EdgeInsets.only(bottom: 24),
                            itemCount: items.length,
                            itemBuilder: (context, i) =>
                                _InvoiceCard(invoice: items[i]),
                          ),
                      };
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({required this.invoice});

  final MemberInvoice invoice;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(AppRoutes.invoiceDetail, extra: invoice.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
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
                      invoice.invoiceNumber,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    Text(
                      invoice.member.name,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    Formatters.currency(invoice.totalAmount),
                    style: AppText.tabular(size: 13, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  AppPill(
                    label: invoice.status.replaceAll('_', ' '),
                    tone: _statusTones[invoice.status] ?? AppPillTone.neutral,
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
