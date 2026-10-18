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
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/trainer_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../plans/presentation/plan_ui.dart' show PlanGlyph;
import '../../team/presentation/widgets/team_ui.dart';
import 'workout_ui.dart';

/// Add / edit a workout plan (`POST /workout-plans`,
/// `PATCH /workout-plans/:id`) with every field web's plan form has: name,
/// goal, description, level, duration (weeks), trainer, notes and the
/// "active (visible for assignment)" switch.
///
/// **Add** is a 3-step wizard (Basics -> Setup -> Review, with a completeness
/// ring); **Edit** (when [planId] is given - the screen loads the plan itself)
/// is one page of the same sections under a gradient banner. The weekly
/// schedule is built afterwards on the plan page, as on web.
///
/// Edit sends **only the keys that changed** (`updateWorkoutPlanSchema`
/// treats an absent key as "leave alone" and rejects an empty body). As on web,
/// a blank goal / description / notes or trainer is left unchanged, not cleared.
/// A Trainer creating or editing a plan is always the trainer on it (see
/// [TrainerPickerField]). On a successful **create** the screen pops with the
/// new plan id so the list can open it; on edit it pops with null.
class WorkoutPlanCatalogFormScreen extends StatefulWidget {
  const WorkoutPlanCatalogFormScreen({super.key, this.planId});

  /// Null -> create.
  final String? planId;

  bool get isEdit => planId != null;

  @override
  State<WorkoutPlanCatalogFormScreen> createState() =>
      _WorkoutPlanCatalogFormScreenState();
}

