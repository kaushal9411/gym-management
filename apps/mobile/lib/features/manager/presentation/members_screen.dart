import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../bloc/common/paginated_list_cubit.dart';
import '../../../bloc/common/paginated_list_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/formatters.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';

const _statusTones = {
  'ACTIVE': AppPillTone.success,
  'FROZEN': AppPillTone.danger,
  'INACTIVE': AppPillTone.neutral,
};

const _statusFilters = [
  (label: 'All', value: null),
  (label: 'Active', value: 'ACTIVE'),
  (label: 'Frozen', value: 'FROZEN'),
];

/// Design frame "6. Members list" — search + status filter + roster
/// (`GET /members`, branch-scoped server-side for Manager/Receptionist).
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  final _searchController = TextEditingController();
  String? _status;
  Timer? _debounce;
  late final _cubit = PaginatedListCubit<GymMember>(
    (page) => getIt<MemberRepository>().list(
      page: page,
      search: _searchController.text.trim(),
      status: _status,
    ),
  );

  @override
  void initState() {
    super.initState();
    _cubit.load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _cubit.close();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _cubit.load);
  }

  void _onStatusChanged(String? status) {
    setState(() => _status = status);
    _cubit.load();
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PaginatedListCubit<GymMember>>.value(
      value: _cubit,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: BlocBuilder<PaginatedListCubit<GymMember>,
                      PaginatedListState<GymMember>>(
                    builder: (context, state) {
                      final count = state is PaginatedListLoaded<GymMember>
                          ? '${state.items.length} shown'
                          : '';
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(count, style: AppText.eyebrow()),
                          Text('Members', style: AppText.display(size: 22)),
                        ],
                      );
                    },
                  ),
                ),
                Container(
                  width: 36,
                  height: 36,
                  decoration: const BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(
                      Icons.add_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () => context
                        .push(AppRoutes.memberForm)
                        .then((_) => _cubit.load()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Search members…',
                hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                filled: true,
                fillColor: AppColors.surface2,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: const BorderSide(color: AppColors.line),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                for (final f in _statusFilters) ...[
                  _FilterChip(
                    label: f.label,
                    selected: _status == f.value,
                    onTap: () => _onStatusChanged(f.value),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
            const SizedBox(height: 12),
            Expanded(
              child: BlocBuilder<PaginatedListCubit<GymMember>,
                  PaginatedListState<GymMember>>(
                builder: (context, state) {
                  return switch (state) {
                    PaginatedListLoading() => const AppLoadingView(),
                    PaginatedListError(:final message) => AppErrorView(
                        message: message,
                        onRetry: _cubit.load,
                      ),
                    PaginatedListLoaded(:final items) when items.isEmpty =>
                      const AppEmptyState(
                        icon: Icons.people_alt_outlined,
                        title: 'No members found',
                        message: 'Tap + to add your first member.',
                      ),
                    PaginatedListLoaded(:final items) => RefreshIndicator(
                        color: AppColors.staffB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: () async => _cubit.load(),
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: items.length,
                          itemBuilder: (context, i) => _MemberCard(
                            member: items[i],
                            onChanged: _cubit.load,
                          ),
                        ),
                      ),
                  };
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected ? AppColors.staffGrad : null,
          color: selected ? null : AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w700,
            color: selected ? Colors.white : AppColors.inkSoft,
          ),
        ),
      ),
    );
  }
}

/// Rich roster card — mirrors web's `MemberListCard`: photo, ID, mobile,
/// due amount, plan + expiry, and one-tap Call / WhatsApp / Renew / Punch In.
/// Renew and Punch In hit the real endpoints and surface the backend's own
/// rejection (e.g. "still active until …", "no active membership") rather
/// than re-implementing eligibility here.
class _MemberCard extends StatefulWidget {
  const _MemberCard({required this.member, required this.onChanged});

  final GymMember member;
  final VoidCallback onChanged;

  @override
  State<_MemberCard> createState() => _MemberCardState();
}

class _MemberCardState extends State<_MemberCard> {
  bool _renewing = false;
  bool _checkingIn = false;

  GymMember get m => widget.member;

  /// `9876543210` → `919876543210` — prepends India's code only for a bare
  /// 10-digit local number (same rule as web's `toWhatsAppNumber`).
  String _waNumber(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    return digits.length == 10 ? '91$digits' : digits;
  }

  Future<void> _open(Uri uri) async {
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && mounted) _toast('Could not open ${uri.scheme == 'tel' ? 'dialer' : 'WhatsApp'}');
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _renew() async {
    setState(() => _renewing = true);
    try {
      await getIt<MemberRepository>().renew(m.id);
      if (!mounted) return;
      _toast('Membership renewed.');
      widget.onChanged();
    } on ApiException catch (e) {
      if (mounted) _toast(e.message);
    } finally {
      if (mounted) setState(() => _renewing = false);
    }
  }

  Future<void> _punchIn() async {
    setState(() => _checkingIn = true);
    try {
      await getIt<AttendanceRepository>()
          .manualCheckIn(memberId: m.id, branchId: m.branch.id);
      if (mounted) _toast('${m.name} checked in.');
    } on ApiException catch (e) {
      if (mounted) _toast(e.message);
    } finally {
      if (mounted) setState(() => _checkingIn = false);
    }
  }

  String _fmtDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  @override
  Widget build(BuildContext context) {
    final membership = m.currentMembership;
    final hasPhone = m.phone != null && m.phone!.isNotEmpty;
    final due = m.outstandingAmount;
    final deleted = m.deletedAt != null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.card),
          onTap: () => context
              .push(AppRoutes.memberDetail, extra: m.id)
              .then((_) => widget.onChanged()),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(
                        gradient: AppColors.staffGrad,
                        shape: BoxShape.circle,
                      ),
                      child: UserAvatar(
                        avatarUrl: m.profilePhotoUrl,
                        name: m.name,
                        size: 54,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  m.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 15,
                                    weight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              AppPill(
                                label: deleted ? 'DELETED' : m.status,
                                tone: deleted
                                    ? AppPillTone.neutral
                                    : _statusTones[m.status] ??
                                        AppPillTone.neutral,
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            m.memberId,
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w700,
                              color: AppColors.staffPillFg,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.surface3.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          _InfoCell(
                            icon: Icons.phone_iphone_rounded,
                            label: 'Mobile',
                            value: hasPhone ? m.phone! : '—',
                          ),
                          _InfoCell(
                            icon: Icons.account_balance_wallet_rounded,
                            label: 'Due amount',
                            value:
                                Formatters.currency(due),
                            valueColor:
                                due > 0 ? AppColors.danger : AppColors.success,
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _InfoCell(
                            icon: Icons.card_membership_rounded,
                            label: 'Plan',
                            value: membership?.planName ?? 'No plan',
                          ),
                          _InfoCell(
                            icon: Icons.event_rounded,
                            label: membership != null &&
                                    membership.status != 'ACTIVE'
                                ? 'Expiry · ${membership.status.toLowerCase()}'
                                : 'Plan expiry',
                            value: membership != null
                                ? _fmtDate(membership.endDate)
                                : '—',
                            valueColor: membership != null &&
                                    membership.endDate.isBefore(DateTime.now())
                                ? AppColors.danger
                                : AppColors.memberB,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    _ActionButton(
                      icon: Icons.call_rounded,
                      label: 'Call',
                      color: AppColors.staffA,
                      onTap: hasPhone
                          ? () => _open(Uri(scheme: 'tel', path: m.phone))
                          : null,
                    ),
                    _ActionButton(
                      icon: Icons.chat_rounded,
                      label: 'WhatsApp',
                      color: AppColors.success,
                      onTap: hasPhone
                          ? () => _open(
                                Uri.parse(
                                  'https://wa.me/${_waNumber(m.phone!)}',
                                ),
                              )
                          : null,
                    ),
                    if (!deleted && membership != null)
                      _ActionButton(
                        icon: Icons.autorenew_rounded,
                        label: _renewing ? '…' : 'Renew',
                        color: AppColors.staffB,
                        onTap: _renewing ? null : _renew,
                      ),
                    if (!deleted) ...[
                      const SizedBox(width: 6),
                      Expanded(
                        flex: 2,
                        child: _PunchInButton(
                          loading: _checkingIn,
                          onTap: _checkingIn ? null : _punchIn,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoCell extends StatelessWidget {
  const _InfoCell({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 15, color: AppColors.inkFaint),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
                const SizedBox(height: 1),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w700,
                    color: valueColor ?? AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Opacity(
          opacity: enabled ? 1 : 0.35,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.16),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 17, color: color),
                ),
                const SizedBox(height: 4),
                Text(
                  label,
                  style: AppText.body(size: 11, weight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PunchInButton extends StatelessWidget {
  const _PunchInButton({required this.loading, required this.onTap});

  final bool loading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Ink(
          height: 40,
          decoration: BoxDecoration(
            gradient: AppColors.memberGrad,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: loading
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.memberOnGrad,
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.fingerprint_rounded,
                        size: 17,
                        color: AppColors.memberOnGrad,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Punch In',
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w800,
                          color: AppColors.memberOnGrad,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
