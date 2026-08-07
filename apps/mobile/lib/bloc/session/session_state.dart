import '../../models/session_user.dart';
import '../../models/tenant.dart';

sealed class SessionState {
  const SessionState();
}

class SessionBooting extends SessionState {
  const SessionBooting();
}

class SessionNeedsTenant extends SessionState {
  const SessionNeedsTenant();
}

class SessionNeedsLogin extends SessionState {
  final Tenant tenant;
  const SessionNeedsLogin(this.tenant);
}

class SessionAuthenticated extends SessionState {
  final Tenant tenant;
  final SessionUser user;
  const SessionAuthenticated({required this.tenant, required this.user});
}
