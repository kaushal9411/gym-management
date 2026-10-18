import '../../../core/di/service_locator.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/body_measurement.dart';
import '../../../models/food.dart';
import '../../../models/gym_member.dart';
import '../../../models/paginated_result.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/member_repository.dart';
import 'smart_engine.dart';
import 'starter_foods.dart';

/// What the planner needs about one member, from existing endpoints only
/// (web's `useSmartMemberInput`): the profile, the latest body measurement and
/// the last 28 days of attendance.
class SmartMemberInput {
  const SmartMemberInput({
    required this.member,
    required this.name,
    required this.memberCode,
    required this.weightSource,
    required this.memberId,
  });

  final PlannerMember member;
  final String name;
  final String memberCode;
  final String memberId;

  /// "Latest measurement, 03 Oct" / "Member profile" / '' when unknown.
  final String weightSource;
}

double? _pos(num? v) => v != null && v > 0 ? v.toDouble() : null;

const _months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String dayMonth(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')} ${_months[d.month - 1]}';

/// Pure mapping (unit-tested): profile + measurements + visit count ->
/// planner input. Newest measurement with a positive value wins; the member
/// profile is the fallback for height and weight.
SmartMemberInput buildSmartInput({
  required GymMember member,
  required List<BodyMeasurement> measurements,
  required List<DateTime> visitTimes,
  DateTime? now,
}) {
  final n = now ?? DateTime.now();
  final sorted = [...measurements]
    ..sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
  BodyMeasurement? withWeight;
  BodyMeasurement? withHeight;
  for (final m in sorted) {
    if (withWeight == null && _pos(m.weightKg) != null) withWeight = m;
    if (withHeight == null && _pos(m.heightCm) != null) withHeight = m;
  }
  final cutoff = n.subtract(const Duration(days: 28));
  final visits28 = visitTimes.where((t) => !t.isBefore(cutoff)).length;
  final weight = _pos(withWeight?.weightKg) ?? _pos(member.weight);
  final dob = member.dateOfBirth;
  return SmartMemberInput(
    memberId: member.id,
    name: member.name,
    memberCode: member.memberId,
    weightSource: withWeight != null
        ? 'Latest measurement, ${dayMonth(withWeight.recordedAt.toLocal())}'
        : (weight != null ? 'Member profile' : ''),
    member: PlannerMember(
      sex: sexFromApi(member.gender),
      dob: dob != null && dob.length >= 10 ? dob.substring(0, 10) : null,
      heightCm: _pos(withHeight?.heightCm) ?? _pos(member.height),
      weightKg: weight,
      goal: goalFromApi(member.goal),
      pref: dietTypeFromApi(member.foodPreference),
      allergies: member.allergies ?? '',
      medical: [member.medicalConditions, member.healthScreeningOtherDetails]
          .where((s) => s != null && s.isNotEmpty)
          .join('. '),
      diabetesOrBp: member.healthFlags['Diabetes / BP'] ?? false,
      heart: member.healthFlags['Heart condition'] ?? false,
      visits28: visits28,
    ),
  );
}

/// Loads the three sources for [memberId]. Any failure is thrown to the
/// caller (web shows "Could not load this member" rather than planning from
/// partial data).
Future<SmartMemberInput> loadSmartInput(String memberId) async {
  final results = await Future.wait<Object>([
    getIt<MemberRepository>().getById(memberId),
    getIt<BodyMeasurementRepository>().listForMember(memberId),
    getIt<AttendanceRepository>().getMemberAttendance(
      memberId,
      limit: 100,
    ),
  ]);
  final member = results[0] as GymMember;
  final measurements = results[1] as List<BodyMeasurement>;
  final attendance = results[2] as PaginatedResult<AttendanceRecord>;
  final visits = <DateTime>[
    for (final r in attendance.items) r.checkInTime,
  ];
  return buildSmartInput(
    member: member,
    measurements: measurements,
    visitTimes: visits,
  );
}

final _starterByName = {
  for (final s in starterFoods) s.name.toLowerCase(): s,
};

/// The tenant's foods the planner knows how to use (matched by name against
/// the starter tags); everything else is ignored.
List<PlannerFood> toPlannerFoods(List<Food> foods) {
  final out = <PlannerFood>[];
  for (final f in foods) {
    final tag = _starterByName[f.name.trim().toLowerCase()];
    if (tag == null) continue;
    out.add(
      PlannerFood(
        id: f.id,
        name: f.name,
        serving: (f.servingSize ?? '').isEmpty ? tag.serving : f.servingSize!,
        kcal: _pos(f.calories) ?? tag.kcal.toDouble(),
        p: _pos(f.protein) ?? tag.p,
        c: _pos(f.carbohydrates) ?? tag.c,
        f: _pos(f.fat) ?? tag.f,
        sugar: _pos(f.sugar) ?? tag.sugar,
        sodium: _pos(f.sodium) ?? tag.sodium,
        diet: tag.diet,
        role: tag.role,
        meals: tag.meals,
        allergens: tag.allergens,
      ),
    );
  }
  return out;
}
