import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_top_bar.dart';
import '../../../../widgets/status_pill.dart';
import '../../data/member_repository.dart';
import '../../data/models/member.dart';
import '../bloc/member_list_cubit.dart';

class MemberListPage extends StatelessWidget {
  const MemberListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) =>
          MemberListCubit(context.read<MemberRepository>())..load(),
      child: const _MemberListView(),
    );
  }
}

class _MemberListView extends StatelessWidget {
  const _MemberListView();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: BlocBuilder<MemberListCubit, MemberListState>(
                buildWhen: (a, b) => b is MemberListLoaded,
                builder: (context, state) {
                  final total =
                      state is MemberListLoaded ? state.members.length : null;
                  return AppTopBar(
                    caption: total != null ? '$total total' : 'Members',
                    title: 'Members',
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                onChanged: (q) =>
                    context.read<MemberListCubit>().searchChanged(q),
                decoration: const InputDecoration(
                  hintText: 'Search members…',
                  prefixIcon: Icon(Icons.search, size: 20),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: BlocBuilder<MemberListCubit, MemberListState>(
                builder: (context, state) {
                  return switch (state) {
                    MemberListLoading() =>
                      const Center(child: CircularProgressIndicator()),
                    MemberListError(message: final message) => Center(
                        child: Text(
                          message,
                          style: TextStyle(color: colors.inkFaint),
                        ),
                      ),
                    MemberListLoaded(members: final members) => members.isEmpty
                        ? Center(
                            child: Text(
                              'No members found',
                              style: TextStyle(color: colors.inkFaint),
                            ),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            itemCount: members.length,
                            separatorBuilder: (_, __) =>
                                Divider(height: 1, color: colors.border),
                            itemBuilder: (context, i) {
                              final member = members[i];
                              return _MemberRow(member: member);
                            },
                          ),
                  };
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MemberRow extends StatelessWidget {
  final MemberSummary member;
  const _MemberRow({required this.member});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final (tone, label) = switch (member.status) {
      'FROZEN' => (PillTone.danger, 'Frozen'),
      'INACTIVE' => (PillTone.neutral, 'Inactive'),
      _ => (PillTone.success, 'Active'),
    };
    return ListTile(
      onTap: () => context.push('/members/${member.id}'),
      contentPadding: EdgeInsets.zero,
      leading: CircleAvatar(
        radius: 18,
        backgroundColor: colors.accentSoft,
        backgroundImage: member.profilePhotoUrl != null
            ? NetworkImage(member.profilePhotoUrl!)
            : null,
        child: member.profilePhotoUrl == null
            ? Text(
                member.initials,
                style: TextStyle(
                  color: colors.accent,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              )
            : null,
      ),
      title: Text(
        member.name,
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        '${member.memberId} · ${member.currentPlanName ?? 'No plan'}',
        style: TextStyle(fontSize: 12, color: colors.inkFaint),
      ),
      trailing: StatusPill(label, tone: tone),
    );
  }
}
