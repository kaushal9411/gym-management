import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../core/network/auth_event_bus.dart';
import '../../core/network/module_event_bus.dart';
import '../../core/push/push_notification_service.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/utils/tenant_features.dart';
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
    required PushNotificationService pushNotificationService,
    ModuleEventBus? moduleEventBus,
    Duration moduleRefreshDebounce = const Duration(milliseconds: 800),
  })  : _authRepository = authRepository,
        _memberAuthRepository = memberAuthRepository,
        _publicTenantRepository = publicTenantRepository,
        _storage = storage,
        _pushNotificationService = pushNotificationService,
        _moduleRefreshDebounce = moduleRefreshDebounce,
        super(const SessionUnknown()) {
    _forcedLogoutSub =
        authEventBus.onForcedLogout.listen((_) => _handleForcedLogout());
    // A 403 "This module is currently unavailable." means a flag the app still
    // holds as on was switched off: re-read the flags. A burst of 403s (every
    // card of a dashboard failing at once) is debounced into ONE refresh.
    _moduleSub = moduleEventBus?.onModuleUnavailable.listen((_) {
      _moduleDebounce?.cancel();
      _moduleDebounce = Timer(_moduleRefreshDebounce, () => refreshTenant());
    });
  }

  final AuthRepository _authRepository;
  final MemberAuthRepository _memberAuthRepository;
  final PublicTenantRepository _publicTenantRepository;
  final SecureStorage _storage;
  final PushNotificationService _pushNotificationService;
  late final StreamSubscription<void> _forcedLogoutSub;
  StreamSubscription<void>? _moduleSub;
  Timer? _moduleDebounce;
  final Duration _moduleRefreshDebounce;
  bool _refreshingTenant = false;
  DateTime? _lastTenantRefresh;

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
            unawaited(_pushNotificationService.registerForSession(actorType));
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
              unawaited(
                _pushNotificationService.registerForSession(actorType),
              );
              return;
            }
        }
      } on ApiException catch (e) {
        // Maintenance is not a dead session: keep the tokens and stay on the
        // splash. The app-wide maintenance overlay (MaintenanceCubit, raised by
        // the Dio interceptor) covers it; once maintenance ends it calls
        // restore() again.
        if (e.isMaintenance) return;
        // Anything else falls through to the sign-out below.
      } catch (_) {
        // Falls through to the remembered-gym lookup below.
      }
      await _storage.clearSession();
    }
    emit(const SessionUnauthenticated());
  }

  void staffSignedIn(UserProfile user, TenantBranding tenant) {
    emit(SessionAuthenticatedStaff(user, tenant));
    unawaited(AppCurrency.refresh());
    unawaited(_pushNotificationService.registerForSession(ActorType.staff));
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

  /// Re-resolves the signed-in gym (`GET /public/tenants/resolve`, public, so
  /// it also answers during maintenance) and emits a NEW authenticated state
  /// ONLY when the tenant differs — in practice its `featureFlags`: a module the
  /// owner or platform switched off (or back on) while the app stayed open.
  /// The same user/member is kept; nothing is emitted for an unchanged gym, and
  /// a failed lookup is ignored (the next resume/403 tries again).
  ///
  /// [minInterval] skips the call when the last attempt was more recent (the
  /// app-resume caller passes ~60 s; the 403 path passes none).
  Future<void> refreshTenant({Duration? minInterval}) async {
    final start = tenantOfSession(state);
    if (start == null || _refreshingTenant) return;
    final last = _lastTenantRefresh;
    if (minInterval != null &&
        last != null &&
        DateTime.now().difference(last) < minInterval) {
      return;
    }
    _refreshingTenant = true;
    _lastTenantRefresh = DateTime.now();
    try {
      final slug = await _storage.readTenantSlug() ?? start.slug;
      final fresh = await _publicTenantRepository.resolve(slug);
      // Re-read the state: the user may have signed out (or changed) while the
      // lookup was in flight.
      final now = state;
      final latest = tenantOfSession(now);
      if (latest == null || fresh == latest) return;
      if (now is SessionAuthenticatedStaff) {
        emit(SessionAuthenticatedStaff(now.user, fresh));
      } else if (now is SessionAuthenticatedMember) {
        emit(SessionAuthenticatedMember(now.member, fresh));
      }
    } catch (_) {
      // Best-effort: keep the flags we have.
    } finally {
      _refreshingTenant = false;
    }
  }

  void memberSignedIn(MemberProfile member, TenantBranding tenant) {
    emit(SessionAuthenticatedMember(member, tenant));
    unawaited(_pushNotificationService.registerForSession(ActorType.member));
  }

  /// Self-service profile edit/photo change: keeps the name/photo shown in
  /// the member header, menu and dashboard in sync (and in the cold-start
  /// cache) without a re-login. [clearPhoto] removes the photo.
  Future<void> memberProfileChanged({
    String? name,
    String? email,
    String? profilePhotoUrl,
    bool clearPhoto = false,
  }) async {
    final current = state;
    if (current is! SessionAuthenticatedMember) return;
    final next = current.member.copyWith(
      name: name,
      email: email,
      profilePhotoUrl: profilePhotoUrl,
      clearPhoto: clearPhoto,
    );
    emit(SessionAuthenticatedMember(next, current.tenant));
    try {
      await _storage.saveMemberProfile(next.toJson());
    } catch (_) {
      // Cache write is best-effort; the in-memory session is already updated.
    }
  }

  Future<void> signOut() async {
    final current = state;
    if (current is SessionAuthenticatedStaff) {
      // Unregister BEFORE logout invalidates this device's tokens — the
      // DELETE call still needs a valid Authorization header.
      await _pushNotificationService.unregister(ActorType.staff);
      await _authRepository.logout();
    } else if (current is SessionAuthenticatedMember) {
      await _pushNotificationService.unregister(ActorType.member);
      await _memberAuthRepository.logout();
    }
    AppCurrency.reset();
    emit(const SessionUnauthenticated());
  }

  Future<void> _handleForcedLogout() async {
    if (state is SessionUnauthenticated || state is SessionUnknown) return;
    final actorType = await _storage.readActorType();
    if (actorType != null) {
      await _pushNotificationService.unregister(actorType);
    }
    await _storage.clearSession();
    emit(const SessionUnauthenticated());
  }

  @override
  Future<void> close() {
    _forcedLogoutSub.cancel();
    _moduleSub?.cancel();
    _moduleDebounce?.cancel();
    return super.close();
  }
}
