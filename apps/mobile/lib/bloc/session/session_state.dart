import 'package:equatable/equatable.dart';

import '../../core/theme/app_colors.dart';
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

/// Signed out. [rememberedRole]/[rememberedTenant] are set when this
/// device has a remembered gym+role from a previous session (cold-start
/// restore, sign-out, or a forced logout) — the router sends the user
/// straight to Login for that gym instead of Find Gym. Both null means a
/// genuinely fresh device, or the user explicitly asked to change gyms.
class SessionUnauthenticated extends SessionState {
  const SessionUnauthenticated({this.rememberedRole, this.rememberedTenant});

  final AppRole? rememberedRole;
  final TenantBranding? rememberedTenant;

  @override
  List<Object?> get props => [rememberedRole, rememberedTenant?.slug];
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
  List<Object?> get props => [member.id, tenant.slug];
}
