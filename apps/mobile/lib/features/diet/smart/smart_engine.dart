import '../../../models/diet_plan.dart';

/// Smart Diet Plan engine - a line-for-line port of web's
/// `features/diet/smart/engine.ts` (pure, rule-based, no network): Mifflin-St
/// Jeor BMR x activity (from gym visits) x goal adjustment gives calories;
/// protein / fat / carbs are split by fixed rules; foods are picked by role per
/// meal and the quantities nudged until calories and protein land within
/// tolerance. Same input + same `mix` = same plan. Keep it in sync with web:
/// the numbers must match what a trainer sees on the web planner.

enum DietType { vegan, vegetarian, eggetarian, nonVegetarian }

enum FoodRole {
  protein,
  carb,
  fat,
  vegetable,
  fruit,
  dairy,
  snack,
  supplement,
}

enum Allergen { gluten, lactose, nuts, egg, soy, fish, shellfish }

enum Sex { m, f, o }

enum GoalKey {
  weightLoss,
  muscleBuilding,
  weightGain,
  generalFitness,
  endurance,
  rehabilitation,
  other,
}

GoalKey? goalFromApi(String? v) => switch (v) {
      'WEIGHT_LOSS' => GoalKey.weightLoss,
      'MUSCLE_BUILDING' => GoalKey.muscleBuilding,
      'WEIGHT_GAIN' => GoalKey.weightGain,
      'GENERAL_FITNESS' => GoalKey.generalFitness,
      'ENDURANCE' => GoalKey.endurance,
      'REHABILITATION' => GoalKey.rehabilitation,
      'OTHER' => GoalKey.other,
      _ => null,
    };

DietType? dietTypeFromApi(String? v) => switch (v) {
      'VEGAN' => DietType.vegan,
      'VEGETARIAN' => DietType.vegetarian,
      'EGGETARIAN' => DietType.eggetarian,
      'NON_VEGETARIAN' => DietType.nonVegetarian,
      _ => null,
    };

Sex? sexFromApi(String? v) => switch (v) {
      'MALE' => Sex.m,
      'FEMALE' => Sex.f,
      'OTHER' || 'PREFER_NOT_TO_SAY' => Sex.o,
      _ => null,
    };

class PlannerFood {
  const PlannerFood({
    required this.id,
    required this.name,
    required this.serving,
    required this.kcal,
    required this.p,
    required this.c,
    required this.f,
    required this.sugar,
    required this.sodium,
    required this.diet,
    required this.role,
    required this.meals,
    required this.allergens,
  });

  final String id;
  final String name;
  final String serving;
  final double kcal;
  final double p;
  final double c;
  final double f;
  final double sugar;
  final double sodium;
  final DietType diet;
  final FoodRole role;
  final List<MealType> meals;
  final List<Allergen> allergens;
}

class PlannerMember {
  const PlannerMember({
    this.sex,
    this.dob,
    this.heightCm,
    this.weightKg,
    this.goal,
    this.pref,
    this.allergies = '',
    this.medical = '',
    this.diabetesOrBp = false,
    this.heart = false,
    this.visits28 = 0,
  });

  final Sex? sex;

  /// `YYYY-MM-DD` (a calendar date; a longer ISO string is cut to its date).
  final String? dob;
  final double? heightCm;
  final double? weightKg;
  final GoalKey? goal;
  final DietType? pref;
  final String allergies;
  final String medical;
  final bool diabetesOrBp;
  final bool heart;
  final int visits28;
}

enum MissingField { sex, dob, height, weight, goal, pref }

const missingLabel = {
  MissingField.sex: 'Gender',
  MissingField.dob: 'Date of birth',
  MissingField.height: 'Height',
  MissingField.weight: 'Weight',
  MissingField.goal: 'Fitness goal',
  MissingField.pref: 'Food preference',
};

const slotLabel = {
  MealType.breakfast: 'Breakfast',
  MealType.morningSnack: 'Morning snack',
  MealType.lunch: 'Lunch',
  MealType.eveningSnack: 'Evening snack',
  MealType.dinner: 'Dinner',
  MealType.preWorkout: 'Pre workout',
  MealType.postWorkout: 'Post workout',
};

const _layoutFive = <(MealType, double)>[
  (MealType.breakfast, 0.25),
  (MealType.morningSnack, 0.1),
  (MealType.lunch, 0.3),
  (MealType.eveningSnack, 0.1),
  (MealType.dinner, 0.25),
];
const _layoutFiveWorkout = <(MealType, double)>[
  (MealType.breakfast, 0.22),
  (MealType.preWorkout, 0.1),
  (MealType.lunch, 0.28),
  (MealType.postWorkout, 0.12),
  (MealType.dinner, 0.28),
];

class Component {
  const Component(this.label, this.roles, this.share);

