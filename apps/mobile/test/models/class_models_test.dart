import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/classes/presentation/class_ui.dart';
import 'package:gym_saas_mobile/features/classes/presentation/classes_screen.dart';
import 'package:gym_saas_mobile/features/classes/presentation/widgets/class_schedule_editor.dart';
import 'package:gym_saas_mobile/models/class_session.dart';
import 'package:gym_saas_mobile/models/group_class.dart';
import 'package:gym_saas_mobile/models/member_booking.dart';

Map<String, dynamic> _class({
  String id = 'c1',
  String name = 'Morning Yoga',
  bool isActive = true,
  String? deletedAt,
  String createdAt = '2026-01-01T10:00:00.000Z',
}) =>
    {
      'id': id,
      'name': name,
      'description': null,
      'trainer': {'id': 't1', 'name': 'Asha'},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'capacity': 15,
      'durationMinutes': 60,
      'isActive': isActive,
      'schedule': [
        {'dayOfWeek': 'MONDAY', 'startTime': '07:00'},
        {'dayOfWeek': 'MONDAY', 'startTime': '18:00'},
      ],
      'createdAt': createdAt,
      'updatedAt': createdAt,
      'deletedAt': deletedAt,
    };

void main() {
  group('GroupClass', () {
    test('parses a class with two slots on the same day', () {
      final c = GroupClass.fromJson(_class());
      expect(c.schedule, hasLength(2));
      expect(c.schedule.first.dayOfWeek, WeekDay.monday);
      expect(c.isDeleted, isFalse);
      expect(c.branch?.name, 'Bandra');
    });

    test('deletedAt marks it deleted', () {
      final c = GroupClass.fromJson(
        _class(deletedAt: '2026-03-01T00:00:00.000Z'),
      );
      expect(c.isDeleted, isTrue);
    });
  });

  group('ClassSession / ClassSessionDetail', () {
    final raw = {
      'id': 's1',
      'groupClass': {'id': 'c1', 'name': 'Morning Yoga'},
      'branch': {'id': 'b1', 'name': 'Bandra'},
      'trainer': null,
      'sessionDate': '2026-10-19',
      'startTime': '07:00',
      'endTime': '08:00',
      'capacity': 10,
      'bookedCount': 10,
      'status': 'SCHEDULED',
    };

    test('parses branch, full flag and day key', () {
      final s = ClassSession.fromJson(raw);
      expect(s.branch?.name, 'Bandra');
      expect(s.isFull, isTrue);
      expect(s.isScheduled, isTrue);
      expect(s.dayKey, '2026-10-19');
    });

    test('older payloads without a branch still parse', () {
      final s = ClassSession.fromJson({...raw}..remove('branch'));
      expect(s.branch, isNull);
    });

    test('detail keeps non-cancelled bookings with member code and role', () {
      final d = ClassSessionDetail.fromJson({
        ...raw,
        'bookings': [
          {
            'id': 'b1',
            'member': {'id': 'm1', 'memberId': 'MEM-0001', 'name': 'Riya Shah'},
            'status': 'BOOKED',
            'bookedByRole': 'STAFF',
            'bookedAt': '2026-10-18T10:00:00.000Z',
            'cancelledAt': null,
          },
          {
            'id': 'b2',
            'member': {'id': 'm2', 'memberId': 'MEM-0002', 'name': 'Dev Rao'},
            'status': 'CANCELLED',
            'bookedByRole': 'MEMBER',
            'bookedAt': '2026-10-18T10:00:00.000Z',
            'cancelledAt': '2026-10-18T11:00:00.000Z',
          },
        ],
      });
      expect(d.bookings, hasLength(1));
      expect(d.bookings.single.memberCode, 'MEM-0001');
      expect(d.bookings.single.bookedByRole, 'STAFF');
      expect(d.branch?.id, 'b1');
    });
  });

  group('MemberBooking', () {
    test('parses the session times and day key', () {
      final b = MemberBooking.fromJson({
        'id': 'bk1',
        'status': 'BOOKED',
        'bookedAt': '2026-10-18T10:00:00.000Z',
        'session': {
          'id': 's1',
          'groupClass': {'id': 'c1', 'name': 'Yoga'},
          'branch': {'id': 'b1', 'name': 'Bandra'},
          'sessionDate': '2026-10-19',
          'startTime': '07:00',
          'endTime': '08:00',
        },
      });
      expect(b.startTime, '07:00');
      expect(b.endTime, '08:00');
      expect(b.dayKey, '2026-10-19');
      expect(b.bookedAt, isNotNull);
    });
  });

  group('filterClasses', () {
    final all = [
      GroupClass.fromJson(_class(id: '1', name: 'Zumba')),
      GroupClass.fromJson(_class(id: '2', name: 'Yoga', isActive: false)),
      GroupClass.fromJson(
        _class(id: '3', name: 'Boxing', deletedAt: '2026-03-01T00:00:00.000Z'),
      ),
    ];

    test('All keeps deleted ones, sorted by name', () {
      expect(
        filterClasses(all).map((c) => c.name),
        ['Boxing', 'Yoga', 'Zumba'],
      );
    });

    test('Active / Inactive exclude deleted', () {
      expect(
        filterClasses(all, status: 'active').map((c) => c.name),
        ['Zumba'],
      );
      expect(
        filterClasses(all, status: 'inactive').map((c) => c.name),
        ['Yoga'],
      );
    });

    test('search matches the name and sort flips', () {
      expect(filterClasses(all, search: 'yo').single.name, 'Yoga');
      expect(
        filterClasses(all, sort: 'name:desc').map((c) => c.name),
        ['Zumba', 'Yoga', 'Boxing'],
      );
    });
  });

  group('helpers', () {
    test('classTime renders 12h', () {
      expect(classTime('07:00'), '7:00 AM');
      expect(classTime('00:30'), '12:30 AM');
      expect(classTime('18:05'), '6:05 PM');
    });

    test('startOfWeek is Monday', () {
      expect(startOfWeek(DateTime(2026, 10, 18)), DateTime(2026, 10, 12));
      expect(startOfWeek(DateTime(2026, 10, 12)), DateTime(2026, 10, 12));
    });

    test('sameSlots ignores order', () {
      const a = ScheduleSlot(dayOfWeek: WeekDay.monday, startTime: '07:00');
      const b = ScheduleSlot(dayOfWeek: WeekDay.friday, startTime: '18:00');
      expect(sameSlots([a, b], [b, a]), isTrue);
      expect(sameSlots([a], [a, b]), isFalse);
    });
  });
}
