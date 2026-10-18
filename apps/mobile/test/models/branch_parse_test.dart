import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/branch.dart';
import 'package:gym_saas_mobile/repositories/branch_repository.dart';

Map<String, dynamic> _json({Map<String, dynamic> extra = const {}}) => {
      'id': 'b1',
      'name': 'Bandra Branch',
      'branchCode': 'BR-0001',
      'email': 'bandra@gym.test',
      'phone': '9876543210',
      'whatsappNumber': null,
      'addressLine1': '12 Hill Road',
      'addressLine2': null,
      'city': 'Mumbai',
      'state': 'MH',
      'country': 'India',
      'postalCode': '400050',
      // Prisma DECIMALs arrive as strings.
      'latitude': '19.059984',
      'longitude': '72.829500',
      'operatingHours': {
        'monday': {'open': '06:00', 'close': '22:00', 'closed': false},
        'sunday': {'open': null, 'close': null, 'closed': true},
      },
      'holidays': [
        {'date': '2026-01-26', 'label': 'Republic Day'},
        {'date': '2026-08-15'},
      ],
      'capacity': 150,
      'maxMembers': 500,
      'maxStaff': 20,
      'allowCheckIn': true,
      'notes': 'Rooftop studio',
      'isDefault': true,
      'isActive': true,
      'timezone': 'Asia/Kolkata',
      'memberCount': 120,
      'staffCount': 8,
      'createdAt': '2026-01-01T10:00:00.000Z',
      'updatedAt': '2026-02-01T10:00:00.000Z',
      'deletedAt': null,
      ...extra,
    };

void main() {
  group('Branch.fromJson', () {
    test('parses the full BranchDto including string decimals', () {
      final b = Branch.fromJson(_json());
      expect(b.name, 'Bandra Branch');
      expect(b.latitude, closeTo(19.059984, 1e-9));
      expect(b.longitude, closeTo(72.8295, 1e-9));
      expect(b.hasCoordinates, isTrue);
      expect(b.capacity, 150);
      expect(b.maxMembers, 500);
      expect(b.capacityUsage, closeTo(0.8, 1e-9));
      expect(b.location, 'Mumbai, MH');
      expect(b.fullAddress, '12 Hill Road, Mumbai, MH, 400050, India');
      expect(b.isDeleted, isFalse);
      expect(b.createdAt, isNotNull);
      expect(b.holidays.length, 2);
      expect(b.holidays.last.label, isNull);
      expect(b.operatingHours['monday']!.label, '06:00 - 22:00');
      expect(b.operatingHours['sunday']!.label, 'Closed');
    });

    test('nulls, numeric strings and a deleted branch do not throw', () {
      final b = Branch.fromJson(
        _json(
          extra: {
            'latitude': null,
            'longitude': null,
            'capacity': null,
            'maxMembers': '300',
            'memberCount': null,
            'operatingHours': null,
            'holidays': null,
            'deletedAt': '2026-03-01T00:00:00.000Z',
            'isActive': false,
          },
        ),
      );
      expect(b.hasCoordinates, isFalse);
      expect(b.capacity, isNull);
      expect(b.capacityUsage, isNull);
      expect(b.maxMembers, 300);
      expect(b.memberCount, 0);
      expect(b.operatingHours, isEmpty);
      expect(b.holidays, isEmpty);
      expect(b.isDeleted, isTrue);
    });

    test('capacity usage is clamped to 1 when over capacity', () {
      final b = Branch.fromJson(_json(extra: {'memberCount': 400}));
      expect(b.capacityUsage, 1.0);
    });

    test('DayHours labels', () {
      expect(const DayHours().label, 'Not set');
      expect(const DayHours(closed: true).label, 'Closed');
      expect(
        const DayHours(open: '09:00', close: '17:30').label,
        '09:00 - 17:30',
      );
    });
  });

  group('BranchRepository.listAll', () {
    test('walks pages, asks for deleted ones, never sends isActive', () async {
      final dio = Dio();
      final seen = <Map<String, dynamic>>[];
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            seen.add(Map.of(options.queryParameters));
            final page = options.queryParameters['page'] as int;
            handler.resolve(
              Response(
                requestOptions: options,
                statusCode: 200,
                data: {
                  'data': {
                    'items': [
                      _json(extra: {'id': 'b$page', 'name': 'Branch $page'}),
                    ],
                    'total': 2,
                    'page': page,
                    'limit': 100,
                    'totalPages': 2,
                  },
                },
              ),
            );
          },
        ),
      );
      final all = await BranchRepository(dio).listAll();
      expect(all.map((b) => b.id), ['b1', 'b2']);
      expect(seen.length, 2);
      expect(seen.first['includeDeleted'], true);
      expect(seen.first['limit'], 100);
      expect(seen.every((q) => !q.containsKey('isActive')), isTrue);
    });
  });
}
