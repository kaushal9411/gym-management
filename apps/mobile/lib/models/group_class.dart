enum WeekDay { monday, tuesday, wednesday, thursday, friday, saturday, sunday }

extension WeekDayX on WeekDay {
  String get apiValue => switch (this) {
        WeekDay.monday => 'MONDAY',
        WeekDay.tuesday => 'TUESDAY',
        WeekDay.wednesday => 'WEDNESDAY',
        WeekDay.thursday => 'THURSDAY',
        WeekDay.friday => 'FRIDAY',
        WeekDay.saturday => 'SATURDAY',
        WeekDay.sunday => 'SUNDAY',
      };

  String get label => switch (this) {
        WeekDay.monday => 'Mon',
        WeekDay.tuesday => 'Tue',
        WeekDay.wednesday => 'Wed',
        WeekDay.thursday => 'Thu',
        WeekDay.friday => 'Fri',
        WeekDay.saturday => 'Sat',
        WeekDay.sunday => 'Sun',
      };
}

/// One weekly recurring slot — `PATCH /classes/:id/schedule`'s `slots[]`.
class ScheduleSlot {
  const ScheduleSlot({required this.dayOfWeek, required this.startTime});

  final WeekDay dayOfWeek;
  final String startTime;

  factory ScheduleSlot.fromJson(Map<String, dynamic> json) => ScheduleSlot(
        dayOfWeek: WeekDay.values.firstWhere(
          (d) => d.apiValue == json['dayOfWeek'],
          orElse: () => WeekDay.monday,
        ),
        startTime: json['startTime'] as String,
      );

  Map<String, dynamic> toJson() =>
      {'dayOfWeek': dayOfWeek.apiValue, 'startTime': startTime};
}

class ClassTrainer {
  const ClassTrainer({required this.id, required this.name});

  final String id;
  final String name;

  factory ClassTrainer.fromJson(Map<String, dynamic> json) => ClassTrainer(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class ClassBranch {
  const ClassBranch({required this.id, required this.name});

  final String id;
  final String name;

  factory ClassBranch.fromJson(Map<String, dynamic> json) => ClassBranch(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

/// Mirrors `GroupClassDto` (`GET /classes`, `/classes/:id`, `POST /classes`).
class GroupClass {
  const GroupClass({
    required this.id,
    required this.name,
    required this.capacity,
    required this.durationMinutes,
    this.description,
    this.trainer,
    this.branch,
    this.isActive = true,
    this.schedule = const [],
    this.createdAt,
    this.updatedAt,
    this.deletedAt,
  });

  final String id;
  final String name;
  final int capacity;
  final int durationMinutes;
  final String? description;
  final ClassTrainer? trainer;
  final ClassBranch? branch;
  final bool isActive;
  final List<ScheduleSlot> schedule;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Non-null means soft-deleted.
  final DateTime? deletedAt;

  factory GroupClass.fromJson(Map<String, dynamic> json) => GroupClass(
        id: json['id'] as String,
        name: json['name'] as String,
        capacity: json['capacity'] as int,
        durationMinutes: json['durationMinutes'] as int,
        description: json['description'] as String?,
        trainer: json['trainer'] == null
            ? null
            : ClassTrainer.fromJson(json['trainer'] as Map<String, dynamic>),
        branch: json['branch'] == null
            ? null
            : ClassBranch.fromJson(json['branch'] as Map<String, dynamic>),
        isActive: json['isActive'] as bool? ?? true,
        schedule: json['schedule'] == null
            ? const []
            : (json['schedule'] as List)
                .map((e) => ScheduleSlot.fromJson(e as Map<String, dynamic>))
                .toList(),
        createdAt: json['createdAt'] == null
            ? null
            : DateTime.parse(json['createdAt'] as String),
        updatedAt: json['updatedAt'] == null
            ? null
            : DateTime.parse(json['updatedAt'] as String),
        deletedAt: json['deletedAt'] == null
            ? null
            : DateTime.parse(json['deletedAt'] as String),
      );
}
