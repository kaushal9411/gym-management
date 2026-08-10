import 'dart:async';

/// Fired when a session is invalidated somewhere the UI didn't directly
/// trigger it — e.g. a refresh-token attempt inside the Dio interceptor
/// fails while a background request was in flight. `SessionCubit` listens
/// for this and drops back to the signed-out state so the router redirects
/// to Login, without the interceptor needing to know about Bloc/GetIt.
class AuthEventBus {
  final _controller = StreamController<void>.broadcast();

  Stream<void> get onForcedLogout => _controller.stream;

  void notifyForcedLogout() => _controller.add(null);

  void dispose() => _controller.close();
}
