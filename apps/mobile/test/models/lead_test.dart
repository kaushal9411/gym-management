import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/models/lead.dart';
import 'package:gym_saas_mobile/models/lead_analytics.dart';
import 'package:gym_saas_mobile/models/paginated_result.dart';
import 'package:gym_saas_mobile/repositories/lead_repository.dart';

// Fixtures follow the backend contract in docs/BACKEND-GUIDE.md 'Leads &
// Enquiries'; the same parsers were also run once against live responses.
void main() {
  Map<String, dynamic> item({Map<String, dynamic> extra = const {}}) => {
        'id': 'l1',
        'name': 'ZZ Lead One',
        'phone': '9000099001',
        'email': null,
        'source': 'REFERRAL',
        'sourceDetail': 'Ravi',
        'status': 'VISIT_SCHEDULED',
        'branch': {'id': 'b1', 'name': 'Main'},
        'interestedPlan': {'id': 'p1', 'name': 'Monthly'},
        'assignedTo': {'id': 'u1', 'name': 'Asha'},
        'nextFollowUpAt': '2026-10-11T09:30:00.000Z',
        'followUpState': 'today',
        'expectedJoinDate': '2026-10-20T00:00:00.000Z',
        'createdAt': '2026-10-01T00:00:00.000Z',
        ...extra,
      };

  group('Lead', () {
    test('parses a full list item', () {
      final l = Lead.fromJson(item());
      expect(l.status, LeadStatus.visitScheduled);
      expect(l.source, LeadSource.referral);
      expect(l.assignedTo?.name, 'Asha');
      expect(l.interestedPlan?.id, 'p1');
      expect(l.followUpState, 'today');
      expect(l.expectedJoinDate, '2026-10-20');
      expect(l.isOpen, isTrue);
      expect(l.activities, isEmpty);
    });

    test('tolerates a nearly empty object', () {
      final l = Lead.fromJson({});
      expect(l.id, '');
      expect(l.name, '');
      expect(l.status, LeadStatus.newLead);
      expect(l.source, LeadSource.other);
      expect(l.followUpState, 'none');
      expect(l.assignedTo, isNull);
      expect(l.ageDays(), isNull);
    });

    test('unknown enum values degrade, malformed refs are null', () {
      final l = Lead.fromJson(
        item(
          extra: {
            'status': 'WEIRD',
            'source': 'TELEPATHY',
            'branch': 'not-a-map',
            'nextFollowUpAt': 'garbage',
          },
        ),
      );
      expect(l.status, LeadStatus.newLead);
      expect(l.source, LeadSource.other);
      expect(l.branch, isNull);
      expect(l.nextFollowUpAt, isNull);
    });

    test('CONVERTED lead without a member is tolerated', () {
      final l = Lead.fromJson(
        item(
          extra: {
            'status': 'CONVERTED',
            'convertedMemberId': null,
            'convertedMember': null,
            'convertedAt': '2026-10-05T00:00:00.000Z',
          },
        ),
      );
      expect(l.status, LeadStatus.converted);
      expect(l.isOpen, isFalse);
      expect(l.convertedMember, isNull);
      expect(l.convertedAt, isNotNull);
    });

    test('detail activities incl. system and unknown types', () {
      final l = Lead.fromJson(
        item(
          extra: {
            'convertedMember': {'id': 'm1', 'memberId': 'MEM-9', 'name': 'X'},
            'activities': [
              {
                'id': 'a1',
                'type': 'STATUS_CHANGE',
                'fromStatus': 'NEW',
                'toStatus': 'CONTACTED',
                'createdAt': '2026-10-02T10:00:00Z',
              },
              {'id': 'a2', 'type': 'CALL', 'note': 'spoke'},
              {'id': 'a3', 'type': 'FUTURE_TYPE'},
            ],
          },
        ),
      );
      expect(l.convertedMember?.memberId, 'MEM-9');
      expect(l.activities.length, 3);
      expect(l.activities[0].isSystem, isTrue);
      expect(l.activities[1].isSystem, isFalse);
      expect(l.activities[2].type, isNull);
      expect(l.activities[2].rawType, 'FUTURE_TYPE');
    });

    test('list envelope with counts and summary', () {
      final data = {
        'items': [item()],
        'total': 1,
        'page': 1,
        'limit': 20,
        'totalPages': 1,
        'counts': {'all': 5, 'NEW': 2, 'LOST': 1},
        'summary': {'total': 1, 'open': 1, 'followUpsOverdue': 3},
      };
      final p = PaginatedResult.fromJson(data, Lead.fromJson);
      expect(p.items.single.name, 'ZZ Lead One');
      final c = LeadCounts.tryParse(data['counts'])!;
      expect(c.all, 5);
      expect(c.of(LeadStatus.newLead), 2);
      expect(c.of(LeadStatus.converted), 0);
      final s = LeadSummary.tryParse(data['summary'])!;
      expect(s.followUpsOverdue, 3);
      expect(s.converted, 0);
      expect(LeadCounts.tryParse(null), isNull);
    });

    test('wa number rule', () {
      expect(leadWaNumber('90000 99001'), '919000099001');
      expect(leadWaNumber('+91 90000-99001'), '919000099001');
    });

    test('filters serialise', () {
      final f = const LeadFilters(
        search: 'ra',
        status: LeadStatus.lost,
        sources: {LeadSource.walkIn, LeadSource.website},
        assignedTo: 'me',
        followUp: 'overdue',
      );
      expect(f.toQuery(), {
        'search': 'ra',
        'status': 'LOST',
        'source': 'WALK_IN,WEBSITE',
        'assignedTo': 'me',
        'followUp': 'overdue',
      });
      expect(f.activeFilterCount, 3);
      expect(const LeadFilters().toQuery(), isEmpty);
    });

    test('plan / created-date / sort filters serialise', () {
      const f = LeadFilters(
        planId: 'p1',
        planName: 'Gold',
        createdFrom: '2026-09-01',
        createdTo: '2026-09-30',
        sortBy: 'nextFollowUpAt',
        sortDir: 'asc',
      );
      expect(f.toQuery(), {
        'interestedPlanId': 'p1',
        'createdFrom': '2026-09-01',
        'createdTo': '2026-09-30',
        'sortBy': 'nextFollowUpAt',
        'sortDir': 'asc',
      });
      // plan + created window count as one filter each; sort is not a filter.
      expect(f.activeFilterCount, 2);
      expect(f.isDefaultSort, isFalse);
      final cleared = f.copyWith(clearPlan: true, clearCreated: true);
      expect(cleared.planId, isNull);
      expect(cleared.planName, isNull);
      expect(cleared.createdFrom, isNull);
      expect(cleared.sortBy, 'nextFollowUpAt');
    });

    test('lostAt and gender are parsed; gender options mirror the API enum',
        () {
      final l = Lead.fromJson(
        item(
          extra: {
            'status': 'LOST',
            'gender': 'PREFER_NOT_TO_SAY',
            'lostAt': '2026-10-05T10:00:00.000Z',
          },
        ),
      );
      expect(l.gender, 'PREFER_NOT_TO_SAY');
      expect(l.lostAt, isNotNull);
      expect(
        leadGenderOptions.map((g) => g.$1),
        ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
      );
      expect(Lead.fromJson({}).lostAt, isNull);
    });
  });

  group('LeadAnalytics', () {
    test('topBranches are parsed as cohort rows', () {
      final a = LeadAnalytics.fromJson({
        'topBranches': [
          {
            'branchId': 'b1',
            'name': 'Main',
            'leads': 5,
            'converted': 2,
            'conversionRate': 0.4,
          },
        ],
      });
      expect(a.topBranches.single.name, 'Main');
      expect(a.topBranches.single.leads, 5);
      expect(a.topBranches.single.conversionRate, 0.4);
      expect(LeadAnalytics.fromJson({}).topBranches, isEmpty);
    });

    test('parses full payload', () {
      final a = LeadAnalytics.fromJson({
        'kpis': {
          'newLeads': {'value': 10, 'previous': 5},
          'converted': {'value': 2, 'previous': 0},
          'conversionRate': {'value': 0.2, 'previous': 0.1},
          'avgDaysToConvert': {'value': null, 'previous': null},
          'open': {'value': 7, 'previous': null},
          'followUpsDueToday': {'value': 1},
          'followUpsOverdue': {'value': 3},
        },
        'headline': {
          'today': {
            'newLeads': 2,
            'converted': 1,
            'newLeadsDelta': 100,
            'convertedDelta': null,
          },
        },
        'daily': [
          {'date': '2026-10-01', 'newLeads': 2, 'converted': 1, 'lost': 0},
        ],
        'funnel': {
          'stages': [
            {'stage': 'NEW', 'count': 10, 'pctOfTop': 1, 'dropOff': 0},
          ],
          'lost': 2,
          'total': 10,
        },
        'bySource': [
          {
            'source': 'WALK_IN',
            'leads': 4,
            'converted': 1,
            'conversionRate': 0.25,
          },
        ],
        'byStaff': [
          {'userId': null, 'name': 'Unassigned', 'leads': 1, 'converted': 0},
        ],
        'lostReasons': [
          {'reason': 'NO_RESPONSE', 'count': 2},
        ],
        'ageing': [
          {'bucket': '0-7', 'count': 3},
        ],
      });
      expect(a.newLeads.deltaPercent, 100);
      expect(a.converted.deltaPercent, isNull);
      expect(a.avgDaysToConvert.value, isNull);
      expect(a.open.intValue, 7);
      expect(a.followUpsOverdue.intValue, 3);
      expect(a.today.newLeadsDelta, 100);
      expect(a.today.convertedDelta, isNull);
      expect(a.funnel.single.count, 10);
      expect(a.funnelLost, 2);
      expect(a.bySource.single.conversionRate, 0.25);
      expect(a.byStaff.single.key, isNull);
      expect(a.byStaff.single.name, 'Unassigned');
      expect(a.lostReasons.single.reason, 'NO_RESPONSE');
    });

    test('empty object degrades to zeros', () {
      final a = LeadAnalytics.fromJson({});
      expect(a.newLeads.intValue, 0);
      expect(a.daily, isEmpty);
      expect(a.funnel, isEmpty);
      expect(a.today.newLeads, 0);
      expect(a.thisYear.newLeadsDelta, isNull);
    });
  });
}
