import 'payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// Mirrors the backend `LeadListItem` / `LeadDetail` DTOs
/// (`GET /leads`, `GET /leads/:id`). Parsing is defensive: any missing or
/// malformed field degrades to null/empty instead of throwing, so one odd
/// row (e.g. the demo CONVERTED leads with `convertedMemberId: null`) can
/// never blank the list.

enum LeadStatus {
  newLead('NEW', 'New'),
  contacted('CONTACTED', 'Contacted'),
  visitScheduled('VISIT_SCHEDULED', 'Visit scheduled'),
  trialDone('TRIAL_DONE', 'Trial done'),
  negotiation('NEGOTIATION', 'Negotiation'),
  converted('CONVERTED', 'Converted'),
  lost('LOST', 'Lost');

  const LeadStatus(this.api, this.label);

  final String api;
  final String label;

  bool get isOpen => this != converted && this != lost;

  static LeadStatus parse(Object? v) => LeadStatus.values.firstWhere(
        (s) => s.api == v,
        orElse: () => LeadStatus.newLead,
      );

  /// The open pipeline stages in order (stepper).
  static const pipeline = [
    newLead,
    contacted,
    visitScheduled,
    trialDone,
    negotiation,
    converted,
  ];
}

enum LeadSource {
  walkIn('WALK_IN', 'Walk-in'),
  phoneCall('PHONE_CALL', 'Phone call'),
  website('WEBSITE', 'Website'),
  socialMedia('SOCIAL_MEDIA', 'Social media'),
  referral('REFERRAL', 'Referral'),
  advertisement('ADVERTISEMENT', 'Advertisement'),
  other('OTHER', 'Other');

  const LeadSource(this.api, this.label);

  final String api;
  final String label;

  static LeadSource parse(Object? v) => LeadSource.values.firstWhere(
        (s) => s.api == v,
        orElse: () => LeadSource.other,
      );

  static String labelOf(String api) => parse(api).label;
}

enum LeadLostReason {
  priceTooHigh('PRICE_TOO_HIGH', 'Price too high'),
  notInterested('NOT_INTERESTED', 'Not interested'),
  joinedCompetitor('JOINED_COMPETITOR', 'Joined competitor'),
  locationTooFar('LOCATION_TOO_FAR', 'Location too far'),
  timingNotRight('TIMING_NOT_RIGHT', 'Timing not right'),
  noResponse('NO_RESPONSE', 'No response'),
  other('OTHER', 'Other');

  const LeadLostReason(this.api, this.label);

  final String api;
  final String label;

  static LeadLostReason? tryParse(Object? v) {
    for (final r in LeadLostReason.values) {
      if (r.api == v) return r;
    }
    return null;
  }

  static String labelOf(String api) => tryParse(api)?.label ?? api;
}

/// Manual activity types a user can log. System types
/// (STATUS_CHANGE/ASSIGNMENT/CREATED/CONVERTED) only ever arrive from the API.
enum LeadActivityType {
  note('NOTE', 'Note', false),
  call('CALL', 'Call', false),
  whatsapp('WHATSAPP', 'WhatsApp', false),
  email('EMAIL', 'Email', false),
  visit('VISIT', 'Visit', false),
  trial('TRIAL', 'Trial', false),
  followUp('FOLLOW_UP', 'Follow-up', false),
  statusChange('STATUS_CHANGE', 'Stage change', true),
  assignment('ASSIGNMENT', 'Assignment', true),
  created('CREATED', 'Lead created', true),
  converted('CONVERTED', 'Converted', true);

  const LeadActivityType(this.api, this.label, this.isSystem);

  final String api;
  final String label;
  final bool isSystem;

  static LeadActivityType? tryParse(Object? v) {
    for (final t in LeadActivityType.values) {
      if (t.api == v) return t;
    }
    return null;
  }

  static List<LeadActivityType> get manual =>
      values.where((t) => !t.isSystem).toList();
}

class LeadRef {
  const LeadRef({required this.id, required this.name});

  final String id;
  final String name;

  static LeadRef? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    final id = v['id'];
    if (id is! String) return null;
    return LeadRef(id: id, name: (v['name'] as String?) ?? '');
  }
}

class LeadActivity {
  const LeadActivity({
    required this.id,
    required this.type,
    required this.rawType,
    this.note,
    this.outcome,
    this.fromStatus,
    this.toStatus,
    this.scheduledFor,
    this.createdBy,
    this.createdAt,
  });

  final String id;

