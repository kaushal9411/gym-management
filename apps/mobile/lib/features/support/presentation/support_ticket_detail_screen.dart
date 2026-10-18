import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'support_ui.dart';

/// One ticket — web's ticket dialog as a page: a teal hero (status · priority,
/// subject, who raised it and when), the status / priority tags, the
/// description, and "Replies from our team" as a timeline (or "Waiting for our
/// team" when there are none). Backs `GET /support/tickets/:id`
/// (`support:view`).
///
/// Dropped vs web: nothing — web's dialog is read-only too. The design's
/// "Write a reply" composer is not built because `/support/tickets` exposes
/// only list / get / create; replies are added by the platform team from the
/// admin console.
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
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load the ticket ($e)');
    }
  }

  String _stamp(DateTime d) => '${fmtDate(d)} · ${_time(d)}';

  String _time(DateTime d) {
    final l = d.toLocal();
    final h = l.hour % 12 == 0 ? 12 : l.hour % 12;
    return '$h:${l.minute.toString().padLeft(2, '0')} '
        '${l.hour < 12 ? 'AM' : 'PM'}';
  }

  Widget _hero(double top, SupportTicket? t) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          top + 4,
          18 + teamSideInset(context),
          22,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                IconButton(
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(
                    Icons.arrow_back_rounded,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    t == null
                        ? 'TICKET'
                        : '${ticketStatusLabel(t.status)} · '
                                '${t.priority.label} priority'
                            .toUpperCase(),
                    overflow: TextOverflow.ellipsis,
                    style: AppText.eyebrow(
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              t?.subject ?? 'Ticket details',
              style: AppText.display(size: 22, color: Colors.white),
            ),
            if (t != null) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.person_outline_rounded,
                          size: 13,
                          color: Colors.white,
                        ),
                        const SizedBox(width: 5),
                        Flexible(
                          child: Text(
                            t.createdByName ?? t.createdByEmail ?? 'You',
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'Raised ${_stamp(t.createdAt)}',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.9),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final t = _ticket;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          _hero(top, t),
          Expanded(
            child: _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : t == null
                    ? const AppLoadingView()
                    : RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: _load,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.only(bottom: 28),
                          children: [
                            TeamCenter(
                              maxWidth: 760,
                              child: Padding(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 16, 16, 0),
                                child: _content(t),
                              ),
                            ),
                          ],
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _content(SupportTicket t) {
    final platform = context.watch<PlatformConfigCubit>().state.appName;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            TeamTag(
              label: ticketStatusLabel(t.status),
              color: ticketStatusColor(t.status),
              icon: ticketStatusIcon(t.status),
            ),
            TeamTag(
              label: t.priority.label,
              color: ticketPriorityColor(t.priority),
              icon: ticketPriorityIcon(t.priority),
            ),
            if (t.closedAt != null)
              TeamTag(
                label: 'Closed ${fmtDate(t.closedAt)}',
                color: TeamColors.slate,
                icon: Icons.lock_outline_rounded,
              ),
          ],
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Text(
            t.description,
            style: AppText.body(size: 13.5, color: AppColors.ink),
          ),
        ),
        const SizedBox(height: 22),
        Text('REPLIES FROM OUR TEAM', style: AppText.eyebrow()),
        const SizedBox(height: 12),
        if (t.notes.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 26),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              children: [
                Icon(Icons.hourglass_empty_rounded, color: AppColors.inkFaint),
                const SizedBox(height: 6),
                Text(
                  'Waiting for our team',
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  "No replies yet — we'll respond here as soon as we can.",
                  textAlign: TextAlign.center,
                  style: AppText.body(size: 12.5, color: AppColors.inkFaint),
                ),
              ],
            ),
          )
        else
          for (final n in t.notes)
            _Reply(
              note: n,
              author: n.authorName ?? '$platform team',
              stamp: _stamp(n.createdAt),
            ),
      ],
    );
  }
}

/// One reply on the timeline: initials avatar and a bordered bubble.
class _Reply extends StatelessWidget {
  const _Reply({
    required this.note,
    required this.author,
    required this.stamp,
  });

  final TicketNote note;
  final String author;
  final String stamp;

  @override
  Widget build(BuildContext context) {
    final color = TeamColors.rotation[
        author.codeUnits.fold<int>(0, (a, c) => a + c) %
            TeamColors.rotation.length];
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Text(
              supportInitials(author),
              style: AppText.body(
                size: 12,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    author,
                    style: AppText.body(size: 12.5, weight: FontWeight.w800),
                  ),
                  Text(
                    stamp,
                    style: AppText.body(
                      size: 11,
                      color: AppColors.inkFaint,
                      weight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    note.note,
                    style: AppText.body(size: 13, color: AppColors.ink),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
