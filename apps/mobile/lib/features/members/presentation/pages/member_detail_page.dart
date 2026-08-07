import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_card.dart';
import '../../../../widgets/status_pill.dart';
import '../../data/member_repository.dart';
import '../../data/models/member.dart';

class MemberDetailPage extends StatefulWidget {
  final String memberId;
  const MemberDetailPage({super.key, required this.memberId});

  @override
  State<MemberDetailPage> createState() => _MemberDetailPageState();
}

class _MemberDetailPageState extends State<MemberDetailPage> {
  late Future<MemberDetail> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<MemberRepository>().getById(widget.memberId);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Scaffold(
      appBar: AppBar(),
      body: FutureBuilder<MemberDetail>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            final message = snapshot.error is AppException
                ? (snapshot.error as AppException).message
                : 'Something went wrong';
            return Center(
              child: Text(message, style: TextStyle(color: colors.inkFaint)),
            );
          }
          final member = snapshot.data!;
          final (tone, label) = switch (member.status) {
            'FROZEN' => (PillTone.danger, 'Frozen'),
            'INACTIVE' => (PillTone.neutral, 'Inactive'),
            _ => (PillTone.success, 'Active'),
          };
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: colors.accentSoft,
                    backgroundImage: member.profilePhotoUrl != null
                        ? NetworkImage(member.profilePhotoUrl!)
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          member.name,
                          style: const TextStyle(
                            fontFamily: 'Bebas Neue',
                            fontSize: 22,
                          ),
                        ),
                        Text(
                          member.memberId,
                          style: TextStyle(
                            fontSize: 12,
                            color: colors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(label, tone: tone),
                ],
              ),
              const SizedBox(height: 18),
              if (member.currentPlanName != null)
                AppCard(
                  backgroundColor: colors.accentSoft,
                  borderColor: Colors.transparent,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        member.currentPlanName!.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: .6,
                          color: colors.accent,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        member.membershipEndDate != null
                            ? 'Expires ${DateFormat('d MMM').format(member.membershipEndDate!)}'
                            : 'No expiry on file',
                        style: const TextStyle(
                          fontFamily: 'Bebas Neue',
                          fontSize: 20,
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 14),
              AppCard(
                child: Column(
                  children: [
                    _InfoRow(label: 'Branch', value: member.branchName ?? '—'),
                    const SizedBox(height: 10),
                    _InfoRow(
                      label: 'Trainer',
                      value: member.trainerName ?? '—',
                    ),
                    const SizedBox(height: 10),
                    _InfoRow(label: 'Phone', value: member.phone ?? '—'),
                    const SizedBox(height: 10),
                    _InfoRow(label: 'Email', value: member.email ?? '—'),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              AppCard(
                child: Row(
                  children: [
                    Icon(
                      member.canCheckIn ? Icons.check_circle : Icons.cancel,
                      color: member.canCheckIn ? colors.success : colors.danger,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      member.canCheckIn
                          ? 'Eligible to check in'
                          : 'Not eligible to check in',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Row(
      children: [
        Text(
          label,
          style: TextStyle(color: colors.inkFaint, fontWeight: FontWeight.w600),
        ),
        const Spacer(),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }
}
