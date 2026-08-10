import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../repositories/finance_repository.dart';
import 'finance_summary_state.dart';

class FinanceSummaryCubit extends Cubit<FinanceSummaryState> {
  FinanceSummaryCubit(this._repository) : super(const FinanceSummaryLoading());

  final FinanceRepository _repository;

  Future<void> load() async {
    emit(const FinanceSummaryLoading());
    try {
      emit(FinanceSummaryLoaded(await _repository.summary()));
    } on ApiException catch (e) {
      emit(FinanceSummaryError(e.message));
    }
  }
}
