/// Mirrors the API's envelope error shape (core/errors in apps/api) so every
/// repository can surface a field-aware message the same way tenant-web's
/// toXError() wrappers do, instead of a raw Dio exception.
class AppException implements Exception {
  final String message;
  final String? code;
  final int? statusCode;
  final List<FieldError> fieldErrors;

  const AppException({
    required this.message,
    this.code,
    this.statusCode,
    this.fieldErrors = const [],
  });

  factory AppException.fromDioData(dynamic data, int? statusCode) {
    if (data is Map<String, dynamic>) {
      final errors = (data['errors'] as List?)
              ?.map(
                (e) => FieldError(
                  field: e['field']?.toString() ?? '',
                  message: e['message']?.toString() ?? '',
                ),
              )
              .toList() ??
          const <FieldError>[];
      if (errors.isNotEmpty) {
        return AppException(
          message: '${errors.first.field}: ${errors.first.message}',
          code: data['code']?.toString(),
          statusCode: statusCode,
          fieldErrors: errors,
        );
      }
      return AppException(
        message: data['message']?.toString() ?? 'Something went wrong',
        code: data['code']?.toString(),
        statusCode: statusCode,
      );
    }
    return AppException(
      message: 'Something went wrong',
      statusCode: statusCode,
    );
  }

  factory AppException.network() => const AppException(
        message: "Can't reach FitCloud. Check your connection.",
      );

  @override
  String toString() => message;
}

class FieldError {
  final String field;
  final String message;
  const FieldError({required this.field, required this.message});
}
