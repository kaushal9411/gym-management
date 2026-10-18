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
import '../../../models/diet_plan.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/trainer_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'diet_ui.dart';

/// Add / edit a diet plan (`POST /diet-plans`, `PATCH /diet-plans/:id`) with
/// every field web's plan form has: name, goal, description, daily calories,
/// duration (days), trainer / nutritionist, notes and the "active (visible
/// for assignment)" switch. Web's form is a single page, so this is too: the
/// same sections under a gradient banner, a sticky Cancel / Save bar, and -
/// when creating - web's "Ready to create" completeness ring. The meal builder
/// is set after the plan exists (its own screen), exactly as on web.
///
/// Edit (when [planId] is given - the screen loads the plan itself) sends
/// **only the keys that changed** (`updateDietPlanSchema` treats an absent key
/// as "leave alone" and rejects an empty body). As on web, a blank goal /
/// description / notes or calorie target is left unchanged, not cleared (the
/// PATCH schema has no way to null them); the trainer *can* be cleared
/// (`trainerId: null`) with the picker's X. A Trainer creating or editing a
/// plan is always the trainer on it (see [TrainerPickerField]). On a
/// successful **create** the screen pops with the new plan id so the list can
/// open it; on edit it pops with null.
class DietPlanCatalogFormScreen extends StatefulWidget {
  const DietPlanCatalogFormScreen({super.key, this.planId});

  /// Null -> create.
  final String? planId;

  bool get isEdit => planId != null;

  @override
  State<DietPlanCatalogFormScreen> createState() =>
      _DietPlanCatalogFormScreenState();
}

class _DietPlanCatalogFormScreenState extends State<DietPlanCatalogFormScreen> {
  final _name = TextEditingController();
  final _goal = TextEditingController();
  final _description = TextEditingController();
  final _calories = TextEditingController();
  final _duration = TextEditingController(text: '30');
  final _notes = TextEditingController();

  TrainerOption? _trainer;
  bool _isActive = true;

