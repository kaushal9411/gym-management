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
import '../../../models/support_ticket.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';


/// The design pills tickets by **priority** (High is emphasised, Medium is
/// muted), not by status — status lives in the "N open" count up top and,
/// for anything no longer open, in the row's subtext.
const _priorityTones = {
  TicketPriority.urgent: AppPillTone.danger,
  TicketPriority.high: AppPillTone.warning,
  TicketPriority.medium: AppPillTone.neutral,
  TicketPriority.low: AppPillTone.neutral,
};

const _openStatuses = {'OPEN', 'IN_PROGRESS'};

/// Design frame "12. Support" — open count, priority pills and the
/// gradient "+" button. Backs `GET/POST /support/tickets` (tenant-facing
/// create/view plane; gated behind the `support_tickets` plan feature —
/// a 403 here means the current plan doesn't include it, not a bug).
class SupportTicketsScreen extends StatelessWidget {
  const SupportTicketsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<SupportTicket>>(
      create: (_) => PaginatedListCubit<SupportTicket>(
        (page) => getIt<SupportTicketRepository>().list(page: page),
      )..load(),
      child: const _SupportTicketsView(),
    );
  }
}

class _SupportTicketsView extends StatelessWidget {
  const _SupportTicketsView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: BlocBuilder<PaginatedListCubit<SupportTicket>,
            PaginatedListState<SupportTicket>>(
          builder: (context, state) {
            final open = state is PaginatedListLoaded<SupportTicket>
                ? state.items
                    .where((t) => _openStatuses.contains(t.status))
                    .length
                : 0;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Support', style: AppText.display(size: 18)),
                Text('$open open', style: AppText.eyebrow()),
              ],
            );
          },
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
                  onPressed: () {
                    final cubit =
                        context.read<PaginatedListCubit<SupportTicket>>();
                    context
                        .push(AppRoutes.supportTicketForm)
                        .then((_) => cubit.load());
                  },
                ),
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PaginatedListCubit<SupportTicket>,
          PaginatedListState<SupportTicket>>(
        builder: (context, state) {
          return switch (state) {
            PaginatedListLoading() => const AppLoadingView(),
            PaginatedListError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<PaginatedListCubit<SupportTicket>>().load(),
              ),
            PaginatedListLoaded(:final items) when items.isEmpty =>
              const AppEmptyState(
                icon: Icons.support_agent_outlined,
                title: 'No support tickets yet',
                message: 'Tap + to open a ticket with the FitCloud team.',
              ),
            PaginatedListLoaded(:final items) => RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: () =>
                    context.read<PaginatedListCubit<SupportTicket>>().load(),
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  itemCount: items.length,
                  itemBuilder: (context, i) => _TicketCard(ticket: items[i]),
                ),
              ),
          };
        },
      ),
    );
  }
}

class _TicketCard extends StatelessWidget {
  const _TicketCard({required this.ticket});

  final SupportTicket ticket;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () =>
            context.push(AppRoutes.supportTicketDetail, extra: ticket.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      ticket.subject,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                  ),
                  AppPill(
                    label: ticket.priority.label,
                    tone: _priorityTones[ticket.priority] ??
                        AppPillTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                _openStatuses.contains(ticket.status)
                    ? 'Opened ${_formatDate(ticket.createdAt)}'
                    : '${ticket.status.replaceAll('_', ' ').toLowerCase()} · '
                        '${_formatDate(ticket.createdAt)}',
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}
