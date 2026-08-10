/// Maps the API's shared envelope (`{ success, message, data, errors,
/// timestamp, requestId }`) into something screens can react to directly —
/// mirrors `apps/api/src/core/http/response.ts`'s `ApiResponseBody` shape.
class FieldError {
  const FieldError({required this.message, this.field, this.code});

  final String? field;
  final String? code;
  final String message;

  factory FieldError.fromJson(Map<String, dynamic> json) => FieldError(
        field: json['field'] as String?,
        code: json['code'] as String?,
        message: json['message'] as String? ?? 'Something went wrong',
      );
}

class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.fieldErrors = const [],
  });

  final String message;
  final int? statusCode;
  final List<FieldError> fieldErrors;

  /// True for connectivity failures (no response reached the server at all).
  factory ApiException.network() => const ApiException(
        message: 'Can\'t reach FitCloud. Check your connection and try again.',
      );

  factory ApiException.fromResponseData(dynamic data, int? statusCode) {
    if (data is Map<String, dynamic>) {
      final message = data['message'] as String? ?? 'Something went wrong';
      final rawErrors = data['errors'];
      final fieldErrors = rawErrors is List
          ? rawErrors
              .whereType<Map<String, dynamic>>()
              .map(FieldError.fromJson)
              .toList()
          : <FieldError>[];
      return ApiException(
        message: message,
        statusCode: statusCode,
        fieldErrors: fieldErrors,
      );
    }
    return ApiException(
      message: 'Something went wrong',
      statusCode: statusCode,
    );
  }

  /// First field-specific error for [field], if the server flagged one.
  String? errorFor(String field) {
    for (final e in fieldErrors) {
      if (e.field == field) return e.message;
    }
    return null;
  }

  @override
  String toString() => message;
}
