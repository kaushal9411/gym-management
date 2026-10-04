import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap, jsonMoney;

/// Mirrors `MemberOverviewDto` (`GET /portal/overview`, member token). Money
/// arrives as decimal STRINGS; every block parses defensively (a missing
/// block degrades to empty/null instead of throwing) and nullable server
/// fields stay nullable here — never defaulted to a fake 0.
String? _str(Object? v) => v is String && v.isNotEmpty ? v : null;

int? _intOrNull(Object? v) => v is num ? v.toInt() : null;

double? _moneyOrNull(Object? v) =>
    v is num ? v.toDouble() : (v is String ? double.tryParse(v) : null);

class OverviewMember {
  const OverviewMember({
    required this.id,
    required this.memberId,
    required this.name,
    required this.photoUrl,
    required this.joiningDate,
    required this.branchName,
    required this.trainerName,
  });

  final String id;
  final String memberId;
  final String name;
  final String? photoUrl;
  final String joiningDate;
  final String? branchName;
  final String? trainerName;

  factory OverviewMember.fromJson(Map<String, dynamic> j) => OverviewMember(
        id: _str(j['id']) ?? '',
        memberId: _str(j['memberId']) ?? '',
        name: _str(j['name']) ?? '',
        photoUrl: _str(j['photoUrl']),
        joiningDate: _str(j['joiningDate']) ?? '',
        branchName: _str(jsonMap(j['branch'])['name']),
        trainerName: _str(jsonMap(j['trainer'])['name']),
      );
}

class OverviewMembership {
  const OverviewMembership({
    required this.planName,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.daysLeft,
    required this.totalDays,
    required this.price,
    required this.amountPaid,
    required this.expired,
  });

  final String planName;
  final String status;
  final String startDate;
  final String endDate;
  final int daysLeft;
  final int totalDays;
  final double? price;
  final double? amountPaid;
  final bool expired;

  /// Fraction of the term still remaining (0..1); 0 once expired.
  double get remainingFraction =>
      expired || totalDays <= 0 ? 0 : (daysLeft / totalDays).clamp(0, 1);

  factory OverviewMembership.fromJson(Map<String, dynamic> j) {
    final daysLeft = jsonInt(j['daysLeft']);
    return OverviewMembership(
      planName: _str(j['planName']) ?? 'Membership',
      status: _str(j['status']) ?? '',
      startDate: _str(j['startDate']) ?? '',
      endDate: _str(j['endDate']) ?? '',
      daysLeft: daysLeft,
      totalDays: jsonInt(j['totalDays']),
      price: _moneyOrNull(j['price']),
      amountPaid: _moneyOrNull(j['amountPaid']),
      expired: j['expired'] is bool ? j['expired'] as bool : daysLeft < 0,
    );
  }
}

class OverviewWeekday {
  const OverviewWeekday({required this.weekday, required this.count});

  /// 0 = Sunday .. 6 = Saturday (the API's UTC convention).
  final int weekday;
  final int count;
}

class OverviewDay {
  const OverviewDay({required this.date, required this.visits});

  final String date;
  final int visits;
}

class OverviewAttendance {
  const OverviewAttendance({
    required this.thisMonthVisits,
    required this.previousMonthVisits,
    required this.currentStreakDays,
    required this.bestStreakDays,
    required this.totalVisits,
    required this.avgVisitMinutes,
    required this.lastVisitAt,
    required this.weekday,
    required this.daily,
  });

  final int thisMonthVisits;
  final int previousMonthVisits;
  final int currentStreakDays;
  final int bestStreakDays;
  final int totalVisits;
  final int? avgVisitMinutes;
  final String? lastVisitAt;
  final List<OverviewWeekday> weekday;
  final List<OverviewDay> daily;

  /// Percent change vs last month; null without a baseline (never "+100%").
  double? get deltaPercent => previousMonthVisits > 0
      ? (thisMonthVisits - previousMonthVisits) / previousMonthVisits * 100
      : null;

  int get maxDaily =>
      daily.fold(0, (m, d) => d.visits > m ? d.visits : m);

  int get maxWeekday =>
      weekday.fold(0, (m, d) => d.count > m ? d.count : m);

  factory OverviewAttendance.fromJson(Map<String, dynamic> j) {
    final month = jsonMap(j['thisMonth']);
    return OverviewAttendance(
      thisMonthVisits: jsonInt(month['visits']),
      previousMonthVisits: jsonInt(month['previous']),
      currentStreakDays: jsonInt(j['currentStreakDays']),
      bestStreakDays: jsonInt(j['bestStreakDays']),
      totalVisits: jsonInt(j['totalVisits']),
      avgVisitMinutes: _intOrNull(j['avgVisitMinutes']),
      lastVisitAt: _str(j['lastVisitAt']),
      weekday: jsonList(j['weekday'])
          .map(
            (e) => OverviewWeekday(
              weekday: jsonInt(e['weekday']),
              count: jsonInt(e['count']),
            ),
          )
          .toList(),
      daily: jsonList(j['daily'])
          .map(
            (e) => OverviewDay(
              date: _str(e['date']) ?? '',
              visits: jsonInt(e['visits']),
            ),
          )
          .toList(),
    );
  }
}

