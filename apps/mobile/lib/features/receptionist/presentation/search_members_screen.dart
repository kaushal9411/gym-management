import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../attendance/presentation/attendance_member_card.dart';
import '../../attendance/presentation/attendance_sheets.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

Color _statusColor(String status) => switch (status) {
      'ACTIVE' => TeamColors.green,
      'FROZEN' => TeamColors.sky,
      _ => TeamColors.slate,
    };

/// Design frame "4b. Search manually" — the no-QR fallback for front-desk
/// check-in, redesigned like web's manual panel: search by name, phone or
/// member ID, each result is a member card showing whether they can check in
/// (frozen / inactive / no plan / expired) with **Check in**
/// (`POST /attendance/manual-check-in`, staff-attributed) and **Check out**
/// (`POST /attendance/manual-check-out`, closes their open visit) buttons.
///
/// Behaviour kept from before: the search hits `GET /members?search=` across
/// all statuses (the server rejects ineligible check-ins with its own
/// message, shown in a snackbar), and a successful check-in opens the
/// "Checked in" confirmation screen.
class SearchMembersScreen extends StatefulWidget {
  const SearchMembersScreen({super.key});

  @override
  State<SearchMembersScreen> createState() => _SearchMembersScreenState();
}

class _SearchMembersScreenState extends State<SearchMembersScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<GymMember>? _results;
  String? _error;
  bool _searching = false;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _search);
    setState(() {});
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() {
        _results = null;
        _error = null;
      });
      return;
    }
    setState(() {
      _error = null;
      _searching = true;
    });
    try {
      final result =
          await getIt<MemberRepository>().list(search: query, page: 1);
      if (!mounted || query != _searchController.text.trim()) return;
      setState(() => _results = result.items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not search ($e)');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _checkIn(GymMember member) async {
    setState(() => _busyId = member.id);
    try {
      await getIt<AttendanceRepository>().manualCheckIn(memberId: member.id);
      if (!mounted) return;
      await context.push(AppRoutes.checkedIn, extra: member.name);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, attendanceErrorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _checkOut(GymMember member) async {
    setState(() => _busyId = member.id);
    try {
      await getIt<AttendanceRepository>().manualCheckOut(memberId: member.id);
      if (mounted) teamSnack(context, '${member.name} checked out.');
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, attendanceErrorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    final count = _results?.length;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: CustomScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        slivers: [
          SliverToBoxAdapter(
            child: ListHero(
              title: 'Find a member',
              subtitle: 'Check in or out by name, phone or member ID',
              topInset: top,
              side: 18 + teamSideInset(context),
              leading: ListHeroButton(
                icon: Icons.arrow_back_rounded,
                onTap: () => context.pop(),
              ),
              chips: [
                ListHeroChip(
                  icon: Icons.manage_search_rounded,
                  label: count == null
                      ? 'Type to search'
                      : '$count ${count == 1 ? 'result' : 'results'}',
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                child: TextField(
                  controller: _searchController,
                  autofocus: true,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _search(),
                  style: AppText.body(size: 14, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: 'e.g. Karan or MEM-0001',
                    hintStyle:
                        AppText.body(size: 14, color: AppColors.inkFaint),
                    filled: true,
                    fillColor: AppColors.surface2,
                    prefixIcon: Icon(
                      Icons.search_rounded,
                      size: 19,
                      color: AppColors.inkFaint,
                    ),
                    suffixIcon: _searchController.text.isEmpty
                        ? null
                        : IconButton(
                            icon: Icon(
                              Icons.close_rounded,
                              size: 18,
                              color: AppColors.inkFaint,
                            ),
                            onPressed: _searchController.clear,
                          ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: BorderSide(color: AppColors.line),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: BorderSide(color: AppColors.line),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      borderSide: const BorderSide(color: TeamColors.violet),
                    ),
                  ),
                ),
              ),
            ),
          ),
          ..._resultSlivers(),
        ],
      ),
    );
  }

  List<Widget> _resultSlivers() {
    if (_error != null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: AppErrorView(message: _error!, onRetry: _search),
        ),
      ];
    }
    if (_results == null) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Type to search members.',
                style: AppText.body(color: AppColors.inkFaint),
              ),
            ),
          ),
        ),
      ];
    }
    if (_results!.isEmpty) {
      return [
        SliverFillRemaining(
          hasScrollBody: false,
          child: _searching
              ? const AppLoadingView()
              : const AppEmptyState(
                  icon: Icons.search_off_outlined,
                  title: 'No members found',
                ),
        ),
      ];
    }
    return [
      teamCardSliver<GymMember>(
        context,
        items: _results!,
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
        builder: (m, i) {
          final reason = memberIneligibleReason(m);
          final busy = _busyId == m.id;
          final plan = m.currentMembership?.planName ?? 'No plan';
          return FadeUp(
            index: i.clamp(0, 6),
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AttendanceMemberCard(
                key: ValueKey('member-${m.id}'),
                name: m.name,
                code: m.memberId,
                subtitle: plan,
                photoUrl: m.profilePhotoUrl,
                eligible: reason == null,
                message: reason ?? 'Eligible',
                tags: [
                  TeamTag(label: m.status, color: _statusColor(m.status)),
                ],
                actions: AttendanceActionRow(
                  busy: busy,
                  onCheckIn: () => _checkIn(m),
                  onCheckOut: () => _checkOut(m),
                ),
              ),
            ),
          );
        },
      ),
    ];
  }
}
