import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_workout_tracking.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'member_workout_logic.dart';
import 'member_workout_sheets.dart';
import 'widgets/member_profile_blocks.dart';
import 'widgets/workout_day_widgets.dart';

/// The member's own workout log (last 60 days), grouped by day, with edit
/// (details of a completed exercise) and delete on every entry. Pushed from
/// the Workout tab; the tab reloads when this screen closes.
class MemberWorkoutHistoryScreen extends StatefulWidget {
  const MemberWorkoutHistoryScreen({super.key});

  @override
  State<MemberWorkoutHistoryScreen> createState() =>
      _MemberWorkoutHistoryScreenState();
}

class _MemberWorkoutHistoryScreenState
    extends State<MemberWorkoutHistoryScreen> {
  WorkoutHistory? _history;
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final h = await getIt<MemberPortalRepository>().workoutHistory();
      if (!mounted) return;
      setState(() {
        _history = h;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load your history.');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_history != null) {
      setState(() => _loading = false);
      teamSnack(context, message, error: true);
    } else {
      setState(() {
        _loading = false;
        _error = message;
      });
    }
  }

  Future<void> _edit(WorkoutLogEntry e) async {
    final message = await showWorkoutDetailsSheet(
      context,
      title: e.exerciseName,
      subtitle: dayLong(e.date),
      submitLabel: 'Save changes',
      initial: WorkoutDetails(
        setsDone: e.setsDone,
        repsDone: e.repsDone,
        weightKg: e.weightKg,
        durationMin: e.durationMin,
        notes: e.notes,
      ),
      onSave: (details) async {
        await getIt<MemberPortalRepository>().updateWorkoutLog(e.id, details);
        return 'Entry updated.';
      },
    );
    if (message == null || !mounted) return;
    teamSnack(context, message);
    await _load(silent: true);
  }

  Future<void> _delete(WorkoutLogEntry e) async {
    final ok = await confirmTeam(
      context,
      title: 'Delete this entry?',
      message: '${e.exerciseName} on ${shortDay(e.date)} will be removed from '
          'your history and progress.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = e.id);
    try {
      await getIt<MemberPortalRepository>().deleteWorkoutLog(e.id);
      if (!mounted) return;
      teamSnack(context, 'Entry deleted.');
      await _load(silent: true);
    } on ApiException catch (err) {
      if (mounted) teamSnack(context, err.detailedMessage, error: true);
    } catch (err) {
      if (mounted) {
        teamSnack(
          context,
          'Could not delete the entry. Try again.',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final h = _history;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Workout history'),
      ),
      body: h == null
          ? (_loading
              ? const AppLoadingView(role: AppRole.member)
              : AppErrorView(
                  message: _error ?? 'Something went wrong.',
                  onRetry: _load,
                  role: AppRole.member,
                ))
          : RefreshIndicator(
              color: AppColors.memberB,
              backgroundColor: AppColors.surface2,
              onRefresh: () => _load(silent: true),
              child: h.entries.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 80),
                        AppEmptyState(
                          icon: Icons.history_rounded,
                          title: 'Nothing logged yet',
                          message:
                              'Your workouts will show up here once you log them.',
                        ),
                      ],
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(0, 4, 0, 32),
                      children: [
                        TeamCenter(
                          maxWidth: 800,
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (final (date, entries) in h.byDay)
                                  _DayGroup(
                                    date: date,
                                    entries: entries,
                                    session: h.sessions[date],
                                    busyId: _busyId,
                                    onEdit: _edit,
                                    onDelete: _delete,
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

class _DayGroup extends StatelessWidget {
  const _DayGroup({
    required this.date,
    required this.entries,
    required this.session,
    required this.busyId,
    required this.onEdit,
    required this.onDelete,
  });

  final String date;
  final List<WorkoutLogEntry> entries;
  final SessionMeta? session;
  final String? busyId;
  final ValueChanged<WorkoutLogEntry> onEdit;
  final ValueChanged<WorkoutLogEntry> onDelete;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: BounceIn(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(dayLong(date), style: AppText.display(size: 16)),
                if (session?.durationMin != null)
                  _Pill('${session!.durationMin} min', WorkoutColors.info),
                if (session?.effort != null)
                  _Pill(
                    'Effort ${session!.effort}/5 · ${effortLabels[session!.effort]}',
                    WorkoutColors.effort,
                  ),
              ],
            ),
            const SizedBox(height: 8),
            for (final e in entries)
              _EntryRow(
                entry: e,
                busy: busyId == e.id,
                onEdit: () => onEdit(e),
                onDelete: () => onDelete(e),
              ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          label,
          style:
              AppText.body(size: 10.5, weight: FontWeight.w800, color: color),
        ),
      );
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({
    required this.entry,
    required this.busy,
    required this.onEdit,
    required this.onDelete,
  });

  final WorkoutLogEntry entry;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final done = entry.status == LogStatus.completed;
    final color = done ? WorkoutColors.doneSolid : WorkoutColors.skipped;
    return Container(
      key: ValueKey('entry-${entry.id}'),
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(
              done ? Icons.check_rounded : Icons.skip_next_rounded,
              size: 18,
              color: color,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.exerciseName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 13.5,
                    weight: FontWeight.w800,
                    color: done ? AppColors.ink : AppColors.inkFaint,
                  ),
                ),
                Text(
                  done ? (entry.loggedLabel ?? 'Done') : 'Skipped',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          if (busy)
            const Padding(
              padding: EdgeInsets.all(12),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else ...[
            if (done)
              IconButton(
                key: ValueKey('edit-entry-${entry.id}'),
                tooltip: 'Edit ${entry.exerciseName}',
                icon: const Icon(Icons.edit_rounded, size: 19),
                color: AppColors.inkSoft,
                onPressed: onEdit,
              ),
            IconButton(
              key: ValueKey('delete-entry-${entry.id}'),
              tooltip: 'Delete ${entry.exerciseName}',
              icon: const Icon(Icons.delete_outline_rounded, size: 20),
              color: AppColors.inkSoft,
              onPressed: onDelete,
            ),
          ],
        ],
      ),
    );
  }
}
