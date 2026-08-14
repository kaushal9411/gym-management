import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/user_session.dart';
import '../../../repositories/auth_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "11f. Sessions" — active devices only (see
/// `AuthRepository.listSessions`'s doc comment for why the design's
/// "Recent login history" list has no backend to read from).
class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  List<UserSession>? _sessions;
  String? _error;
  String? _revoking;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final sessions = await getIt<AuthRepository>().listSessions();
      if (!mounted) return;
      setState(() => _sessions = sessions);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _revoke(UserSession session) async {
    setState(() => _revoking = session.id);
    try {
      await getIt<AuthRepository>().logoutDevice(session.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _revoking = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessions = _sessions;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Sessions', style: AppText.display(size: 18)),
            Text('Active devices', style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: sessions == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  for (final session in sessions)
                    _SessionTile(
                      session: session,
                      revoking: _revoking == session.id,
                      onSignOut: () => _revoke(session),
                    ),
                ],
              ),
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({
    required this.session,
    required this.revoking,
    required this.onSignOut,
  });

  final UserSession session;
  final bool revoking;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: session.isCurrent ? AppColors.staffB : AppColors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  session.deviceLabel ?? session.userAgent ?? 'Unknown device',
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (session.isCurrent)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.successSoft,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    'This device',
                    style: AppText.body(
                      size: 10,
                      weight: FontWeight.w800,
                      color: AppColors.success,
                    ),
                  ),
                )
              else
                AppButton(
                  label: 'Sign out',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  fullWidth: false,
                  loading: revoking,
                  onPressed: onSignOut,
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${session.ipAddress ?? 'Unknown location'} · ${_relative(session.lastActiveAt)}',
            style: AppText.body(size: 11, color: AppColors.inkFaint),
          ),
        ],
      ),
    );
  }

  String _relative(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 1) return 'active now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays}d ago';
  }
}