  DietPlan? _plan;
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
      final plan = await getIt<DietPlanRepository>().getById(widget.planId!);
      if (!mounted) return;
      setState(() {
        _plan = plan;
        _name.text = plan.name;
        _goal.text = plan.goal ?? '';
        _description.text = plan.description ?? '';
        _calories.text =
            plan.dailyCalories == null ? '' : '${plan.dailyCalories}';
        _duration.text = '${plan.durationDays}';
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
    for (final c in [
      _name,
      _goal,
      _description,
      _calories,
      _duration,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  // ── parsing + validation ──────────────────────────────────────────────────

  String _t(TextEditingController c) => c.text.trim();
  int? get _days => int.tryParse(_t(_duration));
  int? get _kcal => int.tryParse(_t(_calories));

  /// First problem, or null. Mirrors the server's zod limits.
  String? _validate() {
    if (_t(_name).isEmpty) return 'Plan name is required.';
    if (_t(_name).length > 150) {
      return 'Plan name is limited to 150 characters.';
    }
    if (_t(_goal).length > 150) return 'Goal is limited to 150 characters.';
    if (_t(_description).length > 4000) {
      return 'Description is limited to 4000 characters.';
    }
    final d = _days;
    if (d == null || d < 1 || d > 730) {
      return 'Duration must be a whole number of days from 1 to 730.';
    }
    if (_t(_calories).isNotEmpty && (_kcal == null || _kcal! < 1)) {
      return 'Daily calories must be a positive whole number.';
    }
    if (_t(_notes).length > 2000) {
      return 'Notes are limited to 2000 characters.';
    }
    return null;
  }

  Map<String, dynamic> _createBody() => {
        'name': _t(_name),
        'durationDays': _days,
        'isActive': _isActive,
        if (_t(_goal).isNotEmpty) 'goal': _t(_goal),
        if (_t(_description).isNotEmpty) 'description': _t(_description),
        if (_kcal != null) 'dailyCalories': _kcal,
        if (_trainer != null) 'trainerId': _trainer!.id,
        if (_t(_notes).isNotEmpty) 'notes': _t(_notes),
      };

  /// Only what changed. Returns the body and whether a text field / calorie
  /// target was blanked (those cannot be cleared on PATCH).
  (Map<String, dynamic>, bool) _editBody() {
    final p = _plan!;
    final body = <String, dynamic>{};
    var blanked = false;
    if (_t(_name) != p.name) body['name'] = _t(_name);
    void text(String key, TextEditingController c, String? old) {
      final now = _t(c);
      final before = old ?? '';
      if (now == before) return;
      if (now.isEmpty) {
        blanked = true;
      } else {
        body[key] = now;
      }
    }

    text('goal', _goal, p.goal);
    text('description', _description, p.description);
    text('notes', _notes, p.notes);
    final d = _days;
    if (d != null && d != p.durationDays) body['durationDays'] = d;
    final k = _kcal;
    if (k != null && k != p.dailyCalories) body['dailyCalories'] = k;
    if (k == null && p.dailyCalories != null) blanked = true;
    if (_trainer?.id != p.trainer?.id) body['trainerId'] = _trainer?.id;
    if (_isActive != p.isActive) body['isActive'] = _isActive;
    return (body, blanked);
  }

  // ── actions ───────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    final err = _validate();
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    Map<String, dynamic> body;
    var blanked = false;
    if (_isEdit) {
      final r = _editBody();
      body = r.$1;
      blanked = r.$2;
      if (body.isEmpty) {
        teamSnack(
          context,
          blanked
              ? 'Nothing was saved - a blank goal, description, notes or '
                  'calorie target is left unchanged.'
              : 'No changes to save.',
        );
        if (!blanked) context.pop();
        return;
      }
    } else {
      body = _createBody();
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = getIt<DietPlanRepository>();
      final saved = _isEdit
          ? await repo.updateWith(_plan!.id, body)
          : await repo.createWith(body);
      if (!mounted) return;
      teamSnack(
        context,
        _isEdit
            ? (blanked
                ? 'Plan updated. Blank goal, description, notes or calories '
                    'were left unchanged.'
                : 'Plan updated.')
            : '${saved.name} created.',
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
        icon: Icons.restaurant_rounded,
        color: TeamColors.indigo,
        title: 'Plan information',
        subtitle: 'What trainers and members see',
        children: [
          AppLabeledField(
            label: 'Plan name *',
            hintText: 'e.g. Lean Cutting Phase',
            icon: Icons.restaurant_rounded,
            iconColor: TeamColors.indigo,
            controller: _name,
            textCapitalization: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
            inputFormatters: [LengthLimitingTextInputFormatter(150)],
          ),
          AppLabeledField(
            label: 'Goal',
            hintText: 'e.g. Weight loss',
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
        title: 'Calories, length & trainer',
        subtitle: 'The daily target and how long the plan runs',
        children: [
          AppLabeledField(
            label: 'Daily calories',
            hintText: 'e.g. 2000',
            icon: Icons.local_fire_department_rounded,
            iconColor: TeamColors.rose,
            controller: _calories,
            keyboardType: TextInputType.number,
            onChanged: (_) => setState(() {}),
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(5),
            ],
          ),
          AppLabeledField(
            label: 'Duration (days) *',
            hintText: '1 - 730',
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
            label: 'Trainer / Nutritionist',
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
            ? 'Active (visible for assignment)'
            : 'Saved as an inactive draft until you activate it',
        icon: Icons.play_circle_rounded,
        color: TeamColors.green,
        value: _isActive,
        onChanged: (v) => setState(() => _isActive = v),
      );

  /// Web's "Ready to create" card: name, duration and goal ticked live.
  Widget _readiness() {
    final checks = [
      ('Plan name', _t(_name).isNotEmpty),
      ('Duration (days)', (_days ?? 0) > 0),
      ('Goal', _t(_goal).isNotEmpty),
    ];
    final ok = checks.where((c) => c.$2).length;
    final ratio = ok / checks.length;
    return TeamSectionCard(
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
    final p = _plan;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final name = _t(_name);
    final days = _days;
    final kcal = _kcal;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(_isEdit ? 'Edit diet plan' : 'New diet plan'),
      ),
      bottomNavigationBar: TeamBottomBar(
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: TeamOutlineButton(
                label: 'Cancel',
                onTap: _saving ? null : () => context.pop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 3,
              child: TeamGradientButton(
                label: _isEdit ? 'Save changes' : 'Create plan',
                icon: Icons.check_rounded,
                loading: _saving,
                gradient: _isEdit ? TeamColors.cta : TeamColors.ctaGreen,
                onTap: _submit,
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DietBanner(
              top: top,
              name: name.isEmpty ? (p?.name ?? 'New plan') : name,
              subtitle: _isEdit
                  ? '${p!.activeMemberCount} '
                      '${p.activeMemberCount == 1 ? 'member' : 'members'} '
                      'on this plan'
                  : 'The meal builder is set after creating the plan',
              chip: kcal != null
                  ? '$kcal kcal/day · ${days == null ? '—' : daysLabel(days)}'
                  : (days == null ? 'Diet plan' : daysLabel(days)),
              chipIcon: _isEdit
                  ? Icons.edit_rounded
                  : Icons.local_fire_department_rounded,
            ),
            TeamCenter(
              maxWidth: 840,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FadeUp(index: 0, child: FormAlert(message: _error!)),
                      const SizedBox(height: 14),
                    ],
                    _basics(),
                    const SizedBox(height: 14),
                    _setup(),
                    const SizedBox(height: 14),
                    _availability(),
                    if (!_isEdit) ...[
                      const SizedBox(height: 14),
                      _readiness(),
                    ],
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
