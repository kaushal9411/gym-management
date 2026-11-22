import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/hr_attendance.dart';
import '../../models/hr_enums.dart';
import '../../models/hr_leave.dart';
import '../../repositories/hr_repository.dart';

/// One field's validation message (null = fine).
class LeaveFormErrors {
  const LeaveFormErrors({this.type, this.dates, this.reason, this.balance});

  final String? type;
  final String? dates;
  final String? reason;

  /// The server preview said the balance is not enough.
  final String? balance;

  bool get any =>
      type != null || dates != null || reason != null || balance != null;
}

/// Pure client-side rules, mirroring the API's (`docs/HR-API-CONTRACT.md` §3).
/// The server stays the authority (back-date window, leave-year span, overlap)
/// - these only stop obviously bad input before a round trip.
LeaveFormErrors validateLeaveForm({
  required String? leaveTypeId,
  required DateTime? start,
  required DateTime? end,
  required DayPart dayPart,
  required String reason,
  required DateTime today,
  HrLeavePreview? preview,
}) {
  String? type;
  String? dates;
  String? reasonError;
  String? balance;
  if (leaveTypeId == null) type = 'Choose a leave type';
  if (start == null || end == null) {
    dates = 'Pick the dates';
  } else if (end.isBefore(start)) {
    dates = 'End date is before the start date';
  } else if (dayPart.isHalf && !_sameDay(start, end)) {
    dates = 'A half day must be a single date';
  } else if (end.difference(start).inDays + 1 > 120) {
    dates = 'A request can cover at most 120 days';
  } else if (start.difference(today).inDays > 366) {
    dates = 'Start date is too far ahead';
  }
  final r = reason.trim();
  if (r.length < 3) {
    reasonError = 'Add a reason (at least 3 characters)';
  } else if (r.length > 500) {
    reasonError = 'Keep the reason under 500 characters';
  }
  if (preview != null && !preview.sufficient) {
    balance = 'Not enough leave balance for these dates';
  }
  return LeaveFormErrors(
    type: type,
    dates: dates,
    reason: reasonError,
    balance: balance,
  );
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

class LeaveApplyState {
  const LeaveApplyState({
    this.loadingTypes = true,
    this.types = const [],
    this.typesError,
    this.leaveTypeId,
    this.start,
    this.end,
    this.dayPart = DayPart.fullDay,
    this.reason = '',
    this.preview,
    this.previewLoading = false,
    this.previewError,
    this.submitting = false,
    this.submitError,
    this.submitted,
    this.autoApprove = false,
    this.showErrors = false,
  });

  final bool loadingTypes;
  final List<HrLeaveType> types;
  final String? typesError;
  final String? leaveTypeId;
  final DateTime? start;
  final DateTime? end;
  final DayPart dayPart;
  final String reason;
  final HrLeavePreview? preview;
  final bool previewLoading;
  final String? previewError;
  final bool submitting;
  final String? submitError;

  /// Set once the request is created - the screen pops with it.
  final HrLeaveRequest? submitted;

  /// On-behalf only: apply + approve in one step.
  final bool autoApprove;

  /// Flip on the first submit attempt so untouched fields don't show errors.
  final bool showErrors;

  HrLeaveType? get selectedType {
    for (final t in types) {
      if (t.id == leaveTypeId) return t;
    }
    return null;
  }

  bool get hasRange => start != null && end != null;

  LeaveApplyState copyWith({
    bool? loadingTypes,
    List<HrLeaveType>? types,
    String? typesError,
    bool clearTypesError = false,
    String? leaveTypeId,
    DateTime? start,
    DateTime? end,
    DayPart? dayPart,
    String? reason,
    HrLeavePreview? preview,
    bool clearPreview = false,
    bool? previewLoading,
    String? previewError,
    bool clearPreviewError = false,
    bool? submitting,
    String? submitError,
    bool clearSubmitError = false,
    HrLeaveRequest? submitted,
    bool? autoApprove,
    bool? showErrors,
  }) =>
      LeaveApplyState(
        loadingTypes: loadingTypes ?? this.loadingTypes,
        types: types ?? this.types,
        typesError: clearTypesError ? null : (typesError ?? this.typesError),
        leaveTypeId: leaveTypeId ?? this.leaveTypeId,
        start: start ?? this.start,
        end: end ?? this.end,
        dayPart: dayPart ?? this.dayPart,
        reason: reason ?? this.reason,
        preview: clearPreview ? null : (preview ?? this.preview),
        previewLoading: previewLoading ?? this.previewLoading,
        previewError:
            clearPreviewError ? null : (previewError ?? this.previewError),
        submitting: submitting ?? this.submitting,
        submitError:
            clearSubmitError ? null : (submitError ?? this.submitError),
        submitted: submitted ?? this.submitted,
        autoApprove: autoApprove ?? this.autoApprove,
        showErrors: showErrors ?? this.showErrors,
      );
}

/// The Apply-leave form. Self-service by default; pass [onBehalfOf] for HR
/// applying for someone else (then `/hr/leaves*` is used and
/// [LeaveApplyState.autoApprove] becomes available).
///
/// Every change to type / dates / day part re-runs the server preview
/// (debounced by [previewDelay]; stale responses are dropped) so the days
/// count, the skipped weekly offs / holidays and the balance check are always
/// the server's numbers - never re-implemented on the phone.
class LeaveApplyCubit extends Cubit<LeaveApplyState> {
  LeaveApplyCubit(
    this._repo, {
    required DateTime Function() today,
    this.onBehalfOf,
    this.previewDelay = const Duration(milliseconds: 280),
  })  : _today = today,
        super(const LeaveApplyState());

  final HrRepository _repo;
  final DateTime Function() _today;
  final HrEmployeeRef? onBehalfOf;
  final Duration previewDelay;

  Timer? _debounce;
  int _previewSeq = 0;

  bool get isOnBehalf => onBehalfOf != null;

  DateTime get today {
    final t = _today();
    return DateTime(t.year, t.month, t.day);
  }

  Future<void> init() async {
    emit(state.copyWith(loadingTypes: true, clearTypesError: true));
    try {
      final all =
          isOnBehalf ? await _repo.leaveTypes() : await _repo.myLeaveTypes();
      final types = all.where((t) => t.isActive).toList();
      emit(
        state.copyWith(
          loadingTypes: false,
          types: types,
          leaveTypeId: types.isNotEmpty ? types.first.id : null,
          start: today,
          end: today,
        ),
      );
      _schedulePreview();
    } on ApiException catch (e) {
      emit(state.copyWith(loadingTypes: false, typesError: e.message));
    }
  }

  void setType(String id) {
    if (id == state.leaveTypeId) return;
    emit(state.copyWith(leaveTypeId: id, clearSubmitError: true));
    _schedulePreview();
  }

  /// Picks the range. A half day (or [end] < [start]) collapses to one date.
  void setDates(DateTime start, DateTime end) {
    var e = end;
    if (e.isBefore(start) || state.dayPart.isHalf) e = start;
    emit(state.copyWith(start: start, end: e, clearSubmitError: true));
    _schedulePreview();
  }

  void setDayPart(DayPart part) {
    if (part == state.dayPart) return;
    final start = state.start;
    emit(
      state.copyWith(
        dayPart: part,
        end: part.isHalf && start != null ? start : state.end,
        clearSubmitError: true,
      ),
    );
    _schedulePreview();
  }

  void setReason(String v) =>
      emit(state.copyWith(reason: v, clearSubmitError: true));

  void setAutoApprove(bool v) => emit(state.copyWith(autoApprove: v));

  LeaveFormErrors get errors => validateLeaveForm(
        leaveTypeId: state.leaveTypeId,
        start: state.start,
        end: state.end,
        dayPart: state.dayPart,
        reason: state.reason,
        today: today,
        preview: state.preview,
      );

  void _schedulePreview() {
    _debounce?.cancel();
    final s = state;
    final e = validateLeaveForm(
      leaveTypeId: s.leaveTypeId,
      start: s.start,
      end: s.end,
      dayPart: s.dayPart,
      reason: 'xxx',
      today: today,
    );
    if (e.type != null || e.dates != null) {
      _previewSeq++;
      emit(
        s.copyWith(
          clearPreview: true,
          previewLoading: false,
          clearPreviewError: true,
        ),
      );
      return;
    }
    emit(s.copyWith(previewLoading: true, clearPreviewError: true));
    _debounce = Timer(previewDelay, _runPreview);
  }

  Future<void> _runPreview() async {
    final s = state;
    final seq = ++_previewSeq;
    try {
      final p = isOnBehalf
          ? await _repo.previewLeaveFor(
              userId: onBehalfOf!.userId,
              leaveTypeId: s.leaveTypeId!,
              startDate: s.start!,
              endDate: s.end!,
              dayPart: s.dayPart,
            )
          : await _repo.previewMyLeave(
              leaveTypeId: s.leaveTypeId!,
              startDate: s.start!,
              endDate: s.end!,
              dayPart: s.dayPart,
            );
      if (isClosed || seq != _previewSeq) return;
      emit(state.copyWith(preview: p, previewLoading: false));
    } on ApiException catch (e) {
      if (isClosed || seq != _previewSeq) return;
      emit(
        state.copyWith(
          clearPreview: true,
          previewLoading: false,
          previewError: e.detailedMessage,
        ),
      );
    }
  }

  /// Validates, then POSTs. Returns the created request (also on state).
  Future<HrLeaveRequest?> submit() async {
    final s = state;
    if (s.submitting) return null;
    emit(s.copyWith(showErrors: true, clearSubmitError: true));
    if (errors.any || s.previewLoading) return null;
    emit(state.copyWith(submitting: true));
    try {
      final r = isOnBehalf
          ? await _repo.applyLeaveFor(
              userId: onBehalfOf!.userId,
              leaveTypeId: s.leaveTypeId!,
              startDate: s.start!,
              endDate: s.end!,
              dayPart: s.dayPart,
              reason: s.reason,
              autoApprove: s.autoApprove,
            )
          : await _repo.applyLeave(
              leaveTypeId: s.leaveTypeId!,
              startDate: s.start!,
              endDate: s.end!,
              dayPart: s.dayPart,
              reason: s.reason,
            );
      emit(state.copyWith(submitting: false, submitted: r));
      return r;
    } on ApiException catch (e) {
      emit(state.copyWith(submitting: false, submitError: e.detailedMessage));
      return null;
    }
  }

  @override
  Future<void> close() {
    _debounce?.cancel();
    return super.close();
  }
}
