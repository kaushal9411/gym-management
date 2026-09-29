import 'package:dio/dio.dart';

import '../core/network/api_exception.dart';
import '../core/storage/secure_storage.dart';

/// Registers/unregisters this device's FCM token for push notifications —
/// staff hits `POST/DELETE /profile/device-token`, member hits
/// `POST/DELETE /portal/device-token`. Same self-service, no-permission-key
/// pattern as the rest of each of those modules (see backend
/// `modules/profile`/`modules/member-portal`).
class DeviceTokenRepository {
  DeviceTokenRepository(this._dio);

  final Dio _dio;

  Future<void> register(ActorType actorType, String token) async {
    try {
      await _dio.post<Map<String, dynamic>>(
        _pathFor(actorType),
        data: {'token': token, 'platform': 'ANDROID'},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  Future<void> unregister(ActorType actorType, String token) async {
    try {
      await _dio.delete<Map<String, dynamic>>(
        _pathFor(actorType),
        data: {'token': token},
      );
    } on DioException catch (e) {
      throw _mapError(e);
    }
  }

  String _pathFor(ActorType actorType) => actorType == ActorType.staff
      ? '/profile/device-token'
      : '/portal/device-token';

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
