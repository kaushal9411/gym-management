import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/diet_plan.dart';
import '../../../models/food.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../repositories/food_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import '../smart/smart_engine.dart';
import '../smart/smart_input.dart';
import '../smart/starter_foods.dart';
import 'diet_ui.dart';

const _planDays = 28;

/// Smart Diet Plan (Owner / Manager catalog hero button, `diets:create`) -
/// web's `/diet-plans/smart` page. Pick a member and the rule-based planner
/// ([generate], a port of web's engine) builds a daily meal plan from their
/// profile, latest measurement and the last 28 days of attendance. Review the
/// notices, change quantities or swap foods, "Try another mix", then **Save
/// draft plan**: `POST /diet-plans` (inactive) + `PATCH .../meals`; if the
/// meals fail the empty draft is deleted again. Pops with the new plan id so
/// the list opens it.
///
/// When the food library lacks the starter foods the planner knows, "Add
/// starter foods" creates / restores / re-activates them (web does the same).
class SmartDietPlanScreen extends StatefulWidget {
  const SmartDietPlanScreen({super.key});

  @override
  State<SmartDietPlanScreen> createState() => _SmartDietPlanScreenState();
}

class _SmartDietPlanScreenState extends State<SmartDietPlanScreen> {
  final _search = TextEditingController();
  Timer? _debounce;

  List<GymMember>? _results;
  String? _searchError;
  GymMember? _picked;

  SmartMemberInput? _input;
  bool _memberLoading = false;
  String? _memberError;

  List<PlannerFood> _catalog = const [];
  bool _catalogLoading = true;
  String? _catalogError;

  int _mix = 0;
  bool _explainOpen = false;
  GenerateResult? _result;
  Plan? _edit;
  int? _swapOpen;
  bool _adding = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _loadCatalog() async {
    setState(() {
      _catalogLoading = true;
      _catalogError = null;
    });
    try {
      final foods = await getIt<FoodRepository>().active();
      if (!mounted) return;
      setState(() {
        _catalog = toPlannerFoods(foods);
        _catalogLoading = false;
        _regen();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _catalogLoading = false;
        _catalogError = e.message;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _catalogLoading = false;
        _catalogError = 'Could not load the food library ($e)';
      });
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _runSearch);
    setState(() {});
  }

