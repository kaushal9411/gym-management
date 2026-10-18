import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/lead.dart';

sealed class LeadFollowUpsState extends Equatable {
  const LeadFollowUpsState(this.bucket, this.mineOnly);

  /// due | overdue | today | upcoming
  final String bucket;
  final bool mineOnly;

  @override
  List<Object?> get props => [bucket, mineOnly];
}

class LeadFollowUpsLoading extends LeadFollowUpsState {
  const LeadFollowUpsLoading(super.bucket, super.mineOnly);
}

class LeadFollowUpsError extends LeadFollowUpsState {
  const LeadFollowUpsError(super.bucket, super.mineOnly, this.message);

  final String message;

  @override
  List<Object?> get props => [bucket, mineOnly, message];
}

class LeadFollowUpsLoaded extends LeadFollowUpsState {
  const LeadFollowUpsLoaded(super.bucket, super.mineOnly, this.data);

  final LeadFollowUps data;

  @override
  List<Object?> get props => [bucket, mineOnly, data.items.length, data.due];
}

class LeadFollowUpsCubit extends Cubit<LeadFollowUpsState> {
  LeadFollowUpsCubit(this._fetch, {String bucket = 'due'})
      : super(LeadFollowUpsLoading(bucket, true));

  final Future<LeadFollowUps> Function(String scope, String bucket) _fetch;

  Future<void> load({String? bucket, bool? mineOnly}) async {
    final b = bucket ?? state.bucket;
    final m = mineOnly ?? state.mineOnly;
    emit(LeadFollowUpsLoading(b, m));
    try {
      final data = await _fetch(m ? 'mine' : 'all', b);
      if (!isClosed) emit(LeadFollowUpsLoaded(b, m, data));
    } on ApiException catch (e) {
      if (!isClosed) emit(LeadFollowUpsError(b, m, e.message));
    } on Object {
      if (!isClosed) {
        emit(LeadFollowUpsError(b, m, 'Could not load follow-ups.'));
      }
    }
  }
}