class _WorkoutPlanCatalogFormScreenState
    extends State<WorkoutPlanCatalogFormScreen> {
  static const _stepNames = ['Basics', 'Setup', 'Review'];
  static const _stepIcons = [
    Icons.badge_rounded,
    Icons.tune_rounded,
    Icons.rocket_launch_rounded,
  ];

  final _name = TextEditingController();
  final _goal = TextEditingController();
  final _description = TextEditingController();
  final _duration = TextEditingController(text: '8');
  final _notes = TextEditingController();

  WorkoutLevel _level = WorkoutLevel.intermediate;
  TrainerOption? _trainer;
  bool _isActive = true;

  WorkoutPlan? _plan;
  int _step = 0;
  bool _saving = false;
  String? _error;
  String? _loadError;

  bool get _isEdit => widget.isEdit;

  @override
  void initState() {
    super.initState();
    _trainer = _selfTrainerOption();
    if (_isEdit) _load();
  }

  /// A Trainer creating/editing a plan is always the trainer on it - null for
  /// every other role, leaving their picker exactly as before.
  TrainerOption? _selfTrainerOption() {
    final session = context.read<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff && session.user.isTrainer) {
      return TrainerOption(id: session.user.id, name: session.user.name);
    }
    return null;
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final plan = await getIt<WorkoutPlanRepository>().getById(widget.planId!);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _name.text = plan.name;
        _goal.text = plan.goal ?? '';
        _description.text = plan.description ?? '';
        _level = plan.level;
        _duration.text = '${plan.durationWeeks}';
        _notes.text = plan.notes ?? '';
        _isActive = plan.isActive;
        final t = plan.trainer;
        _trainer = t == null
            ? _selfTrainerOption()
            : TrainerOption(id: t.id, name: t.name);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = 'Could not load this plan ($e)');
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _goal, _description, _duration, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  // ── parsing + validation ──────────────────────────────────────────────────

  String _t(TextEditingController c) => c.text.trim();
  int? get _weeks => int.tryParse(_t(_duration));

  /// First problem on [step], or null. Mirrors the server's zod limits.
  String? _validateStep(int step) {
    switch (step) {
      case 0:
        if (_t(_name).isEmpty) return 'Plan name is required.';
        if (_t(_name).length > 150) {
          return 'Plan name is limited to 150 characters.';
        }
        if (_t(_goal).length > 150) {
          return 'Goal is limited to 150 characters.';
        }
        if (_t(_description).length > 4000) {
          return 'Description is limited to 4000 characters.';
        }
      case 1:
        final w = _weeks;
        if (w == null || w < 1 || w > 104) {
          return 'Duration must be a whole number of weeks from 1 to 104.';
        }
        if (_t(_notes).length > 2000) {
          return 'Notes are limited to 2000 characters.';
        }
    }
    return null;
  }

  Map<String, dynamic> _createBody() => {
        'name': _t(_name),
        'level': _level.apiValue,
        'durationWeeks': _weeks,
        'isActive': _isActive,
        if (_t(_goal).isNotEmpty) 'goal': _t(_goal),
        if (_t(_description).isNotEmpty) 'description': _t(_description),
        if (_trainer != null) 'trainerId': _trainer!.id,
        if (_t(_notes).isNotEmpty) 'notes': _t(_notes),
      };

  Map<String, dynamic> _editBody() {
    final p = _plan!;
    final body = <String, dynamic>{};
    if (_t(_name) != p.name) body['name'] = _t(_name);
    // Like web, a blank goal / description / notes means "leave it alone"
    // (they are not nullable on PATCH and web never clears them either).
    void text(String key, TextEditingController c, String? old) {
      if (_t(c).isNotEmpty && _t(c) != (old ?? '')) body[key] = _t(c);
    }

    text('goal', _goal, p.goal);
    text('description', _description, p.description);
    text('notes', _notes, p.notes);
    if (_level != p.level) body['level'] = _level.apiValue;
    final w = _weeks;
    if (w != null && w != p.durationWeeks) body['durationWeeks'] = w;
    if (_trainer != null && _trainer!.id != p.trainer?.id) {
      body['trainerId'] = _trainer!.id;
    }
    if (_isActive != p.isActive) body['isActive'] = _isActive;
    return body;
  }

  // ── actions ───────────────────────────────────────────────────────────────

  void _next() {
    final err = _validateStep(_step);
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    setState(() {
      _error = null;
      _step++;
    });
  }

  void _back() => setState(() {
        _error = null;
        _step--;
      });

  Future<void> _submit() async {
    for (var s = 0; s < _stepNames.length - 1; s++) {
      final err = _validateStep(s);
      if (err != null) {
        setState(() {
          _error = err;
          if (!_isEdit) _step = s;
        });
        return;
      }
    }
    final Map<String, dynamic> body = _isEdit ? _editBody() : _createBody();
    if (_isEdit && body.isEmpty) {
      teamSnack(context, 'No changes to save.');
      context.pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = getIt<WorkoutPlanRepository>();
      final saved = _isEdit
          ? await repo.updateWith(_plan!.id, body)
          : await repo.createWith(body);
      if (!mounted) return;
      teamSnack(
        context,
        _isEdit ? 'Plan updated.' : '${saved.name} created.',
      );
      context.pop(_isEdit ? null : saved.id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      // A parse failure after a successful save must not leave the spinner
      // running; say what happened.
      if (!mounted) return;
      setState(
        () => _error = 'Something went wrong while saving ($e). Check the '
            'plans list - the change may already have been applied.',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── sections ──────────────────────────────────────────────────────────────

  Widget _basics() => TeamFormSection(
        icon: Icons.badge_rounded,
        color: TeamColors.indigo,
        title: 'Plan information',
        subtitle: 'What trainers and members see',
        children: [
          AppLabeledField(
            label: 'Plan name *',
            hintText: 'e.g. Strength Foundations',
            icon: Icons.fitness_center_rounded,
            iconColor: TeamColors.indigo,
            controller: _name,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            inputFormatters: [LengthLimitingTextInputFormatter(150)],
          ),
          AppLabeledField(
            label: 'Goal',
            hintText: 'e.g. Fat loss',
            icon: Icons.track_changes_rounded,
            iconColor: TeamColors.amber,
            controller: _goal,
            textCapitalization: TextCapitalization.sentences,
            onChanged: (_) => setState(() {}),
            inputFormatters: [LengthLimitingTextInputFormatter(150)],
          ),
          AppLabeledField(
            label: 'Description',
            hintText: 'Who is this plan for, and what does it cover?',
            icon: Icons.notes_rounded,
            iconColor: TeamColors.sky,
            controller: _description,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            inputFormatters: [LengthLimitingTextInputFormatter(4000)],
          ),
        ],
      );

  Widget _setup() => TeamFormSection(
        icon: Icons.tune_rounded,
        color: TeamColors.violet,
        title: 'Level, length & trainer',
        subtitle: 'How demanding it is and how long it runs',
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(
                      Icons.signal_cellular_alt_rounded,
                      size: 14,
                      color: TeamColors.green,
                    ),
                    const SizedBox(width: 6),
                    Text('Level', style: AppText.eyebrow()),
                  ],
                ),
              ),
              for (final l in WorkoutLevel.values) ...[
                TeamChoiceCard(
                  title: l.label,
                  icon: levelIcon(l),
                  color: levelColor(l),
                  selected: _level == l,
                  onTap: () => setState(() => _level = l),
                ),
                const SizedBox(height: 8),
              ],
            ],
          ),
          AppLabeledField(
            label: 'Duration (weeks) *',
            hintText: '1 - 104',
            icon: Icons.timelapse_rounded,
            iconColor: TeamColors.teal,
            controller: _duration,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(3),
            ],
          ),
          TrainerPickerField(
            selectedTrainer: _trainer,
            onChanged: (t) => setState(() => _trainer = t),
          ),
          AppLabeledField(
            label: 'Notes',
            hintText: 'Only staff see these',
            icon: Icons.sticky_note_2_rounded,
            iconColor: TeamColors.rose,
            controller: _notes,
            minLines: 2,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            inputFormatters: [LengthLimitingTextInputFormatter(2000)],
          ),
        ],
      );

  Widget _availability() => TeamToggleRow(
        title: _isEdit ? 'Active' : 'Start as active',
        subtitle: _isActive
            ? 'Visible for assignment'
            : 'Saved as an inactive draft until you activate it',
        icon: Icons.play_circle_rounded,
        color: TeamColors.green,
        value: _isActive,
        onChanged: (v) => setState(() => _isActive = v),
      );

  Widget _review() {
    final checks = [
      ('Plan name', _t(_name).isNotEmpty),
      ('Duration (weeks)', (_weeks ?? 0) > 0),
      ('Goal', _t(_goal).isNotEmpty),
    ];
    final ok = checks.where((c) => c.$2).length;
    final ratio = ok / checks.length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSectionCard(
          icon: Icons.checklist_rounded,
          color: TeamColors.green,
          title: 'Ready to create',
          subtitle: 'Only the name and duration are required',
          child: Row(
            children: [
              AnimatedRing(
                value: ratio,
                size: 84,
                stroke: 9,
                colors: const [TeamColors.green, TeamColors.teal],
                track: AppColors.surface3,
                child: Text(
                  '${(ratio * 100).round()}%',
                  style: AppText.display(size: 17, color: TeamColors.green),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  children: [
                    for (final c in checks) TeamCheckRow(label: c.$1, ok: c.$2),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.fact_check_rounded,
          color: TeamColors.violet,
          title: 'Summary',
          child: TeamTileGrid(
            tiles: [
              TeamFieldTile(
                icon: Icons.fitness_center_rounded,
                label: 'Plan',
                value: _t(_name),
                color: TeamColors.indigo,
              ),
              TeamFieldTile(
                icon: levelIcon(_level),
                label: 'Level',
                value: _level.label,
                color: levelColor(_level),
              ),
              TeamFieldTile(
                icon: Icons.timelapse_rounded,
                label: 'Duration',
                value: _weeks == null ? null : weeksLabel(_weeks!),
                color: TeamColors.teal,
              ),
              TeamFieldTile(
                icon: Icons.sports_gymnastics_rounded,
                label: 'Trainer',
                value: _trainer?.name,
                color: TeamColors.violet,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.rocket_launch_rounded,
          color: TeamColors.indigo,
          title: 'Availability',
          subtitle: 'You build the weekly schedule right after creating it',
          child: _availability(),
        ),
      ],
    );
  }

  // ── layout ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isEdit && _plan == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
        body: SafeArea(
          top: false,
          child: _loadError != null
              ? AppErrorView(message: _loadError!, onRetry: _load)
              : const AppLoadingView(),
        ),
      );
    }
    return _isEdit ? _editPage() : _wizardPage();
  }

  Widget _editPage() {
    final p = _plan!;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Edit workout plan'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            WorkoutBanner(
              top: top,
              name: _t(_name).isEmpty ? p.name : _t(_name),
              subtitle: '${p.activeMemberCount} '
                  '${p.activeMemberCount == 1 ? 'member' : 'members'} on this '
                  'plan',
              chip: 'Editing plan',
              chipIcon: Icons.edit_rounded,
            ),
            TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    _basics(),
                    const SizedBox(height: 14),
                    _setup(),
                    const SizedBox(height: 14),
                    _availability(),
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: 'Save changes',
                      icon: Icons.check_rounded,
                      loading: _saving,
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

  Widget _wizardPage() {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final last = _step == _stepNames.length - 1;
    final stepBody = switch (_step) {
      0 => _basics(),
      1 => _setup(),
      _ => _review(),
    };
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New workout plan'),
      ),
      bottomNavigationBar: TeamBottomBar(
        child: Row(
          children: [
            if (_step > 0) ...[
              Expanded(
                flex: 2,
                child: TeamOutlineButton(
                  label: 'Back',
                  icon: Icons.arrow_back_rounded,
                  onTap: _saving ? null : _back,
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: 3,
              child: TeamGradientButton(
                label: last ? 'Create plan' : 'Next',
                icon: last ? Icons.check_rounded : Icons.arrow_forward_rounded,
                loading: _saving,
                gradient: last ? TeamColors.ctaGreen : TeamColors.cta,
                onTap: last ? _submit : _next,
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          _hero(top),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              16,
              16 + teamSideInset(context),
              0,
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.06, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: Column(
                key: ValueKey(_step),
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_error != null) ...[
                    FormAlert(message: _error!),
                    const SizedBox(height: 14),
                  ],
                  stepBody,
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(double top) {
    final n = _stepNames.length;
    return Container(
      padding: EdgeInsets.fromLTRB(
        18 + teamSideInset(context),
        top + 2,
        18 + teamSideInset(context),
        20,
      ),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF312E81), Color(0xFF7C3AED), Color(0xFFC026D3)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Floating(
                child: PlanGlyph(size: 46, icon: Icons.fitness_center_rounded),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _t(_name).isEmpty ? 'Create a plan' : _t(_name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.display(size: 24, color: Colors.white),
                    ),
                    Text(
                      'Step ${_step + 1} of $n · ${_stepNames[_step]}',
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              for (var i = 0; i < n; i++) ...[
                if (i > 0)
                  Expanded(
                    child: Container(
                      height: 3,
                      margin:
                          const EdgeInsets.only(left: 6, right: 6, bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(
                          alpha: i <= _step ? 0.95 : 0.3,
                        ),
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                  ),
                GestureDetector(
                  onTap: () {
                    // Jump back freely; forward only if the steps before pass.
                    if (i <= _step) {
                      setState(() {
                        _error = null;
                        _step = i;
                      });
                      return;
                    }
                    String? err;
                    for (var s = _step; s < i && err == null; s++) {
                      err = _validateStep(s);
                    }
                    setState(() {
                      _error = err;
                      if (err == null) _step = i;
                    });
                  },
                  child: Column(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i <= _step
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.18),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.5),
                          ),
                        ),
                        child: Icon(
                          i < _step ? Icons.check_rounded : _stepIcons[i],
                          size: 19,
                          color: i <= _step
                              ? const Color(0xFF7C3AED)
                              : Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _stepNames[i],
                        style: AppText.body(
                          size: 10.5,
                          weight: FontWeight.w700,
                          color: Colors.white.withValues(
                            alpha: i == _step ? 1 : 0.7,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
