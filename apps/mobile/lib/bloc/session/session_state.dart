import 'package:equatable/equatable.dart';

import '../../models/member_profile.dart';
import '../../models/tenant_branding.dart';
import '../../models/user_profile.dart';

sealed class SessionState extends Equatable {
  const SessionState();

  @override
  List<Object?> get props => [];
}

/// Restoring a session from secure storage — the router shows Splash while in this state.
class SessionUnknown extends SessionState {
  const SessionUnknown();
}

/// Signed out. The gym is never remembered or asked for up front: login
/// discovers it from the credentials (`PublicTenantRepository.discoverGyms`).
class SessionUnauthenticated extends SessionState {
  const SessionUnauthenticated();

  @override
  List<Object?> get props => const [];
}

class SessionAuthenticatedStaff extends SessionState {
  const SessionAuthenticatedStaff(this.user, this.tenant);

  final UserProfile user;
  final TenantBranding tenant;

  @override
  List<Object?> get props => [user.id, tenant.slug];
}

class SessionAuthenticatedMember extends SessionState {
  const SessionAuthenticatedMember(this.member, this.tenant);

  final MemberProfile member;
  final TenantBranding tenant;

  @override
  List<Object?> get props =>
      [member.id, member.name, member.profilePhotoUrl, tenant.slug];
}
