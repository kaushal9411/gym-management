import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_info.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart'
    show Looping, PulseDot;
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors, TeamTag;
import 'widgets/member_dash_ui.dart';
import 'widgets/member_profile_blocks.dart';

/// Gym info — web's `/portal/gym`, in the same coloured-block style as My
/// Profile (`GET /portal/gym`).
///
/// An animated hero (drifting gradient, the logo or initials in a rotating
/// ring, gym name, "Your branch: …", and a live **Open now · closes 9:00 PM** /
/// **Closed · opens 6:00 AM** chip computed from today's hours) with quick
/// actions — Call, Directions (Google Maps) and Website — for whatever the
/// gym has filled in. Then coloured blocks that bounce in: **Get in touch**
/// (phone, e-mail, website), **Address** with **Get directions**, **Opening
/// hours** (Monday first, today highlighted, Closed days greyed) and **Follow
/// us** (Instagram, Facebook, X, YouTube, LinkedIn, anything else as a link).
/// Only fields the gym actually set are shown; branch values win over the
/// gym's. An all-empty response shows the gym name and "Your gym hasn't added
/// details yet".
///
/// Dropped vs web: nothing — the map is a link (Google Maps) on both.
class MemberGymInfoScreen extends StatefulWidget {
  const MemberGymInfoScreen({super.key});

  @override
  State<MemberGymInfoScreen> createState() => _MemberGymInfoScreenState();
}

class _MemberGymInfoScreenState extends State<MemberGymInfoScreen> {
  GymInfo? _info;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _info == null;
      _error = null;
    });
    try {
      final info = await getIt<MemberPortalRepository>().gymInfo();
      if (mounted) setState(() => _info = info);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load gym details ($e)');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: _loading
          ? const AppLoadingView(role: AppRole.member)
          : _info == null
              ? AppErrorView(
                  message: _error ?? 'Gym details unavailable.',
                  onRetry: _load,
                  role: AppRole.member,
                )
              : RefreshIndicator(
                  color: AppColors.memberB,
                  backgroundColor: AppColors.surface2,
                  onRefresh: _load,
                  child: GymInfoBody(info: _info!),
                ),
    );
  }
}

Future<void> launchGymLink(BuildContext context, Uri uri) async {
  var ok = false;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } on Object {
    ok = false;
  }
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Could not open that link.')),
    );
  }
}

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

Uri _webUri(String raw) =>
    Uri.parse(raw.contains('://') ? raw : 'https://$raw');

const _days = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

int? _minutes(String? hhmm) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm ?? '');
  return m == null ? null : int.parse(m[1]!) * 60 + int.parse(m[2]!);
}

/// "06:00" → "6:00 AM".
String gymTime(String? hhmm) {
  final m = _minutes(hhmm);
  if (m == null) return hhmm ?? '';
  final h = m ~/ 60;
  final min = (m % 60).toString().padLeft(2, '0');
  return '${h % 12 == 0 ? 12 : h % 12}:$min ${h < 12 ? 'AM' : 'PM'}';
}

/// Web's `openState`: null when today's hours are unknown.
({bool open, String label})? gymOpenState(List<GymHour>? hours, DateTime now) {
  if (hours == null) return null;
  final today = _days[now.weekday - 1];
  GymHour? h;
  for (final x in hours) {
    if (x.day.toLowerCase() == today) h = x;
  }
  if (h == null) return null;
  final o = _minutes(h.open);
  final c = _minutes(h.close);
  if (h.closed || o == null || c == null) {
    return (open: false, label: 'Closed today');
  }
  final cur = now.hour * 60 + now.minute;
  if (cur >= o && cur < c) {
    return (open: true, label: 'Open now · closes ${gymTime(h.close)}');
  }
  return (
    open: false,
    label: cur < o ? 'Closed · opens ${gymTime(h.open)}' : 'Closed for today',
  );
}

