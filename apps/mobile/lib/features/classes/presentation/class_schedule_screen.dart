import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/group_class.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_ui.dart';
import 'widgets/class_schedule_editor.dart';

/// "Weekly schedule" step - recurring day + start-time slots
/// (`PATCH /classes/:id/schedule`), the page a new class lands on right after
/// it is created (web sets the schedule on the detail page after creating;
/// here it is its own page). Each save replaces the whole slot list, so the
/// local list is the source of truth until "Save weekly schedule" is pressed;
/// [groupClass].schedule seeds it, so it is also usable for an existing
/// class. A day can hold several start times (as on web). Pops after saving;
/// the back arrow skips (the schedule can be edited later on the class
/// detail page).
class ClassScheduleScreen extends StatefulWidget {
  const ClassScheduleScreen({super.key, required this.groupClass});

  final GroupClass groupClass;

  @override
  State<ClassScheduleScreen> createState() => _ClassScheduleScreenState();
}

class _ClassScheduleScreenState extends State<ClassScheduleScreen> {
  late List<ScheduleSlot> _slots = List.of(widget.groupClass.schedule);
  bool _dirty = false;
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GroupClassRepository>().setSchedule(
        widget.groupClass.id,
        _slots,
      );
      if (!mounted) return;
      teamSnack(context, 'Weekly schedule saved.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Something went wrong ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final c = widget.groupClass;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Weekly schedule'),
      ),
      bottomNavigationBar: TeamBottomBar(
        child: TeamGradientButton(
          label: 'Save weekly schedule',
          icon: Icons.check_rounded,
          gradient: TeamColors.ctaGreen,
          loading: _saving,
          onTap: _save,
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClassHeroShell(
              topInset: top,
              child: Row(
                children: [
                  FadeUp(
                    index: 0,
                    child: ClassGlyph(
                      name: c.name,
                      color: TeamColors.indigo,
                      size: 56,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: FadeUp(
                      index: 1,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.display(
                              size: 22,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${c.branch?.name ?? 'No branch'} · '
                            '${c.capacity} seats · ${c.durationMinutes}m',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 12.5,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                          ),
                          const SizedBox(height: 8),
                          TeamHeroPill(
                            plural(_slots.length, 'weekly slot'),
                            icon: Icons.schedule_rounded,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            TeamCenter(
              maxWidth: 960,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    TeamSectionCard(
                      icon: Icons.schedule_rounded,
                      color: TeamColors.violet,
                      title: 'Weekly schedule',
                      subtitle: 'Recurring day + start time',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'A recurring template - the scheduler expands it '
                            'into dated, bookable sessions for a rolling '
                            '4-week window every night.',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ClassScheduleEditor(
                            initialSlots: widget.groupClass.schedule,
                            onChanged: (slots, dirty) => setState(() {
                              _slots = slots;
                              _dirty = dirty;
                            }),
                          ),
                          if (_dirty)
                            Padding(
                              padding: const EdgeInsets.only(top: 12),
                              child: Text(
                                'Unsaved changes',
                                style: AppText.body(
                                  size: 12,
                                  weight: FontWeight.w800,
                                  color: TeamColors.amber,
                                ),
                              ),
                            ),
                        ],
                      ),
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
