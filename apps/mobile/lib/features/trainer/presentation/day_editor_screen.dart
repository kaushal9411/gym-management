import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import '../../workouts/presentation/schedule_draft.dart';
import '../../workouts/presentation/widgets/weekly_schedule_editor.dart';
import 'workout_plan_detail_screen.dart';

/// Design frame "6a. Day editor", redesigned: one day of the plan with its
/// exercises as reorderable cards (drag the handle), remove, add from the
/// library, and Save. The API replaces the plan's whole schedule, so the save
/// sends every other day unchanged - including each exercise's rest and notes,
/// which the old editor silently dropped. Pops `true` when saved.
class DayEditorScreen extends StatefulWidget {
  const DayEditorScreen({required this.args, super.key});

  final DayEditorArgs args;

  @override
  State<DayEditorScreen> createState() => _DayEditorScreenState();
}

class _DayEditorScreenState extends State<DayEditorScreen> {
  late final ScheduleDraft _draft = ScheduleDraft.fromPlan(widget.args.plan);
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<WorkoutPlanRepository>().setExercises(
        widget.args.plan.id,
        _draft.toDrafts(),
      );
      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong while saving ($e).');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final day = widget.args.day;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(day.label, style: AppText.display(size: 18)),
            Text(widget.args.plan.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      bottomNavigationBar: TeamBottomBar(
        child: TeamGradientButton(
          label: 'Save',
          icon: Icons.check_rounded,
          loading: _saving,
          gradient: TeamColors.ctaGreen,
          onTap: _save,
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            16 + teamSideInset(context, maxWidth: 840),
            8,
            16 + teamSideInset(context, maxWidth: 840),
            24,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 12),
              ],
              WeeklyScheduleEditor(
                draft: _draft,
                singleDay: day,
                onChanged: () => setState(() {}),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
