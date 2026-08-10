import 'package:equatable/equatable.dart';

sealed class PaginatedListState<T> extends Equatable {
  const PaginatedListState();

  @override
  List<Object?> get props => [];
}

class PaginatedListLoading<T> extends PaginatedListState<T> {
  const PaginatedListLoading();
}

class PaginatedListError<T> extends PaginatedListState<T> {
  const PaginatedListError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class PaginatedListLoaded<T> extends PaginatedListState<T> {
  const PaginatedListLoaded({
    required this.items,
    required this.page,
    required this.totalPages,
    this.loadingMore = false,
  });

  final List<T> items;
  final int page;
  final int totalPages;
  final bool loadingMore;

  bool get hasMore => page < totalPages;

  PaginatedListLoaded<T> copyWith({
    List<T>? items,
    int? page,
    bool? loadingMore,
  }) =>
      PaginatedListLoaded<T>(
        items: items ?? this.items,
        page: page ?? this.page,
        totalPages: totalPages,
        loadingMore: loadingMore ?? this.loadingMore,
      );

  @override
  List<Object?> get props => [items.length, page, totalPages, loadingMore];
}
