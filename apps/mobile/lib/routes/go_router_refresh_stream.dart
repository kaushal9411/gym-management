import 'dart:async';

import 'package:flutter/foundation.dart';

/// Bridges a Bloc/Cubit's state Stream into the Listenable GoRouter's
/// `refreshListenable` expects, so a session-state change (e.g. logout)
/// re-runs `redirect` without needing a manual `context.go` at every call site.
class GoRouterRefreshStream extends ChangeNotifier {
  late final StreamSubscription<dynamic> _subscription;

  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
