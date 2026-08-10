import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../repositories/branch_repository.dart';
import 'branch_list_state.dart';

class BranchListCubit extends Cubit<BranchListState> {
  BranchListCubit(this._repository) : super(const BranchListLoading());

  final BranchRepository _repository;
  String _search = '';

  Future<void> load({String search = ''}) async {
    _search = search;
    emit(const BranchListLoading());
    try {
      final result = await _repository.list(page: 1, search: search);
      emit(
        BranchListLoaded(
          items: result.items,
          page: result.page,
          totalPages: result.totalPages,
        ),
      );
    } on ApiException catch (e) {
      emit(BranchListError(e.message));
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! BranchListLoaded ||
        !current.hasMore ||
        current.loadingMore) {
      return;
    }
    emit(current.copyWith(loadingMore: true));
    try {
      final result =
          await _repository.list(page: current.page + 1, search: _search);
      emit(
        current.copyWith(
          items: [...current.items, ...result.items],
          page: result.page,
          loadingMore: false,
        ),
      );
    } on ApiException {
      // Leave the existing list intact — just stop the loading spinner so the user can retry by scrolling again.
      emit(current.copyWith(loadingMore: false));
    }
  }
}
