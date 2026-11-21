import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/maintenance/maintenance_cubit.dart';
import '../../../bloc/platform/platform_config_cubit.dart';
import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/theme/app_colors.dart';
import 'maintenance_screen.dart';

/// Wraps the whole app (`MaterialApp.router`'s `builder`) and lays the
/// [MaintenanceScreen] over it while [MaintenanceCubit] is active.
///
/// An overlay rather than a route on purpose: the Navigator, every role shell
/// (and its `IndexedStack` tab cache) and the session stay mounted and
/// untouched underneath, so when maintenance ends the user is exactly where
/// they were — nothing to restore, no redirect to fight. The covered app is
/// made inert (no taps, no semantics, no focus) while the overlay is up.
///
/// On the way out, if the session was still being restored when maintenance
/// hit (cold start), restore is re-run; otherwise there is nothing to redo.
class MaintenanceHost extends StatelessWidget {
  const MaintenanceHost({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<MaintenanceCubit, MaintenanceState>(
      listenWhen: (prev, next) => prev.active && !next.active,
      listener: (context, _) {
        final session = context.read<SessionCubit>();
        if (session.state is SessionUnknown) session.restore();
      },
      buildWhen: (prev, next) => prev.active != next.active,
      builder: (context, state) {
        final session = context.read<SessionCubit>().state;
        final role = session is SessionAuthenticatedMember
            ? AppRole.member
            : AppRole.staff;
        final tenantName = switch (session) {
          SessionAuthenticatedStaff(:final tenant) => tenant.name,
          SessionAuthenticatedMember(:final tenant) => tenant.name,
          _ => null,
        };
        return Stack(
          fit: StackFit.expand,
          children: [
            IgnorePointer(
              ignoring: state.active,
              child: ExcludeSemantics(
                excluding: state.active,
                child: ExcludeFocus(excluding: state.active, child: child),
              ),
            ),
            if (state.active)
              Positioned.fill(
                child: MaintenanceScreen(
                  role: role,
                  fallbackGymName: tenantName,
                  supportEmail:
                      context.read<PlatformConfigCubit>().state.supportEmail,
                ),
              ),
          ],
        );
      },
    );
  }
}
