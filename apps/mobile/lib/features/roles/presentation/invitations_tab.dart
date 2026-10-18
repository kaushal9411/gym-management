import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/invitation.dart';
import '../../../models/tenant_role.dart';
import '../../../repositories/invitation_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

const _inviteWindowHours = 48;

const _chips = [
  (label: 'All', value: null, color: TeamColors.indigo),
  (label: 'Pending', value: 'PENDING', color: TeamColors.amber),
  (label: 'Accepted', value: 'ACCEPTED', color: TeamColors.green),
  (label: 'Revoked', value: 'REVOKED', color: TeamColors.rose),
  (label: 'Expired', value: 'EXPIRED', color: TeamColors.violet),
];

Color _inviteColor(String status) => switch (status) {
      'PENDING' => TeamColors.amber,
      'ACCEPTED' => TeamColors.green,
      'REVOKED' => TeamColors.rose,
      _ => TeamColors.violet,
    };

/// Web's `/invitations`: status-filtered list of email invitations, each with
/// a countdown ring draining toward its 48-hour expiry, plus Resend / Revoke
/// for pending ones (`users:invite`).
class InvitationsTab extends StatefulWidget {
  const InvitationsTab({super.key});

  @override
  State<InvitationsTab> createState() => InvitationsTabState();
}

class InvitationsTabState extends State<InvitationsTab> {
  String? _status;
  int? _total;
  String? _busyId;
  late final _cubit = PaginatedListCubit<Invitation>((page) async {
    final r = await getIt<InvitationRepository>().list(
      page: page,
      status: _status,
    );
    if (mounted) setState(() => _total = r.total);
    return r;
  });

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  /// Called by the hub after sending a new invite.
  void reload() => _cubit.load();

  Future<void> _resend(Invitation i) async {
    setState(() => _busyId = i.id);
    try {
      await getIt<InvitationRepository>().resend(i.id);
      if (!mounted) return;
      teamSnack(context, 'Re-sent to ${i.email}');
      _cubit.load();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _revoke(Invitation i) async {
    final ok = await confirmTeam(
      context,
      title: 'Revoke invitation?',
      message: '${i.email} will no longer be able to accept this invite.',
      confirmLabel: 'Revoke',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _busyId = i.id);
    try {
      await getIt<InvitationRepository>().revoke(i.id);
      if (!mounted) return;
      teamSnack(context, 'Invitation revoked');
      _cubit.load();
    } catch (e) {
      if (mounted) {
        teamSnack(
          context,
          e is ApiException ? e.detailedMessage : '$e',
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: () async => _cubit.load(),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  18 + teamSideInset(context),
                  0,
                  18 + teamSideInset(context),
                  12,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (final c in _chips) ...[
                            TeamFilterChip(
                              label: c.label,
                              color: c.color,
                              selected: _status == c.value,
                              onTap: () {
                                setState(() => _status = c.value);
                                _cubit.load();
                              },
                            ),
                            const SizedBox(width: 8),
                          ],
                        ],
                      ),
                    ),
                    if (_total != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          '$_total ${_total == 1 ? 'invitation' : 'invitations'}'
                          ' · pending invites expire after '
                          '$_inviteWindowHours hours',
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            BlocBuilder<PaginatedListCubit<Invitation>,
                PaginatedListState<Invitation>>(
              builder: (context, state) => switch (state) {
                PaginatedListLoading() => const SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppLoadingView(),
                  ),
                PaginatedListError(:final message) => SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppErrorView(message: message, onRetry: _cubit.load),
                  ),
                PaginatedListLoaded(:final items) when items.isEmpty =>
                  const SliverFillRemaining(
                    hasScrollBody: false,
                    child: AppEmptyState(
                      icon: Icons.mail_outline_rounded,
                      title: 'No invitations yet',
                      message: 'Tap + to invite your first staff member.',
                    ),
                  ),
                PaginatedListLoaded(
                  :final items,
                  :final hasMore,
                  :final loadingMore,
                ) =>
                  teamCardSliver<Invitation>(
                    context,
                    items: items,
                    footer: hasMore
                        ? Center(
                            child: loadingMore
                                ? const CircularProgressIndicator()
                                : TextButton(
                                    onPressed: _cubit.loadMore,
                                    child: const Text('Load more'),
                                  ),
                          )
                        : null,
                    builder: (inv, i) => FadeUp(
                      index: i.clamp(0, 6),
                      child: _InvitationCard(
                        invitation: inv,
                        busy: _busyId == inv.id,
                        onResend: () => _resend(inv),
                        onRevoke: () => _revoke(inv),
                      ),
                    ),
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _InvitationCard extends StatelessWidget {
  const _InvitationCard({
    required this.invitation,
    required this.busy,
    required this.onResend,
    required this.onRevoke,
  });

  final Invitation invitation;
  final bool busy;
  final VoidCallback onResend;
  final VoidCallback onRevoke;

  @override
  Widget build(BuildContext context) {
    final inv = invitation;
    final status = inv.isExpired ? 'EXPIRED' : inv.status;
    final color = _inviteColor(status);
    final pending = status == 'PENDING';
    final hoursLeft = pending
        ? inv.expiresAt.difference(DateTime.now()).inHours.clamp(0, 9999) + 1
        : 0;
    final ratio =
        pending ? (hoursLeft / _inviteWindowHours).clamp(0.0, 1.0) : 1.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AnimatedRing(
                value: ratio.toDouble(),
                size: 58,
                stroke: 6,
                colors: [color, color.withValues(alpha: 0.6)],
                track: color.withValues(alpha: 0.16),
                child: Text(
                  pending
                      ? '${hoursLeft}h'
                      : status == 'ACCEPTED'
                          ? '✓'
                          : '–',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w800,
                    color: color,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      inv.email,
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${displayRoleName(inv.roleName)} · invited by '
                      '${inv.invitedByName}',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      children: [
                        TeamTag(label: prettyEnum(status), color: color),
                        TeamTag(
                          label: pending
                              ? 'Expires ${fmtDateTime(inv.expiresAt)}'
                              : 'Sent ${fmtDate(inv.createdAt)}',
                          color: TeamColors.slate,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (pending || status == 'EXPIRED') ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _MiniButton(
                    label: 'Resend',
                    icon: Icons.forward_to_inbox_rounded,
                    color: TeamColors.indigo,
                    busy: busy,
                    onTap: onResend,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _MiniButton(
                    label: 'Revoke',
                    icon: Icons.block_rounded,
                    color: TeamColors.rose,
                    busy: busy,
                    onTap: onRevoke,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MiniButton extends StatelessWidget {
  const _MiniButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.busy,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Opacity(
        opacity: busy ? 0.5 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