  final String label;
  final List<FoodRole> roles;
  final double share;
}

const _template = <MealType, List<Component>>{
  MealType.breakfast: [
    Component('Protein', [FoodRole.protein, FoodRole.dairy], 0.35),
    Component('Carb', [FoodRole.carb], 0.45),
    Component('Fruit', [FoodRole.fruit], 0.2),
  ],
  MealType.morningSnack: [
    Component('Fruit', [FoodRole.fruit], 0.45),
    Component('Snack', [FoodRole.dairy, FoodRole.snack, FoodRole.fat], 0.55),
  ],
  MealType.lunch: [
    Component('Protein', [FoodRole.protein], 0.34),
    Component('Carb', [FoodRole.carb], 0.4),
    Component('Vegetable', [FoodRole.vegetable], 0.16),
    Component('Fat', [FoodRole.fat], 0.1),
  ],
  MealType.eveningSnack: [
    Component('Snack', [FoodRole.snack, FoodRole.dairy], 0.55),
    Component('Fruit or fat', [FoodRole.fruit, FoodRole.fat], 0.45),
  ],
  MealType.dinner: [
    Component('Protein', [FoodRole.protein], 0.38),
    Component('Carb', [FoodRole.carb], 0.32),
    Component('Vegetable', [FoodRole.vegetable], 0.2),
    Component('Fat', [FoodRole.fat], 0.1),
  ],
  MealType.preWorkout: [
    Component('Carb', [FoodRole.carb], 0.55),
    Component('Fruit', [FoodRole.fruit], 0.45),
  ],
  MealType.postWorkout: [
    Component(
      'Protein',
      [FoodRole.supplement, FoodRole.protein, FoodRole.dairy],
      0.55,
    ),
    Component('Carb', [FoodRole.carb, FoodRole.fruit], 0.45),
  ],
};

class GoalRule {
  const GoalRule(
    this.label,
    this.adj,
    this.p,
    this.fat, {
    this.review = false,
  });

  final String label;
  final double adj;
  final double p;
  final double fat;
  final bool review;
}

const goals = <GoalKey, GoalRule>{
  GoalKey.weightLoss: GoalRule('Weight loss', -0.2, 2.0, 0.25),
  GoalKey.muscleBuilding: GoalRule('Muscle building', 0.1, 2.0, 0.25),
  GoalKey.weightGain: GoalRule('Weight gain', 0.15, 1.6, 0.25),
  GoalKey.generalFitness: GoalRule('General fitness', 0, 1.4, 0.25),
  GoalKey.endurance: GoalRule('Endurance', 0.05, 1.4, 0.2),
  GoalKey.rehabilitation:
      GoalRule('Rehabilitation', 0, 1.6, 0.25, review: true),
  GoalKey.other: GoalRule('Other', 0, 1.4, 0.25),
};

const _activity = <(double, String)>[
  (1.2, 'Sedentary'),
  (1.375, 'Lightly active'),
  (1.55, 'Moderately active'),
  (1.725, 'Very active'),
  (1.9, 'Extra active'),
];

const dietLabel = {
  DietType.vegan: 'Vegan',
  DietType.vegetarian: 'Vegetarian',
  DietType.eggetarian: 'Eggetarian',
  DietType.nonVegetarian: 'Non-veg',
};

// Same insertion order as web's ALLERGY_RX (it decides how the list reads).
final _allergyRx = <Allergen, RegExp>{
  Allergen.lactose: RegExp('lactose|dairy|milk', caseSensitive: false),
  Allergen.egg: RegExp(r'\begg', caseSensitive: false),
  Allergen.nuts: RegExp(
    r'\b(nuts?|peanuts?|almonds?|cashews?|walnuts?)\b',
    caseSensitive: false,
  ),
  Allergen.gluten: RegExp('gluten|celiac|coeliac|wheat', caseSensitive: false),
  Allergen.soy: RegExp(r'\bsoy', caseSensitive: false),
  Allergen.fish: RegExp(r'\bfish\b', caseSensitive: false),
  Allergen.shellfish:
      RegExp('shellfish|prawn|shrimp|crab', caseSensitive: false),
};
final _medDiabetes = RegExp('diabet|blood sugar', caseSensitive: false);
final _medBp = RegExp(
  r'blood pressure|hypertens|\bbp\b',
  caseSensitive: false,
);
final _medHeart = RegExp('heart|cardiac', caseSensitive: false);
final _medKidney = RegExp('kidney|renal', caseSensitive: false);
final _medPregnancy =
    RegExp('pregnan|lactating|breastfeed', caseSensitive: false);

