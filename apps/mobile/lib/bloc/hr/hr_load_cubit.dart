import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';

sealed class HrLoadState<T> {
  const HrLoadState();
}

class HrLoadLoading<T> extends HrLoadState<T> {
  const HrLoadLoading();
}

class HrLoadError<T> extends HrLoadState<T> {
  const HrLoadError(this.message);

  final String message;
}

class HrLoadLoaded<T> extends HrLoadState<T> {
  const HrLoadLoaded(this.data);

  final T data;
}

/// "Load one thing" cubit for the HR admin screens whose data is not a paged
/// list (shifts, holidays of a year, leave types, the policy, a month grid,
/// the team calendar's month). Mutations happen in the form sheets; they call
/// [load] with `silent: true` afterwards so the list refreshes from the server
/// without flashing a skeleton (no optimistic UI - house rule).
///
/// A stale reply is dropped: calling [load] again (e.g. the year stepper)
/// supersedes any request still in flight.
class HrLoadCubit<T> extends Cubit<HrLoadState<T>> {
  HrLoadCubit(this._fetch) : super(const HrLoadLoading());

  final Future<T> Function() _fetch;
  int _req = 0;

  Future<void> load({bool silent = false}) async {
    final req = ++_req;
    if (!silent || state is! HrLoadLoaded<T>) emit(const HrLoadLoading());
    try {
      final data = await _fetch();
      if (isClosed || req != _req) return;
      emit(HrLoadLoaded<T>(data));
    } on ApiException catch (e) {
      if (isClosed || req != _req) return;
      // A failed silent refresh keeps what is on screen.
      if (silent && state is HrLoadLoaded<T>) return;
      emit(HrLoadError<T>(e.message));
    }
  }
}
