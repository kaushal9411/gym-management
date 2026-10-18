import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/lead.dart';
import '../models/lead_analytics.dart';
import '../models/paginated_result.dart';

/// 409 on create/update: the phone/email already belongs to an open lead or
/// a member. [duplicates] drives the banner + links on the form.
class LeadDuplicateException extends ApiException {
  const LeadDuplicateException({
    required super.message,
    required this.duplicates,
  }) : super(statusCode: 409);

  final List<LeadDuplicate> duplicates;
}

/// Server-side list filters (`GET /leads`). Value class so the list screen
/// and the dashboard's tap-through tiles can share it.
class LeadFilters {
  const LeadFilters({
    this.search = '',
    this.status,
    this.sources = const {},
    this.assignedTo,
    this.followUp,
    this.planId,
    this.planName,
    this.createdFrom,
    this.createdTo,
    this.sortBy = 'createdAt',
    this.sortDir = 'desc',
  });

  final String search;

  /// Single status chip (null = All).
  final LeadStatus? status;
  final Set<LeadSource> sources;

  /// uuid | 'me' | 'unassigned' | null
  final String? assignedTo;

  /// 'overdue' | 'today' | 'upcoming' | 'none' | null
  final String? followUp;

  /// Interested plan filter (id + display name for the chip).
  final String? planId;
  final String? planName;

  /// `YYYY-MM-DD` created-date window (inclusive), either end optional.
  final String? createdFrom;
  final String? createdTo;

  /// createdAt | updatedAt | name | nextFollowUpAt | lastActivityAt |
  /// expectedJoinDate, with asc | desc.
  final String sortBy;
  final String sortDir;

  bool get isDefaultSort => sortBy == 'createdAt' && sortDir == 'desc';

  int get activeFilterCount =>
      (sources.isEmpty ? 0 : 1) +
      (assignedTo == null ? 0 : 1) +
      (followUp == null ? 0 : 1) +
      (planId == null ? 0 : 1) +
      (createdFrom == null && createdTo == null ? 0 : 1);

  LeadFilters copyWith({
    String? search,
    LeadStatus? status,
    bool clearStatus = false,
    Set<LeadSource>? sources,
    String? assignedTo,
    bool clearAssignedTo = false,
    String? followUp,
    bool clearFollowUp = false,
    String? planId,
    String? planName,
    bool clearPlan = false,
    String? createdFrom,
    String? createdTo,
    bool clearCreated = false,
    String? sortBy,
    String? sortDir,
  }) =>
      LeadFilters(
        search: search ?? this.search,
        status: clearStatus ? null : (status ?? this.status),
        sources: sources ?? this.sources,
        assignedTo: clearAssignedTo ? null : (assignedTo ?? this.assignedTo),
        followUp: clearFollowUp ? null : (followUp ?? this.followUp),
        planId: clearPlan ? null : (planId ?? this.planId),
        planName: clearPlan ? null : (planName ?? this.planName),
        createdFrom: clearCreated ? null : (createdFrom ?? this.createdFrom),
        createdTo: clearCreated ? null : (createdTo ?? this.createdTo),
        sortBy: sortBy ?? this.sortBy,
        sortDir: sortDir ?? this.sortDir,
      );

  Map<String, dynamic> toQuery() => {
        if (search.isNotEmpty) 'search': search,
        if (status != null) 'status': status!.api,
        if (sources.isNotEmpty) 'source': sources.map((s) => s.api).join(','),
        if (assignedTo != null) 'assignedTo': assignedTo,
        if (followUp != null) 'followUp': followUp,
        if (planId != null) 'interestedPlanId': planId,
        if (createdFrom != null) 'createdFrom': createdFrom,
        if (createdTo != null) 'createdTo': createdTo,
        if (!isDefaultSort) ...{'sortBy': sortBy, 'sortDir': sortDir},
      };
}

class LeadListPage {
  const LeadListPage({required this.page, this.counts, this.summary});

  final PaginatedResult<Lead> page;
  final LeadCounts? counts;
  final LeadSummary? summary;
}

class LeadRepository {
  LeadRepository(this._dio);

  final Dio _dio;

