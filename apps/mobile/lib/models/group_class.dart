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

  Map<String, dynamic> toJson() =>
      {'dayOfWeek': dayOfWeek.apiValue, 'startTime': startTime};
}

/// Mirrors `GroupClassDto` (`POST /classes`) — just the fields the create
/// form collects and echoes back.
class GroupClass {
  const GroupClass({
    required this.id,
    required this.name,
    required this.capacity,
    required this.durationMinutes,
  });

  final String id;
  final String name;
  final int capacity;
  final int durationMinutes;

  factory GroupClass.fromJson(Map<String, dynamic> json) => GroupClass(
        id: json['id'] as String,
        name: json['name'] as String,
        capacity: json['capacity'] as int,
        durationMinutes: json['durationMinutes'] as int,
      );
}
