import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../repositories/public_tenant_repository.dart';

/// Just the one field — [PublicTenantRepository.getPlatformConfig] already
/// never throws (falls back to the static default itself), so there's no
/// loading/error state worth modelling here, unlike every other cubit in
/// this app.
class PlatformConfigState extends Equatable {
  const PlatformConfigState(this.appName, {this.supportEmail});

  final String appName;

  /// The super admin's support address (Company Information), when set.
  final String? supportEmail;

  /// Equatable so a periodic reload (on app resume) that changes nothing
  /// doesn't rebuild the whole app.
  @override
  List<Object?> get props => [appName, supportEmail];
}

/// App-wide singleton (registered the same way as `SessionCubit` in
/// `service_locator.dart`) for the super-admin-configured platform/app
/// name. [load] is awaited once in `main.dart` before `runApp`, with a
/// timeout, so the very first frame already has the real name rather than
/// flashing the default and then relabelling itself a moment later.
class PlatformConfigCubit extends Cubit<PlatformConfigState> {
  PlatformConfigCubit(this._repository)
      : super(const PlatformConfigState('FitCloud'));

  final PublicTenantRepository _repository;

  Future<void> load() async {
    final config = await _repository.getPlatformInfo().timeout(
      const Duration(seconds: 3),
      onTimeout: () => PlatformInfo(state.appName, state.supportEmail),
    );
    emit(PlatformConfigState(config.appName, supportEmail: config.supportEmail));
  }
}
