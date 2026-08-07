import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/errors/app_exception.dart';
import '../../data/member_repository.dart';
import '../../data/models/member.dart';

sealed class MemberListState {
  const MemberListState();
}

class MemberListLoading extends MemberListState {
  const MemberListLoading();
}

class MemberListLoaded extends MemberListState {
  final List<MemberSummary> members;
  const MemberListLoaded(this.members);
}

class MemberListError extends MemberListState {
  final String message;
  const MemberListError(this.message);
}

class MemberListCubit extends Cubit<MemberListState> {
  final MemberRepository _repository;
  Timer? _debounce;

  MemberListCubit(this._repository) : super(const MemberListLoading());

  Future<void> load({String? search}) async {
    emit(const MemberListLoading());
    try {
      final page = await _repository.list(search: search);
      emit(MemberListLoaded(page.items));
    } on AppException catch (e) {
      emit(MemberListError(e.message));
    }
  }

  /// Same 300ms debounce tenant-web's Members page uses (useDebouncedValue)
  /// so typing doesn't fire a request per keystroke.
  void searchChanged(String query) {
    _debounce?.cancel();
    _debounce =
        Timer(const Duration(milliseconds: 300), () => load(search: query));
  }

  @override
  Future<void> close() {
    _debounce?.cancel();
    return super.close();
  }
}
