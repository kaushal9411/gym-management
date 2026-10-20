import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/network/comm_failure.dart';
import '../models/comm_audience.dart';
import '../models/comm_automation.dart';
import '../models/comm_campaign.dart';
import '../models/comm_channel.dart';
import '../models/comm_overview.dart';
import '../models/comm_request.dart';
import '../models/paginated_result.dart';
import '../models/payments_analytics.dart' show jsonInt, jsonList, jsonMap;

/// The staff plane's Communications surface (`/communications/*`, behind the
/// `notifications` module flag): hub overview, audience preview + picker,
/// campaigns (create / list / detail / recipients / cancel / retry) and the
/// automations. Permissions: `notifications:view` reads, `notifications:send`
/// audience + campaign writes, `notifications:manage` automation writes.
///
/// Every failure is thrown as a [CommFailure] (an [ApiException]) with a
/// human message and the structured parts (field errors, short channels...).
class CommunicationsRepository {
  CommunicationsRepository(this._dio);

  final Dio _dio;

  /// `GET /communications/overview`.
  Future<CommOverview> overview() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/communications/overview',
        );
        return CommOverview.fromJson(_data(r));
      });

  /// `POST /communications/audience/preview` (120/min). [channels] null = all
  /// five (what the Channels step needs to draw every meter).
  Future<AudiencePreview> previewAudience({
    required AudienceMode mode,
    AudienceFilter filter = AudienceFilter.empty,
    List<String> pickedMemberIds = const [],
    List<CommChannel>? channels,
    String? title,
    String? body,
  }) =>
      _run(
        () async {
          final r = await _dio.post<Map<String, dynamic>>(
            '/communications/audience/preview',
            data: {
              'audienceMode': mode.api,
              if (mode == AudienceMode.filters)
                'audienceFilter': filter.toJson(),
              if (mode == AudienceMode.picked)
                'pickedMemberIds': pickedMemberIds,
              if (channels != null && channels.isNotEmpty)
                'channels': [for (final c in channels) c.api],
              if (title != null && title.trim().isNotEmpty)
                'title': title.trim(),
              if (body != null && body.trim().isNotEmpty) 'body': body.trim(),
            },
          );
          return AudiencePreview.fromJson(_data(r));
        },
        permission: 'notifications:send',
      );

  /// `GET /communications/audience/members` — the picker (needs only
  /// `notifications:send`, branch-scoped, no contact values).
  Future<PaginatedResult<PickerMember>> pickerMembers({
    String? search,
    String? branchId,
    int page = 1,
    int limit = 20,
  }) =>
      _run(
        () async {
          final r = await _dio.get<Map<String, dynamic>>(
            '/communications/audience/members',
            queryParameters: {
              'page': page,
              'limit': limit,
              if (search != null && search.trim().isNotEmpty)
                'search': search.trim(),
              if (branchId != null) 'branchId': branchId,
            },
          );
          return PaginatedResult.fromJson(_data(r), PickerMember.fromJson);
        },
        permission: 'notifications:send',
      );

  /// `POST /communications/campaigns` with an optional `Idempotency-Key`
  /// (a repeat returns the first campaign, flagged `idempotentReplay`).
  Future<CommCampaign> createCampaign(
    CampaignRequest request, {
    String? idempotencyKey,
  }) =>
      _run(
        () async {
          final r = await _dio.post<Map<String, dynamic>>(
            '/communications/campaigns',
            data: request.toJson(),
            options: Options(
              headers: {
                if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
              },
            ),
          );
          return CommCampaign.fromJson(_data(r));
        },
        permission: 'notifications:send',
      );

  /// `GET /communications/campaigns` with the per-status `counts` block.
  Future<({PaginatedResult<CommCampaign> page, CampaignCounts? counts})>
      campaigns({
    CampaignStatus? status,
    String? search,
    int page = 1,
    int limit = 20,
  }) =>
          _run(() async {
            final r = await _dio.get<Map<String, dynamic>>(
              '/communications/campaigns',
              queryParameters: {
                'page': page,
                'limit': limit,
                if (status != null && status != CampaignStatus.unknown)
                  'status': status.api,
                if (search != null && search.trim().isNotEmpty)
                  'search': search.trim(),
              },
            );
            final data = _data(r);
            return (
              page: PaginatedResult.fromJson(data, CommCampaign.fromJson),
              counts: CampaignCounts.tryParse(data['counts']),
            );
          });

  /// `GET /communications/campaigns/:id`.
  Future<CampaignDetail> campaign(String id) => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/communications/campaigns/$id',
        );
        return CampaignDetail.fromJson(_data(r));
      });

  /// `GET /communications/campaigns/:id/recipients`. [status] is one
  /// `RecipientStatus`; [channel] filters to one channel.
  Future<PaginatedResult<CampaignRecipient>> recipients(
    String id, {
    String? status,
    CommChannel? channel,
    int page = 1,
    int limit = 30,
  }) =>
      _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/communications/campaigns/$id/recipients',
          queryParameters: {
            'page': page,
            'limit': limit,
            if (status != null && status.isNotEmpty) 'status': status,
            if (channel != null) 'channel': channel.api,
          },
        );
        return PaginatedResult.fromJson(_data(r), CampaignRecipient.fromJson);
      });

  /// `POST /communications/campaigns/:id/cancel`.
  Future<CommCampaign> cancelCampaign(String id) => _run(
        () async {
          final r = await _dio.post<Map<String, dynamic>>(
            '/communications/campaigns/$id/cancel',
          );
          return CommCampaign.fromJson(_data(r));
        },
        permission: 'notifications:send',
      );

  /// `POST /communications/campaigns/:id/retry-failed` — failed messages go
  /// back to the queue; skipped ones are never retried.
  Future<({int retried, CommCampaign campaign})> retryFailed(String id) => _run(
        () async {
          final r = await _dio.post<Map<String, dynamic>>(
            '/communications/campaigns/$id/retry-failed',
          );
          final data = _data(r);
          return (
            retried: jsonInt(data['retried']),
            campaign: CommCampaign.fromJson(jsonMap(data['campaign'])),
          );
        },
        permission: 'notifications:send',
      );

  /// `GET /communications/automations`.
  Future<AutomationList> automations() => _run(() async {
        final r = await _dio.get<Map<String, dynamic>>(
          '/communications/automations',
        );
        return AutomationList.fromJson(_data(r));
      });

  /// `PUT /communications/automations/:key` (perm `notifications:manage`).
  /// [offsets] is omitted for fixed-timing rules; title/body overrides are
  /// left untouched (omitted).
  Future<AutomationRule> updateAutomation(
    String key, {
    required bool enabled,
    required List<CommChannel> channels,
    List<int>? offsets,
  }) =>
      _run(
        () async {
          final r = await _dio.put<Map<String, dynamic>>(
            '/communications/automations/$key',
            data: {
              'enabled': enabled,
              if (offsets != null) 'offsets': offsets,
              'channels': [for (final c in channels) c.api],
            },
          );
          return AutomationRule.fromJson(_data(r));
        },
        permission: 'notifications:manage',
      );

  /// `POST /communications/automations/:key/test` (perm
  /// `notifications:manage`, 10/min): the rule's saved message to the staff
  /// member's own contact. [channels] must exclude IN_APP.
  Future<List<TestSendResult>> testAutomation(
    String key, {
    List<CommChannel>? channels,
  }) =>
      _run(
        () async {
          final r = await _dio.post<Map<String, dynamic>>(
            '/communications/automations/$key/test',
            data: {
              if (channels != null && channels.isNotEmpty)
                'channels': [for (final c in channels) c.api],
            },
          );
          return jsonList(_data(r)['results'])
              .map(TestSendResult.fromJson)
              .toList();
        },
        permission: 'notifications:manage',
      );

  // ── plumbing ──────────────────────────────────────────────────────────

  Map<String, dynamic> _data(Response<Map<String, dynamic>> r) =>
      jsonMap(r.data?['data']);

  Future<T> _run<T>(
    Future<T> Function() call, {
    String permission = 'notifications:view',
  }) async {
    try {
      return await call();
    } on DioException catch (e) {
      throw CommFailure.from(_toApi(e), permission: permission);
    }
  }

  ApiException _toApi(DioException e) {
    if (e.response == null) return ApiException.network();
    return ApiException.fromResponseData(
      e.response?.data,
      e.response?.statusCode,
    );
  }
}