const _allowedDiets = <DietType, List<DietType>>{
  DietType.vegan: [DietType.vegan],
  DietType.vegetarian: [DietType.vegan, DietType.vegetarian],
  DietType.eggetarian: [
    DietType.vegan,
    DietType.vegetarian,
    DietType.eggetarian,
  ],
  DietType.nonVegetarian: [
    DietType.vegan,
    DietType.vegetarian,
    DietType.eggetarian,
    DietType.nonVegetarian,
  ],
};

/// JS `Math.round`: halves go up (Dart's `round()` goes away from zero).
double _jsRound(double x) => (x + 0.5).floorToDouble();

double _step(double n, double s) => _jsRound(n / s) * s;
double _r025(double q) => _jsRound(q * 4) / 4;
double _clamp(double n, double a, double b) => n < a ? a : (n > b ? b : n);

/// Age in whole years on [now] from a `YYYY-MM-DD` date; null when unparsable.
int? ageOf(String? dob, {DateTime? now}) {
  if (dob == null || dob.length < 10) return null;
  final y = int.tryParse(dob.substring(0, 4));
  final m = int.tryParse(dob.substring(5, 7));
  final d = int.tryParse(dob.substring(8, 10));
  if (y == null || m == null || d == null) return null;
  final n = now ?? DateTime.now();
  var age = n.year - y;
  if (n.month < m || (n.month == m && n.day < d)) age--;
  return age;
}

(double, String) _activityFor(int visitsPerWeek) {
  if (visitsPerWeek <= 1) return _activity[0];
  if (visitsPerWeek == 2) return _activity[1];
  if (visitsPerWeek <= 4) return _activity[2];
  if (visitsPerWeek <= 6) return _activity[3];
  return _activity[4];
}

List<MissingField> missingFields(PlannerMember m) {
  return [
    if (m.sex == null) MissingField.sex,
    if (m.dob == null || ageOf(m.dob) == null) MissingField.dob,
    if (m.heightCm == null || m.heightCm == 0) MissingField.height,
    if (m.weightKg == null || m.weightKg == 0) MissingField.weight,
    if (m.goal == null) MissingField.goal,
    if (m.pref == null) MissingField.pref,
  ];
}

class Targets {
  const Targets({
    required this.age,
    required this.bmr,
    required this.vpw,
    required this.actLabel,
    required this.actMult,
    required this.tdee,
    required this.raw,
    required this.kcal,
    required this.p,
    required this.c,
    required this.f,
    required this.floor,
    required this.floored,
    required this.pCapped,
    required this.goal,
    required this.bmi,
  });

  final int age;
  final double bmr;
  final int vpw;
  final String actLabel;
  final double actMult;
  final double tdee;
  final double raw;
  final double kcal;
  final double p;
  final double c;
  final double f;
  final double floor;
  final bool floored;
  final bool pCapped;
  final GoalRule goal;
  final double bmi;
}

double _scOf(Sex s) => switch (s) {
      Sex.m => 5,
      Sex.f => -161,
      Sex.o => -78,
    };

Targets _targets(PlannerMember m, DateTime? now) {
  final g = goals[m.goal!]!;
  final age = ageOf(m.dob, now: now) ?? 30;
  final sc = _scOf(m.sex!);
  final weight = m.weightKg!;
  final height = m.heightCm!;
  final bmr = 10 * weight + 6.25 * height - 5 * age + sc;
  final vpw = _jsRound(m.visits28 / 4).toInt();
  final act = _activityFor(vpw);
  final tdee = bmr * act.$1;
  final raw = tdee * (1 + g.adj);
  final floor = m.sex == Sex.m ? 1500.0 : 1200.0;
  final floored = raw < floor;
  final kcal = _step(raw > floor ? raw : floor, 10);
  final pRaw = (g.p < 2.5 ? g.p : 2.5) * weight;
  final pCap = (0.3 * kcal) / 4;
  final p = _step(pRaw < pCap ? pRaw : pCap, 5);
  final fRaw = (g.fat * kcal) / 9;
  final f = _step(fRaw > 0.6 * weight ? fRaw : 0.6 * weight, 5);
  final cRaw = _step((kcal - p * 4 - f * 9) / 4, 5);
  final c = cRaw > 0 ? cRaw : 0.0;
  final hm = height / 100;
  return Targets(
    age: age,
    bmr: bmr,
    vpw: vpw,
    actLabel: act.$2,
    actMult: act.$1,
    tdee: tdee,
    raw: raw,
    kcal: kcal,
    p: p,
    c: c,
    f: f,
    floor: floor,
    floored: floored,
    pCapped: pRaw > pCap,
    goal: g,
    bmi: weight / (hm * hm),
  );
}

class _Safety {
  _Safety(this.blocks, this.review, this.allergens, this.diabetes, this.sodium);

  final List<String> blocks;
  final List<String> review;
  final List<Allergen> allergens;
  final bool diabetes;
  final bool sodium;
}