({IconData icon, String label, Color color}) _social(String key) =>
    switch (key.toLowerCase()) {
      'instagram' => (
          icon: Icons.camera_alt_outlined,
          label: 'Instagram',
          color: const Color(0xFFE1306C),
        ),
      'facebook' => (
          icon: Icons.facebook_rounded,
          label: 'Facebook',
          color: const Color(0xFF1877F2),
        ),
      'twitter' || 'x' => (
          icon: Icons.alternate_email_rounded,
          label: key.toLowerCase() == 'x' ? 'X' : 'X / Twitter',
          color: const Color(0xFF0F172A),
        ),
      'youtube' => (
          icon: Icons.play_circle_outline_rounded,
          label: 'YouTube',
          color: const Color(0xFFEF4444),
        ),
      'linkedin' => (
          icon: Icons.business_center_outlined,
          label: 'LinkedIn',
          color: const Color(0xFF0A66C2),
        ),
      _ => (
          icon: Icons.language_rounded,
          label: _cap(key),
          color: TeamColors.violet,
        ),
    };

class GymInfoBody extends StatelessWidget {
  const GymInfoBody({required this.info, this.now, super.key});

  final GymInfo info;

  /// Injectable clock (tests); defaults to [DateTime.now].
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final i = info;
    final b = i.branch;
    final clock = now ?? DateTime.now();
    // Branch values win over the gym's (web's rule).
    final phone = b?.phone ?? i.phone;
    final email = b?.email ?? i.email;
    final address = b?.address ?? i.address;
    final hours = (b?.businessHours?.isNotEmpty ?? false)
        ? b!.businessHours
        : (i.businessHours?.isNotEmpty ?? false)
            ? i.businessHours
            : null;
    final website = i.website;
    final state = gymOpenState(hours, clock);
    final lines = address == null
        ? <String>[]
        : [
            address.line1,
            address.line2,
            [address.city, address.state, address.postalCode]
                .where((x) => x != null && x.isNotEmpty)
                .join(', '),
            address.country,
          ].whereType<String>().where((x) => x.isNotEmpty).toList();
    final mapsUri = lines.isEmpty
        ? null
        : Uri.parse(
            'https://www.google.com/maps/search/?api=1&query='
            '${Uri.encodeComponent(lines.join(', '))}',
          );
    final hasAnything = phone != null ||
        email != null ||
        website != null ||
        lines.isNotEmpty ||
        hours != null ||
        i.social.isNotEmpty;
    var idx = 1;
    Widget bounce(Widget w) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: BounceIn(index: idx++, child: w),
        );

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        _GymHero(
          top: MediaQuery.of(context).padding.top,
          info: i,
          state: state,
          onBack: () => Navigator.of(context).maybePop(),
          actions: [
            if (phone != null)
              MemberHeroButton(
                icon: Icons.call_rounded,
                label: 'Call',
                solid: true,
                onTap: () =>
                    launchGymLink(context, Uri(scheme: 'tel', path: phone)),
              ),
            if (mapsUri != null)
              MemberHeroButton(
                icon: Icons.navigation_rounded,
                label: 'Directions',
                onTap: () => launchGymLink(context, mapsUri),
              ),
            if (website != null)
              MemberHeroButton(
                icon: Icons.language_rounded,
                label: 'Website',
                onTap: () => launchGymLink(context, _webUri(website)),
              ),
          ],
        ),
        TeamCenter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (!hasAnything)
                  bounce(
                    const AppEmptyState(
                      icon: Icons.storefront_outlined,
                      title: 'No details shared yet',
                      message: "Your gym hasn't added details yet. Address, "
                          'phone and opening hours will show up here once '
                          'they do.',
                    ),
                  ),
                if (phone != null || email != null || website != null)
                  bounce(
                    _GymBlock(
                      title: 'Get in touch',
                      subtitle: 'Tap to call, email or visit',
                      icon: Icons.support_agent_rounded,
                      colors: const [Color(0xFF059669), Color(0xFF34D399)],
                      children: [
                        if (phone != null)
                          _LinkRow(
                            icon: Icons.call_rounded,
                            color: TeamColors.green,
                            title: phone,
                            subtitle: 'Call',
                            onTap: () => launchGymLink(
                              context,
                              Uri(scheme: 'tel', path: phone),
                            ),
                          ),
                        if (email != null)
                          _LinkRow(
                            icon: Icons.mail_rounded,
                            color: TeamColors.sky,
                            title: email,
                            subtitle: 'Email',
                            onTap: () => launchGymLink(
                              context,
                              Uri(scheme: 'mailto', path: email),
                            ),
                          ),
                        if (website != null)
                          _LinkRow(
                            icon: Icons.language_rounded,
                            color: TeamColors.violet,
                            title: website.replaceFirst(
                              RegExp(r'^https?://', caseSensitive: false),
                              '',
                            ),
                            subtitle: 'Website',
                            onTap: () =>
                                launchGymLink(context, _webUri(website)),
                          ),
                      ],
                    ),
                  ),
                if (lines.isNotEmpty)
                  bounce(
                    _GymBlock(
                      title: 'Address',
                      subtitle: b?.name,
                      icon: Icons.place_rounded,
                      colors: const [Color(0xFFF59E0B), Color(0xFFF97316)],
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (var k = 0; k < lines.length; k++)
                                Text(
                                  lines[k],
                                  style: AppText.body(
                                    size: 14,
                                    weight: k == 0
                                        ? FontWeight.w800
                                        : FontWeight.w600,
                                    color: k == 0
                                        ? AppColors.ink
                                        : AppColors.inkSoft,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (mapsUri != null)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                            child: PressBounce(
                              onTap: () => launchGymLink(context, mapsUri),
                              child: Container(
                                key: const ValueKey('gym-directions'),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 11,
                                ),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFFF59E0B),
                                      Color(0xFFF97316),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(
                                      Icons.navigation_rounded,
                                      size: 17,
                                      color: Colors.white,
                                    ),
                                    const SizedBox(width: 7),
                                    Text(
                                      'Get directions',
                                      style: AppText.body(
                                        size: 13,
                                        weight: FontWeight.w800,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                if (hours != null)
                  bounce(
                    _GymBlock(
                      title: 'Opening hours',
                      subtitle: state?.label,
                      icon: Icons.schedule_rounded,
                      colors: const [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                      children: [
                        for (final d in _days)
                          _HoursRow(
                            day: d,
                            hour: hours.cast<GymHour?>().firstWhere(
                                  (x) => x!.day.toLowerCase() == d,
                                  orElse: () => null,
                                ),
                            today: _days[clock.weekday - 1] == d,
                          ),
                        const SizedBox(height: 6),
                      ],
                    ),
                  ),
                if (i.social.isNotEmpty)
                  bounce(
                    _GymBlock(
                      title: 'Follow us',
                      subtitle: 'Social media',
                      icon: Icons.favorite_rounded,
                      colors: const [Color(0xFFC026D3), Color(0xFFEC4899)],
                      children: [
                        for (final e in i.social.entries)
                          Builder(
                            builder: (context) {
                              final meta = _social(e.key);
                              return _LinkRow(
                                icon: meta.icon,
                                color: meta.color,
                                title: meta.label,
                                subtitle: e.value.replaceFirst(
                                  RegExp(
                                    r'^https?://(www\.)?',
                                    caseSensitive: false,
                                  ),
                                  '',
                                ),
                                onTap: () => launchGymLink(
                                  context,
                                  _webUri(e.value),
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────────────────────────────────────────── hero

class _GymHero extends StatelessWidget {
  const _GymHero({
    required this.top,
    required this.info,
    required this.state,
    required this.onBack,
    required this.actions,
  });

  final double top;
  final GymInfo info;
  final ({bool open, String label})? state;
  final VoidCallback onBack;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final branch = info.branch;
    return Looping(
      duration: const Duration(seconds: 9),
      reverse: true,
      builder: (context, t) => Container(
        decoration: BoxDecoration(
          borderRadius:
              const BorderRadius.vertical(bottom: Radius.circular(34)),
          gradient: LinearGradient(
            begin: Alignment(-1 + t * 0.5, -1),
            end: Alignment(1 - t * 0.5, 1),
            colors: const [
              Color(0xFF3B0764),
              Color(0xFF6D28D9),
              Color(0xFFC026D3),
              Color(0xFFF97316),
            ],
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned(
              right: -50 + 24 * t,
              top: -40,
              child: _blob(210, const Color(0x66FBBF24)),
            ),
            Positioned(
              left: -60 - 16 * t,
              bottom: -30 + 14 * t,
              child: _blob(190, const Color(0x6622D3EE)),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(18, top + 8, 18, 22),
              child: Column(
                children: [
                  Row(
                    children: [
                      GestureDetector(
                        onTap: onBack,
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'MY GYM',
                        style: AppText.eyebrow(
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                      const Spacer(),
                      const SizedBox(width: 38),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.6, end: 1),
                    duration: const Duration(milliseconds: 650),
                    curve: Curves.elasticOut,
                    builder: (context, v, child) =>
                        Transform.scale(scale: v, child: child),
                    child: _Logo(info: info),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    info.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 26, color: Colors.white),
                  ),
                  if (branch != null && branch.name.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      'Your branch: ${branch.name}',
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                  if (state != null) ...[
                    const SizedBox(height: 10),
                    Container(
                      key: const ValueKey('gym-open-chip'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          state!.open
                              ? const PulseDot(
                                  color: Color(0xFF34D399),
                                  size: 9,
                                )
                              : Container(
                                  width: 9,
                                  height: 9,
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.55),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              state!.label,
                              style: AppText.body(
                                size: 12,
                                weight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  if (actions.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        for (var k = 0; k < actions.length; k++) ...[
                          if (k > 0) const SizedBox(width: 8),
                          Expanded(child: actions[k]),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _blob(double size, Color color) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      );
}

/// The gym logo (or its initials) in a rotating ring.
class _Logo extends StatelessWidget {
  const _Logo({required this.info});

  final GymInfo info;

  @override
  Widget build(BuildContext context) => Looping(
        duration: const Duration(seconds: 6),
        builder: (context, t) => Container(
          width: 104,
          height: 104,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: SweepGradient(
              transform: GradientRotation(t * 6.2831853),
              colors: const [
                Color(0xFFFDE68A),
                Color(0xFFF9A8D4),
                Colors.white,
                Color(0xFF67E8F9),
                Color(0xFFFDE68A),
              ],
            ),
          ),
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: const BoxDecoration(
              color: Color(0xFF3B0764),
              shape: BoxShape.circle,
            ),
            child: UserAvatar(
              avatarUrl: info.logoUrl,
              name: info.name,
              size: 92,
              role: AppRole.member,
            ),
          ),
        ),
      );
}

// ───────────────────────────────────────────────────────────────── blocks

/// Coloured block: gradient header (icon, title, subtitle) over a tinted body.
class _GymBlock extends StatelessWidget {
  const _GymBlock({
    required this.title,
    required this.icon,
    required this.colors,
    required this.children,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final List<Color> colors;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final c2 = colors.last;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: c2.withValues(alpha: 0.35), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: c2.withValues(alpha: 0.18),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(gradient: LinearGradient(colors: colors)),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 19, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: AppText.display(size: 16, color: Colors.white),
                      ),
                      if (subtitle != null)
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 11.5,
                            weight: FontWeight.w700,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Container(
            color: c2.withValues(alpha: 0.06),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }
}

/// A tappable contact / social row with a coloured icon chip and a squish.
class _LinkRow extends StatelessWidget {
  const _LinkRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => PressBounce(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(icon, size: 20, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      );
}

class _HoursRow extends StatelessWidget {
  const _HoursRow({
    required this.day,
    required this.hour,
    required this.today,
  });

  final String day;
  final GymHour? hour;
  final bool today;

  @override
  Widget build(BuildContext context) {
    final h = hour;
    if (h == null) return const SizedBox.shrink();
    final closed = h.closed || h.open == null || h.close == null;
    const accent = Color(0xFF8B5CF6);
    return Container(
      color: today ? accent.withValues(alpha: 0.14) : null,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        children: [
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  _cap(day),
                  style: AppText.body(
                    size: 13.5,
                    weight: today ? FontWeight.w800 : FontWeight.w700,
                    color: today ? accent : AppColors.inkSoft,
                  ),
                ),
                if (today) ...[
                  const TeamTag(label: 'Today', color: accent),
                ],
              ],
            ),
          ),
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: closed
                  ? const TeamTag(label: 'Closed', color: TeamColors.slate)
                  : Text(
                      '${gymTime(h.open)} – ${gymTime(h.close)}',
                      style: AppText.body(
                        size: 13.5,
                        weight: today ? FontWeight.w800 : FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
