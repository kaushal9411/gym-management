import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/auth_event_bus.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/app_currency.dart';
import '../../models/member_profile.dart';
import '../../models/tenant_branding.dart';
import '../../models/user_profile.dart';
import '../../repositories/auth_repository.dart';
import '../../repositories/member_auth_repository.dart';
import '../../repositories/public_tenant_repository.dart';
import 'session_state.dart';

/// App-wide "who is signed in, on which plane, and for which gym" source of
/// truth. The router listens to this (via `GoRouterRefreshStream`) to
/// redirect between the signed-out flow and each role's authenticated shell.
class SessionCubit extends Cubit<SessionState> {
  SessionCubit({
    required AuthRepository authRepository,
    required MemberAuthRepository memberAuthRepository,
    required PublicTenantRepository publicTenantRepository,
    required SecureStorage storage,
    required AuthEventBus authEventBus,
  })  : _authRepository = authRepository,
        _memberAuthRepository = memberAuthRepository,
        _publicTenantRepository = publicTenantRepository,
        _storage = storage,
        super(const SessionUnknown()) {
    _forcedLogoutSub =
        authEventBus.onForcedLogout.listen((_) => _handleForcedLogout());
  }

  final AuthRepository _authRepository;
  final MemberAuthRepository _memberAuthRepository;
  final PublicTenantRepository _publicTenantRepository;
  final SecureStorage _storage;
  late final StreamSubscription<void> _forcedLogoutSub;

  Future<void> restore() async {
    final actorType = await _storage.readActorType();
    final slug = await _storage.readTenantSlug();
    if (actorType != null && slug != null) {
      try {
        switch (actorType) {
          case ActorType.staff:
            final Future<UserProfile> userFuture = _authRepository.me();
            final Future<TenantBranding> tenantFuture =
                _publicTenantRepository.resolve(slug);
            emit(
              SessionAuthenticatedStaff(await userFuture, await tenantFuture),
            );
            unawaited(AppCurrency.refresh());
            return;
          case ActorType.member:
            final member = await _memberAuthRepository.restoreCachedProfile();
            if (member != null) {
              emit(
                SessionAuthenticatedMember(
                  member,
                  await _publicTenantRepository.resolve(slug),
                ),
              );
              return;
            }
        }
      } catch (_) {
        // Falls through to the remembered-gym lookup below.
      }
      await _storage.clearSession();
    }
    emit(await _unauthenticatedWithMemory());
  }

  /// No valid session, but this device may still remember which gym+role
  /// it was last used for — resolved here so the router can send a
  /// returning user straight to Login instead of Find Gym. Any failure
  /// (nothing remembered, the remembered gym no longer resolves) falls
  /// back to a bare unauthenticated state, which sends them to Find Gym.
  Future<SessionUnauthenticated> _unauthenticatedWithMemory() async {
    final slug = await _storage.readTenantSlug();
    if (slug == null) return const SessionUnauthenticated();
    try {
      final recents = await _publicTenantRepository.recentGyms();
      RecentGym? match;
      for (final gym in recents) {
        if (gym.slug == slug) {
          match = gym;
          break;
        }
      }
      if (match == null) return const SessionUnauthenticated();
      final tenant = await _publicTenantRepository.resolve(slug);
      final role =
          match.actorType == ActorType.staff ? AppRole.staff : AppRole.member;
      return SessionUnauthenticated(
        rememberedRole: role,
        rememberedTenant: tenant,
      );
    } catch (_) {
      return const SessionUnauthenticated();
    }
  }

  /// Explicit "Change gym" — clears only the in-memory remembered
  /// gym/role so the router allows Find Gym again this session. Storage
  /// is left untouched until the user actually resolves a new gym
  /// (`PublicTenantRepository.resolve` overwrites it then); backing out
  /// without picking one keeps the old gym remembered for next launch.
  void startGymChange() {
    AppCurrency.reset();
    emit(const SessionUnauthenticated());
  }

  void staffSignedIn(UserProfile user, TenantBranding tenant) {
    emit(SessionAuthenticatedStaff(user, tenant));
    unawaited(AppCurrency.refresh());
  }

  /// Re-fetches `/auth/me` and re-emits — used after a self-profile edit
  /// (e.g. name change) so the header avatar/greeting shown app-wide stays
  /// in sync without requiring a full re-login.
  Future<void> refreshStaffUser() async {
    final current = state;
    if (current is! SessionAuthenticatedStaff) return;
    final user = await _authRepository.me();
    emit(SessionAuthenticatedStaff(user, current.tenant));
  }

  void memberSignedIn(MemberProfile member, TenantBranding tenant) =>
      emit(SessionAuthenticatedMember(member, tenant));

  Future<void> signOut() async {
    final current = state;
    if (current is SessionAuthenticatedStaff) {
      await _authRepository.logout();
    } else if (current is SessionAuthenticatedMember) {
      await _memberAuthRepository.logout();
    }
    AppCurrency.reset();
    emit(await _unauthenticatedWithMemory());
  }

  Future<void> _handleForcedLogout() async {
    if (state is SessionUnauthenticated || state is SessionUnknown) return;
    await _storage.clearSession();
    emit(await _unauthenticatedWithMemory());
  }

  @override
  Future<void> close() {
    _forcedLogoutSub.cancel();
    return super.close();
  }
}