_Safety _safety(PlannerMember m, Targets t) {
  final blocks = <String>[];
  final review = <String>[];
  final allergens = <Allergen>[];
  var diabetes = false;
  var sodium = false;
  if (t.age < 18) {
    blocks.add(
      'Under 18. Automatic plans are not offered for minors, so a trainer '
      'should build this plan by hand.',
    );
  }
  if (t.bmi < 18.5 && m.goal == GoalKey.weightLoss) {
    blocks.add(
      'BMI is ${t.bmi.toStringAsFixed(1)}, under 18.5, so a calorie deficit '
      'is not offered.',
    );
  }
  final text = m.medical;
  if (_medDiabetes.hasMatch(text) || m.diabetesOrBp) {
    diabetes = true;
    review.add(
      'Diabetes noted. Sugary foods are down-weighted and daily sugar is '
      'checked against 10% of calories.',
    );
  }
  if (_medBp.hasMatch(text) ||
      _medHeart.hasMatch(text) ||
      m.heart ||
      m.diabetesOrBp) {
    sodium = true;
    review.add(
      'Blood pressure or heart condition noted. High-sodium foods are '
      'down-weighted and daily sodium is checked against 2,000 mg.',
    );
  }
  if (_medKidney.hasMatch(text)) {
    review.add(
      'Kidney condition noted. A trainer or doctor must review protein before '
      'this plan is used.',
    );
  }
  if (_medPregnancy.hasMatch(text)) {
    review.add(
      'Pregnancy or breastfeeding noted. A doctor or dietitian must review '
      'this draft before use.',
    );
  }
  if (t.age >= 65) {
    review.add('Age 65 or older. A trainer must review this draft.');
  }
  if (t.goal.review) {
    review.add('Rehabilitation goals are always held for trainer review.');
  }
  _allergyRx.forEach((k, rx) {
    if (rx.hasMatch(m.allergies)) allergens.add(k);
  });
  return _Safety(blocks, review, allergens, diabetes, sodium);
}

/// FNV-1a over UTF-16 code units, as 32 unsigned bits (web: `Math.imul`).
int _hash(String s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) {
    h ^= s.codeUnitAt(i);
    h = (h * 16777619) & 0xFFFFFFFF;
  }
  return h;
}

int _pickRank(int seed, String key, int n) {
  if (seed == 0 || n < 2) return 0;
  final r = (_hash('$seed|$key') % 1000) / 1000;
  final w = const [0.5, 0.3, 0.2].take(n).toList();
  final tot = w.fold<double>(0, (a, x) => a + x);
  var acc = 0.0;
  for (var i = 0; i < w.length; i++) {
    acc += w[i] / tot;
    if (r < acc) return i;
  }
  return n - 1;
}

class PlanContext {
  PlanContext({
    required this.diets,
    required this.allergens,
    required this.used,
    required this.diabetes,
    required this.sodium,
    required this.seed,
  });

  final List<DietType> diets;
  final List<Allergen> allergens;
  final Map<String, int> used;
  final bool diabetes;
  final bool sodium;
  final int seed;

  PlanContext copyWith({Map<String, int>? used, int? seed}) => PlanContext(
        diets: diets,
        allergens: allergens,
        used: used ?? this.used,
        diabetes: diabetes,
        sodium: sodium,
        seed: seed ?? this.seed,
      );
}

bool _allowedFood(PlannerFood f, PlanContext ctx) =>
    ctx.diets.contains(f.diet) && !f.allergens.any(ctx.allergens.contains);

List<PlannerFood> _slotCandidates(
  List<PlannerFood> catalog,
  MealType slot,
  List<FoodRole> roles,
  PlanContext ctx,
) =>
    catalog
        .where(
          (f) =>
              _allowedFood(f, ctx) &&
              roles.contains(f.role) &&
              f.meals.contains(slot),
        )
        .toList();

List<FoodRole> _roleCoverage(List<PlannerFood> catalog, PlanContext ctx) {
  final have = <FoodRole>{};
  for (final f in catalog) {
    if (_allowedFood(f, ctx)) have.add(f.role);
  }
  return const [
    FoodRole.protein,
    FoodRole.carb,
    FoodRole.vegetable,
    FoodRole.fruit,
    FoodRole.fat,
  ].where((r) => !have.contains(r)).toList();
}

