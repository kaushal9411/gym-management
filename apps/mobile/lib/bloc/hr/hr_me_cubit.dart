import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/hr_summary.dart';
import '../../repositories/hr_repository.dart';

/// Which punch is in flight.
enum HrPunch { checkIn, checkOut }

sealed class HrMeState {
  const HrMeState();
}

class HrMeLoading extends HrMeState {
  const HrMeLoading();
}

class HrMeError extends HrMeState {
  const HrMeError(this.message, {this.notAnEmployee = false});

  final String message;

  /// 403 `NOT_AN_EMPLOYEE` - the account has no StaffProfile (the owner), so
  /// there is no personal HR to show. Rendered as an explanation, not an error.
  final bool notAnEmployee;
}

class HrMeLoaded extends HrMeState {
  const HrMeLoaded(this.summary, {this.punching, this.notice, this.celebrate});

  final HrMeSummary summary;

  /// Set while a check-in / check-out request is in flight.
  final HrPunch? punching;

  /// One-shot error from the last punch attempt (409 "already checked in"...).
  final String? notice;

  /// Set right after a successful punch so the UI can play its confirmation.
  final HrPunch? celebrate;

  HrMeLoaded copyWith({
    HrMeSummary? summary,
    HrPunch? punching,
    bool clearPunching = false,
    String? notice,
    bool clearNotice = false,
    HrPunch? celebrate,
    bool clearCelebrate = false,
  }) =>
      HrMeLoaded(
        summary ?? this.summary,
        punching: clearPunching ? null : (punching ?? this.punching),
        notice: clearNotice ? null : (notice ?? this.notice),
        celebrate: clearCelebrate ? null : (celebrate ?? this.celebrate),
      );
}

/// State behind the "My HR" screen: the self summary plus check-in / out.
///
/// Mutations never touch the UI optimistically (house rule): the button shows
/// a spinner, the response `AttendanceDay` becomes today's record, and the
/// summary is then re-fetched silently so `canCheckIn` / `canCheckOut`, the
/// month stats and the calendar always come from the server.
class HrMeCubit extends Cubit<HrMeState> {
  HrMeCubit(this._repo) : super(const HrMeLoading());

  final HrRepository _repo;

  Future<void> load({bool silent = false}) async {
    if (!silent || state is! HrMeLoaded) emit(const HrMeLoading());
    try {
      final summary = await _repo.meSummary();
      final cur = state;
      emit(
        silent && cur is HrMeLoaded
            ? cur.copyWith(summary: summary)
            : HrMeLoaded(summary),
      );
    } on ApiException catch (e) {
      // A silent refresh failing must not wipe a screen that has data.
      if (silent && state is HrMeLoaded) return;
      emit(
        HrMeError(
          e.message,
          notAnEmployee: HrRepository.isNotAnEmployee(e),
        ),
      );
    }
  }

  Future<void> checkIn() => _punch(HrPunch.checkIn);

  Future<void> checkOut() => _punch(HrPunch.checkOut);

  Future<void> _punch(HrPunch kind) async {
    final cur = state;
    if (cur is! HrMeLoaded || cur.punching != null) return;
    final today = cur.summary.today;
    // The server decides (`canCheckIn` / `canCheckOut`); never fire a request
    // the summary already says will be refused.
    if (kind == HrPunch.checkIn ? !today.canCheckIn : !today.canCheckOut) {
      return;
    }
    emit(cur.copyWith(punching: kind, clearNotice: true));
    try {
      final day = kind == HrPunch.checkIn
          ? await _repo.checkIn()
          : await _repo.checkOut();
      final latest = state;
      if (latest is HrMeLoaded) {
        emit(
          latest.copyWith(
            summary: latest.summary.copyWith(
              today: latest.summary.today.withAttendance(day),
            ),
            clearPunching: true,
            celebrate: kind,
          ),
        );
      }
      await load(silent: true);
    } on ApiException catch (e) {
      final latest = state;
      if (latest is HrMeLoaded) {
        emit(latest.copyWith(clearPunching: true, notice: e.message));
      }
      // 409s mean the server's view differs from ours - resync.
      if (e.statusCode == 409) await load(silent: true);
    }
  }

  /// The UI calls this once it has played the celebration.
  void celebrated() {
    final cur = state;
    if (cur is HrMeLoaded && cur.celebrate != null) {
      emit(cur.copyWith(clearCelebrate: true));
    }
  }

  void dismissNotice() {
    final cur = state;
    if (cur is HrMeLoaded && cur.notice != null) {
      emit(cur.copyWith(clearNotice: true));
    }
  }
}
