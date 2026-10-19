Map<String, dynamic> _ex(String id,
        {String status = 'PENDING', Map<String, dynamic>? extra,}) =>
    {
      'exerciseId': id,
      'name': 'Ex $id',
      'muscleGroup': 'Legs',
      'sets': 4,
      'reps': '8',
      'restSeconds': 90,
      'notes': null,
      'status': status,
      'logId': status == 'PENDING' ? null : 'log-$id',
      'setsDone': null,
      'repsDone': null,
      'weightKg': null,
      'durationMin': null,
      'logNotes': null,
      ...?extra,
    };

Map<String, dynamic> _day(String date, String label, String state,
        {List<Map<String, dynamic>> ex = const [],
        Map<String, dynamic>? session,}) =>
    {
      'date': date,
      'weekday': label.toUpperCase(),
      'label': label,
      'isToday': date == '2026-10-21',
      'isFuture': date.compareTo('2026-10-21') > 0,
      'canLog': ex.isNotEmpty && date.compareTo('2026-10-21') <= 0,
      'state': state,
      'focus': ex.isEmpty ? null : 'Legs',
      'plannedCount': ex.length,
      'completedCount': ex.where((e) => e['status'] == 'COMPLETED').length,
      'skippedCount': ex.where((e) => e['status'] == 'SKIPPED').length,
      'percent': 0,
      'exercises': ex,
      'session': session,
    };

Map<String, dynamic> trackingJson() => {
      'today': '2026-10-21',
      'backdateDays': 14,
      'windowStart': '2026-10-07',
      'everLogged': true,
      'days': [
        _day('2026-10-19', 'Monday', 'DONE',
            ex: [_ex('a', status: 'COMPLETED'), _ex('b', status: 'SKIPPED')],
            session: {'durationMin': 50, 'effort': 4, 'notes': null},),
        _day('2026-10-20', 'Tuesday', 'REST'),
        _day('2026-10-21', 'Wednesday', 'TODAY', ex: [_ex('c'), _ex('d')]),
        _day('2026-10-22', 'Thursday', 'REST'),
        _day('2026-10-23', 'Friday', 'UPCOMING', ex: [_ex('e')]),
        _day('2026-10-24', 'Saturday', 'REST'),
        _day('2026-10-25', 'Sunday', 'REST'),
      ],
      'week': {
        'start': '2026-10-19',
        'end': '2026-10-25',
        'plannedSessions': 3,
        'completedSessions': 1,
        'plannedExercises': 5,
        'completedExercises': 1,
        'skippedExercises': 1,
        'completionPercent': 20,
      },
      'nextDay': {
        'date': '2026-10-21',
        'weekday': 'WEDNESDAY',
        'label': 'Wednesday',
        'isToday': true,
        'focus': 'Legs',
        'plannedCount': 2,
      },
      'streak': 1,
      'consistency': [
        for (var i = 0; i < 8; i++)
          {
            'weekStart': '2026-09-${(7 + i * 7).toString().padLeft(2, '0')}',
            'isCurrent': i == 7,
            'plannedSessions': 3,
            'completedSessions': i % 3,
            'percent': i == 0 ? null : (i % 3) * 33,
          },
      ],
      'exercises': [
        {
          'exerciseId': 'a',
          'name': 'Ex a',
          'muscleGroup': 'Legs',
          'planned': 2,
          'completed': 1,
          'skipped': 1,
        },
      ],
      'muscleGroups': [
        {'name': 'Legs', 'planned': 2, 'completed': 1, 'skipped': 1},
      ],
      'mostSkipped': <Map<String, dynamic>>[],
      'last30': {
        'sessionsDone': 3,
        'exercisesCompleted': 6,
        'minutes': 55,
        'volumeKg': '1600',
        'avgEffort': 4,
      },
      'personalBests': [
        {
          'exerciseId': 'a',
          'name': 'Ex a',
          'weightKg': '65.5',
          'repsDone': 5,
          'date': '2026-10-19',
          'isNew': true,
        },
      ],
      'insights': [
        {'tone': 'warn', 'title': 'T1', 'body': 'B1'},
        {'tone': 'good', 'title': 'T2', 'body': 'B2'},
        {'tone': 'tip', 'title': 'T3', 'body': 'B3'},
      ],
    };

Map<String, dynamic> assignmentJson() => {
      'id': 'as1',
      'status': 'ACTIVE',
      'startDate': '2026-10-05',
      'endDate': null,
      'trainerRemarks': null,
      'workoutPlan': {
        'id': 'p1',
        'name': 'Plan',
        'level': 'BEGINNER',
        'durationWeeks': 8,
        'exercises': [
          {'exerciseId': 'a', 'name': 'Ex a', 'dayOfWeek': 'MONDAY'},
        ],
      },
      'progress': <Map<String, dynamic>>[],
      'tracking': trackingJson(),
    };
