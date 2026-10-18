import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/group_class.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_actions.dart';
import 'class_form_screen.dart';
import 'class_ui.dart';
import 'widgets/class_form_fields.dart';
import 'widgets/class_schedule_editor.dart';

/// Class detail (web's `/classes/[classId]`): animated gradient hero (status,
/// seats, duration, weekly slots, trainer, Delete), the editable "Class
/// information" card with an unsaved-changes bar, and the "Weekly schedule"
/// card (day + time slots, Save weekly schedule, Regenerate sessions now).
///
/// Gating follows web: the form and schedule are read-only without
/// `classes:update` (which also gates Save, Save weekly schedule and
/// Regenerate), Delete needs `classes:delete`. Soft-deleted classes 404 on
/// this endpoint, so the catalog opens a restore sheet for them instead;
/// Restore is still offered here (`classes:restore`) if one is shown.
///
/// `PATCH /classes/:id` always sends the full form (`trainerId: null` clears
/// the trainer). `PATCH /classes/:id/schedule` replaces the whole slot list.
/// Pops after Delete.
class ClassDetailScreen extends StatefulWidget {
  const ClassDetailScreen({super.key, required this.classId});

  final String classId;

  @override
  State<ClassDetailScreen> createState() => _ClassDetailScreenState();
}

class _ClassDetailScreenState extends State<ClassDetailScreen> {
  final _data = ClassFormData();
  GroupClass? _class;
  List<BranchOption> _branches = const [];
  String? _error;
  String? _formError;
  bool _saving = false;
  bool _busy = false;

