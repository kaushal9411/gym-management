import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around flutter_secure_storage — mirrors what tenant-web's
/// redux-persist `auth` slice holds (tokens), but on-device this has to be
/// the platform keystore/keychain, not persisted JS state.
class SecureStorage {
  final FlutterSecureStorage _storage;

  SecureStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _kAccessToken = 'fitcloud.access_token';
  static const _kRefreshToken = 'fitcloud.refresh_token';
  static const _kTenantSlug = 'fitcloud.tenant_slug';

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    required String tenantSlug,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken, value: accessToken),
      _storage.write(key: _kRefreshToken, value: refreshToken),
      _storage.write(key: _kTenantSlug, value: tenantSlug),
    ]);
  }

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken, value: accessToken),
      _storage.write(key: _kRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> get accessToken => _storage.read(key: _kAccessToken);
  Future<String?> get refreshToken => _storage.read(key: _kRefreshToken);
  Future<String?> get tenantSlug => _storage.read(key: _kTenantSlug);

  Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _kTenantSlug, value: slug);

  Future<void> clearSession() async {
    await Future.wait([
      _storage.delete(key: _kAccessToken),
      _storage.delete(key: _kRefreshToken),
    ]);
  }
}
