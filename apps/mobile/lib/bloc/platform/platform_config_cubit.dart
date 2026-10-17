import 'package:flutter_bloc/flutter_bloc.dart';

import '../../repositories/public_tenant_repository.dart';

/// Just the one field — [PublicTenantRepository.getPlatformConfig] already
/// never throws (falls back to the static default itself), so there's no
/// loading/error state worth modelling here, unlike every other cubit in
/// this app.
class PlatformConfigState {
  const PlatformConfigState(this.appName);

  final String appName;
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
    final appName = await _repository
        .getPlatformConfig()
        .timeout(const Duration(seconds: 3), onTimeout: () => state.appName);
    emit(PlatformConfigState(appName));
  }
}
