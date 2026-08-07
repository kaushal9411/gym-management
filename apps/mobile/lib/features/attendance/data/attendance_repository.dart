import 'package:dio/dio.dart';

import '../../../core/errors/app_exception.dart';

class QrValidationResult {
  final bool valid;
  final String? reason;
  final String? memberId;
  final String? memberDisplayId;
  final String? memberName;
  final bool alreadyCheckedIn;

  const QrValidationResult({
    required this.valid,
    this.reason,
    this.memberId,
    this.memberDisplayId,
    this.memberName,
    required this.alreadyCheckedIn,
  });

  factory QrValidationResult.fromJson(Map<String, dynamic> json) {
    final member = json['member'] as Map<String, dynamic>?;
    return QrValidationResult(
      valid: json['valid'] as bool? ?? false,
      reason: json['reason'] as String?,
      memberId: member?['id'] as String?,
      memberDisplayId: member?['memberId'] as String?,
      memberName: member?['name'] as String?,
      alreadyCheckedIn: json['alreadyCheckedIn'] as bool? ?? false,
    );
  }
}

class AttendanceRepository {
  final Dio _dio;
  AttendanceRepository(this._dio);

  Future<QrValidationResult> validateQr(String qrCodeToken) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/attendance/validate-qr',
        data: {'qrCodeToken': qrCodeToken},
      );
      return QrValidationResult.fromJson(
        response.data!['data'] as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }

  Future<void> checkIn(String memberId) async {
    try {
      await _dio.post<void>(
        '/attendance/check-in',
        data: {'memberId': memberId},
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }

  Future<void> checkOut(String memberId) async {
    try {
      await _dio.post<void>(
        '/attendance/check-out',
        data: {'memberId': memberId},
      );
    } on DioException catch (e) {
      throw AppException.fromDioData(e.response?.data, e.response?.statusCode);
    }
  }

  /// Parses the payload apps/api's qrcode generation embeds
  /// (`fitcloud-member:{tenantId}:{token}`) — mirrors tenant-web's
  /// utils/qr-token.ts#extractQrToken.
  static String? extractQrToken(String raw) {
    final parts = raw.split(':');
    if (parts.length == 3 && parts[0] == 'fitcloud-member') return parts[2];
    return null;
  }
}
