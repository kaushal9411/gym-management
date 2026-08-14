import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../shared/widgets/app_pill.dart';

/// "My Profile" → "Check permissions". Read-only: role badges plus every
/// granted permission grouped by resource, sourced from the session's own
/// `/auth/me` data — no separate network call needed.
class MyPermissionsScreen extends StatelessWidget {
  const MyPermissionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final sessionUser =
        session is SessionAuthenticatedStaff ? session.user : null;
    final groups = _groupPermissions(sessionUser?.permissions ?? const []);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Check permissions', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: (sessionUser?.roles ?? const [])
                  .map(
                    (r) => AppPill(label: r, tone: AppPillTone.roleTint),
                  )
                  .toList(),
            ),
            const SizedBox(height: 16),
            for (final group in groups)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _PermissionGroupView(
                  resource: group.key,
                  permissions: group.value,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// "members:read" → "members" — same grouping the role-permission picker
/// uses, applied here read-only to the current user's own granted keys.
List<MapEntry<String, List<String>>> _groupPermissions(
  List<String> permissions,
) {
  final groups = <String, List<String>>{};
  for (final key in permissions) {
    final resource = key.split(':').first;
    groups.putIfAbsent(resource, () => []).add(key);
  }
  final entries = groups.entries.toList()
    ..sort((a, b) => a.key.compareTo(b.key));
  return entries;
}

/// Read-only twin of `RoleFormScreen`'s `_PermissionGroupCard` — same card
/// chrome, no "Select all" pill or tap handlers since this just shows what
/// the signed-in user can already do.
class _PermissionGroupView extends StatelessWidget {
  const _PermissionGroupView({
    required this.resource,
    required this.permissions,
  });

  final String resource;
  final List<String> permissions;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            resource,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: permissions
                .map(
                  (permission) => Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppColors.staffGrad,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text(
                      permission,
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}
