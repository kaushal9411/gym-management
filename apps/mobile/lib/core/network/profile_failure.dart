import 'api_exception.dart';

enum ProfileFailureKind {
  validation,
  duplicate,
  tooLarge,
  unsupportedImage,
  accountLocked,
  rateLimited,
  network,
  other,
}

/// Typed failure for the member self-service profile endpoints. Extends
/// [ApiException] so generic handlers keep working, but carries a [kind] and
/// a user-friendly [message] (never the raw server text for 409/413/423/429).
class ProfileFailure extends ApiException {
  const ProfileFailure({
    required this.kind,
    required super.message,
    super.statusCode,
    super.fieldErrors,
  });

  final ProfileFailureKind kind;

  factory ProfileFailure.from(ApiException e) {
    switch (e.statusCode) {
      case 409:
        return ProfileFailure(
          kind: ProfileFailureKind.duplicate,
          statusCode: 409,
          message:
              'That email or phone number is already in use. Try a different one.',
        );
      case 413:
        return ProfileFailure(
          kind: ProfileFailureKind.tooLarge,
          statusCode: 413,
          message: 'That photo is too large. Choose a smaller one.',
        );
      case 423:
        return ProfileFailure(
          kind: ProfileFailureKind.accountLocked,
          statusCode: 423,
          message:
              'Too many wrong password attempts. Your account is locked for a while — try again later.',
        );
      case 429:
        return ProfileFailure(
          kind: ProfileFailureKind.rateLimited,
          statusCode: 429,
          message:
              'You are making changes too quickly. Please wait a few minutes and try again.',
        );
      case 422:
      case 400:
        return ProfileFailure(
          kind: ProfileFailureKind.validation,
          statusCode: e.statusCode,
          message: e.fieldErrors.isNotEmpty
              ? e.fieldErrors.first.message
              : e.message,
          fieldErrors: e.fieldErrors,
        );
      case null:
        return ProfileFailure(
          kind: ProfileFailureKind.network,
          message: e.message,
        );
      default:
        return ProfileFailure(
          kind: ProfileFailureKind.other,
          statusCode: e.statusCode,
          message: e.message,
          fieldErrors: e.fieldErrors,
        );
    }
  }
}