  /// Null when the server sends a type this build doesn't know.
  final LeadActivityType? type;
  final String rawType;
  final String? note;
  final String? outcome;
  final String? fromStatus;
  final String? toStatus;
  final DateTime? scheduledFor;
  final LeadRef? createdBy;
  final DateTime? createdAt;

  bool get isSystem => type?.isSystem ?? false;

  factory LeadActivity.fromJson(Map<String, dynamic> j) => LeadActivity(
        id: (j['id'] as String?) ?? '',
        type: LeadActivityType.tryParse(j['type']),
        rawType: (j['type'] as String?) ?? '',
        note: j['note'] as String?,
        outcome: j['outcome'] as String?,
        fromStatus: j['fromStatus'] as String?,
        toStatus: j['toStatus'] as String?,
        scheduledFor: _date(j['scheduledFor']),
        createdBy: LeadRef.tryParse(j['createdBy']),
        createdAt: _date(j['createdAt']),
      );
}

class ConvertedMember {
  const ConvertedMember({
    required this.id,
    required this.memberId,
    required this.name,
  });

  final String id;
  final String memberId;
  final String name;

  static ConvertedMember? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    final id = v['id'];
    if (id is! String) return null;
    return ConvertedMember(
      id: id,
      memberId: (v['memberId'] as String?) ?? '',
      name: (v['name'] as String?) ?? '',
    );
  }
}

DateTime? _date(Object? v) => v is String ? DateTime.tryParse(v) : null;

class Lead {
  const Lead({
    required this.id,
    required this.name,
    required this.phone,
    required this.source,
    required this.status,
    this.email,
    this.gender,
    this.sourceDetail,
    this.branch,
    this.interestedPlan,
    this.interest,
    this.assignedTo,
    this.nextFollowUpAt,
    this.followUpState = 'none',
    this.expectedJoinDate,
    this.lostReason,
    this.lostNote,
    this.lostAt,
    this.notes,
    this.convertedMemberId,
    this.convertedAt,
    this.lastActivityAt,
    this.createdBy,
    this.createdAt,
    this.updatedAt,
    this.convertedMember,
    this.activities = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String? gender;
  final LeadSource source;
  final String? sourceDetail;
  final LeadStatus status;
  final LeadRef? branch;
  final LeadRef? interestedPlan;
  final String? interest;
  final LeadRef? assignedTo;
  final DateTime? nextFollowUpAt;

  /// 'overdue' | 'today' | 'upcoming' | 'none' (server-computed, UTC days).
  final String followUpState;

  /// `YYYY-MM-DD` or null.
  final String? expectedJoinDate;
  final String? lostReason;
  final String? lostNote;
  final DateTime? lostAt;
  final String? notes;
  final String? convertedMemberId;
  final DateTime? convertedAt;
  final DateTime? lastActivityAt;
  final LeadRef? createdBy;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  /// Detail only. Null for the 6 demo CONVERTED leads that have no member.
  final ConvertedMember? convertedMember;
  final List<LeadActivity> activities;

  bool get isOpen => status.isOpen;
  bool get hasOverdueFollowUp => followUpState == 'overdue';

  /// Whole days since creation (null when createdAt is unknown).
  int? ageDays([DateTime? now]) => createdAt == null
      ? null
      : (now ?? DateTime.now()).difference(createdAt!).inDays.clamp(0, 99999);

  factory Lead.fromJson(Map<String, dynamic> j) {
    final expected = j['expectedJoinDate'];
    return Lead(
      id: (j['id'] as String?) ?? '',
      name: (j['name'] as String?) ?? '',
      phone: (j['phone'] as String?) ?? '',
      email: j['email'] as String?,
      gender: j['gender'] as String?,
      source: LeadSource.parse(j['source']),
      sourceDetail: j['sourceDetail'] as String?,
      status: LeadStatus.parse(j['status']),
      branch: LeadRef.tryParse(j['branch']),
      interestedPlan: LeadRef.tryParse(j['interestedPlan']),
      interest: j['interest'] as String?,
      assignedTo: LeadRef.tryParse(j['assignedTo']),
      nextFollowUpAt: _date(j['nextFollowUpAt']),
      followUpState: (j['followUpState'] as String?) ?? 'none',
      expectedJoinDate: expected is String && expected.length >= 10
          ? expected.substring(0, 10)
          : null,
      lostReason: j['lostReason'] as String?,
      lostNote: j['lostNote'] as String?,
      lostAt: _date(j['lostAt']),
      notes: j['notes'] as String?,
      convertedMemberId: j['convertedMemberId'] as String?,
      convertedAt: _date(j['convertedAt']),
      lastActivityAt: _date(j['lastActivityAt']),
      createdBy: LeadRef.tryParse(j['createdBy']),
      createdAt: _date(j['createdAt']),
      updatedAt: _date(j['updatedAt']),
      convertedMember: ConvertedMember.tryParse(j['convertedMember']),
      activities: jsonList(j['activities']).map(LeadActivity.fromJson).toList(),
    );
  }
}

/// Status-chip badges — server `counts` (all filters EXCEPT status).
class LeadCounts {
  const LeadCounts({required this.all, this.byStatus = const {}});

  final int all;
  final Map<String, int> byStatus;

  int of(LeadStatus s) => byStatus[s.api] ?? 0;

  static LeadCounts? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    return LeadCounts(
      all: jsonInt(v['all']),
      byStatus: {
        for (final s in LeadStatus.values) s.api: jsonInt(v[s.api]),
      },
    );
  }
}

class LeadSummary {
  const LeadSummary({
    this.total = 0,
    this.open = 0,
    this.converted = 0,
    this.lost = 0,
    this.followUpsOverdue = 0,
    this.followUpsDueToday = 0,
  });

