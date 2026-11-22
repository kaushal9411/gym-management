import 'dart:async';

/// Fired by the Dio interceptor when the API answers 403 "This module is
/// currently unavailable." — i.e. a module the app still thought was on has
/// been switched off. `SessionCubit` listens and re-resolves the gym's feature
/// flags so the UI hides the module, without the interceptor knowing about
/// Bloc/GetIt (same decoupling as `AuthEventBus` / `MaintenanceEventBus`).
class ModuleEventBus {
  final _controller = StreamController<void>.broadcast();

  Stream<void> get onModuleUnavailable => _controller.stream;

  void notifyModuleUnavailable() {
    if (!_controller.isClosed) _controller.add(null);
  }

  void dispose() => _controller.close();
}
