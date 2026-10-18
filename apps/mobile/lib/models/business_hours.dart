/// One weekday of the gym's opening hours (`businessHours.<day>` on
/// `GET /settings/profile`): `open` / `close` are `HH:MM` (24-hour) strings,
/// null while closed.
class BusinessHoursDay {
  const BusinessHoursDay({this.open, this.close, this.closed = false});

  final String? open;
  final String? close;
  final bool closed;

  factory BusinessHoursDay.fromJson(Map<String, dynamic> j) => BusinessHoursDay(
        open: j['open'] as String?,
        close: j['close'] as String?,
        closed: j['closed'] == true,
      );

  Map<String, dynamic> toJson() => {
        'open': closed ? null : open,
        'close': closed ? null : close,
        'closed': closed,
      };

  BusinessHoursDay copyWith({String? open, String? close, bool? closed}) =>
      BusinessHoursDay(
        open: open ?? this.open,
        close: close ?? this.close,
        closed: closed ?? this.closed,
      );

  /// Hours open this day (0 when closed or incomplete / inverted).
  double get hours {
    if (closed) return 0;
    final a = _minutes(open);
    final b = _minutes(close);
    if (a == null || b == null || b <= a) return 0;
    return (b - a) / 60;
  }

  static int? _minutes(String? hhmm) {
    if (hhmm == null) return null;
    final p = hhmm.split(':');
    if (p.length < 2) return null;
    final h = int.tryParse(p[0]);
    final m = int.tryParse(p[1]);
    if (h == null || m == null) return null;
    return h * 60 + m;
  }
}

/// Web's `Weekday` keys, Monday first.
const kWeekdays = <String>[
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/// The whole week (`PATCH /settings/profile/business-hours` replaces it).
class BusinessHours {
  const BusinessHours([this.days = const {}]);

  final Map<String, BusinessHoursDay> days;

  BusinessHoursDay? operator [](String day) => days[day];

  factory BusinessHours.fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return const BusinessHours();
    return BusinessHours({
      for (final d in kWeekdays)
        if (json[d] is Map<String, dynamic>)
          d: BusinessHoursDay.fromJson(json[d] as Map<String, dynamic>),
    });
  }

  Map<String, dynamic> toJson() => {
        for (final e in days.entries) e.key: e.value.toJson(),
      };

  BusinessHours withDay(String day, BusinessHoursDay value) =>
      BusinessHours({...days, day: value});

  /// Days that are not marked closed.
  int get openDays =>
      kWeekdays.where((d) => days[d] != null && !days[d]!.closed).length;

  double get weeklyHours => days.values.fold<double>(0, (s, d) => s + d.hours);

  @override
  bool operator ==(Object other) =>
      other is BusinessHours &&
      other.days.length == days.length &&
      days.entries.every(
        (e) =>
            other.days[e.key]?.open == e.value.open &&
            other.days[e.key]?.close == e.value.close &&
            other.days[e.key]?.closed == e.value.closed,
      );

  @override
  int get hashCode => Object.hashAll(
        days.entries.map(
          (e) =>
              Object.hash(e.key, e.value.open, e.value.close, e.value.closed),
        ),
      );
}
