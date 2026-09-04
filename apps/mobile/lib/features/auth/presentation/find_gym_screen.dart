import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/tenant_branding.dart';
import '../../../models/tenant_summary.dart';
import '../../../repositories/public_tenant_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/brand_mark.dart';
import 'login_screen.dart';

/// Design frame "2. Find your gym" — one entry surface for both staff and
/// members, a real dropdown of every active gym (`GET /public/tenants`);
/// the user picks, never types a gym name to submit. The search field only
/// filters the already-loaded list client-side; it never itself resolves
/// arbitrary text as a slug.
///
/// User-requested change: this used to also ask staff-vs-member up front
/// via a [RoleToggle] before showing the gym list. That's gone — which
/// plane a login is on isn't decided here anymore; [LoginScreen] detects it
/// from what's actually typed (an email vs. a Member ID), same "one
/// credentials field, no separate screens" precedent as the web app's own
/// unified `/login`. `rememberAs` used to be passed to [resolve] from this
/// screen's toggle; since the role isn't known yet at gym-pick time now,
/// that's deferred to [LoginScreen] recording it after a real login
/// actually succeeds (`PublicTenantRepository.rememberGymForRole`).
class FindGymScreen extends StatefulWidget {
  const FindGymScreen({super.key});

  @override
  State<FindGymScreen> createState() => _FindGymScreenState();
}

class _FindGymScreenState extends State<FindGymScreen> {
  final _searchController = TextEditingController();
  String? _resolvingSlug;
  String? _error;
  List<TenantSummary>? _gyms;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
    _searchController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final gyms = await getIt<PublicTenantRepository>().listActive();
      if (!mounted) return;
      setState(() => _gyms = gyms);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.message);
    }
  }

  List<TenantSummary> get _filtered {
    final gyms = _gyms ?? const [];
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return gyms;
    return gyms
        .where(
          (g) =>
              g.name.toLowerCase().contains(query) ||
              g.slug.toLowerCase().contains(query),
        )
        .toList();
  }

  Future<void> _select(TenantSummary gym) async {
    setState(() {
      _resolvingSlug = gym.slug;
      _error = null;
    });
    try {
      // No `rememberAs` — the role isn't known until a real login succeeds
      // (see this file's doc comment / `LoginScreen`).
      final TenantBranding tenant =
          await getIt<PublicTenantRepository>().resolve(gym.slug);
      if (!mounted) return;
      context.push(
        AppRoutes.login,
        extra: LoginScreenArgs(role: null, tenant: tenant),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _resolvingSlug = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            children: [
              const SizedBox(height: 8),
              // Neutral — no role is known yet at this point (see this
              // file's doc comment), same default `BrandMark.initials`
              // already uses when its own `role` is omitted.
              const BrandMark.glyph(role: AppRole.staff, size: 52),
              const SizedBox(height: 12),
              Text('Find your gym', style: AppText.display(size: 24)),
              const SizedBox(height: 6),
              Text(
                'Select your gym to continue',
                style: AppText.body(color: AppColors.inkSoft),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  border: Border.all(color: AppColors.line),
                ),
                child: TextField(
                  controller: _searchController,
                  style: AppText.body(size: 15, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    border: InputBorder.none,
                    hintText: 'Search gyms…',
                    hintStyle:
                        AppText.body(size: 15, color: AppColors.inkFaint),
                    prefixIcon: const Icon(
                      Icons.search_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: AppText.body(size: 12, color: AppColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 14),
              Expanded(child: _buildList()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildList() {
    if (_gyms == null) {
      return _loadError != null
          ? AppErrorView(message: _loadError!, onRetry: _load)
          : const AppLoadingView();
    }
    final gyms = _filtered;
    if (gyms.isEmpty) {
      return const AppEmptyState(
        icon: Icons.storefront_outlined,
        title: 'No gyms found',
        message: 'Try a different search.',
      );
    }
    return ListView.builder(
      itemCount: gyms.length,
      itemBuilder: (context, i) {
        final gym = gyms[i];
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: _GymTile(
            gym: gym,
            busy: _resolvingSlug == gym.slug,
            disabled: _resolvingSlug != null && _resolvingSlug != gym.slug,
            onTap: () => _select(gym),
          ),
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
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: disabled ? null : onTap,
        child: Opacity(
          opacity: disabled ? 0.4 : 1,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: const BoxDecoration(
                    // Neutral — role isn't known until a real login
                    // succeeds, see this file's top doc comment.
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    gym.initials,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w800,
                      color: Colors.white,
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
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      Text(
                        gym.slug,
                        style:
                            AppText.body(size: 11, color: AppColors.inkFaint),
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
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: AppColors.inkFaint,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
