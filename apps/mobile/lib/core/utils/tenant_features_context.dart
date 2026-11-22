import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../bloc/session/session_cubit.dart';
import '../../models/tenant_branding.dart';
import 'tenant_features.dart';

extension TenantFeatureContext on BuildContext {
  /// The gym of the signed-in session, subscribing this widget to session
  /// changes so a flag refresh rebuilds it. Null when there is no
  /// `SessionCubit` above (isolated widget tests) or nobody is signed in.
  TenantBranding? get watchTenant {
    try {
      return tenantOfSession(watch<SessionCubit>().state);
    } catch (_) {
      return null;
    }
  }

  /// Same lookup without subscribing — for event handlers (outside `build`).
  TenantBranding? get readTenant {
    try {
      return tenantOfSession(read<SessionCubit>().state);
    } catch (_) {
      return null;
    }
  }

  /// [tenantAllows] against the watched session gym; [flag] must be on and,
  /// when [anyOf] is given, at least one of those too. With no session to
  /// judge by (see [watchTenant]) nothing is hidden.
  bool featureOn(String? flag, {List<String> anyOf = const []}) {
    final tenant = watchTenant;
    return tenant == null || tenantAllows(tenant, flag: flag, anyOf: anyOf);
  }
}
