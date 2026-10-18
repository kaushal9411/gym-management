import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/scheduled_report.dart';
import '../../../repositories/scheduled_report_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'scheduled/scheduled_ui.dart';

/// "Schedule a report" — web's dialog as a page (pushed from the list's "+"
/// for `reports:export` holders; pops `true` after a save).
///
/// Fields and order as on web: Name, Report (all 18 types — the 11 reports and
/// the 7 analytics views, a picker), Frequency (Daily / Weekly / Monthly
/// chips), Recipient emails (comma-separated; the parsed addresses are
/// previewed as chips). Rules match the API: name 1..150 characters, 1..20
/// valid emails. Payload `{name, reportType, frequency, recipientEmails}`.
/// The recipient defaults to the signed-in user's email (as before). Server
/// field errors show via `ApiException.detailedMessage`.
///
/// Web has no edit form, so there is none here either.
class ScheduledReportFormScreen extends StatefulWidget {
  const ScheduledReportFormScreen({super.key});

  @override
  State<ScheduledReportFormScreen> createState() =>
      _ScheduledReportFormScreenState();
}

class _ScheduledReportFormScreenState extends State<ScheduledReportFormScreen> {
  final _nameController = TextEditingController();
  late final _emailController =
      TextEditingController(text: _defaultEmail(context));
  ScheduledReportType _reportType = ScheduledReportType.revenue;
  ReportFrequency _frequency = ReportFrequency.weekly;
  bool _loading = false;
  String? _error;

  String _defaultEmail(BuildContext context) {
    final session = context.read<SessionCubit>().state;
    return session is SessionAuthenticatedStaff ? session.user.email : '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading) return;
    final name = _nameController.text.trim();
    final emails = parseRecipients(_emailController.text);
    final problem = validateSchedule(name: name, emails: emails);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<ScheduledReportRepository>().create(
        name: name,
        reportType: _reportType,
        frequency: _frequency,
        recipientEmails: emails,
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save the schedule ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final emails = parseRecipients(_emailController.text);
    final color = scheduledTypeColor(_reportType.apiValue);
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New Scheduled Report'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Hero(top: top),
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
                      icon: Icons.drive_file_rename_outline_rounded,
                      color: TeamColors.indigo,
                      title: 'Name',
                      children: [
                        AppLabeledField(
                          label: 'Report name',
                          hintText: 'e.g. Weekly revenue summary',
                          icon: Icons.label_rounded,
                          iconColor: TeamColors.indigo,
                          controller: _nameController,
                          textInputAction: TextInputAction.next,
                          textCapitalization: TextCapitalization.sentences,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(150)
                          ,],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TeamFormSection(
                      icon: scheduledTypeIcon(_reportType.apiValue),
                      color: color,
                      title: 'What to send',
                      subtitle: 'Any report or analytics view',
                      children: [
                        OptionPickerField(
                          label: 'Report',
                          icon: Icons.description_rounded,
                          iconColor: color,
                          options: [
                            for (final t in ScheduledReportType.values)
                              (t.apiValue, t.label),
                          ],
                          value: _reportType.apiValue,
                          onChanged: (v) {
                            final t = v == null
                                ? null
                                : ScheduledReportTypeX.fromApi(v);
                            if (t != null) setState(() => _reportType = t);
                          },
                        ),
                        Text('FREQUENCY', style: AppText.eyebrow()),
                        Row(
                          children: [
                            for (final f in ReportFrequency.values) ...[
                              Expanded(
                                child: _FrequencyTile(
                                  frequency: f,
                                  selected: _frequency == f,
                                  onTap: _loading
                                      ? null
                                      : () => setState(() => _frequency = f),
                                ),
                              ),
                              if (f != ReportFrequency.values.last)
                                const SizedBox(width: 8),
                            ],
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    TeamFormSection(
                      icon: Icons.mark_email_read_rounded,
                      color: TeamColors.teal,
                      title: 'Recipients',
                      subtitle: 'Up to 20 email addresses',
                      children: [
                        AppLabeledField(
                          label: 'Recipient emails (comma-separated)',
                          hintText: 'owner@gym.com, manager@gym.com',
                          icon: Icons.alternate_email_rounded,
                          iconColor: TeamColors.teal,
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.done,
                          minLines: 1,
                          maxLines: 3,
                          onChanged: (_) => setState(() {}),
                        ),
                        if (emails.isNotEmpty)
                          Wrap(
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              for (final e in emails)
                                RptStatPill(
                                  icon: isValidEmail(e)
                                      ? Icons.check_circle_outline_rounded
                                      : Icons.error_outline_rounded,
                                  value: e,
                                  color: isValidEmail(e)
                                      ? TeamColors.teal
                                      : TeamColors.rose,
                                ),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _Summary(
                      type: _reportType,
                      frequency: _frequency,
                      recipients: emails.length,
                    ),
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: 'Create schedule',
                      icon: Icons.event_available_rounded,
                      loading: _loading,
                      onTap: _submit,
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

class _FrequencyTile extends StatelessWidget {
  const _FrequencyTile({
    required this.frequency,
    required this.selected,
    required this.onTap,
  });

  final ReportFrequency frequency;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = frequencyColor(frequency);
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            gradient: selected
                ? LinearGradient(colors: [c, c.withValues(alpha: 0.7)])
                : null,
            color: selected ? null : AppColors.surface3,
            borderRadius: BorderRadius.circular(14),
            boxShadow: selected
                ? [
                    BoxShadow(
                      color: c.withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Column(
            children: [
              Icon(
                frequencyIcon(frequency),
                size: 20,
                color: selected ? Colors.white : c,
              ),
              const SizedBox(height: 4),
              Text(
                frequency.label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: selected ? Colors.white : AppColors.inkSoft,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Live read-back of what will be created.
class _Summary extends StatelessWidget {
  const _Summary({
    required this.type,
    required this.frequency,
    required this.recipients,
  });

  final ScheduledReportType type;
  final ReportFrequency frequency;
  final int recipients;

  @override
  Widget build(BuildContext context) {
    final c = scheduledTypeColor(type.apiValue);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [c.withValues(alpha: 0.16), Colors.transparent],
        ),
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: c.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_awesome_rounded, color: c, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${type.label} will be emailed ${frequency.label.toLowerCase()} '
              'to $recipients ${recipients == 1 ? 'recipient' : 'recipients'}.',
              style: AppText.body(size: 12.5, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// Full-width gradient header under the transparent app bar.
class _Hero extends StatelessWidget {
  const _Hero({required this.top});

  final double top;

  @override
  Widget build(BuildContext context) {
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
                Icons.event_repeat_rounded,
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
                    'Schedule a report',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Email a report on a daily, weekly or monthly schedule',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Automated delivery',
                    icon: Icons.mark_email_unread_rounded,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
