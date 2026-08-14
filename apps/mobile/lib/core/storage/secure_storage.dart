import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Which auth plane the stored session belongs to — staff hits `/auth/*`
/// (email+password, optional 2FA), member hits `/member/auth/*`
/// (memberId+password, no 2FA). Two entirely separate JWT audiences on the
/// backend, never mixed.
enum ActorType { staff, member }

/// One entry in the on-device "recently used gyms" list — backs the Find
/// Gym screen's dropdown so a returning user taps instead of retyping a
/// slug. Deliberately local-only: the API has no "list all tenants"
/// directory endpoint (and shouldn't — that would let anyone enumerate
/// every gym on the platform), so this is built purely from gyms this
/// device has actually resolved before, never fetched from the server.
class RecentGym {
  const RecentGym({
    required this.slug,
    required this.name,
    required this.actorType,
  });

  final String slug;
  final String name;
  final ActorType actorType;

  /// Same "first two letters of the first two words" rule as
  /// `TenantBranding.initials` — duplicated rather than shared since this
  /// class only ever carries a name, matching how each model in this app
  /// (e.g. `IamUser.initials`) owns its own copy of this getter.
  String get initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  Map<String, dynamic> toJson() =>
      {'slug': slug, 'name': name, 'actorType': actorType.name};

  factory RecentGym.fromJson(Map<String, dynamic> json) => RecentGym(
        slug: json['slug'] as String,
        name: json['name'] as String,
        actorType: ActorType.values.byName(json['actorType'] as String),
      );
}

class SecureStorage {
  SecureStorage(this._storage);

  final FlutterSecureStorage _storage;

  static const _keyTenantSlug = 'tenant_slug';
  static const _keyActorType = 'actor_type';
  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyMemberProfile = 'member_profile';
  static const _keyRecentGyms = 'recent_gyms';
  static const _maxRecentGyms = 6;

  Future<void> saveTenantSlug(String slug) =>
      _storage.write(key: _keyTenantSlug, value: slug);

  Future<String?> readTenantSlug() => _storage.read(key: _keyTenantSlug);

  Future<List<RecentGym>> readRecentGyms() async {
    final raw = await _storage.read(key: _keyRecentGyms);
    if (raw == null) return const [];
    final list = jsonDecode(raw) as List;
    return list
        .map((e) => RecentGym.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Most-recently-used first; re-selecting an already-remembered gym
  /// moves it to the front and refreshes its display name instead of
  /// duplicating the row. Capped so a device shared across many demo
  /// tenants can't grow this unbounded.
  Future<void> rememberGym(RecentGym gym) async {
    final existing = await readRecentGyms();
    final next = [
      gym,
      ...existing.where((g) => g.slug != gym.slug),
    ].take(_maxRecentGyms).toList();
    await _storage.write(
      key: _keyRecentGyms,
      value: jsonEncode(next.map((g) => g.toJson()).toList()),
    );
  }

  Future<void> forgetGym(String slug) async {
    final existing = await readRecentGyms();
    final next = existing.where((g) => g.slug != slug).toList();
    await _storage.write(
      key: _keyRecentGyms,
      value: jsonEncode(next.map((g) => g.toJson()).toList()),
    );
  }

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
