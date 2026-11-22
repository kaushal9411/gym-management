import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/hr_enums.dart';
import '../../models/hr_payroll.dart';
import '../../repositories/hr_repository.dart';

/// What the payroll run screen is currently doing for the user.
enum PayrollAction {
  recalculate,
  approve,
  delete,
  savePayslip,
  pay,
  payAll,
}

sealed class PayrollRunState {
  const PayrollRunState();
}

class PayrollRunLoading extends PayrollRunState {
  const PayrollRunLoading();
}

class PayrollRunError extends PayrollRunState {
  const PayrollRunError(this.message);

  final String message;
}

class PayrollRunLoaded extends PayrollRunState {
  const PayrollRunLoaded(
    this.detail, {
    this.busy,
    this.notice,
    this.noticeIsError = false,
    this.deleted = false,
    this.payAllResult,
  });

  final HrPayrollRunDetail detail;

  /// Set while a mutation is in flight (buttons show a spinner).
  final PayrollAction? busy;

  /// One-shot message for a snackbar (success or the server's wording).
  final String? notice;
  final bool noticeIsError;

  /// The DRAFT run was deleted - the screen pops.
  final bool deleted;

  /// Set by [PayrollRunCubit.payAll] so the screen can show the summary.
  final HrPayAllResult? payAllResult;

  HrPayrollRun get run => detail.run;
  bool get isDraft => run.status == PayrollRunStatus.draft;
  bool get isApproved => run.status == PayrollRunStatus.approved;

  /// Payslips still to pay (only meaningful once the run is APPROVED).
  List<HrPayslip> get unpaid =>
      detail.payslips.where((p) => p.status != PayslipStatus.paid).toList();

  double get unpaidTotal => unpaid.fold<double>(0, (s, p) => s + p.netPay);

  PayrollRunLoaded copyWith({
    HrPayrollRunDetail? detail,
    PayrollAction? busy,
    bool clearBusy = false,
    String? notice,
    bool noticeIsError = false,
    bool clearNotice = false,
    bool? deleted,
    HrPayAllResult? payAllResult,
  }) =>
      PayrollRunLoaded(
        detail ?? this.detail,
        busy: clearBusy ? null : (busy ?? this.busy),
        notice: clearNotice ? null : (notice ?? this.notice),
        noticeIsError: clearNotice
            ? false
            : (notice != null ? noticeIsError : this.noticeIsError),
        deleted: deleted ?? this.deleted,
        payAllResult: payAllResult ?? this.payAllResult,
      );
}

/// State of one payroll run (`GET /hr/payroll/runs/:id`) and every action on
/// it: recalculate, approve, delete a draft, edit a draft payslip (bonus /
/// advance recovery / manual lines -> server recomputes), pay one, pay all.
///
/// No optimistic UI: each action sets [PayrollRunLoaded.busy], waits for the
/// server, then the run is re-read so totals, statuses and the paid counters
/// always come from the API. A 409 (`ALREADY_PAID`, `INVALID_STATE`) means the
/// copy on screen was stale: the server's message is shown and the run is
/// reloaded.
class PayrollRunCubit extends Cubit<PayrollRunState> {
  PayrollRunCubit(this._repo, this.runId) : super(const PayrollRunLoading());

  final HrRepository _repo;
  final String runId;

  Future<void> load({bool silent = false}) async {
    final cur = state;
    if (!silent || cur is! PayrollRunLoaded) emit(const PayrollRunLoading());
    try {
      final d = await _repo.payrollRun(runId);
      if (isClosed) return;
      final now = state;
      emit(
        now is PayrollRunLoaded && silent
            ? now.copyWith(detail: d, clearBusy: true)
            : PayrollRunLoaded(d),
      );
    } on ApiException catch (e) {
      if (isClosed) return;
      if (silent && state is PayrollRunLoaded) return;
      emit(PayrollRunError(e.message));
    }
  }

  /// Runs [body] with [action] marked busy; maps failures to a notice.
  Future<bool> _act(
    PayrollAction action,
    Future<String> Function() body,
  ) async {
    final cur = state;
    if (cur is! PayrollRunLoaded || cur.busy != null) return false;
    emit(cur.copyWith(busy: action, clearNotice: true));
    try {
      final message = await body();
      if (isClosed) return true;
      final s = state;
      if (s is PayrollRunLoaded) {
        emit(s.copyWith(clearBusy: true, notice: message));
      }
      return true;
    } on ApiException catch (e) {
      if (isClosed) return false;
      final s = state;
      if (s is PayrollRunLoaded) {
        emit(
          s.copyWith(
            clearBusy: true,
            notice: e.detailedMessage,
            noticeIsError: true,
          ),
        );
      }
      // The copy on screen may be stale (ALREADY_PAID / INVALID_STATE).
      if (e.statusCode == 409) await load(silent: true);
      return false;
    }
  }

  void clearNotice() {
    final s = state;
    if (s is PayrollRunLoaded && s.notice != null) {
      emit(s.copyWith(clearNotice: true));
    }
  }

  Future<bool> recalculate() => _act(PayrollAction.recalculate, () async {
        final d = await _repo.recalculateRun(runId);
        _swap(d);
        return 'Payslips recalculated from the latest attendance and pay '
            'structures.';
      });

  Future<bool> approve() => _act(PayrollAction.approve, () async {
        await _repo.approveRun(runId);
        await _reload();
        return 'Payroll approved and locked. Employees can now see their '
            'payslips.';
      });

  /// Deletes a DRAFT run. On success the state flips to `deleted` so the
  /// screen can pop.
  Future<bool> deleteDraft() async {
    final ok = await _act(PayrollAction.delete, () async {
      await _repo.deleteRun(runId);
      return 'Draft payroll deleted.';
    });
    final s = state;
    if (ok && s is PayrollRunLoaded) emit(s.copyWith(deleted: true));
    return ok;
  }

  /// Saves the editor of one DRAFT payslip, then re-reads the run so the
  /// totals move with the server's recomputation.
  Future<bool> savePayslip(String payslipId, HrPayslipEdit edit) =>
      _act(PayrollAction.savePayslip, () async {
        await _repo.patchPayslip(payslipId, edit);
        await _reload();
        return 'Payslip recalculated.';
      });

  Future<bool> pay(
    HrPayslip p, {
    required PaymentMode mode,
    String? paidOn,
    String? remark,
  }) =>
      _act(PayrollAction.pay, () async {
        await _repo.payPayslip(
          p.id,
          mode: mode,
          paidOn: paidOn,
          remark: remark,
        );
        await _reload();
        return '${p.summary.employee?.name ?? 'Payslip'} paid.';
      });

  Future<bool> payAll({
    required PaymentMode mode,
    String? paidOn,
    String? remark,
  }) =>
      _act(PayrollAction.payAll, () async {
        final r = await _repo.payAll(
          runId,
          mode: mode,
          paidOn: paidOn,
          remark: remark,
        );
        await _reload();
        final s = state;
        if (s is PayrollRunLoaded) emit(s.copyWith(payAllResult: r));
        return r.failed.isEmpty
            ? '${r.paid} payslip${r.paid == 1 ? '' : 's'} paid.'
            : '${r.paid} paid, ${r.failed.length} failed.';
      });

  void _swap(HrPayrollRunDetail d) {
    final s = state;
    if (s is PayrollRunLoaded) emit(s.copyWith(detail: d));
  }

  Future<void> _reload() async {
    final d = await _repo.payrollRun(runId);
    _swap(d);
  }
}
