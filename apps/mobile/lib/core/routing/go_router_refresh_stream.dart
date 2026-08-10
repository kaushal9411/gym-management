import 'dart:async';

import 'package:flutter/foundation.dart';

/// Adapts a Bloc/Cubit's `Stream<State>` into a `Listenable` so `GoRouter`'s
/// `refreshListenable` re-evaluates `redirect` whenever [SessionCubit] emits.
class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen((_) => notifyListeners());
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
