import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../models/tenant_summary.dart';
import '../../../repositories/public_tenant_repository.dart';

/// Gym chooser, shown as a bottom sheet over the login screen — ONLY after a
/// successful email/Member-ID + password sign-in whose account belongs to more
/// than one gym ([gyms] is exactly those gyms). Picking one resolves its full
/// branding and pops with the [TenantBranding]; dismissing pops null.
Future<TenantBranding?> showGymPicker(
  BuildContext context, {
  required List<TenantSummary> gyms,
}) {
  return showModalBottomSheet<TenantBranding>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (_) => _GymPickerSheet(gyms: gyms),
  );
}

class _GymPickerSheet extends StatefulWidget {
  const _GymPickerSheet({required this.gyms});

  final List<TenantSummary> gyms;

  @override
  State<_GymPickerSheet> createState() => _GymPickerSheetState();
}

class _GymPickerSheetState extends State<_GymPickerSheet> {
  String? _resolvingSlug;
  String? _error;

  Future<void> _select(TenantSummary gym) async {
    setState(() {
      _resolvingSlug = gym.slug;
      _error = null;
    });
    try {
      final tenant = await getIt<PublicTenantRepository>().resolve(gym.slug);
      if (!mounted) return;
      Navigator.of(context).pop(tenant);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.isMaintenance) {
        setState(() => _resolvingSlug = null);
        return;
      }
      setState(() {
        _error = e.message;
        _resolvingSlug = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
          child: Container(
            constraints: BoxConstraints(maxHeight: height * 0.78),
            decoration: BoxDecoration(
              color: const Color(0xFF14101F).withValues(alpha: 0.94),
              border: Border(
                top: BorderSide(color: Colors.white.withValues(alpha: 0.16)),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Choose your gym',
                  style: AppText.display(size: 24, color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your account is linked to more than one gym. '
                  'Which one do you want to sign in to?',
                  style: AppText.body(
                    size: 13.5,
                    color: Colors.white.withValues(alpha: 0.62),
                    weight: FontWeight.w600,
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(
                    _error!,
                    style: AppText.body(
                      size: 12.5,
                      color: const Color(0xFFFF8CA2),
                      weight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Flexible(child: _body()),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _body() {
    final list = widget.gyms;
    return ListView.separated(
      shrinkWrap: true,
      itemCount: list.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, i) {
        final gym = list[i];
        return _GymTile(
          gym: gym,
          busy: _resolvingSlug == gym.slug,
          disabled: _resolvingSlug != null && _resolvingSlug != gym.slug,
          onTap: () => _select(gym),
        );
      },
    );
  }
}

class _GymTile extends StatelessWidget {
  const _GymTile({
    required this.gym,
    required this.busy,
    required this.disabled,
    required this.onTap,
  });

  final TenantSummary gym;
  final bool busy;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: disabled || busy ? null : onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 180),
          opacity: disabled ? 0.4 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
            ),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppColors.staffGrad,
                  ),
                  child: Text(
                    gym.initials,
                    style: AppText.body(
                      size: 13,
                      color: Colors.white,
                      weight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        gym.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 14.5,
                          color: Colors.white,
                          weight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        gym.slug,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          color: Colors.white.withValues(alpha: 0.45),
                        ),
                      ),
                    ],
                  ),
                ),
                if (busy)
                  const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 20,
                    color: Colors.white.withValues(alpha: 0.5),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
