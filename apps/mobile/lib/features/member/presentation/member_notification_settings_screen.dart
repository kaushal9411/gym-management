import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/profile_failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/member_notification_preferences.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../communications/comm_constants.dart';
import '../../communications/presentation/widgets/comm_widgets.dart';
import '../../team/presentation/widgets/team_ui.dart' show TeamCenter;
import 'widgets/member_dash_ui.dart';

/// Notification settings — the member's promotional opt-out per channel
/// (`GET` / `PUT /portal/notification-preferences`), reached from My Profile.
///
/// One switch per channel the member can control (Push, Email, SMS, WhatsApp):
/// ON = "send me offers and announcements here", OFF = promotional opt-out.
/// Each switch saves on tap — awaiting the server and then showing what it
/// stored (no optimistic update), with a spinner on that switch meanwhile.
/// Below, the categories that are **always delivered** (membership expiry,
/// invoice and payment reminders, class reminders and changes, account and
/// receipt messages) are listed with the API's own explanation, so members
/// know opting out never hides anything about their own membership.
///
/// Errors: load failure -> retry view; a failed save -> red banner with the
/// specific reason (rate limit 30 per 15 minutes, no connection, ...) and the
/// switch stays where the server has it. Member plane only (member repository
/// and palette).
class MemberNotificationSettingsScreen extends StatefulWidget {
  const MemberNotificationSettingsScreen({super.key});

  @override
  State<MemberNotificationSettingsScreen> createState() =>
      _MemberNotificationSettingsScreenState();
}

class _MemberNotificationSettingsScreenState
    extends State<MemberNotificationSettingsScreen> {
  MemberNotificationPreferences? _prefs;
  bool _loading = true;
  String? _error;
  String? _banner;
  final _busy = <String>{};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = _prefs == null;
      _error = null;
    });
    try {
      final p = await getIt<MemberPortalRepository>().notificationPreferences();
      if (mounted) setState(() => _prefs = p);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Could not load your notification settings.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _set(ChannelPreference pref, bool receive) async {
    final key = pref.channel.api;
    if (_busy.contains(key)) return;
    setState(() {
      _busy.add(key);
      _banner = null;
    });
    try {
      final updated = await getIt<MemberPortalRepository>()
          .updateNotificationPreferences({pref.channel: !receive});
      if (mounted) setState(() => _prefs = updated);
    } on ProfileFailure catch (e) {
      if (mounted) setState(() => _banner = e.message);
    } on ApiException catch (e) {
      if (mounted) setState(() => _banner = e.message);
    } catch (_) {
      if (mounted) {
        setState(() => _banner = 'Could not save that. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _busy.remove(key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = _prefs;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : p == null
              ? Column(
                  children: [
                    const MemberPageHero(
                      eyebrow: 'Notifications',
                      title: 'Notification settings',
                    ),
                    Expanded(
                      child: AppErrorView(
                        message: _error ?? 'Settings unavailable.',
                        onRetry: _load,
                        role: AppRole.member,
                      ),
                    ),
                  ],
                )
              : RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: _load,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.only(bottom: 32),
                    children: [
                      const MemberPageHero(
                        eyebrow: 'Notifications',
                        title: 'Notification settings',
                        subtitle: 'Choose which offers and announcements '
                            'reach you.',
                      ),
                      TeamCenter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_banner != null) ...[
                                FormAlert(message: _banner!),
                                const SizedBox(height: 12),
                              ],
                              MemberSection(
                                title: 'Offers and announcements',
                                subtitle: 'Turn a channel off to stop these',
                                icon: Icons.campaign_outlined,
                                color: kPushColor,
                                child: Column(
                                  children: [
                                    for (final c in p.channels)
                                      _ChannelRow(
                                        pref: c,
                                        busy: _busy.contains(c.channel.api),
                                        onChanged: (v) => _set(c, v),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),
                              MemberSection(
                                title: 'Always delivered',
                                subtitle: 'These cannot be turned off',
                                icon: Icons.lock_outline_rounded,
                                color: AppColors.memberPillFg,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    for (final n in p.nonBlockable)
                                      Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 8),
                                        child: Row(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Padding(
                                              padding: const EdgeInsets.only(
                                                top: 2,
                                              ),
                                              child: Icon(
                                                Icons.check_circle_rounded,
                                                size: 16,
                                                color: AppColors.memberPillFg,
                                              ),
                                            ),
                                            const SizedBox(width: 9),
                                            Expanded(
                                              child: Text(
                                                n.label,
                                                style: AppText.body(
                                                  size: 13,
                                                  weight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    if (p.note.isNotEmpty)
                                      Text(
                                        p.note,
                                        style: AppText.body(
                                          size: 12,
                                          weight: FontWeight.w600,
                                          color: AppColors.inkFaint,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _ChannelRow extends StatelessWidget {
  const _ChannelRow({
    required this.pref,
    required this.busy,
    required this.onChanged,
  });

  final ChannelPreference pref;
  final bool busy;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final receive = !pref.promotionalOptOut;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          ChannelDot(channel: pref.channel, size: 34),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pref.label,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                Text(
                  receive ? 'You get offers here' : 'Offers are off here',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          CommSwitch(
            value: receive,
            busy: busy,
            semanticLabel: '${pref.label} offers and announcements',
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
