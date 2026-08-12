import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../manager/presentation/manager_shell.dart';
import '../../member/presentation/member_shell.dart';
import '../../owner/presentation/owner_shell.dart';
import '../../receptionist/presentation/receptionist_shell.dart';
import '../../trainer/presentation/trainer_shell.dart';
import 'signed_in_stub_screen.dart';

/// The single `/home` route branches by role here rather than in the
/// router itself, so `AppRoutes.home` stays one stable redirect target for
/// every authenticated session while each role's actual shell is built out
/// chunk by chunk. OWNER gets [OwnerShell], MANAGER gets [ManagerShell],
/// RECEPTIONIST gets [ReceptionistShell], TRAINER gets [TrainerShell], and
/// a member session gets [MemberShell]; anything else still lands on the
/// temporary stub.
class HomeRouterScreen extends StatelessWidget {
  const HomeRouterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    if (session is SessionAuthenticatedStaff) {
      if (session.user.isOwner) return const OwnerShell();
      if (session.user.isManager) return const ManagerShell();
      if (session.user.isReceptionist) return const ReceptionistShell();
      if (session.user.isTrainer) return const TrainerShell();
    }
    if (session is SessionAuthenticatedMember) return const MemberShell();
    return const SignedInStubScreen();
  }
}
