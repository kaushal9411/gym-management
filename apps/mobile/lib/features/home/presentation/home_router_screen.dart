import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../owner/presentation/owner_shell.dart';
import 'signed_in_stub_screen.dart';

/// The single `/home` route branches by role here rather than in the
/// router itself, so `AppRoutes.home` stays one stable redirect target for
/// every authenticated session while each role's actual shell is built out
/// chunk by chunk. OWNER gets the real [OwnerShell]; every other role
/// still lands on the temporary stub until its chunk lands.
class HomeRouterScreen extends StatelessWidget {
  const HomeRouterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff && session.user.isOwner) {
      return const OwnerShell();
    }
    return const SignedInStubScreen();
  }
}
