/// `GET /portal/plan` payloads, shaped exactly like the API (see
/// `member-plan-benefits.util.ts`): the 7 benefits in order, zero quotas as
/// `included: false`, an uncapped freeze as `quota: null` + "No limit".
Map<String, dynamic> _benefit(
  String key,
  String label, {
  bool included = true,
  int? quota,
  int? used,
  int? remaining,
  String? unit,
  String? note,
  List<String> items = const [],
}) =>
    {
      'key': key,
      'label': label,
      'included': included,
      'quota': quota,
      'used': used,
      'remaining': remaining,
      'unit': unit,
      'note': note,
      'items': items,
    };

/// A fully loaded plan with partial usage and two named branches.
Map<String, dynamic> planJson({
  String name = 'Quarterly Pro',
  String? category = 'Premium',
  String? description = 'Everything you need for three months of training.',
  String status = 'ACTIVE',
  int daysLeft = 61,
  bool expired = false,
}) =>
    {
      'name': name,
      'code': 'PLAN-0002',
      'category': category,
      'description': description,
      'durationLabel': '3 Months',
      'status': status,
      'startDate': '2026-10-01',
      'endDate': '2026-12-30',
      'daysLeft': daysLeft,
      'expired': expired,
      'totalDays': 90,
      'benefits': [
        _benefit(
          'gym_access',
          'Gym access',
          note: '2 branches',
          items: ['Bandra', 'Thane'],
        ),
        _benefit(
          'pt_sessions',
          'Personal training',
          quota: 4,
          used: 1,
          remaining: 3,
          unit: 'sessions',
        ),
        _benefit(
          'group_classes',
          'Group classes',
          quota: 10,
          used: 10,
          remaining: 0,
          unit: 'classes',
          note: 'All used',
        ),
        _benefit('diet_consultation', 'Diet consultation'),
        _benefit('locker', 'Locker', included: false),
        _benefit(
          'guest_passes',
          'Guest passes',
          quota: 2,
          used: 0,
          remaining: 2,
          unit: 'passes',
        ),
        _benefit(
          'freeze',
          'Membership freeze',
          unit: 'days',
          note: 'No limit',
        ),
      ],
    };

/// A bare plan: everything optional is off, only gym access remains.
Map<String, dynamic> barePlanJson() => {
      'name': 'Walk-in',
      'code': 'PLAN-0009',
      'category': null,
      'description': null,
      'durationLabel': '1 Month',
      'status': 'ACTIVE',
      'startDate': '2026-10-01',
      'endDate': '2026-10-31',
      'daysLeft': 12,
      'expired': false,
      'totalDays': 31,
      'benefits': [
        _benefit('gym_access', 'Gym access', note: 'All branches'),
        _benefit(
          'pt_sessions',
          'Personal training',
          included: false,
          unit: 'sessions',
        ),
        _benefit(
          'group_classes',
          'Group classes',
          included: false,
          unit: 'classes',
        ),
        _benefit('diet_consultation', 'Diet consultation', included: false),
        _benefit('locker', 'Locker', included: false),
        _benefit(
          'guest_passes',
          'Guest passes',
          included: false,
          unit: 'passes',
        ),
        _benefit(
          'freeze',
          'Membership freeze',
          included: false,
          unit: 'days',
          note: 'Not allowed',
        ),
      ],
    };