class OverviewWorkout {
  const OverviewWorkout({
    required this.planName,
    required this.progressPercent,
    required this.completedExercises,
    required this.totalExercises,
    required this.completedThisWeek,
  });

  final String planName;
  final int progressPercent;
  final int completedExercises;
  final int totalExercises;
  final int completedThisWeek;

  factory OverviewWorkout.fromJson(Map<String, dynamic> j) => OverviewWorkout(
        planName: _str(j['planName']) ?? 'Workout plan',
        progressPercent: jsonInt(j['progressPercent']).clamp(0, 100),
        completedExercises: jsonInt(j['completedExercises']),
        totalExercises: jsonInt(j['totalExercises']),
        completedThisWeek: jsonInt(j['completedThisWeek']),
      );
}

class OverviewDiet {
  const OverviewDiet({
    required this.planName,
    required this.dailyCalories,
    required this.loggedToday,
    required this.waterTodayMl,
    required this.latestWeightKg,
  });

  final String planName;
  final int? dailyCalories;
  final bool loggedToday;
  final int? waterTodayMl;
  final double? latestWeightKg;

  factory OverviewDiet.fromJson(Map<String, dynamic> j) => OverviewDiet(
        planName: _str(j['planName']) ?? 'Diet plan',
        dailyCalories: _intOrNull(j['dailyCalories']),
        loggedToday: j['loggedToday'] == true,
        waterTodayMl: _intOrNull(j['waterTodayMl']),
        latestWeightKg: _moneyOrNull(j['latestWeightKg']),
      );
}

class OverviewBilling {
  const OverviewBilling({
    required this.outstanding,
    required this.outstandingInvoiceCount,
    required this.nextDueDate,
    required this.paidLast90Days,
    required this.paidLast90DaysCount,
  });

  final double outstanding;
  final int outstandingInvoiceCount;
  final String? nextDueDate;
  final double paidLast90Days;
  final int paidLast90DaysCount;

  factory OverviewBilling.fromJson(Map<String, dynamic> j) {
    final out = jsonMap(j['outstanding']);
    final paid = jsonMap(j['paidLast90Days']);
    return OverviewBilling(
      outstanding: jsonMoney(out['value']),
      outstandingInvoiceCount: jsonInt(out['invoiceCount']),
      nextDueDate: _str(j['nextDueDate']),
      paidLast90Days: jsonMoney(paid['value']),
      paidLast90DaysCount: jsonInt(paid['count']),
    );
  }
}

class OverviewClass {
  const OverviewClass({
    required this.sessionId,
    required this.name,
    required this.date,
    required this.startTime,
    required this.endTime,
    required this.trainerName,
    required this.bookingStatus,
  });

  final String sessionId;
  final String name;
  final String date;
  final String startTime;
  final String endTime;
  final String? trainerName;
  final String bookingStatus;

  factory OverviewClass.fromJson(Map<String, dynamic> j) => OverviewClass(
        sessionId: _str(j['sessionId']) ?? '',
        name: _str(j['name']) ?? 'Class',
        date: _str(j['date']) ?? '',
        startTime: _str(j['startTime']) ?? '',
        endTime: _str(j['endTime']) ?? '',
        trainerName: _str(j['trainerName']),
        bookingStatus: _str(j['bookingStatus']) ?? '',
      );
}

class MemberOverview {
  const MemberOverview({
    required this.member,
    required this.membership,
    required this.attendance,
    required this.workout,
    required this.diet,
    required this.billing,
    required this.upcomingClasses,
    required this.unreadNotifications,
  });

  final OverviewMember member;
  final OverviewMembership? membership;
  final OverviewAttendance attendance;
  final OverviewWorkout? workout;
  final OverviewDiet? diet;
  final OverviewBilling billing;
  final List<OverviewClass> upcomingClasses;
  final int unreadNotifications;

  factory MemberOverview.fromJson(Map<String, dynamic> j) => MemberOverview(
        member: OverviewMember.fromJson(jsonMap(j['member'])),
        membership: j['membership'] is Map<String, dynamic>
            ? OverviewMembership.fromJson(j['membership'] as Map<String, dynamic>)
            : null,
        attendance: OverviewAttendance.fromJson(jsonMap(j['attendance'])),
        workout: j['workout'] is Map<String, dynamic>
            ? OverviewWorkout.fromJson(j['workout'] as Map<String, dynamic>)
            : null,
        diet: j['diet'] is Map<String, dynamic>
            ? OverviewDiet.fromJson(j['diet'] as Map<String, dynamic>)
            : null,
        billing: OverviewBilling.fromJson(jsonMap(j['billing'])),
        upcomingClasses: jsonList(jsonMap(j['classes'])['upcoming'])
            .map(OverviewClass.fromJson)
            .toList(),
        unreadNotifications: jsonInt(jsonMap(j['notifications'])['unread']),
      );
}
