import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../bloc/finance/ledger_analytics_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/expense_entry.dart';
import '../../../models/ledger_analytics.dart';
import '../../../repositories/expense_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import 'widgets/ledger_analytics_header.dart';

/// Design frame "Expenses" plus the analytics header (see
/// [LedgerAnalyticsHeader] for what was dropped vs web). The period chips
/// scope only the analytics; the list is unfiltered, and the `summary` line
/// above it covers the whole set (not just the loaded page). The header hides
/// itself without `finance:view` / on a 403. Pushed route (not an
/// IndexedStack tab), so both cubits reload in `initState` on every visit and
/// after the create form pops. Create flow unchanged.
class ExpenseListScreen extends StatefulWidget {
  const ExpenseListScreen({super.key});

  @override
  State<ExpenseListScreen> createState() => _ExpenseListScreenState();
}

class _ExpenseListScreenState extends State<ExpenseListScreen> {
  final _summary = ValueNotifier<LedgerListSummary?>(null);
  late final LedgerAnalyticsCubit _analytics;
  late final PaginatedListCubit<ExpenseEntry> _list;

  bool get _canView {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff &&
        session.user.hasPermission('finance:view');
  }

  @override
  void initState() {
    super.initState();
    _list = PaginatedListCubit<ExpenseEntry>((page) async {
      final r = await getIt<ExpenseRepository>().listWithSummary(page: page);
      if (page == 1) _summary.value = r.summary;
      return r.page;
    })
      ..load();
    _analytics = LedgerAnalyticsCubit(
      ({required dateFrom, required dateTo}) => getIt<ExpenseRepository>()
          .analytics(dateFrom: dateFrom, dateTo: dateTo),
    );
    if (_canView) {
      _analytics.load();
    } else {
      _analytics.hide();
    }
  }

  @override
  void dispose() {
    _list.close();
    _analytics.close();
    _summary.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    if (_canView) unawaited(_analytics.load());
    await _list.load();
  }

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider<LedgerAnalyticsCubit>.value(value: _analytics),
        BlocProvider<PaginatedListCubit<ExpenseEntry>>.value(value: _list),
      ],
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          backgroundColor: AppColors.bg,
          elevation: 0,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Finance', style: AppText.eyebrow()),
              Text('Expenses', style: AppText.display(size: 18)),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () =>
                        context.push(AppRoutes.expenseForm).then((_) {
                      if (mounted) unawaited(_refresh());
                    }),
                  ),
                ),
              ),
            ),
          ],
        ),
        body: RefreshIndicator(
          color: AppColors.staffB,
          backgroundColor: AppColors.surface2,
          onRefresh: _refresh,
          child: BlocBuilder<PaginatedListCubit<ExpenseEntry>,
              PaginatedListState<ExpenseEntry>>(
            builder: (context, state) => CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 8),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const LedgerAnalyticsHeader(kind: LedgerKind.expense),
                        ValueListenableBuilder<LedgerListSummary?>(
                          valueListenable: _summary,
                          builder: (context, s, _) => s == null
                              ? const SizedBox.shrink()
                              : Text(
                                  'Total ${Formatters.currency(s.total)} · '
                                  '${s.count} ${s.count == 1 ? 'entry' : 'entries'} · '
                                  'avg ${Formatters.currency(s.average)}',
                                  style: AppText.body(
                                    size: 11.5,
                                    color: AppColors.inkSoft,
                                    weight: FontWeight.w700,
                                  ),
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
                ..._listSlivers(state),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _listSlivers(PaginatedListState<ExpenseEntry> state) {
    Widget fill(Widget child) => SliverFillRemaining(
          hasScrollBody: false,
          child: SizedBox(height: 260, child: child),
        );
    return switch (state) {
      PaginatedListLoading() => [fill(const AppLoadingView())],
      PaginatedListError(:final message) => [
          fill(AppErrorView(message: message, onRetry: _list.load)),
        ],
      PaginatedListLoaded(:final items) when items.isEmpty => [
          fill(
            const AppEmptyState(
              icon: Icons.receipt_long_outlined,
              title: 'No expenses recorded yet',
              message: 'Tap + to record your first expense.',
            ),
          ),
        ],
      PaginatedListLoaded(:final items, :final hasMore, :final loadingMore) => [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
            sliver: SliverList.builder(
              itemCount: items.length + (hasMore ? 1 : 0),
              itemBuilder: (context, i) {
                if (i == items.length) {
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Center(
                      child: loadingMore
                          ? const CircularProgressIndicator(
                              color: AppColors.staffB,
                            )
                          : TextButton(
                              onPressed: _list.loadMore,
                              child: const Text('Load more'),
                            ),
                    ),
                  );
                }
                return _ExpenseCard(entry: items[i]);
              },
            ),
          ),
        ],
    };
  }
}

class _ExpenseCard extends StatelessWidget {
  const _ExpenseCard({required this.entry});

  final ExpenseEntry entry;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  entry.description?.isNotEmpty == true
                      ? entry.description!
                      : entry.category.label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${entry.category.label} · ${entry.expenseDate.day}/${entry.expenseDate.month}/${entry.expenseDate.year}',
                  style: AppText.body(
                    size: 11,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            Formatters.currency(entry.amount),
            style: AppText.tabular(
              size: 14,
              weight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
