import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _statusTones = {
  'OPEN': AppPillTone.warning,
  'IN_PROGRESS': AppPillTone.roleTint,
  'RESOLVED': AppPillTone.success,
  'CLOSED': AppPillTone.neutral,
};

class SupportTicketDetailScreen extends StatefulWidget {
  const SupportTicketDetailScreen({super.key, required this.ticketId});

  final String ticketId;

  @override
  State<SupportTicketDetailScreen> createState() =>
      _SupportTicketDetailScreenState();
}

class _SupportTicketDetailScreenState extends State<SupportTicketDetailScreen> {
  SupportTicket? _ticket;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final ticket =
          await getIt<SupportTicketRepository>().getById(widget.ticketId);
      if (!mounted) return;
      setState(() => _ticket = ticket);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: _ticket == null
            ? Text('Ticket', style: AppText.display(size: 18))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _ticket!.subject,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 18),
                  ),
                  Text(
                    'Ticket #${_ticket!.id.substring(0, 8)} · '
                    '${_ticket!.priority.label} priority',
                    style: AppText.eyebrow(),
                  ),
                ],
              ),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _ticket == null
                ? const AppLoadingView()
                : _buildContent(_ticket!),
      ),
    );
  }

  Widget _buildContent(SupportTicket ticket) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      ticket.subject,
                      style: AppText.body(size: 15, weight: FontWeight.w700),
                    ),
                  ),
                  AppPill(
                    label: ticket.status.replaceAll('_', ' '),
                    tone: _statusTones[ticket.status] ?? AppPillTone.neutral,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                ticket.description,
                style: AppText.body(size: 13, color: AppColors.inkSoft),
              ),
              const SizedBox(height: 10),
              Text(
                '${ticket.priority.label} priority · Opened ${_formatDate(ticket.createdAt)}'
                '${ticket.closedAt != null ? ' · Closed ${_formatDate(ticket.closedAt!)}' : ''}',
                style: AppText.body(
                  size: 11,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        if (ticket.notes.isEmpty)
          Text(
            'No replies yet — the FitCloud team will respond here.',
            style: AppText.body(color: AppColors.inkFaint),
          )
        else
          ...ticket.notes.map((note) => _ReplyBubble(note: note)),
      ],
    );
  }

  String _formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';
}

/// A support-side reply, styled as the design's tinted "FitCloud Support"
/// bubble. The design's "Write a reply… / Send reply" composer is not
/// built: `/support/tickets` exposes only list/get/create — replies are
/// added by FitCloud admins through the admin console, so a tenant has
/// nothing to POST a reply to.
class _ReplyBubble extends StatelessWidget {
  const _ReplyBubble({required this.note});

  final TicketNote note;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
        ),
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${note.authorName ?? 'FitCloud Support'} · '
            '${_relative(note.createdAt)}',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w800,
              color: AppColors.staffPillFg,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            note.note,
            style: AppText.body(size: 13, color: AppColors.ink),
          ),
        ],
      ),
    );
  }

  static String _relative(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) {
      return '${diff.inHours} hr${diff.inHours == 1 ? '' : 's'} ago';
    }
    if (diff.inDays == 1) return 'yesterday';
    return '${diff.inDays} days ago';
  }
}
