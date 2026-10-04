import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_info.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../finance/presentation/widgets/analytics_parts.dart';

/// Public-safe gym info (`GET /portal/gym`): contact, address, opening hours
/// and the member's own branch. Only fields the gym actually filled in are
/// shown — an all-null response renders just the name and an explanatory
/// empty state, never placeholders. Phone/email/website are tap-to-launch
/// via `url_launcher` (already a dependency; the manifest `<queries>` cover
/// `tel:` and `https`, and `mailto:` is launched best-effort — failure shows
/// a SnackBar).
///
/// Dropped: a map view (no maps package, no coordinates in the API) and
/// social-link buttons beyond plain tap-to-open rows (the API sends a free
/// `Record<string,string>`, shown as-is under "Social").
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
      _loading = true;
      _error = null;
    });
    try {
      final info = await getIt<MemberPortalRepository>().gymInfo();
      if (!mounted) return;
      setState(() => _info = info);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Gym info', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView(role: AppRole.member)
            : _error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : RefreshIndicator(
                    color: AppColors.memberB,
                    backgroundColor: AppColors.surface2,
                    onRefresh: _load,
                    child: GymInfoBody(info: _info!),
                  ),
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
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Could not open that link.')));
  }
}

String _cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

Uri _webUri(String raw) =>
    Uri.parse(raw.contains('://') ? raw : 'https://$raw');

class GymInfoBody extends StatelessWidget {
  const GymInfoBody({required this.info, super.key});

  final GymInfo info;

  @override
  Widget build(BuildContext context) {
    final i = info;
    final b = i.branch;
    final phone = i.phone ?? b?.phone;
    final email = i.email ?? b?.email;
    final address = b?.address ?? i.address;
    final hours = b?.businessHours ?? i.businessHours;
    final blocks = <Widget>[
      if (phone != null || email != null || i.website != null || address != null)
        AnalyticsBlock(
          title: 'Contact',
          child: Column(
            children: [
              if (address != null)
                _InfoRow(icon: Icons.place_outlined, text: address.oneLine),
              if (phone != null)
                _InfoRow(
                  icon: Icons.call_outlined,
                  text: phone,
                  onTap: () => launchGymLink(
                    context,
                    Uri(scheme: 'tel', path: phone),
                  ),
                ),
              if (email != null)
                _InfoRow(
                  icon: Icons.mail_outline_rounded,
                  text: email,
                  onTap: () => launchGymLink(
                    context,
                    Uri(scheme: 'mailto', path: email),
                  ),
                ),
              if (i.website != null)
                _InfoRow(
                  icon: Icons.language_rounded,
                  text: i.website!,
                  onTap: () => launchGymLink(context, _webUri(i.website!)),
                ),
            ],
          ),
        ),
      if (hours != null) _HoursBlock(hours: hours),
      if (i.social.isNotEmpty)
        AnalyticsBlock(
          title: 'Social',
          child: Column(
            children: [
              for (final e in i.social.entries)
                _InfoRow(
                  icon: Icons.link_rounded,
                  text: '${_cap(e.key)}: ${e.value}',
                  onTap: () => launchGymLink(context, _webUri(e.value)),
                ),
            ],
          ),
        ),
    ];
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        Text(i.name, style: AppText.display(size: 24)),
        if (b != null && b.name.isNotEmpty && b.name != i.name)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              b.name,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: AppColors.memberPillFg,
              ),
            ),
          ),
        const SizedBox(height: 14),
        if (blocks.isEmpty)
          const AppEmptyState(
            icon: Icons.storefront_outlined,
            title: 'No details shared yet',
            message: 'Your gym has not added contact details or opening '
                'hours. Ask the front desk.',
          )
        else
          for (var k = 0; k < blocks.length; k++) ...[
            StaggeredReveal(index: k, child: blocks[k]),
            const SizedBox(height: 12),
          ],
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text, this.onTap});

  final IconData icon;
  final String text;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppColors.memberB),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: AppText.body(
                size: 13,
                weight: FontWeight.w600,
                color: onTap == null ? AppColors.ink : AppColors.memberPillFg,
              ),
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return row;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.tile),
        onTap: onTap,
        child: row,
      ),
    );
  }
}

class _HoursBlock extends StatelessWidget {
  const _HoursBlock({required this.hours});

  final List<GymHour> hours;

  @override
  Widget build(BuildContext context) {
    return AnalyticsBlock(
      title: 'Opening hours',
      child: Column(
        children: [
          for (final h in hours)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _cap(h.day),
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    h.closed || h.open == null || h.close == null
                        ? 'Closed'
                        : '${h.open} – ${h.close}',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w600,
                      color: h.closed ? AppColors.inkFaint : AppColors.ink,
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
