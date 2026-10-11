import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../core/network/api_exception.dart';
import '../../models/lead.dart';
import '../../repositories/lead_repository.dart';

sealed class LeadDetailState extends Equatable {
  const LeadDetailState();

  @override
  List<Object?> get props => [];
}

class LeadDetailLoading extends LeadDetailState {
  const LeadDetailLoading();
}

class LeadDetailError extends LeadDetailState {
  const LeadDetailError(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

class LeadDetailLoaded extends LeadDetailState {
  const LeadDetailLoaded(this.lead, {this.busy = false});

  final Lead lead;

  /// A mutation is in flight (buttons disable; no optimistic UI).
  final bool busy;

  @override
  List<Object?> get props =>
      [lead.id, lead.updatedAt, lead.status, lead.activities.length, busy];
}

/// Detail + every mutation. Mutations `await` the API and show the RESPONSE
/// (no optimistic UI); each returns an error message, or null on success.
class LeadDetailCubit extends Cubit<LeadDetailState> {
  LeadDetailCubit(this._repo, this.leadId) : super(const LeadDetailLoading());

  final LeadRepository _repo;
  final String leadId;

  Lead? get lead {
    final s = state;
    return s is LeadDetailLoaded ? s.lead : null;
  }

  Future<void> load() async {
    emit(const LeadDetailLoading());
    try {
      final l = await _repo.getById(leadId);
      if (!isClosed) emit(LeadDetailLoaded(l));
    } on ApiException catch (e) {
      if (!isClosed) emit(LeadDetailError(e.message));
    }
  }

  /// Replace the lead with one fetched elsewhere (e.g. after an edit form).
  void replace(Lead l) => emit(LeadDetailLoaded(l));

  Future<String?> _mutate(Future<Lead> Function() op) async {
    final current = lead;
    if (current == null) return 'Lead not loaded';
    emit(LeadDetailLoaded(current, busy: true));
    try {
      final next = await op();
      if (!isClosed) emit(LeadDetailLoaded(next));
      return null;
    } on ApiException catch (e) {
      if (!isClosed) emit(LeadDetailLoaded(current));
      return e.errorFor('lostReason') ?? e.message;
    }
  }

  Future<String?> changeStatus(
    LeadStatus status, {
    LeadLostReason? lostReason,
    String? lostNote,
    String? note,
  }) =>
      _mutate(
        () => _repo.changeStatus(
          leadId,
          status: status,
          lostReason: lostReason,
          lostNote: lostNote,
          note: note,
        ),
      );

  Future<String?> addActivity(
    LeadActivityType type, {
    String? note,
    String? outcome,
    DateTime? nextFollowUpAt,
  }) =>
      _mutate(
        () => _repo.addActivity(
          leadId,
          type: type,
          note: note,
          outcome: outcome,
          nextFollowUpAt: nextFollowUpAt,
        ),
      );

  Future<String?> assign(String? userId) =>
      _mutate(() => _repo.assign(leadId, userId));

  Future<String?> delete() async {
    final current = lead;
    if (current == null) return 'Lead not loaded';
    emit(LeadDetailLoaded(current, busy: true));
    try {
      await _repo.delete(leadId);
      return null;
    } on ApiException catch (e) {
      if (!isClosed) emit(LeadDetailLoaded(current));
      return e.message;
    }
  }

  /// Returns the converted member on success; [error] set otherwise.
  Future<({ConvertedMember? member, String? error})> convert(
    Map<String, dynamic> body,
  ) async {
    final current = lead;
    if (current == null) return (member: null, error: 'Lead not loaded');
    emit(LeadDetailLoaded(current, busy: true));
    try {
      final r = await _repo.convert(leadId, body);
      if (!isClosed) emit(LeadDetailLoaded(r.lead));
      return (member: r.member, error: null);
    } on ApiException catch (e) {
      if (!isClosed) emit(LeadDetailLoaded(current));
      return (member: null, error: e.message);
    }
  }
}
