import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/auth/data/auth_repository.dart';
import '../../models/session_user.dart';
import '../../models/tenant.dart';
import '../../storage/secure_storage.dart';
import 'session_state.dart';

/// App-global session state — the one thing that's genuinely cross-feature,
/// so it lives in top-level bloc/ per the documented mobile anatomy rather
/// than inside features/auth. GoRouter's redirect reads this to gate routes,
/// the same job RequireAuth/RequireSubscription do on tenant-web.
class SessionCubit extends Cubit<SessionState> {
  final AuthRepository _authRepository;
  final SecureStorage _storage;

  SessionCubit(this._authRepository, this._storage)
      : super(const SessionBooting());

  Future<void> boot() async {
    final slug = await _storage.tenantSlug;
    if (slug == null || slug.isEmpty) {
      emit(const SessionNeedsTenant());
      return;
    }
    try {
      final tenant = await _authRepository.resolveTenant(slug);
      final token = await _storage.accessToken;
      if (token == null || token.isEmpty) {
        emit(SessionNeedsLogin(tenant));
        return;
      }
      // A stored token isn't proof of a valid session — the first
      // authenticated call (dashboard) will 401 -> refresh -> logout
      // via the interceptor if it's actually stale. We optimistically
      // restore SessionUser from nothing here, so re-derive it on demand.
      emit(SessionNeedsLogin(tenant));
    } catch (_) {
      emit(const SessionNeedsTenant());
    }
  }

  Future<Tenant> resolveTenant(String slug) async {
    final tenant = await _authRepository.resolveTenant(slug);
    emit(SessionNeedsLogin(tenant));
    return tenant;
  }

  void authenticated(Tenant tenant, SessionUser user) {
    emit(SessionAuthenticated(tenant: tenant, user: user));
  }

  Future<void> logout() async {
    final current = state;
    await _authRepository.logout();
    if (current is SessionAuthenticated) {
      emit(SessionNeedsLogin(current.tenant));
    } else {
      emit(const SessionNeedsTenant());
    }
  }
}