  // Weekly schedule working state.
  List<ScheduleSlot> _slots = const [];
  bool _scheduleDirty = false;
  bool _savingSchedule = false;
  bool _generating = false;
  int _scheduleVersion = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _data.dispose();
    super.dispose();
  }

  Future<void> _load({bool keepForm = false}) async {
    setState(() => _error = null);
    try {
      final c = await getIt<GroupClassRepository>().getById(widget.classId);
      final branches = await loadClassBranchOptions(existing: c);
      if (!mounted) return;
      setState(() {
        _class = c;
        _branches = branches;
        _slots = c.schedule;
        _scheduleDirty = false;
        _scheduleVersion++;
      });
      if (!keepForm) {
        _data.fill(c);
        // A Trainer opening a class without a trainer is shown as its trainer
        // (the picker is a read-only "assigned to you" row for them).
        if (c.trainer == null) {
          final self = selfTrainerOption(context);
          if (self != null) {
            _data.trainer = self;
            _data.markClean();
          }
        }
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this class ($e)');
    }
  }

  Future<void> _save() async {
    final c = _class;
    if (c == null) return;
    final problem = _data.validate();
    if (problem != null) {
      setState(() => _formError = problem);
      return;
    }
    setState(() {
      _saving = true;
      _formError = null;
    });
    try {
      final updated = await getIt<GroupClassRepository>().update(
        c.id,
        name: _data.name.text.trim(),
        description: _data.description.text.trim(),
        trainerId: _data.trainer?.id,
        branchId: _data.branchId,
        capacity: _data.capacityValue,
        durationMinutes: _data.durationValue,
        isActive: _data.isActive,
      );
      if (!mounted) return;
      setState(() => _class = updated);
      _data.fill(updated);
      teamSnack(context, 'Class updated');
    } on ApiException catch (e) {
      if (mounted) setState(() => _formError = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _formError = 'Something went wrong ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveSchedule() async {
    final c = _class;
    if (c == null) return;
    setState(() => _savingSchedule = true);
    try {
      await getIt<GroupClassRepository>().setSchedule(c.id, _slots);
      if (!mounted) return;
      teamSnack(context, 'Weekly schedule saved.');
      // Re-baseline the editor from the server's copy; keep unsaved form edits.
      await _load(keepForm: true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _savingSchedule = false);
    }
  }

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      final created = await getIt<ClassSessionRepository>().generate();
      if (mounted) teamSnack(context, '$created session(s) generated.');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _run(ClassAction action) async {
    final c = _class;
    if (c == null) return;
    setState(() => _busy = true);
    try {
      final ok = await runClassAction(context, c, action);
      if (!mounted || !ok) return;
      if (action == ClassAction.delete) {
        context.pop();
        return;
      }
      await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final c = _class;
    final hero = c != null && _error == null;
    final canUpdate = teamCan(context, 'classes:update');
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Class' : 'Classes'),
      ),
      bottomNavigationBar: hero && canUpdate
          ? ListenableBuilder(
              listenable: _data,
              builder: (context, _) => _data.isDirty
                  ? TeamBottomBar(
                      child: Row(
                        children: [
                          Expanded(
                            child: TeamOutlineButton(
                              label: 'Discard',
                              onTap: _saving
                                  ? null
                                  : () => setState(() {
                                        _formError = null;
                                        _data.reset(c);
                                      }),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            flex: 2,
                            child: TeamGradientButton(
                              label: 'Save changes',
                              icon: Icons.check_rounded,
                              loading: _saving,
                              onTap: _save,
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox.shrink(),
            )
          : null,
      body: _error != null
          ? SafeArea(child: AppErrorView(message: _error!, onRetry: _load))
          : c == null
              ? const AppLoadingView()
              : _content(c, canUpdate),
    );
  }

  Widget _content(GroupClass c, bool canUpdate) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canDelete = teamCan(context, 'classes:delete');
    final canRestore = teamCan(context, 'classes:restore');
    final tone = classTone(c);
    final actions = availableClassActions(
      c,
      canDelete: canDelete,
      canRestore: canRestore,
    );

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(keepForm: _data.isDirty),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          ClassHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      SpinningRing(
                        size: 104,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF312E81), Color(0xFFC026D3)],
                            ),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.calendar_month_rounded,
                              size: 44,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 4,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: PulseDot(color: tone, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    c.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.place_rounded,
                        size: 14,
                        color: Colors.white70,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          c.branch?.name ?? 'No branch',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.88),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(classStatus(c), dot: tone),
                      TeamHeroPill(
                        '${c.capacity} seats',
                        icon: Icons.groups_rounded,
                      ),
                      TeamHeroPill(
                        '${c.durationMinutes}m',
                        icon: Icons.timelapse_rounded,
                      ),
                      TeamHeroPill(
                        plural(c.schedule.length, 'weekly slot'),
                        icon: Icons.schedule_rounded,
                      ),
                      if (c.trainer != null)
                        TeamHeroPill(
                          c.trainer!.name,
                          icon: Icons.person_rounded,
                        ),
                    ],
                  ),
                ),
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 4,
                    child: Row(
                      children: [
                        for (final a in actions)
                          TeamHeroAction(
                            label: a.label,
                            icon: a.icon,
                            onTap: _busy ? null : () => _run(a),
                          ),
                      ],
                    ),
                  ),
                ],
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
                  if (_formError != null) ...[
                    FormAlert(message: _formError!),
                    const SizedBox(height: 14),
                  ],
                  ClassInfoFields(
                    data: _data,
                    branches: _branches,
                    enabled: canUpdate,
                  ),
                  const SizedBox(height: 14),
                  _scheduleCard(canUpdate),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _scheduleCard(bool canUpdate) {
    return TeamSectionCard(
      icon: Icons.schedule_rounded,
      color: TeamColors.violet,
      title: 'Weekly schedule',
      subtitle: plural(_slots.length, 'slot'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'A recurring template - the scheduler expands it into dated, '
            'bookable sessions for a rolling 4-week window every night.',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
          if (canUpdate) ...[
            const SizedBox(height: 12),
            GestureDetector(
              key: const ValueKey('regenerate'),
              onTap: _generating ? null : _generate,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: TeamColors.violet.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: TeamColors.violet.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_generating)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      const Icon(
                        Icons.refresh_rounded,
                        size: 16,
                        color: TeamColors.violet,
                      ),
                    const SizedBox(width: 8),
                    Text(
                      _generating ? 'Generating…' : 'Regenerate sessions now',
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w800,
                        color: TeamColors.violet,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          ClassScheduleEditor(
            key: ValueKey('editor-$_scheduleVersion'),
            initialSlots: _slots,
            enabled: canUpdate,
            onChanged: (slots, dirty) {
              _slots = slots;
              if (dirty != _scheduleDirty) {
                setState(() => _scheduleDirty = dirty);
              }
            },
          ),
          if (canUpdate) ...[
            const SizedBox(height: 14),
            TeamGradientButton(
              label: 'Save weekly schedule',
              icon: Icons.check_rounded,
              gradient: TeamColors.ctaGreen,
              loading: _savingSchedule,
              onTap: _scheduleDirty ? _saveSchedule : null,
            ),
          ],
        ],
      ),
    );
  }
}