double _scoreFood(PlannerFood f, PlanContext ctx) {
  final kc = f.kcal == 0 ? 1.0 : f.kcal;
  final pd = (f.p * 4) / kc;
  final cd = (f.c * 4) / kc;
  final fd = (f.f * 9) / kc;
  double fit;
  switch (f.role) {
    case FoodRole.protein:
    case FoodRole.supplement:
    case FoodRole.dairy:
    case FoodRole.snack:
      fit = pd / 0.8 < 1 ? pd / 0.8 : 1;
    case FoodRole.carb:
      fit = cd / 0.9 < 1 ? cd / 0.9 : 1;
    case FoodRole.fat:
      fit = fd / 0.9 < 1 ? fd / 0.9 : 1;
    case FoodRole.vegetable:
      fit = 1 - kc / 200 > 0 ? 1 - kc / 200 : 0;
    case FoodRole.fruit:
      fit = 0.6;
  }
  final variety = 1 / (1 + 1.5 * (ctx.used[f.id] ?? 0));
  var pen = 0.0;
  if (ctx.diabetes) pen += f.sugar / 40 < 0.5 ? f.sugar / 40 : 0.5;
  if (ctx.sodium) pen += f.sodium / 1200 < 0.5 ? f.sodium / 1200 : 0.5;
  return 0.5 * fit + 0.3 * variety - pen;
}

int Function(PlannerFood, PlannerFood) _byScore(PlanContext ctx) => (a, b) {
      final d = _scoreFood(b, ctx) - _scoreFood(a, ctx);
      if (d != 0) return d < 0 ? -1 : 1;
      return a.id.compareTo(b.id) < 0 ? -1 : 1;
    };

/// Stable sort (Dart's `List.sort` is not guaranteed to be).
List<T> _stableSort<T>(Iterable<T> items, int Function(T, T) compare) {
  final indexed = [
    for (final e in items.indexed) (e.$1, e.$2),
  ];
  indexed.sort((a, b) {
    final c = compare(a.$2, b.$2);
    return c != 0 ? c : a.$1.compareTo(b.$1);
  });
  return [for (final e in indexed) e.$2];
}

class PlanItem {
  PlanItem({
    required this.foodId,
    required this.name,
    required this.serving,
    required this.role,
    required this.compLabel,
    required this.roles,
    required this.k,
    required this.p,
    required this.c,
    required this.f,
    required this.sugar,
    required this.sodium,
    required this.qty,
    required this.edited,
  });

  final String foodId;
  final String name;
  final String serving;
  final FoodRole role;
  final String compLabel;
  final List<FoodRole> roles;
  final double k;
  final double p;
  final double c;
  final double f;
  final double sugar;
  final double sodium;
  double qty;
  bool edited;

  PlanItem copy() => PlanItem(
        foodId: foodId,
        name: name,
        serving: serving,
        role: role,
        compLabel: compLabel,
        roles: roles,
        k: k,
        p: p,
        c: c,
        f: f,
        sugar: sugar,
        sodium: sodium,
        qty: qty,
        edited: edited,
      );
}

class PlanSlot {
  PlanSlot(this.type, this.label, this.items);

  final MealType type;
  final String label;
  final List<PlanItem> items;
}

class Plan {
  Plan({
    required this.t,
    required this.review,
    required this.slots,
    required this.notes,
    required this.explain,
    required this.ctx,
    required this.mix,
  });

  final Targets t;
  final List<String> review;
  final List<PlanSlot> slots;
  final List<String> notes;
  List<String> explain;
  final PlanContext ctx;
  final int mix;

  /// A deep copy, so the editor can change quantities without touching the
  /// generated plan it was derived from.
  Plan copy() => Plan(
        t: t,
        review: review,
        slots: [
          for (final s in slots)
            PlanSlot(s.type, s.label, [for (final i in s.items) i.copy()]),
        ],
        notes: [...notes],
        explain: explain,
        ctx: ctx,
        mix: mix,
      );
}

(double, double) qtyRange(PlanItem it) =>
    it.role == FoodRole.supplement ? (0.5, 2.0) : (0.5, 4.0);

PlanItem _makeItem(
  PlannerFood f,
  String label,
  List<FoodRole> roles,
  double qty,
  bool edited,
) =>
    PlanItem(
      foodId: f.id,
      name: f.name,
      serving: f.serving,
      role: f.role,
      compLabel: label,
      roles: roles,
      k: f.kcal,
      p: f.p,
      c: f.c,
      f: f.f,
      sugar: f.sugar,
      sodium: f.sodium,
      qty: qty,
      edited: edited,
    );

class Totals {
  Totals(this.kcal, this.p, this.c, this.f, this.sugar, this.sodium);

  final double kcal;
  final double p;
  final double c;
  final double f;
  final double sugar;
  final double sodium;
}

List<PlanItem> _allItems(Plan plan) => [for (final s in plan.slots) ...s.items];

Totals totals(Plan plan) {
  var kcal = 0.0, p = 0.0, c = 0.0, f = 0.0, sugar = 0.0, sodium = 0.0;
  for (final it in _allItems(plan)) {
    kcal += it.k * it.qty;
    p += it.p * it.qty;
    c += it.c * it.qty;
    f += it.f * it.qty;
    sugar += it.sugar * it.qty;
    sodium += it.sodium * it.qty;
  }
  return Totals(kcal, p, c, f, sugar, sodium);
}

