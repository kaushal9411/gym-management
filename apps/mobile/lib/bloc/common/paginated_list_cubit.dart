import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/paginated_result.dart';
import 'paginated_list_state.dart';

/// Generic "load page 1 / load more" cubit for any endpoint that returns a
/// [PaginatedResult]. `BranchListCubit` predates this and has its own
/// (structurally identical) state classes — not migrated here to avoid
/// touching already-verified code; new list screens should use this instead
/// of copying that pattern a third time.
class PaginatedListCubit<T> extends Cubit<PaginatedListState<T>> {
  PaginatedListCubit(this._fetchPage) : super(PaginatedListLoading<T>());

  final Future<PaginatedResult<T>> Function(int page) _fetchPage;

  Future<void> load() async {
    emit(PaginatedListLoading<T>());
    try {
      final result = await _fetchPage(1);
      emit(
        PaginatedListLoaded<T>(
          items: result.items,
          page: result.page,
          totalPages: result.totalPages,
        ),
      );
    } on ApiException catch (e) {
      emit(PaginatedListError<T>(e.message));
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! PaginatedListLoaded<T> ||
        !current.hasMore ||
        current.loadingMore) {
      return;
    }
    emit(current.copyWith(loadingMore: true));
    try {
      final result = await _fetchPage(current.page + 1);
      emit(
        current.copyWith(
          items: [...current.items, ...result.items],
          page: result.page,
          loadingMore: false,
        ),
      );
    } on ApiException {
      emit(current.copyWith(loadingMore: false));
    }
  }
}
