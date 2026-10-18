import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/login_history_entry.dart';
import '../../../models/user_session.dart';
import '../../../repositories/auth_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/comm_kit.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../income/presentation/income_insights.dart' show LedgerKpiTile;
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../profile/presentation/profile_ui.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Sessions & devices — web's Account Settings → Sessions tab: three KPI
/// tiles (Active sessions, Recent sign-ins, Failed attempts), the active
/// devices (`GET /auth/sessions`; a "This device" tag for the current one,
/// Sign out with a confirmation for the others), "Sign out everywhere"
/// (`POST /auth/logout-all`, which also ends this session) and the Login
/// history timeline (`GET /sessions/login-history`, last 10 successes and
/// failures with IP and time). A failing history call only hides that part.
class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  List<UserSession>? _sessions;
  List<LoginHistoryEntry>? _history;
  String? _error;
  String? _revoking;
  bool _signingOutAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    unawaited(_loadHistory());
    try {
      final sessions = await getIt<AuthRepository>().listSessions();
      if (!mounted) return;
      setState(() => _sessions = sessions);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load your devices ($e)');
    }
  }

  Future<void> _loadHistory() async {
    try {
      final page = await getIt<AuthRepository>().loginHistory();
      if (mounted) setState(() => _history = page.items);
    } catch (_) {
      if (mounted) setState(() => _history = const []);
    }
  }

  Future<void> _signOutAll() async {
    final ok = await confirmTeam(
      context,
      title: 'Sign out everywhere?',
      message: 'Every device, including this one, will have to log in again.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _signingOutAll = true);
    try {
      await getIt<AuthRepository>().logoutAllDevices();
      if (!mounted) return;
      await context.read<SessionCubit>().signOut();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not sign out ($e)', error: true);
    } finally {
      if (mounted) setState(() => _signingOutAll = false);
    }
  }

  Future<void> _revoke(UserSession session) async {
    final ok = await confirmTeam(
      context,
      title: 'Sign out this device?',
      message: '${session.deviceLabel ?? session.userAgent ?? 'This device'} '
          'will have to log in again.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _revoking = session.id);
    try {
      await getIt<AuthRepository>().logoutDevice(session.id);
      if (!mounted) return;
      teamSnack(context, 'Device signed out.');
      await _load();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Could not sign out ($e)', error: true);
    } finally {
      if (mounted) setState(() => _revoking = null);
    }
  }

  Widget _body(List<UserSession> sessions) {
    final history = _history;
    final ok = history?.where((e) => e.success).length ?? 0;
    final failed = (history?.length ?? 0) - ok;
    TextStyle hint() => AppText.body(
          size: 11,
          color: AppColors.inkFaint,
          weight: FontWeight.w700,
        );
    Widget count(int n) => Text(
          '$n',
          style: AppText.display(size: 22, color: AppColors.ink),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CommKpiGrid(
          wideColumns: 3,
          tiles: [
            LedgerKpiTile(
              key: const ValueKey('sess-kpi-active'),
              label: 'Active sessions',
              icon: Icons.devices_rounded,
              color: TeamColors.teal,
              value: count(sessions.length),
              caption: Text('signed in now', style: hint()),
            ),
            LedgerKpiTile(
              key: const ValueKey('sess-kpi-ok'),
              label: 'Recent sign-ins',
              icon: Icons.login_rounded,
              color: TeamColors.green,
              value: count(ok),
              caption: Text('successful, last 10', style: hint()),
            ),
            LedgerKpiTile(
              key: const ValueKey('sess-kpi-failed'),
              label: 'Failed attempts',
              icon: Icons.gpp_bad_outlined,
              color: TeamColors.rose,
              value: count(failed),
              caption: Text('last 10', style: hint()),
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.devices_rounded,
          color: TeamColors.teal,
          title: 'Active sessions',
          subtitle: 'Devices currently signed in to your account.',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (sessions.isEmpty)
                  const ProfileNote('No active sessions.')
                else
                  for (var i = 0; i < sessions.length; i++)
                    FadeUp(
                      index: i.clamp(0, 6),
                      child: _SessionCard(
                        session: sessions[i],
                        revoking: _revoking == sessions[i].id,
                        onSignOut: () => _revoke(sessions[i]),
                      ),
                    ),
                const SizedBox(height: 4),
                TeamOutlineButton(
                  label: 'Sign out everywhere',
                  icon: Icons.logout_rounded,
                  onTap: _signingOutAll ? null : _signOutAll,
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.history_rounded,
          color: kProfileColor,
          title: 'Login history',
          subtitle: 'Recent sign-in attempts on your account.',
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: history == null
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : history.isEmpty
                    ? const ProfileNote('No login history yet.')
                    : Column(
                        children: [
                          for (final e in history) _HistoryRow(entry: e),
                        ],
                      ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessions = _sessions;
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: ListHero(
                title: 'Sessions',
                subtitle: 'The devices signed in to your account.',
                topInset: top,
                side: 18 + teamSideInset(context),
                leading: ListHeroButton(
                  icon: Icons.arrow_back_rounded,
                  onTap: () => context.pop(),
                ),
                chips: [
                  if (sessions != null)
                    ListHeroChip(
                      icon: Icons.devices_rounded,
                      label: '${sessions.length} active '
                          '${sessions.length == 1 ? 'device' : 'devices'}',
                    ),
                ],
              ),
            ),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                  child: sessions == null
                      ? SizedBox(
                          height: 260,
                          child: _error != null
                              ? AppErrorView(message: _error!, onRetry: _load)
                              : const AppLoadingView(),
                        )
                      : _body(sessions),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.revoking,
    required this.onSignOut,
  });

  final UserSession session;
  final bool revoking;
  final VoidCallback onSignOut;

  IconData get _icon {
    final ua = (session.userAgent ?? session.deviceLabel ?? '').toLowerCase();
    if (ua.contains('android') ||
        ua.contains('iphone') ||
        ua.contains('mobile')) {
      return Icons.smartphone_rounded;
    }
    if (ua.contains('ipad') || ua.contains('tablet')) {
      return Icons.tablet_mac_rounded;
    }
    return Icons.computer_rounded;
  }

  String _relative(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'active now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final current = session.isCurrent;
    final c = current ? TeamColors.green : TeamColors.indigo;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [c.withValues(alpha: 0.12), Colors.transparent],
        ),
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: c.withValues(alpha: current ? 0.45 : 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(_icon, color: c),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.deviceLabel ?? session.userAgent ?? 'Unknown device',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                const SizedBox(height: 3),
                Text(
                  '${session.ipAddress ?? 'Unknown location'} · '
                  '${_relative(session.lastActiveAt)}',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (current)
            const TeamTag(label: 'This device', color: TeamColors.green)
          else
            OutlinedButton(
              onPressed: revoking ? null : onSignOut,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side:
                    BorderSide(color: AppColors.danger.withValues(alpha: 0.5)),
                visualDensity: VisualDensity.compact,
              ),
              child: revoking
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Sign out'),
            ),
        ],
      ),
    );
  }
}

/// One login attempt on the history timeline.
class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.entry});

  final LoginHistoryEntry entry;

  @override
  Widget build(BuildContext context) {
    final c = entry.success ? TeamColors.green : TeamColors.rose;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: c.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: Icon(
              entry.success ? Icons.check_rounded : Icons.priority_high_rounded,
              size: 16,
              color: c,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      entry.success ? 'Successful sign-in' : 'Failed sign-in',
                      style: AppText.body(size: 13, weight: FontWeight.w800),
                    ),
                    TeamTag(
                      label:
                          entry.success ? 'Success' : entry.reason ?? 'Failed',
                      color: c,
                    ),
                  ],
                ),
                Text(
                  '${entry.ipAddress ?? 'Unknown IP'} · '
                  '${fmtDateTime(entry.createdAt)}',
                  style: AppText.body(
                    size: 11.5,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
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
