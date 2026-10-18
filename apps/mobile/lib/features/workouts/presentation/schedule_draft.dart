import '../../../models/exercise.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/workout_plan_repository.dart';

int _seq = 0;

/// One editable row of a weekly schedule: the exercise plus its sets, reps,
/// rest and notes. [key] is a stable identity for reorder / diffing.
class DraftExercise {
  DraftExercise({
    required this.exercise,
    this.sets,
    this.reps,
    this.rest,
    this.notes,
    String? key,
  }) : key = key ?? 'd${_seq++}';

  factory DraftExercise.fromPlan(PlanExercise e) => DraftExercise(
        exercise: e.exercise,
        sets: e.sets,
        reps: e.repetitions,
        rest: e.restSeconds,
        notes: e.notes,
        key: e.id,
      );

  /// A freshly picked library exercise with its own defaults.
  factory DraftExercise.fresh(Exercise e) => DraftExercise(
        exercise: e,
        sets: e.defaultSets,
        reps: e.defaultReps,
        rest: e.restSeconds,
      );

  final String key;
  final Exercise exercise;
  int? sets;
  int? reps;
  int? rest;
  String? notes;

  bool sameAs(DraftExercise o) =>
      exercise.id == o.exercise.id &&
      sets == o.sets &&
      reps == o.reps &&
      rest == o.rest &&
      (notes ?? '').trim() == (o.notes ?? '').trim();
}

/// A plan's whole weekly schedule held in memory while it is edited. Because
/// `PATCH /workout-plans/:id/exercises` replaces the entire array, every save
/// goes through [toDrafts], which always carries every day (and every
/// exercise's rest + notes) - editing one day can never wipe another.
class ScheduleDraft {
  ScheduleDraft(Map<WeekDay, List<DraftExercise>> byDay)
      : byDay = {
          for (final d in WeekDay.values) d: [...?byDay[d]],
        };

  factory ScheduleDraft.fromPlan(WorkoutPlan plan) {
    final grouped = plan.exercisesByDay;
    return ScheduleDraft({
      for (final d in WeekDay.values)
        d: [
          for (final e in grouped[d] ?? const <PlanExercise>[])
            DraftExercise.fromPlan(e),
        ],
    });
  }

  final Map<WeekDay, List<DraftExercise>> byDay;

  List<DraftExercise> day(WeekDay d) => byDay[d]!;

  int countOn(WeekDay d) => byDay[d]!.length;

  int get total => byDay.values.fold(0, (a, l) => a + l.length);

  Map<WeekDay, int> get counts => {
        for (final d in WeekDay.values) d: byDay[d]!.length,
      };

  /// The request body list: day order Monday..Sunday, array order = the sort
  /// order inside a day.
  List<PlanExerciseDraft> toDrafts() => [
        for (final d in WeekDay.values)
          for (final e in byDay[d]!)
            PlanExerciseDraft(
              exerciseId: e.exercise.id,
              dayOfWeek: d,
              sets: e.sets,
              repetitions: e.reps,
              restSeconds: e.rest,
              notes: e.notes,
            ),
      ];

  bool sameAs(ScheduleDraft o) {
    for (final d in WeekDay.values) {
      final a = byDay[d]!;
      final b = o.byDay[d]!;
      if (a.length != b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!a[i].sameAs(b[i])) return false;
      }
    }
    return true;
  }
}