bool _proteinish(PlanItem it) =>
    it.role == FoodRole.protein ||
    it.role == FoodRole.supplement ||
    it.role == FoodRole.dairy;

double _pdens(PlanItem it) => (it.p * 4) / it.k;

PlanItem? _best(
  List<PlanItem> items,
  bool Function(PlanItem) pred,
  double Function(PlanItem) score,
) {
  PlanItem? b;
  var bs = double.negativeInfinity;
  for (final it in items) {
    if (!pred(it)) continue;
    final s = score(it);
    if (s > bs) {
      bs = s;
      b = it;
    }
  }
  return b;
}

void _rebalance(Plan plan) {
  final t = plan.t;
  bool grow(PlanItem it) =>
      !it.edited &&
      it.role != FoodRole.supplement &&
      it.qty + 0.25 <= qtyRange(it).$2;
  bool lean(PlanItem it) =>
      it.role == FoodRole.carb ||
      it.role == FoodRole.fat ||
      it.role == FoodRole.fruit ||
      it.role == FoodRole.vegetable;
  bool canCut(PlanItem it) => !it.edited && it.qty - 0.25 >= qtyRange(it).$1;
  for (var n = 0; n < 140; n++) {
    final tot = totals(plan);
    final items = _allItems(plan);
    final kOK = (tot.kcal - t.kcal).abs() <= 0.05 * t.kcal;
    final pOK = tot.p >= 0.95 * t.p;
    final pHigh = tot.p > 1.15 * t.p;
    final fOK = tot.f >= 0.8 * t.f;
    if (kOK && pOK && !pHigh && fOK) return;
    var acted = false;
    if (!pOK) {
      final up = _best(
        items,
        (it) =>
            !it.edited && _proteinish(it) && it.qty + 0.25 <= qtyRange(it).$2,
        _pdens,
      );
      if (up != null) {
        up.qty += 0.25;
        acted = true;
        if (totals(plan).kcal > t.kcal * 1.03) {
          final dn = _best(
            _allItems(plan),
            (it) =>
                canCut(it) &&
                (it.role == FoodRole.carb ||
                    it.role == FoodRole.fat ||
                    it.role == FoodRole.fruit),
            (it) => -_pdens(it) * 1000 + (it.k * it.qty) / 1000,
          );
          if (dn != null) dn.qty -= 0.25;
        }
      }
    }
    if (!acted && tot.kcal > t.kcal * 1.05) {
      final d = _best(
        items,
        (it) =>
            canCut(it) &&
            (it.role == FoodRole.carb ||
                it.role == FoodRole.fat ||
                it.role == FoodRole.fruit ||
                it.role == FoodRole.snack),
        (it) => it.k * it.qty,
      );
      if (d != null) {
        d.qty -= 0.25;
        acted = true;
      }
    }
    if (!acted && tot.kcal < t.kcal * 0.95) {
      var u =
          _best(items, (it) => grow(it) && lean(it), (it) => -it.k * it.qty);
      if (u == null && !pHigh) {
        u = _best(items, grow, (it) => -it.k * it.qty);
      }
      if (u != null) {
        u.qty += 0.25;
        acted = true;
      }
    }
    if (!acted && pHigh) {
      var d = _best(
        items,
        (it) => canCut(it) && _proteinish(it),
        (it) => it.p * it.qty,
      );
      d ??= _best(items, (it) => canCut(it) && it.p > 0, (it) => it.p * it.qty);
      if (d != null) {
        d.qty -= 0.25;
        acted = true;
        if (totals(plan).kcal < t.kcal * 0.98) {
          final g = _best(
            _allItems(plan),
            (it) => grow(it) && lean(it),
            (it) => -it.k * it.qty,
          );
          if (g != null) g.qty += 0.25;
        }
      }
    }
    if (!acted && !fOK) {
      final g = _best(
        items,
        (it) => grow(it) && it.role == FoodRole.fat,
        (it) => (it.f * 9) / it.k,
      );
      if (g != null) {
        g.qty += 0.25;
        acted = true;
        if (totals(plan).kcal > t.kcal * 1.02) {
          final d = _best(
            _allItems(plan),
            (it) => canCut(it) && it.role == FoodRole.carb,
            (it) => it.k * it.qty,
          );
          if (d != null) d.qty -= 0.25;
        }
      }
    }
    if (!acted) return;
  }
}