  Future<LeadListPage> list({
    int page = 1,
    int limit = 20,
    LeadFilters filters = const LeadFilters(),
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/leads',
          queryParameters: {
            'page': page,
            'limit': limit,
            ...filters.toQuery(),
          },
        );
        final data = r.data!['data'] as Map<String, dynamic>;
        return LeadListPage(
          page: PaginatedResult.fromJson(data, Lead.fromJson),
          counts: LeadCounts.tryParse(data['counts']),
          summary: LeadSummary.tryParse(data['summary']),
        );
      });

  Future<Lead> getById(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/leads/$id');
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<Lead> create(Map<String, dynamic> body) => _run(() async {
        final r = await _dio.post<Map<String, dynamic>>('/leads', data: body);
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  /// PATCH with ONLY the changed keys (`null` clears optional fields).
  Future<Lead> update(String id, Map<String, dynamic> body) => _run(() async {
        final r =
            await _dio.patch<Map<String, dynamic>>('/leads/$id', data: body);
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<void> delete(String id) => _run(() async {
        await _dio.delete<Map<String, dynamic>>('/leads/$id');
      });

  Future<Lead> changeStatus(
    String id, {
    required LeadStatus status,
    LeadLostReason? lostReason,
    String? lostNote,
    String? note,
  }) =>
      _run(() async {
        final r = await _dio.patch<Map<String, dynamic>>(
          '/leads/$id/status',
          data: {
            'status': status.api,
            if (lostReason != null) 'lostReason': lostReason.api,
            if (lostNote != null && lostNote.isNotEmpty) 'lostNote': lostNote,
            if (note != null && note.isNotEmpty) 'note': note,
          },
        );
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<Lead> assign(String id, String? userId) => _run(() async {
        final r = await _dio.patch<Map<String, dynamic>>(
          '/leads/$id/assign',
          data: {'assignedToUserId': userId},
        );
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  /// [nextFollowUpAt]: pass [clearFollowUp] to send an explicit null.
  Future<Lead> addActivity(
    String id, {
    required LeadActivityType type,
    String? note,
    String? outcome,
    DateTime? nextFollowUpAt,
    bool clearFollowUp = false,
  }) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/leads/$id/activities',
          data: {
            'type': type.api,
            if (note != null && note.isNotEmpty) 'note': note,
            if (outcome != null && outcome.isNotEmpty) 'outcome': outcome,
            if (nextFollowUpAt != null) ...{
              'nextFollowUpAt': nextFollowUpAt.toUtc().toIso8601String(),
              if (type == LeadActivityType.followUp)
                'scheduledFor': nextFollowUpAt.toUtc().toIso8601String(),
            } else if (clearFollowUp)
              'nextFollowUpAt': null,
          },
        );
        return Lead.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<LeadConvertResult> convert(
    String id,
    Map<String, dynamic> body,
  ) =>
      _run(() async {
        final r = await _dio.post<Map<String, dynamic>>(
          '/leads/$id/convert',
          data: body,
        );
        final data = r.data!['data'] as Map<String, dynamic>;
        return LeadConvertResult(
          lead: Lead.fromJson(data['lead'] as Map<String, dynamic>),
          member: ConvertedMember.tryParse(data['member']),
        );
      });

  Future<LeadFollowUps> followUps({
    String scope = 'mine',
    String bucket = 'due',
    int limit = 50,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/leads/follow-ups',
          queryParameters: {'scope': scope, 'bucket': bucket, 'limit': limit},
        );
        return LeadFollowUps.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<List<LeadAssignee>> assignees() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>('/leads/assignees');
        final data = r.data!['data'];
        return data is List
            ? data
                .whereType<Map<String, dynamic>>()
                .map(LeadAssignee.fromJson)
                .toList()
            : <LeadAssignee>[];
      });

  /// [range]: today | 7d | 30d | month | year | custom (needs [dateFrom] and
  /// [dateTo] as `YYYY-MM-DD`, at most 366 days apart).
  Future<LeadAnalytics> analytics({
    String range = '30d',
    String? dateFrom,
    String? dateTo,
    String? branchId,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/leads/analytics',
          queryParameters: {
            'range': range,
            if (range == 'custom' && dateFrom != null) 'dateFrom': dateFrom,
            if (range == 'custom' && dateTo != null) 'dateTo': dateTo,
            if (branchId != null) 'branchId': branchId,
          },
        );
        return LeadAnalytics.fromJson(r.data!['data'] as Map<String, dynamic>);
      });

  Future<T> _run<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      throw mapError(e);
    }
  }

  static ApiException mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }
    final base = ApiException.fromResponseData(
      e.response?.data,
      e.response?.statusCode,
    );
    if (base.statusCode == 409) {
      final raw = e.response?.data;
      final dups = raw is Map<String, dynamic> && raw['data'] is Map
          ? ((raw['data'] as Map)['duplicates'])
          : null;
      if (dups is List && dups.isNotEmpty) {
        return LeadDuplicateException(
          message: base.message,
          duplicates: dups
              .whereType<Map<String, dynamic>>()
              .map(LeadDuplicate.fromJson)
              .toList(),
        );
      }
    }
    return base;
  }
}
