import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/maintenance_event_bus.dart';
import '../../core/storage/secure_storage.dart';
import '../../repositories/public_tenant_repository.dart';

class MaintenanceState extends Equatable {
  const MaintenanceState({
    this.active = false,
    this.message,
    this.gymName,
    this.checking = false,
    this.offline = false,
    this.backOnline = false,
  });

  /// The full-screen maintenance overlay is showing.
  final bool active;

  /// The admin's custom text, when one is set (null = default copy).
  final String? message;
  final String? gymName;

  /// A re-check of the public resolve endpoint is in flight.
  final bool checking;

  /// The last re-check couldn't reach the server.
  final bool offline;

  /// The last re-check said maintenance is over; the screen plays its short
  /// celebration, then calls [MaintenanceCubit.dismiss].
  final bool backOnline;

  MaintenanceState copyWith({
    bool? active,
    String? message,
    bool clearMessage = false,
    String? gymName,
    bool? checking,
    bool? offline,
    bool? backOnline,
  }) =>
      MaintenanceState(
        active: active ?? this.active,
        message: clearMessage ? null : (message ?? this.message),
        gymName: gymName ?? this.gymName,
        checking: checking ?? this.checking,
        offline: offline ?? this.offline,
        backOnline: backOnline ?? this.backOnline,
      );

  @override
  List<Object?> get props =>
      [active, message, gymName, checking, offline, backOnline];
}

/// App-wide "the server is in maintenance" flag. It is deliberately NOT part
/// of `SessionCubit`: the session (tokens, role, current route) is never
/// touched — the overlay just sits on top of the live Navigator, so when
/// maintenance ends the user is exactly where they were.
///
/// Raised by [MaintenanceEventBus] (Dio 503 `MAINTENANCE`, or a branding
/// resolve with `maintenanceMode: true`); cleared only by a re-check of the
/// public resolve endpoint, which keeps working during maintenance.
class MaintenanceCubit extends Cubit<MaintenanceState> {
  MaintenanceCubit({
    required MaintenanceEventBus bus,
    required PublicTenantRepository repository,
    required SecureStorage storage,
  })  : _repository = repository,
        _storage = storage,
        super(const MaintenanceState()) {
    _sub = bus.onMaintenance.listen(_onSignal);
  }

  final PublicTenantRepository _repository;
  final SecureStorage _storage;
  late final StreamSubscription<MaintenanceSignal> _sub;
  DateTime? _dismissedAt;
  bool _checking = false;

  /// Requests already in flight when maintenance cleared can still come back
  /// 503; don't let those instantly re-raise the overlay.
  static const _staleSignalWindow = Duration(seconds: 3);

  void _onSignal(MaintenanceSignal signal) {
    if (state.backOnline) return;
    final fromResolve = signal.authoritative;
    final dismissedAt = _dismissedAt;
    if (!fromResolve &&
        !state.active &&
        dismissedAt != null &&
        DateTime.now().difference(dismissedAt) < _staleSignalWindow) {
      return;
    }
    final wasActive = state.active;
    emit(
      state.copyWith(
        active: true,
        offline: false,
        gymName: signal.gymName,
        message: signal.message,
        // A resolve is authoritative about the custom text: no text there
        // means "default copy", so drop any stale one.
        clearMessage: fromResolve && signal.message == null,
      ),
    );
    // A bare 503 carries no gym name or custom text — fetch them.
    if (!fromResolve && !wasActive) unawaited(check());
  }

  /// Re-checks `GET /public/tenants/resolve`. No-op when the gym is unknown
  /// (nothing to poll) or a check is already running.
  /// Re-checks whether maintenance is over: `GET /public/tenants/resolve` when
  /// a gym is known (covers its own switch and the platform one), otherwise —
  /// before any login — `GET /public/platform-config`. No-op while a check is
  /// running.
  Future<void> check() async {
    if (!state.active || state.backOnline || _checking) return;
    _checking = true;
    emit(state.copyWith(checking: true));
    try {
      final slug = await _storage.readTenantSlug();
      final bool stillOn;
      final String? message;
      String? gymName;
      if (slug != null && slug.isNotEmpty) {
        final branding = await _repository.resolve(slug);
        stillOn = branding.maintenanceMode;
        message = branding.maintenanceMessage;
        gymName = branding.name;
      } else {
        final info = await _repository.getPlatformInfo();
        if (!info.reachable) throw StateError('platform config unreachable');
        stillOn = info.maintenanceEnabled;
        message = info.maintenanceMessage;
      }
      if (isClosed) return;
      emit(
        state.copyWith(
          checking: false,
          offline: false,
          backOnline: !stillOn,
          gymName: gymName,
          message: message,
          clearMessage: stillOn && message == null,
        ),
      );
    } catch (_) {
      if (!isClosed) emit(state.copyWith(checking: false, offline: true));
    } finally {
      _checking = false;
    }
  }

  /// The screen's "Check now" / Retry.
  Future<void> retry() => check();

  /// Lifts the overlay (after the "Back online" beat, or a pre-login Retry).
  void dismiss() {
    _dismissedAt = DateTime.now();
    emit(const MaintenanceState());
  }

  @override
  Future<void> close() {
    _sub.cancel();
    return super.close();
  }
}
