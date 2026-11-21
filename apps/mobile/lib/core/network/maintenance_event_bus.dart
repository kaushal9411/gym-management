import 'dart:async';

/// One "the server says it is in maintenance" observation, raised from places
/// that know nothing about Bloc/GetIt (the Dio interceptor, the branding
/// resolve call). `MaintenanceCubit` listens and turns it into the
/// full-screen maintenance overlay — same decoupling as [AuthEventBus].
class MaintenanceSignal {
  const MaintenanceSignal({
    this.message,
    this.gymName,
    this.slug,
    this.platform = false,
  });

  /// The admin's custom text (or the API's default text), when known.
  final String? message;

  /// The gym's display name, when the signal came from a branding resolve.
  final String? gymName;
  final String? slug;

  /// Came from `GET /public/platform-config` (the platform-wide switch, seen
  /// before any gym is known). Like a resolve, its message is authoritative.
  final bool platform;

  /// The signal carries authoritative copy (a branding resolve or the
  /// platform config) rather than being a bare 503.
  bool get authoritative => slug != null || platform;
}

class MaintenanceEventBus {
  final _controller = StreamController<MaintenanceSignal>.broadcast();

  Stream<MaintenanceSignal> get onMaintenance => _controller.stream;

  void notify(MaintenanceSignal signal) {
    if (!_controller.isClosed) _controller.add(signal);
  }

  void dispose() => _controller.close();
}