void _topUp(Plan plan, List<PlannerFood> catalog) {
  if (totals(plan).p >= 0.95 * plan.t.p) return;
  final inPlan = _allItems(plan).map((it) => it.foodId).toSet();
  const order = [
    MealType.postWorkout,
    MealType.eveningSnack,
    MealType.morningSnack,
  ];
  for (final type in order) {
    PlanSlot? slot;
    for (final s in plan.slots) {
      if (s.type == type) slot = s;
    }
    if (slot == null) continue;
    final c = _stableSort(
      _slotCandidates(catalog, type, const [FoodRole.supplement], plan.ctx)
          .where((f) => !inPlan.contains(f.id)),
      (a, b) {
        final d = b.p / b.kcal - a.p / a.kcal;
        return d == 0 ? 0 : (d < 0 ? -1 : 1);
      },
    );
    if (c.isEmpty) continue;
    final pick = c.first;
    slot.items.add(
      _makeItem(pick, 'Protein top-up', const [FoodRole.supplement], 1, false),
    );
    plan.notes.add(
      'Added ${pick.name} to ${slot.label} to reach the protein target.',
    );
    _rebalance(plan);
    return;
  }
}

sealed class GenerateResult {
  const GenerateResult();
}

class GenerateMissing extends GenerateResult {
  const GenerateMissing(this.missing);

  final List<MissingField> missing;
}

class GenerateBlocked extends GenerateResult {
  const GenerateBlocked(this.blocks);

  final List<String> blocks;
}

class GenerateCatalog extends GenerateResult {
  const GenerateCatalog(this.gaps);

  final List<FoodRole> gaps;
}

class GenerateOk extends GenerateResult {
  const GenerateOk(this.plan);

  final Plan plan;
}

/// `Math.round(n).toLocaleString('en-US')`.
String fmtInt(double n) {
  final s = _jsRound(n).toInt().abs().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(',');
    b.write(s[i]);
  }
  return (n < 0 && _jsRound(n) != 0 ? '-' : '') + b.toString();
}

/// JS `String(+n.toFixed(2))`: at most two decimals, no trailing zeros.
String q2(double n) {
  var s = n.toStringAsFixed(2);
  if (s.contains('.')) {
    s = s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
  }
  return s;
}

/// JS number-to-string: the shortest form, no trailing ".0".
String numStr(double n) =>
    n == n.roundToDouble() ? n.toInt().toString() : n.toString();

List<String> _explainLines(Plan plan, PlannerMember m) {
  final t = plan.t;
  final g = t.goal;
  final sc = _scOf(m.sex!);
  final al = plan.ctx.allergens.map((a) => a.name).toList();
  return [
    'BMR = 10 x ${numStr(m.weightKg!)} + 6.25 x ${numStr(m.heightCm!)} - 5 x ${t.age} '
        '${sc >= 0 ? '+' : '-'} ${sc.abs().toInt()} = ${fmtInt(t.bmr)} kcal',
    'Activity x${numStr(t.actMult)} (${t.actLabel}, ${t.vpw} visits a week) gives '
        '${fmtInt(t.tdee)} kcal',
    'Goal ${g.label.toLowerCase()} ${g.adj >= 0 ? '+' : '-'}'
        '${_jsRound(g.adj.abs() * 100).toInt()}% gives ${fmtInt(t.raw)} kcal'
        '${t.floored ? ', raised to the ${fmtInt(t.floor)} kcal floor' : ''}, '
        'rounded to ${fmtInt(t.kcal)}',
    'Protein ${numStr(t.p)} g'
        '${t.pCapped ? ' (capped at 30% of calories)' : ' (${g.p.toStringAsFixed(1)} g per kg)'}'
        ', fat ${numStr(t.f)} g, carbohydrate ${numStr(t.c)} g from the remaining '
        'calories',
    'Foods allowed: ${_allowedDiets[m.pref!]!.map((d) => dietLabel[d]!.toLowerCase()).join(', ')}. '
        'Excluded for allergens: ${al.isEmpty ? 'none' : al.join(', ')}',
    ...plan.notes,
  ];
}

