import 'dart:convert';
import 'dart:typed_data';

/// Pure helpers that turn picker bytes into the `data:` URL the backend's
/// `POST /portal/profile/photo` expects, and refuse payloads the server
/// would reject (JSON body cap 1 MB; decoded cap ~740 KB).
const kMaxPhotoPayloadChars = 900000;

class ProfilePhotoException implements Exception {
  const ProfilePhotoException(this.message);
  final String message;
  @override
  String toString() => message;
}

/// 'image/jpeg' | 'image/png' | 'image/webp', sniffed from magic bytes, or
/// null for anything else (GIF/HEIC/...). Never trusts the file extension.
String? sniffImageMime(Uint8List b) {
  if (b.length >= 3 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) {
    return 'image/jpeg';
  }
  if (b.length >= 8 &&
      b[0] == 0x89 &&
      b[1] == 0x50 &&
      b[2] == 0x4E &&
      b[3] == 0x47) {
    return 'image/png';
  }
  if (b.length >= 12 &&
      b[0] == 0x52 && // R
      b[1] == 0x49 && // I
      b[2] == 0x46 && // F
      b[3] == 0x46 && // F
      b[8] == 0x57 && // W
      b[9] == 0x45 && // E
      b[10] == 0x42 && // B
      b[11] == 0x50) {
    // P
    return 'image/webp';
  }
  return null;
}

/// Throws [ProfilePhotoException] with a user-friendly message when the
/// image is an unsupported type or too big to upload.
String buildPhotoDataUrl(Uint8List bytes) {
  final mime = sniffImageMime(bytes);
  if (mime == null) {
    throw const ProfilePhotoException('Choose a JPEG, PNG or WebP photo.');
  }
  final url = 'data:$mime;base64,${base64Encode(bytes)}';
  if (url.length > kMaxPhotoPayloadChars) {
    throw const ProfilePhotoException(
      'That photo is too large. Choose a smaller one or take a new photo.',
    );
  }
  return url;
}
