import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/support_ticket.dart';
import '../../../../repositories/support_ticket_repository.dart';
import '../../../../shared/widgets/adaptive_columns.dart';
import '../../../reports/presentation/analytics/analytics_view_parts.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../support_ui.dart';

/// Opens the mail app on [kSupportEmail]; a snack if none can handle it.
Future<void> contactSupport(BuildContext context) async {
  final ok = await launchUrl(
    Uri(scheme: 'mailto', path: kSupportEmail),
    mode: LaunchMode.externalApplication,
  ).catchError((_) => false);
  if (!ok && context.mounted) {
    teamSnack(context, 'No mail app found — write to $kSupportEmail.');
  }
}

/// Web's help centre: published FAQ pages (`GET /public/cms/pages?type=FAQ`)
/// as expandable cards, and the "Contact us" e-mail card. A failing FAQ call
/// just shows the empty text — the tickets below keep working.
class SupportHelpCentre extends StatefulWidget {
  const SupportHelpCentre({super.key});

  @override
  State<SupportHelpCentre> createState() => _SupportHelpCentreState();
}

class _SupportHelpCentreState extends State<SupportHelpCentre> {
  List<FaqItem>? _faqs;
  String? _open;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final faqs = await getIt<SupportTicketRepository>().faqs();
      if (mounted) setState(() => _faqs = faqs);
    } catch (_) {
      if (mounted) setState(() => _faqs = const []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final faqs = _faqs;
    return AdaptiveColumns(
      children: [
        AnalyticsCard(
          title: 'Frequently asked questions',
          subtitle: 'Quick answers before you raise a ticket',
          color: kSupportColor,
          icon: Icons.help_outline_rounded,
          loading: faqs == null,
          empty: faqs != null && faqs.isEmpty,
          emptyText: 'No FAQs published yet.',
          child: Column(
            children: [
              for (final f in faqs ?? const <FaqItem>[]) _faq(f),
            ],
          ),
        ),
        AnalyticsCard(
          title: 'Contact us',
          subtitle: 'Prefer e-mail? We read every message.',
          color: TeamColors.indigo,
          icon: Icons.mail_outline_rounded,
          child: InkWell(
            key: const ValueKey('support-contact'),
            borderRadius: BorderRadius.circular(AppRadii.card),
            onTap: () => contactSupport(context),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    kSupportColor.withValues(alpha: 0.14),
                    Colors.transparent,
                  ],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: kSupportColor,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(
                      Icons.mail_rounded,
                      color: Colors.white,
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          kSupportEmail,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          'Opens your mail app',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _faq(FaqItem f) {
    final open = _open == f.id;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: open ? kSupportColor.withValues(alpha: 0.07) : null,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _open = open ? null : f.id),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: kSupportColor.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: const Icon(
                      Icons.help_outline_rounded,
                      size: 16,
                      color: kSupportColor,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      f.question,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                  ),
                  Icon(
                    open
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.inkFaint,
                  ),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(52, 0, 14, 14),
              child: Text(
                f.answer,
                style: AppText.body(size: 13, color: AppColors.inkSoft),
              ),
            ),
        ],
      ),
    );
  }
}
