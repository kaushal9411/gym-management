import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Which auth plane the stored session belongs to — staff hits `/auth/*`
/// (email+password, optional 2FA), member hits `/member/auth/*`
/// (memberId+password, no 2FA). Two entirely separate JWT audiences on the
/// backend, never mixed.
enum ActorType { staff, member }

class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _keyTenantSlug = 'tenant_slug';
  static const _keyActorType = 'actor_type';
  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyMemberProfile = 'member_profile';

  Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _keyTenantSlug, value: slug);

  Future<String?> readTenantSlug() => _storage.read(key: _keyTenantSlug);

  Future<void> saveSession({
    required ActorType actorType,
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _keyActorType, value: actorType.name);
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
  }

  Future<void> saveAccessToken(String accessToken) =>
      _storage.write(key: _keyAccessToken, value: accessToken);

  Future<String?> readAccessToken() => _storage.read(key: _keyAccessToken);

  Future<String?> readRefreshToken() => _storage.read(key: _keyRefreshToken);

  Future<ActorType?> readActorType() async {
    final raw = await _storage.read(key: _keyActorType);
    for (final actor in ActorType.values) {
      if (actor.name == raw) return actor;
    }
    return null;
  }

  /// Member plane has no lightweight session-validation endpoint that
  /// matches [MemberProfile]'s shape (`/portal/me` returns the full Member
  /// detail DTO, out of scope until the Member module chunk) — so the
  /// profile returned at login is cached here and re-read on cold start
  /// instead of re-fetched. Staff restores via the real `/auth/me` call.
  Future<void> saveMemberProfile(Map<String, dynamic> profileJson) =>
      _storage.write(key: _keyMemberProfile, value: jsonEncode(profileJson));

  Future<Map<String, dynamic>?> readMemberProfile() async {
    final raw = await _storage.read(key: _keyMemberProfile);
    if (raw == null) return null;
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  /// Clears the session (tokens + actor type + cached member profile) but
  /// keeps the remembered tenant slug — so a signed-out user lands back on
  /// Login, not Find Gym.
  Future<void> clearSession() async {
    await _storage.delete(key: _keyActorType);
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyMemberProfile);
  }
}
