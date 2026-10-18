import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'profile_ui.dart';

/// My Profile → Check permissions. Read-only: the signed-in user's role
/// pills and every granted permission, grouped by resource, from the
/// session's own `/auth/me` data (no extra request). Mobile-only — web has
/// no such page, so this stays as it was: a view of what the account can do.
class MyPermissionsScreen extends StatelessWidget {
  const MyPermissionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final user = session is SessionAuthenticatedStaff ? session.user : null;
    final permissions = user?.permissions ?? const <String>[];
    final groups = _groupPermissions(permissions);
    return ProfileFormPage(
      title: 'Permissions',
      chip: '${permissions.length} permissions · ${groups.length} areas',
      icon: Icons.admin_panel_settings_outlined,
      color: TeamColors.violet,
      name: user?.name ?? 'My profile',
      subtitle: (user?.roles ?? const <String>[]).join(' · '),
      sections: [
        if (groups.isEmpty)
          const TeamSectionCard(
            icon: Icons.lock_outline_rounded,
            color: TeamColors.slate,
            title: 'No permissions',
            child: Padding(
              padding: EdgeInsets.all(14),
              child: ProfileNote('This account has no permissions granted.'),
            ),
          ),
        for (var i = 0; i < groups.length; i++)
          TeamSectionCard(
            icon: Icons.key_rounded,
            color: TeamColors.rotation[i % TeamColors.rotation.length],
            title: groups[i].key,
            subtitle: '${groups[i].value.length} granted',
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final key in groups[i].value)
                    TeamTag(
                      label: key.split(':').last,
                      color:
                          TeamColors.rotation[i % TeamColors.rotation.length],
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

/// "members:view" → "members" — grouped by resource, sorted.
List<MapEntry<String, List<String>>> _groupPermissions(
  List<String> permissions,
) {
  final groups = <String, List<String>>{};
  for (final key in permissions) {
    groups.putIfAbsent(key.split(':').first, () => []).add(key);
  }
  return groups.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
}
