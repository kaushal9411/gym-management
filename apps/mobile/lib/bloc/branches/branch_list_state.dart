import 'package:equatable/equatable.dart';

import '../../models/branch.dart';

sealed class BranchListState extends Equatable {
  const BranchListState();

  @override
  List<Object?> get props => [];
}

class BranchListLoading extends BranchListState {
  const BranchListLoading();
}

class BranchListError extends BranchListState {
  const BranchListError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class BranchListLoaded extends BranchListState {
  const BranchListLoaded({
    required this.items,
    required this.page,
    required this.totalPages,
    this.loadingMore = false,
  });

  final List<Branch> items;
  final int page;
  final int totalPages;
  final bool loadingMore;

  bool get hasMore => page < totalPages;

  BranchListLoaded copyWith({
    List<Branch>? items,
    int? page,
    bool? loadingMore,
  }) =>
      BranchListLoaded(
        items: items ?? this.items,
        page: page ?? this.page,
        totalPages: totalPages,
        loadingMore: loadingMore ?? this.loadingMore,
      );

  @override
  List<Object?> get props => [items.length, page, totalPages, loadingMore];
}
