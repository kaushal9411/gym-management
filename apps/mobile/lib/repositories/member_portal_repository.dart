import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../models/body_measurement.dart';
import '../models/class_session.dart';
import '../models/diet_plan.dart';
import '../models/member_booking.dart';
import '../models/member_diet_assignment.dart';
import '../models/member_invoice.dart';
import '../models/member_portal_profile.dart';
import '../models/member_visit.dart';
import '../models/member_workout_assignment.dart';
import '../models/member_workout_progress.dart';
import '../models/paginated_result.dart';

/// The member plane's single API surface (`/portal/*`) — every route is
/// gated by `memberAuthenticateMiddleware` and always scoped to the
/// caller's own id server-side, so nothing here takes a memberId.
class MemberPortalRepository {
  MemberPortalRepository(this._dio);

  final Dio _dio;

  Future<MemberPortalProfile> me() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/portal/me');
      return MemberPortalProfile.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<PaginatedResult<MemberVisit>> attendance({
    int page = 1,
    int limit = 30,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/portal/attendance',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MemberVisit.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberWorkoutAssignment?> workout() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/portal/workout');
      final data = response.data!['data'];
      return data == null
          ? null
          : MemberWorkoutAssignment.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberWorkoutAssignment> markWorkoutProgress({
    required String assignmentId,
    required String exerciseId,
    required ExerciseProgressStatus status,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/portal/workout/$assignmentId/progress',
        data: {'exerciseId': exerciseId, 'status': status.apiValue},
      );
      return MemberWorkoutAssignment.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<MemberDietAssignment?> diet() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/portal/diet');
      final data = response.data!['data'];
      return data == null
          ? null
          : MemberDietAssignment.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Partial by design — the backend merges into the existing day's log
  /// rather than overwriting, so logging just water can't wipe an
  /// already-logged meal.
  Future<MemberDietAssignment> logDiet({
    required String assignmentId,
    required DateTime date,
    int? waterIntakeMl,
    double? weightKg,
    Map<MealType, ExerciseProgressStatus>? mealsStatus,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/portal/diet/$assignmentId/log',
        data: {
          'date': date.toIso8601String().substring(0, 10),
          if (waterIntakeMl != null) 'waterIntakeMl': waterIntakeMl,
          if (weightKg != null) 'weightKg': weightKg,
          if (mealsStatus != null)
            'mealsStatus': {
              for (final e in mealsStatus.entries)
                e.key.apiValue: e.value.apiValue,
            },
        },
      );
      return MemberDietAssignment.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<PaginatedResult<MemberInvoice>> invoices({
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/portal/invoices',
        queryParameters: {'page': page, 'limit': limit},
      );
      return PaginatedResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
        MemberInvoice.fromJson,
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<ClassSession>> classes({
    required DateTime dateFrom,
    required DateTime dateTo,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/portal/classes',
        queryParameters: {
          'dateFrom': dateFrom.toIso8601String().substring(0, 10),
          'dateTo': dateTo.toIso8601String().substring(0, 10),
        },
      );
      final list = response.data!['data'] as List;
      return list
          .map((e) => ClassSession.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<List<MemberBooking>> myBookings() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/portal/bookings');
      final list = response.data!['data'] as List;
      return list
          .map((e) => MemberBooking.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> bookClass(String sessionId) async {
    try {
      await _dio.post<void>('/portal/classes/$sessionId/book');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> cancelBooking(String bookingId) async {
    try {
      await _dio.post<void>('/portal/bookings/$bookingId/cancel');
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// In-app password change — revokes every other active session on
  /// success (this device stays signed in), same guarantee as the staff
  /// plane's `PATCH /auth/change-password`.
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _dio.post<void>(
        '/portal/change-password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Own body measurement history, newest first — reuses the staff-side
  /// `BodyMeasurement` DTO shape (identical, nothing needs hiding for the
  /// member it belongs to). Read-only: a member never edits their own
  /// measurements, only a trainer/owner/manager logs them.
  Future<List<BodyMeasurement>> measurements() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/portal/measurements');
      final data = response.data!['data'] as List<dynamic>;
      return data
          .map((e) => BodyMeasurement.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  /// Returns the export payload itself (this backend builds it inline — it
  /// does not email a link), so the UI can only report what it contains.
  Future<Map<String, dynamic>> gdprExport() async {
    try {
      final response =
          await _dio.get<Map<String, dynamic>>('/portal/gdpr-export');
      return response.data!['data'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  ApiException _mapError(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return ApiException.network();
    }
    return ApiException.fromResponseData(
      e.response?.data,
      e.response?.statusCode,
    );
  }
}
