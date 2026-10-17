import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/dashboard_kpis.dart';

Map<String, dynamic> _json() => {
      'totalMembers': 521,
      'activeMembers': 412,
      'inactiveMembers': 109,
      'newMembersThisMonth': 46,
      'expiringMemberships': 17,
      'todaysAttendance': 84,
      'monthlyRevenue': '382000.00',
      'monthlyExpenses': '194500.00',
      'outstandingPayments': '42300.00',
      'totalStaff': 9,
      'activeTrainers': 5,
      'activeBranches': 3,
    };

void main() {
  test('parses every field the Overview shows, including inactiveMembers', () {
    final k = DashboardKpis.fromJson(_json());
    expect(k.inactiveMembers, 109);
    expect(k.monthlyExpenses, 194500);
    expect(k.activeBranches, 3);
  });

  test('inactiveMembers falls back to 0 on an older server', () {
    final json = _json()..remove('inactiveMembers');
    expect(DashboardKpis.fromJson(json).inactiveMembers, 0);
  });
}
