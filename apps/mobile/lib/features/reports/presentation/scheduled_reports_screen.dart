import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/scheduled_report.dart';
import '../../../repositories/scheduled_report_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'kit/kit.dart';
import 'scheduled/scheduled_ui.dart';

/// Scheduled Reports — web's "Scheduled Reports" panel (daily / weekly /
/// monthly email delivery of a report), as a page.
///
/// Gradient [ListHero] (counts), then one card per schedule: type, frequency,
/// status, recipients, next / last run, branch, with **Pause / Resume**
/// (added — web has it, `PATCH /reports/scheduled/:id {isActive}`), **Run
/// now** and **Delete** (confirm dialog, web's text). The "+" and the three
/// actions need `reports:export` (web's key, seeded, equals the API routes'
/// `requirePermission`); without it the list is read-only. Reaching the screen
/// is unchanged (hub tile, no route guard); a 403 (no `reports:view`, or the
/// plan-gated module) shows the server's message with Try again.
///
/// Web has no edit form (only create / toggle / run / delete), so neither does
/// mobile. Tablet: cards two-up from 600 dp, hero full-bleed.
class ScheduledReportsScreen extends StatefulWidget {
  const ScheduledReportsScreen({super.key});

  @override
  State<ScheduledReportsScreen> createState() => _ScheduledReportsScreenState();
}

class _ScheduledReportsScreenState extends State<ScheduledReportsScreen> {
  List<ScheduledReport>? _reports;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool keep = false}) async {
    if (!keep) setState(() => _error = null);
    try {
      final reports = await getIt<ScheduledReportRepository>().list();
      if (!mounted) return;
      setState(() {
        _reports = reports;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load scheduled reports ($e)');
    }
  }

  /// Runs [action] with the card's busy flag; reloads on success.
  Future<void> _act(
    String id,
    Future<void> Function() action,
    String success,
  ) async {
    setState(() => _busyId = id);
    try {
      await action();
      if (!mounted) return;
      teamSnack(context, success);
      await _load(keep: true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _delete(ScheduledReport r) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this scheduled report?',
      message:
          "This stops its automatic email delivery. This action can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    await _act(
      r.id,
      () => getIt<ScheduledReportRepository>().delete(r.id),
      'Scheduled report deleted.',
    );
  }

  Future<void> _create() async {
    final created = await context.push<bool>(AppRoutes.scheduledReportForm);
    if (created == true && mounted) {
      teamSnack(context, 'Scheduled report created.');
      await _load(keep: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = ScheduledAccess.of(context);
    final reports = _reports;
    final active = reports?.where((r) => r.isActive).length ?? 0;
    final top = MediaQuery.paddingOf(context).top;
    final hero = ListHero(
      title: 'Scheduled Reports',
      subtitle: 'Automatic email delivery',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      trailing: [
        if (access.canManage)
          ListHeroButton(icon: Icons.add_rounded, onTap: _create),
      ],
      chips: reports == null
          ? const []
          : [
              ListHeroChip(
                icon: Icons.event_note_rounded,
                label: '${reports.length} scheduled',
              ),
              ListHeroChip(
                icon: Icons.play_circle_outline_rounded,
                label: '$active active',
              ),
              ListHeroChip(
                icon: Icons.pause_circle_outline_rounded,
                label: '${reports.length - active} paused',
              ),
            ],
    );
    Widget body;
    if (_error != null && reports == null) {
      body = SizedBox(
        height: 320,
        child: AppErrorView(message: _error!, onRetry: _load),
      );
    } else if (reports == null) {
      body = const Padding(
        padding: EdgeInsets.symmetric(vertical: 48),
        child: AppLoadingView(),
      );
    } else if (reports.isEmpty) {
      body = Padding(
        padding: const EdgeInsets.fromLTRB(18, 40, 18, 0),
        child: Column(
          children: [
            const AppEmptyState(
              icon: Icons.event_note_outlined,
              title: 'No scheduled reports yet',
              message: 'Set one up for automatic email delivery of any report.',
            ),
            if (access.canManage) ...[
              const SizedBox(height: 8),
              AppButton(
                label: 'Schedule a report',
                icon: Icons.add_rounded,
                fullWidth: false,
                onPressed: _create,
              ),
            ],
          ],
        ),
      );
    } else {
      body = const SizedBox.shrink();
    }
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () => _load(keep: true),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: hero),
            if (reports != null && reports.isNotEmpty)
              teamCardSliver<ScheduledReport>(
                context,
                items: reports,
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
                builder: (r, i) => RptReveal(
                  index: i,
                  child: ScheduleCard(
                    report: r,
                    canManage: access.canManage,
                    busy: _busyId == r.id,
                    onToggle: () => _act(
                      r.id,
                      () => getIt<ScheduledReportRepository>()
                          .setActive(r.id, isActive: !r.isActive),
                      r.isActive ? 'Schedule paused.' : 'Schedule resumed.',
                    ),
                    onRunNow: () => _act(
                      r.id,
                      () => getIt<ScheduledReportRepository>().runNow(r.id),
                      'Run recorded — email will be sent shortly.',
                    ),
                    onDelete: () => _delete(r),
                  ),
                ),
              )
            else
              SliverToBoxAdapter(child: body),
          ],
        ),
      ),
    );
  }
}
