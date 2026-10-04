import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/invoice_analytics.dart';
import '../../../models/member_invoice.dart';
import '../../../repositories/invoice_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_filters.dart';
import 'widgets/invoice_insights_header.dart';

const _statusTones = {
  'PAID': AppPillTone.success,
  'UNPAID': AppPillTone.warning,
  'PARTIALLY_PAID': AppPillTone.warning,
  'OVERDUE': AppPillTone.danger,
  'CANCELLED': AppPillTone.neutral,
};

/// Not a literal design frame — the Receptionist Menu's "Invoices" tile
/// ("Search & download"). Backs `GET /invoices`.
///
/// Above the list: the animated insights header
/// (`GET /invoices/analytics`, hidden without `finance:invoice-view` or on
/// 403 — see [InvoiceInsightsHeader] for drops vs web), status chips whose
/// badges are the server's tenant-wide `counts` (the chip drives the SERVER
/// `status` param), a debounced server-side search, and the `summary` of the
/// whole filtered set. Period chips scope only the analytics, not the list.
/// Pushed route, so it reloads on every visit. Tap-through to the detail
/// screen is unchanged.
class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  late final PaginatedListCubit<MemberInvoice> _list;
  late final InvoiceStatsCubit _stats;
  final ValueNotifier<InvoiceCounts?> _counts = ValueNotifier(null);
  final ValueNotifier<InvoiceListSummary?> _summary = ValueNotifier(null);
  String _status = '';
  String _search = '';

  bool get _canViewStats {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('finance:invoice-view');
  }

  @override
  void initState() {
    super.initState();
    final repo = getIt<InvoiceRepository>();
    _list = PaginatedListCubit<MemberInvoice>((page) async {
      final r = await repo.listWithSummary(
        page: page,
        search: _search,
        status: _status.isEmpty ? null : _status,
      );
      if (r.counts != null) _counts.value = r.counts;
      if (page == 1) _summary.value = r.summary;
      return r.page;
    })
      ..load();
    _stats = InvoiceStatsCubit(repo.analytics);
    if (_canViewStats) {
      unawaited(_stats.load());
    } else {
      _stats.hide();
    }
  }

  @override
  void dispose() {
    _list.close();
    _stats.close();
    _counts.dispose();
    _summary.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    if (_canViewStats) unawaited(_stats.load());
    await _list.load();
  }

  void _setStatus(String v) {
    if (v == _status) return;
    setState(() => _status = v);
    _list.load();
  }

  void _setSearch(String v) {
    if (v == _search) return;
    _search = v;
    _list.load();
  }

  List<FilterChipOption<String>> _statusOptions(InvoiceCounts? c) => [
        FilterChipOption('', 'All', count: c?.all),
        FilterChipOption('UNPAID', 'Unpaid', count: c?.unpaid),
        FilterChipOption(
          'PARTIALLY_PAID',
          'Partially paid',
          count: c?.partiallyPaid,
        ),
        FilterChipOption('PAID', 'Paid', count: c?.paid),
        FilterChipOption('OVERDUE', 'Overdue', count: c?.overdue),
        FilterChipOption('CANCELLED', 'Cancelled', count: c?.cancelled),
      ];

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<PaginatedListCubit<MemberInvoice>>.value(value: _list),
        BlocProvider<InvoiceStatsCubit>.value(value: _stats),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: const Text('Invoices'),
        ),
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(18, 4, 18, 0),
                sliver: SliverToBoxAdapter(child: InvoiceInsightsHeader()),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 0),
                sliver: SliverToBoxAdapter(
                  child: DebouncedSearchField(
                    hint: 'Search by invoice # or member…',
                    onChanged: _setSearch,
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
                sliver: SliverToBoxAdapter(
                  child: ValueListenableBuilder<InvoiceCounts?>(
                    valueListenable: _counts,
                    builder: (context, counts, _) => FilterChipsRow<String>(
                      options: _statusOptions(counts),
                      selected: _status,
                      onSelected: _setStatus,
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
                sliver: SliverToBoxAdapter(
                  child: ValueListenableBuilder<InvoiceListSummary?>(
                    valueListenable: _summary,
                    builder: (context, s, _) => s == null
                        ? const SizedBox.shrink()
                        : Text(
                            'Matching ${s.count}: '
                            '${Formatters.currency(s.invoiced)} invoiced · '
                            '${Formatters.currency(s.collected)} collected · '
                            '${Formatters.currency(s.outstanding)} outstanding',
                            style: AppText.body(
                              size: 11.5,
                              color: AppColors.inkSoft,
                              weight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ),
              _buildList(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    return BlocBuilder<PaginatedListCubit<MemberInvoice>,
        PaginatedListState<MemberInvoice>>(
      builder: (context, state) => switch (state) {
        PaginatedListLoading() => const SliverToBoxAdapter(
            child: SizedBox(height: 220, child: AppLoadingView()),
          ),
        PaginatedListError(:final message) => SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppErrorView(message: message, onRetry: _list.load),
            ),
          ),
        PaginatedListLoaded(:final items) when items.isEmpty =>
          const SliverToBoxAdapter(
            child: SizedBox(
              height: 260,
              child: AppEmptyState(
                icon: Icons.receipt_long_outlined,
                title: 'No invoices found',
              ),
            ),
          ),
        PaginatedListLoaded(
          :final items,
          :final hasMore,
          :final loadingMore,
        ) =>
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
            sliver: SliverList.builder(
              itemCount: items.length + (hasMore ? 1 : 0),
              itemBuilder: (context, i) {
                if (i >= items.length) {
                  return Center(
                    child: loadingMore
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: CircularProgressIndicator(
                              color: AppColors.staffB,
                            ),
                          )
                        : TextButton(
                            onPressed: _list.loadMore,
                            child: const Text('Load more'),
                          ),
                  );
                }
                return _InvoiceCard(invoice: items[i]);
              },
            ),
          ),
      },
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
