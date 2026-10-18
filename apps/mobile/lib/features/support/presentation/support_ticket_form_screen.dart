import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/support_ticket.dart';
import '../../../repositories/support_ticket_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'support_ui.dart';

/// "Raise a support ticket" — web's new-ticket dialog as a full page.
///
/// Same fields and rules as web: Subject (3–200 characters), Priority (Low /
/// Medium / High / Urgent, each with web's hint) and Description (10–5000),
/// with live character counters. Submits `POST /support/tickets` and pops
/// `true` so the list reloads. Needs `support:create` and the
/// `support_tickets` plan flag (the "+" that opens this page is hidden
/// without them; opened anyway, the page says so instead of failing late).
class SupportTicketFormScreen extends StatefulWidget {
  const SupportTicketFormScreen({super.key});

  @override
  State<SupportTicketFormScreen> createState() =>
      _SupportTicketFormScreenState();
}

class _SupportTicketFormScreenState extends State<SupportTicketFormScreen> {
  late final SupportAccess _access;
  final _subject = TextEditingController();
  final _description = TextEditingController();
  TicketPriority _priority = TicketPriority.medium;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _access = SupportAccess.of(context);
  }

  @override
  void dispose() {
    _subject.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final subject = _subject.text.trim();
    final description = _description.text.trim();
    if (subject.length < kSubjectMin) {
      setState(
        () => _error = 'Subject needs at least $kSubjectMin characters.',
      );
      return;
    }
    if (description.length < kDescriptionMin) {
      setState(
        () => _error =
            'Describe the issue in at least $kDescriptionMin characters.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<SupportTicketRepository>().create(
        subject: subject,
        description: description,
        priority: _priority,
      );
      if (!mounted) return;
      teamSnack(context, 'Ticket raised — we will reply here.');
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not raise the ticket ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _counter(TextEditingController c, int min, int max) {
    final n = c.text.trim().length;
    final bad = n > 0 && n < min;
    return Align(
      alignment: Alignment.centerRight,
      child: Text(
        '$n/$max${bad ? ' · min $min' : ''}',
        style: AppText.body(
          size: 11,
          weight: FontWeight.w700,
          color: bad ? AppColors.danger : AppColors.inkFaint,
        ),
      ),
    );
  }

  Widget _hero(double top) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          top + 4,
          18 + teamSideInset(context),
          22,
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
              ),
              child: const Icon(
                Icons.support_agent_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Raise a support ticket',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Tell us what went wrong — the more detail, the faster '
                    'we can help.',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Support · New ticket',
                    icon: Icons.support_agent_rounded,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('New ticket'),
      ),
      body: !_access.canRaise
          ? const AppEmptyState(
              icon: Icons.support_agent_outlined,
              title: 'Cannot raise tickets',
              message:
                  "Your plan or role doesn't allow raising support tickets.",
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.only(bottom: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _hero(top),
                  TeamCenter(
                    maxWidth: 760,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_error != null) ...[
                            FormAlert(message: _error!),
                            const SizedBox(height: 14),
                          ],
                          TeamFormSection(
                            icon: Icons.title_rounded,
                            color: kSupportColor,
                            title: 'Subject',
                            children: [
                              AppLabeledField(
                                label: 'Subject',
                                hintText:
                                    'e.g. Cannot check in members at Downtown',
                                icon: Icons.title_rounded,
                                iconColor: kSupportColor,
                                controller: _subject,
                                textCapitalization:
                                    TextCapitalization.sentences,
                                textInputAction: TextInputAction.next,
                                inputFormatters: [
                                  LengthLimitingTextInputFormatter(kSubjectMax),
                                ],
                                onChanged: (_) => setState(() {}),
                              ),
                              _counter(_subject, kSubjectMin, kSubjectMax),
                            ],
                          ),
                          const SizedBox(height: 14),
                          TeamFormSection(
                            icon: Icons.flag_rounded,
                            color: TeamColors.amber,
                            title: 'Priority',
                            subtitle: ticketPriorityHint(_priority),
                            children: [
                              for (final p in kTicketPriorities)
                                TeamChoiceCard(
                                  title: p.label,
                                  description: ticketPriorityHint(p),
                                  icon: ticketPriorityIcon(p),
                                  color: ticketPriorityColor(p),
                                  selected: _priority == p,
                                  onTap: _saving
                                      ? null
                                      : () => setState(() => _priority = p),
                                ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          TeamFormSection(
                            icon: Icons.notes_rounded,
                            color: TeamColors.indigo,
                            title: 'Description',
                            children: [
                              AppLabeledField(
                                label: 'Describe the issue',
                                hintText:
                                    'What happened, and what did you expect?',
                                controller: _description,
                                textCapitalization:
                                    TextCapitalization.sentences,
                                textInputAction: TextInputAction.newline,
                                minLines: 5,
                                maxLines: 10,
                                keyboardType: TextInputType.multiline,
                                inputFormatters: [
                                  LengthLimitingTextInputFormatter(
                                    kDescriptionMax,
                                  ),
                                ],
                                onChanged: (_) => setState(() {}),
                              ),
                              _counter(
                                _description,
                                kDescriptionMin,
                                kDescriptionMax,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          TeamGradientButton(
                            label: 'Submit ticket',
                            icon: Icons.send_rounded,
                            loading: _saving,
                            onTap: _saving ? null : _submit,
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: _saving ? null : () => context.pop(),
                            child: const Text('Cancel'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