  Future<void> _runSearch() async {
    final q = _search.text.trim();
    if (q.isEmpty) {
      setState(() {
        _results = null;
        _searchError = null;
      });
      return;
    }
    try {
      final r = await getIt<MemberRepository>().list(
        search: q,
        limit: 8,
        sortBy: 'name',
        sortDir: 'asc',
      );
      if (!mounted) return;
      setState(() {
        _results = r.items;
        _searchError = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _searchError = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _searchError = 'Could not search members ($e)');
    }
  }

  Future<void> _pick(GymMember m) async {
    setState(() {
      _picked = m;
      _results = null;
      _search.clear();
      _input = null;
      _mix = 0;
      _result = null;
      _edit = null;
      _swapOpen = null;
      _error = null;
      _memberError = null;
      _memberLoading = true;
    });
    try {
      final input = await loadSmartInput(m.id);
      if (!mounted || _picked?.id != m.id) return;
      setState(() {
        _input = input;
        _memberLoading = false;
        _regen();
      });
    } catch (_) {
      if (!mounted || _picked?.id != m.id) return;
      setState(() {
        _memberLoading = false;
        _memberError = 'Could not load this member. Try again.';
      });
    }
  }

  /// Re-runs the planner (deterministic for the same input + mix) and drops
  /// any hand edits - called whenever the member, catalog or mix changes.
  void _regen() {
    final i = _input;
    _result = i == null ? null : generate(i.member, _catalog, mix: _mix);
    _edit = null;
    _swapOpen = null;
  }

  Plan? _basePlan(GenerateResult? r) => r is GenerateOk ? r.plan : null;

  void _mutate(Plan base, Plan current, void Function(Plan copy) fn) {
    final copy = current.copy();
    fn(copy);
    setState(() => _edit = copy);
  }

  Future<void> _addStarterFoods() async {
    setState(() => _adding = true);
    try {
      final repo = getIt<FoodRepository>();
      // Every food including inactive and deleted ones: the name is unique per
      // gym, so those must be brought back, not re-created.
      final known = <String, Food>{};
      for (var page = 1; page <= 50; page++) {
        final res = await repo.list(page: page, includeDeleted: true);
        for (final f in res.items) {
          known[f.name.trim().toLowerCase()] = f;
        }
        if (!res.hasNextPage) break;
      }
      var changed = 0;
      for (final s in starterFoods) {
        final match = known[s.name.toLowerCase()];
        if (match == null) {
          await repo.create(
            name: s.name,
            category: s.category,
            servingSize: s.serving,
            calories: s.kcal,
            protein: s.p,
            carbohydrates: s.c,
            fat: s.f,
            sugar: s.sugar,
            sodium: s.sodium,
          );
          changed++;
          continue;
        }
        if (match.deletedAt != null) {
          await repo.restore(match.id);
          changed++;
        }
        if (!match.isActive) {
          await repo.update(match.id, isActive: true);
          if (match.deletedAt == null) changed++;
        }
      }
      await _loadCatalog();
      if (!mounted) return;
      teamSnack(
        context,
        changed > 0
            ? '$changed starter foods added or restored'
            : 'Starter foods were already in the library',
      );
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) {
        teamSnack(context, 'Something went wrong ($e).', error: true);
      }
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _save(Plan plan) async {
    final input = _input;
    if (input == null) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final t = plan.t;
    final tot = totals(plan);
    final now = DateTime.now();
    final baseName = 'Smart plan - ${input.name} - ${dayMonth(now)}';
    final payload = <String, dynamic>{
      'description': 'Automatic plan for ${input.name} (${input.memberCode}).',
      'goal': t.goal.label,
      'dailyCalories': tot.kcal.round(),
      'durationDays': _planDays,
      'isActive': false,
      'notes': [
        'Created by Smart Diet Plan. Target ${fmtInt(t.kcal)} kcal, protein '
            '${numStr(t.p)} g, carbs ${numStr(t.c)} g, fat ${numStr(t.f)} g.',
        ...plan.explain,
        if (plan.review.isNotEmpty) ...[
          'Trainer review needed before activating:',
          ...plan.review,
        ],
      ].join('\n'),
    };
    final repo = getIt<DietPlanRepository>();
    String? createdId;
    try {
      DietPlan created;
      try {
        created = await repo.createWith({...payload, 'name': baseName});
      } on ApiException catch (e) {
        if (!e.message.contains('already exists')) rethrow;
        // Saved the same member's plan earlier today: keep both drafts, told
        // apart by time.
        final hm = '${now.hour.toString().padLeft(2, '0')}:'
            '${now.minute.toString().padLeft(2, '0')}';
        created = await repo.createWith({...payload, 'name': '$baseName $hm'});
      }
      createdId = created.id;
      await repo.setMeals(created.id, [
        for (final s in plan.slots)
          for (final it in s.items)
            PlanMealDraft(
              foodId: it.foodId,
              mealType: s.type,
              quantity: it.qty,
            ),
      ]);
      if (!mounted) return;
      teamSnack(
        context,
        'Draft plan saved. It stays inactive until you activate it.',
      );
      context.pop(created.id);
    } catch (e) {
      // Do not leave an empty draft behind when the meals could not be saved.
      if (createdId != null) {
        try {
          await repo.delete(createdId);
        } catch (_) {}
      }
      if (!mounted) return;
      final message = e is ApiException ? e.detailedMessage : '$e';
      if (message.contains('do not exist')) {
        unawaited(_loadCatalog());
        setState(
          () => _error = 'A food in this plan was removed since the page '
              'loaded. The list is refreshed, so check the plan and save again.',
        );
      } else {
        setState(() => _error = message);
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canCreate = teamCan(context, 'diets:create');
    final result = _result;
    final base = _basePlan(result);
    final plan = base == null ? null : (_edit ?? base);
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Smart Diet Plan'),
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
                label: 'Save draft plan',
                icon: Icons.check_rounded,
                loading: _saving,
                gradient: TeamColors.ctaGreen,
                onTap: plan == null || !canCreate ? null : () => _save(plan),
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
              name: 'Smart Diet Plan',
              subtitle: 'Built from the member profile, goal and attendance',
              chip: 'Saves as an inactive draft',
              chipIcon: Icons.auto_awesome_rounded,
            ),
            TeamCenter(
              maxWidth: 840,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _memberCard(),
                    ..._notices(result, plan, canCreate),
                    if (plan != null) ...[
                      const SizedBox(height: 14),
                      _targetCard(plan),
                      const SizedBox(height: 14),
                      _mealsCard(plan, base!),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      FormAlert(message: _error!),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      plan != null
                          ? 'Saves as an inactive draft. Nothing reaches the '
                              'member until you activate it.'
                          : 'Pick a member to preview a plan.',
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
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

  Widget _memberCard() {
    final i = _input;
    final m = i?.member;
    final age = m == null ? null : ageOf(m.dob);
    String sexLabel(Sex s) => switch (s) {
          Sex.m => 'Male',
          Sex.f => 'Female',
          Sex.o => 'Other',
        };
    return TeamSectionCard(
      icon: Icons.person_rounded,
      color: TeamColors.indigo,
      title: 'Member',
      subtitle: 'Find a member by name or member ID',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_picked == null) ...[
            AppLabeledField(
              label: 'Find a member',
              hintText: 'Search by name or member ID',
              icon: Icons.search_rounded,
              iconColor: TeamColors.indigo,
              controller: _search,
              onChanged: _onSearch,
            ),
            if (_searchError != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  _searchError!,
                  style: AppText.body(size: 12, color: AppColors.danger),
                ),
              ),
            if (_results != null && _results!.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'No members found.',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
              ),
            for (final r in _results ?? const <GymMember>[])
              Material(
                key: ValueKey('member-${r.id}'),
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () => _pick(r),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    child: Row(
                      children: [
                        UserAvatar(
                          avatarUrl: r.profilePhotoUrl,
                          name: r.name,
                          size: 34,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            '${r.name} · ${r.memberId}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.add_circle_outline_rounded,
                          size: 19,
                          color: TeamColors.indigo,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ] else
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surface3,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  UserAvatar(
                    avatarUrl: _picked!.profilePhotoUrl,
                    name: _picked!.name,
                    size: 40,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _picked!.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.body(size: 14, weight: FontWeight.w800),
                        ),
                        Text(
                          _picked!.memberId,
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    key: const ValueKey('change-member'),
                    tooltip: 'Choose another member',
                    icon: Icon(Icons.close_rounded, color: AppColors.inkFaint),
                    onPressed: () => setState(() {
                      _picked = null;
                      _input = null;
                      _result = null;
                      _edit = null;
                      _memberError = null;
                      _memberLoading = false;
                    }),
                  ),
                ],
              ),
            ),
          if (_memberLoading)
            const Padding(
              padding: EdgeInsets.only(top: 14),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
            ),
          if (_memberError != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                _memberError!,
                style: AppText.body(size: 12.5, color: AppColors.danger),
              ),
            ),
          if (i != null && m != null) ...[
            const SizedBox(height: 14),
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.cake_rounded,
                  label: 'Age and sex',
                  value:
                      '${age != null ? '$age yrs' : 'Not set'}${m.sex != null ? ', ${sexLabel(m.sex!)}' : ''}',
                  color: TeamColors.indigo,
                ),
                TeamFieldTile(
                  icon: Icons.height_rounded,
                  label: 'Height',
                  value: m.heightCm != null
                      ? '${numStr(m.heightCm!)} cm'
                      : 'Not set',
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.monitor_weight_rounded,
                  label: 'Weight',
                  value: m.weightKg != null
                      ? '${numStr(m.weightKg!)} kg'
                      : 'Not set',
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.track_changes_rounded,
                  label: 'Goal',
                  value: m.goal != null ? goals[m.goal!]!.label : 'Not set',
                  color: TeamColors.amber,
                ),
                TeamFieldTile(
                  icon: Icons.restaurant_rounded,
                  label: 'Food preference',
                  value: m.pref != null ? dietLabel[m.pref!] : 'Not set',
                  color: TeamColors.green,
                ),
                TeamFieldTile(
                  icon: Icons.directions_run_rounded,
                  label: 'Visits a week',
                  value: '${_jsRound(m.visits28 / 4)} (last 28 days)',
                  color: TeamColors.sky,
                ),
                TeamFieldTile(
                  icon: Icons.warning_amber_rounded,
                  label: 'Allergies',
                  value: m.allergies.isEmpty ? 'None recorded' : m.allergies,
                  color: TeamColors.rose,
                ),
                TeamFieldTile(
                  icon: Icons.medical_information_rounded,
                  label: 'Medical notes',
                  value: m.medical.isEmpty ? 'None recorded' : m.medical,
                  color: TeamColors.fuchsia,
                  maxLines: 3,
                ),
              ],
            ),
            if (i.weightSource.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Weight source: ${i.weightSource}.',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  static int _jsRound(double v) => (v + 0.5).floor();

  List<Widget> _notices(GenerateResult? result, Plan? plan, bool canCreate) {
    final out = <Widget>[];
    void add(Widget w) {
      out
        ..add(const SizedBox(height: 14))
        ..add(w);
    }

    if (_picked == null) {
      add(
        const _Notice(
          tone: TeamColors.indigo,
          title: 'Pick a member to start',
          lines: ['The plan is generated as soon as a member is selected.'],
        ),
      );
      return out;
    }
    if (_catalogError != null) {
      add(
        _Notice(
          tone: TeamColors.rose,
          title: 'Could not load the food library',
          lines: [_catalogError!],
          action: TeamOutlineButton(label: 'Retry', onTap: _loadCatalog),
        ),
      );
    }
    switch (result) {
      case GenerateMissing(:final missing):
        add(
          _Notice(
            tone: TeamColors.amber,
            title: 'Complete the member profile first',
            lines: [
              'The planner needs these details before it can calculate '
                  'calories:',
              for (final k in missing) '• ${missingLabel[k]}',
            ],
            action: TeamOutlineButton(
              label: 'Open member profile',
              onTap: () => context.push(
                AppRoutes.memberDetail,
                extra: _picked!.id,
              ),
            ),
          ),
        );
      case GenerateBlocked(:final blocks):
        add(
          _Notice(
            tone: TeamColors.rose,
            title: 'Automatic plan not available',
            lines: [for (final b in blocks) '• $b'],
            action: TeamOutlineButton(
              label: 'Build a plan manually',
              onTap: () => context.push(AppRoutes.dietPlanForm),
            ),
          ),
        );
      case GenerateCatalog():
        add(
          _Notice(
            tone: TeamColors.indigo,
            title: _catalogLoading
                ? 'Checking the food library…'
                : 'The food library needs more foods',
            lines: [
              'The planner uses ${starterFoods.length} common Indian foods it '
                  'already knows (proteins, carbs, vegetables, fruits, fats). '
                  'Add them to the food library to generate plans. You can '
                  'edit or remove any of them later.',
            ],
            action: TeamGradientButton(
              label: 'Add starter foods',
              icon: Icons.add_rounded,
              loading: _adding,
              onTap: canCreate ? _addStarterFoods : null,
            ),
          ),
        );
      default:
    }
    if (plan != null) {
      if (plan.review.isNotEmpty) {
        add(
          _Notice(
            tone: TeamColors.amber,
            title: 'Trainer review needed',
            lines: [
              for (final r in plan.review) '• $r',
              'The plan saves as an inactive draft. A trainer must check it '
                  'before it is activated.',
            ],
          ),
        );
      }
      final warn = warnings(plan);
      if (warn.isNotEmpty) {
        add(
          _Notice(
            tone: TeamColors.amber,
            title: 'Check these numbers',
            lines: [for (final w in warn) '• $w'],
          ),
        );
      }
    }
    return out;
  }

  Widget _targetCard(Plan plan) {
    final tot = totals(plan);
    final t = plan.t;
    Widget bar(String label, double got, double want, Color color) {
      final frac = want > 0 ? (got / want).clamp(0.0, 1.0) : 0.0;
      return Padding(
        padding: const EdgeInsets.only(top: 10),
        child: Column(
          children: [
            Row(
              children: [
                Text(
                  label,
                  style: AppText.body(size: 12.5, weight: FontWeight.w700),
                ),
                const Spacer(),
                Text(
                  '${fmtInt(got)} / ${fmtInt(want)} g',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: frac,
                minHeight: 8,
                color: color,
                backgroundColor: AppColors.surface3,
              ),
            ),
          ],
        ),
      );
    }

    return TeamSectionCard(
      icon: Icons.local_fire_department_rounded,
      color: TeamColors.green,
      title: 'Daily target',
      child: Column(
        children: [
          Center(
            child: AnimatedRing(
              value: t.kcal > 0 ? tot.kcal / t.kcal : 0,
              size: 132,
              stroke: 12,
              colors: const [TeamColors.indigo, TeamColors.violet],
              track: AppColors.surface3,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    fmtInt(tot.kcal),
                    style: AppText.display(size: 22, color: TeamColors.indigo),
                  ),
                  Text(
                    'of ${fmtInt(t.kcal)} kcal',
                    style: AppText.body(size: 11, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ),
          ),
          bar('Protein', tot.p, t.p, TeamColors.green),
          bar('Carbs', tot.c, t.c, TeamColors.amber),
          bar('Fat', tot.f, t.f, TeamColors.rose),
          const SizedBox(height: 6),
          InkWell(
            key: const ValueKey('explain-toggle'),
            borderRadius: BorderRadius.circular(10),
            onTap: () => setState(() => _explainOpen = !_explainOpen),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'How this was worked out',
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                  ),
                  Icon(
                    _explainOpen
                        ? Icons.expand_less_rounded
                        : Icons.expand_more_rounded,
                    color: AppColors.inkFaint,
                  ),
                ],
              ),
            ),
          ),
          if (_explainOpen)
            for (var i = 0; i < plan.explain.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${i + 1}. ${plan.explain[i]}',
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Widget _mealsCard(Plan plan, Plan base) {
    return TeamSectionCard(
      icon: Icons.restaurant_menu_rounded,
      color: TeamColors.amber,
      title: 'Daily meals',
      subtitle: 'Repeats every day for $_planDays days',
      trailing: GestureDetector(
        key: const ValueKey('another-mix'),
        onTap: _saving
            ? null
            : () => setState(() {
                  _mix++;
                  _regen();
                }),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.shuffle_rounded, size: 14),
              const SizedBox(width: 4),
              Text(
                'Try another mix',
                style: AppText.body(size: 11.5, weight: FontWeight.w800),
              ),
            ],
          ),
        ),
      ),
      child: Column(
        children: [
          for (var si = 0; si < plan.slots.length; si++) _slot(plan, base, si),
        ],
      ),
    );
  }

  Widget _slot(Plan plan, Plan base, int si) {
    final slot = plan.slots[si];
    final color = mealColor(slot.type);
    final kcal = slot.items.fold<double>(0, (a, it) => a + it.k * it.qty);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Container(
            color: color.withValues(alpha: 0.10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Row(
              children: [
                Icon(mealIcon(slot.type), size: 16, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    slot.label,
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                ),
                Text(
                  '${fmtInt(kcal)} kcal',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          for (var ii = 0; ii < slot.items.length; ii++)
            _item(plan, base, si, ii),
        ],
      ),
    );
  }

  Widget _item(Plan plan, Plan base, int si, int ii) {
    final it = plan.slots[si].items[ii];
    final (lo, hi) = qtyRange(it);
    final keyId = si * 100 + ii;
    final open = _swapOpen == keyId;
    final options =
        open ? swapOptions(plan, si, ii, _catalog) : const <SwapOption>[];
    Widget step(IconData icon, String tip, bool enabled, double delta) =>
        InkWell(
          key: ValueKey('$tip-$si-$ii'),
          borderRadius: BorderRadius.circular(9),
          onTap: enabled && !_saving
              ? () =>
                  _mutate(base, plan, (c) => setQty(c, si, ii, it.qty + delta))
              : null,
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: AppColors.surface3,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(
              icon,
              size: 16,
              color: enabled ? AppColors.ink : AppColors.inkFaint,
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      it.name,
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    Text(
                      '${it.serving} per portion, ${it.compLabel.toLowerCase()}',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              step(Icons.remove_rounded, 'less', it.qty > lo, -0.25),
              SizedBox(
                width: 46,
                child: Text(
                  '${q2(it.qty)} x',
                  textAlign: TextAlign.center,
                  style: AppText.body(size: 12.5, weight: FontWeight.w800),
                ),
              ),
              step(Icons.add_rounded, 'more', it.qty < hi, 0.25),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${fmtInt(it.k * it.qty)} kcal · P ${fmtInt(it.p * it.qty)} '
                  'C ${fmtInt(it.c * it.qty)} F ${fmtInt(it.f * it.qty)}',
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w700,
                    color: AppColors.inkSoft,
                  ),
                ),
              ),
              if (it.edited)
                const MiniChip(label: 'Edited', color: TeamColors.slate),
              TextButton(
                key: ValueKey('swap-$si-$ii'),
                onPressed: _saving
                    ? null
                    : () => setState(() => _swapOpen = open ? null : keyId),
                child: Text(open ? 'Close' : 'Swap food'),
              ),
            ],
          ),
          if (open)
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                if (options.isEmpty)
                  Text(
                    'No other foods fit this slot.',
                    style: AppText.body(size: 11.5, color: AppColors.inkFaint),
                  ),
                for (final o in options)
                  ActionChip(
                    key: ValueKey('opt-${o.food.id}'),
                    label: Text(
                      '${o.food.name} ${q2(o.qty)} x, ${fmtInt(o.kcal)} kcal',
                      style: AppText.body(size: 11.5, weight: FontWeight.w700),
                    ),
                    onPressed: () {
                      _mutate(base, plan, (c) => applySwap(c, si, ii, o));
                      setState(() => _swapOpen = null);
                    },
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({
    required this.tone,
    required this.title,
    required this.lines,
    this.action,
  });

  final Color tone;
  final String title;
  final List<String> lines;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tone.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_rounded, size: 17, color: tone),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          for (final l in lines)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                l,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w600,
                  color: AppColors.inkSoft,
                ),
              ),
            ),
          if (action != null) ...[const SizedBox(height: 8), action!],
        ],
      ),
    );
  }
}