  final int total;
  final int open;
  final int converted;
  final int lost;
  final int followUpsOverdue;
  final int followUpsDueToday;

  static LeadSummary? tryParse(Object? v) {
    if (v is! Map<String, dynamic>) return null;
    return LeadSummary(
      total: jsonInt(v['total']),
      open: jsonInt(v['open']),
      converted: jsonInt(v['converted']),
      lost: jsonInt(v['lost']),
      followUpsOverdue: jsonInt(v['followUpsOverdue']),
      followUpsDueToday: jsonInt(v['followUpsDueToday']),
    );
  }
}

class LeadAssignee {
  const LeadAssignee({required this.id, required this.name, this.role});

  final String id;
  final String name;
  final String? role;

  factory LeadAssignee.fromJson(Map<String, dynamic> j) => LeadAssignee(
        id: (j['id'] as String?) ?? '',
        name: (j['name'] as String?) ?? '',
        role: j['role'] as String?,
      );
}

class LeadFollowUps {
  const LeadFollowUps({
    required this.items,
    this.overdue = 0,
    this.today = 0,
    this.upcoming = 0,
    this.due = 0,
  });

  final List<Lead> items;
  final int overdue;
  final int today;
  final int upcoming;
  final int due;

  factory LeadFollowUps.fromJson(Map<String, dynamic> j) {
    final c = jsonMap(j['counts']);
    return LeadFollowUps(
      items: jsonList(j['items']).map(Lead.fromJson).toList(),
      overdue: jsonInt(c['overdue']),
      today: jsonInt(c['today']),
      upcoming: jsonInt(c['upcoming']),
      due: jsonInt(c['due']),
    );
  }
}

class LeadDuplicate {
  const LeadDuplicate({
    required this.type,
    required this.id,
    required this.name,
    this.status,
    this.memberCode,
    this.matchedOn = const [],
  });

  /// 'LEAD' | 'MEMBER'
  final String type;
  final String id;
  final String name;
  final String? status;
  final String? memberCode;
  final List<String> matchedOn;

  bool get isMember => type == 'MEMBER';

  factory LeadDuplicate.fromJson(Map<String, dynamic> j) => LeadDuplicate(
        type: (j['type'] as String?) ?? 'LEAD',
        id: (j['id'] as String?) ?? '',
        name: (j['name'] as String?) ?? '',
        status: j['status'] as String?,
        memberCode: j['memberCode'] as String?,
        matchedOn: j['matchedOn'] is List
            ? (j['matchedOn'] as List).whereType<String>().toList()
            : const [],
      );
}

class LeadConvertResult {
  const LeadConvertResult({required this.lead, this.member});

  final Lead lead;
  final ConvertedMember? member;
}

/// Backend `gender` enum (`createLeadSchema`) as (wire value, label).
const leadGenderOptions = [
  ('MALE', 'Male'),
  ('FEMALE', 'Female'),
  ('OTHER', 'Other'),
  ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];

/// Digits only, `91`-prefixed when a bare 10-digit number (same rule as the
/// Members list's WhatsApp button and web).
String leadWaNumber(String phone) {
  final digits = phone.replaceAll(RegExp(r'\D'), '');
  return digits.length == 10 ? '91$digits' : digits;
}
