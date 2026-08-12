import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../shared/widgets/app_button.dart';

class ClassBookedArgs {
  const ClassBookedArgs({required this.session, required this.day});

  final ClassSession session;
  final DateTime day;
}

/// Design frame "7a. Booked". The design's "Add to calendar" button is not
/// built — the app has no calendar/url_launcher package, the same reason
/// the Receptionist invoice "Download PDF" was dropped in Chunk 5.
class MemberClassBookedScreen extends StatelessWidget {
  const MemberClassBookedScreen({required this.args, super.key});

  final ClassBookedArgs args;

  @override
  Widget build(BuildContext context) {
    final session = args.session;
    // The booking that just succeeded isn't reflected in the session row we
    // were handed, so count it here rather than re-fetching.
    final takenSpots = session.bookedCount + 1;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(backgroundColor: AppColors.bg, elevation: 0),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0x2EC6F135), Color(0x1A14E0B4)],
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.glassBorder),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(
                        gradient: AppColors.memberGrad,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.check_rounded,
                        size: 30,
                        color: AppColors.memberOnGrad,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text("You're in!", style: AppText.display(size: 22)),
                    const SizedBox(height: 2),
                    Text(
                      '${session.groupClass.name} · ${session.startTime}',
                      style: AppText.body(
                        size: 13,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  children: [
                    if (session.trainer != null)
                      _DetailRow(
                        label: 'Coach',
                        value: session.trainer!.name,
                      ),
                    _DetailRow(
                      label: 'Spot',
                      value: '$takenSpots of ${session.capacity}',
                    ),
                    _DetailRow(
                      label: 'Time',
                      value: '${session.startTime} – ${session.endTime}',
                    ),
                  ],
                ),
              ),
              const Spacer(),
              AppButton(
                label: 'Done',
                role: AppRole.member,
                onPressed: () => context.pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(
            value,
            style: AppText.body(size: 13, weight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