GenerateResult generate(
  PlannerMember m,
  List<PlannerFood> catalog, {
  int mix = 0,
  DateTime? now,
}) {
  final miss = missingFields(m);
  if (miss.isNotEmpty) return GenerateMissing(miss);
  final t = _targets(m, now);
  final s = _safety(m, t);
  if (s.blocks.isNotEmpty) return GenerateBlocked(s.blocks);
  final ctx = PlanContext(
    diets: _allowedDiets[m.pref!]!,
    allergens: s.allergens,
    used: {},
    diabetes: s.diabetes,
    sodium: s.sodium,
    seed: mix,
  );
  final gaps = _roleCoverage(catalog, ctx);
  if (gaps.isNotEmpty) return GenerateCatalog(gaps);
  final layout = t.vpw >= 3 ? _layoutFiveWorkout : _layoutFive;
  final slots = [
    for (final e in layout) PlanSlot(e.$1, slotLabel[e.$1]!, []),
  ];
  final kcalOf = <double>[];
  var used = 0.0;
  for (var i = 0; i < layout.length; i++) {
    final kc =
        i < layout.length - 1 ? _step(t.kcal * layout[i].$2, 5) : t.kcal - used;
    used += kc;
    kcalOf.add(kc);
  }
  for (var si = 0; si < slots.length; si++) {
    final slot = slots[si];
    for (final comp in _template[slot.type]!) {
      final cands = _slotCandidates(catalog, slot.type, comp.roles, ctx)
          .where((f) => !slot.items.any((it) => it.foodId == f.id))
          .toList();
      if (cands.isEmpty) continue;
      final top =
          _stableSort(cands, _byScore(ctx)).take(3).toList(growable: false);
      final f = top[_pickRank(
        ctx.seed,
        '${slot.type.apiValue}|${comp.label}',
        top.length,
      )];
      final b = f.role == FoodRole.supplement ? (0.5, 2.0) : (0.5, 4.0);
      final qty = _clamp(_r025((comp.share * kcalOf[si]) / f.kcal), b.$1, b.$2);
      ctx.used[f.id] = (ctx.used[f.id] ?? 0) + 1;
      slot.items.add(_makeItem(f, comp.label, comp.roles, qty, false));
    }
  }
  final plan = Plan(
    t: t,
    review: s.review,
    slots: slots,
    notes: [],
    explain: [],
    ctx: ctx,
    mix: mix,
  );
  _rebalance(plan);
  _topUp(plan, catalog);
  plan.explain = _explainLines(plan, m);
  return GenerateOk(plan);
}

List<String> warnings(Plan plan) {
  final tot = totals(plan);
  final t = plan.t;
  final w = <String>[];
  final pPct = tot.p / t.p;
  final kPct = tot.kcal / t.kcal;
  if (pPct < 0.95) {
    w.add(
      'Protein is ${_jsRound(pPct * 100).toInt()}% of target with the foods '
      'allowed for this member. Add more protein foods to the food library.',
    );
  }
  if (pPct > 1.2) {
    w.add(
      'Protein is ${_jsRound(pPct * 100).toInt()}% of target. The foods '
      'allowed for this member are protein-dense, so this is as low as the '
      'planner can go.',
    );
  }
  if ((kPct - 1).abs() > 0.05) {
    w.add(
      'Calories are ${_jsRound(kPct * 100).toInt()}% of target, outside the '
      '5% tolerance.',
    );
  }
  if (plan.ctx.diabetes && tot.sugar > (0.1 * tot.kcal) / 4) {
    w.add(
      'Sugar from these foods is ${_jsRound(tot.sugar).toInt()} g, above the '
      'guide of ${_jsRound((0.1 * tot.kcal) / 4).toInt()} g (10% of calories).',
    );
  }
  if (plan.ctx.sodium && tot.sodium > 2000) {
    w.add(
      'Sodium from these foods is ${fmtInt(tot.sodium)} mg, above 2,000 mg.',
    );
  }
  return w;
}

class SwapOption {
  const SwapOption(this.food, this.qty, this.kcal);

  final PlannerFood food;
  final double qty;
  final double kcal;
}

List<SwapOption> swapOptions(
  Plan plan,
  int si,
  int ii,
  List<PlannerFood> catalog,
) {
  final slot = plan.slots[si];
  final it = slot.items[ii];
  final inSlot = slot.items.map((x) => x.foodId).toSet();
  final used = <String, int>{};
  for (final x in _allItems(plan)) {
    used[x.foodId] = (used[x.foodId] ?? 0) + 1;
  }
  final ctx = plan.ctx.copyWith(used: used, seed: 0);
  final cands = _slotCandidates(catalog, slot.type, it.roles, ctx)
      .where((f) => !inSlot.contains(f.id))
      .toList();
  return [
    for (final food in _stableSort(cands, _byScore(ctx)).take(6))
      () {
        final b = food.role == FoodRole.supplement ? (0.5, 2.0) : (0.5, 4.0);
        final qty = _clamp(_r025((it.k * it.qty) / food.kcal), b.$1, b.$2);
        return SwapOption(food, qty, food.kcal * qty);
      }(),
  ];
}

/// Mutates the plan: puts the chosen food in place and re-balances the foods
/// the trainer has not touched.
void applySwap(Plan plan, int si, int ii, SwapOption opt) {
  final old = plan.slots[si].items[ii];
  plan.slots[si].items[ii] =
      _makeItem(opt.food, old.compLabel, old.roles, opt.qty, true);
  _rebalance(plan);
}

/// Mutates the plan: sets a quantity by hand and re-balances the foods the
/// trainer has not touched.
void setQty(Plan plan, int si, int ii, double qty) {
  final it = plan.slots[si].items[ii];
  final b = qtyRange(it);
  it.qty = _clamp(qty, b.$1, b.$2);
  it.edited = true;
}
