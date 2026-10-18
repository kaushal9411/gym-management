import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../shared/widgets/app_button.dart';
import '../../classes/presentation/class_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart' show TeamCenter;

class ClassBookedArgs {
  const ClassBookedArgs({required this.session, required this.day});

  final ClassSession session;
  final DateTime day;
}

/// "You're in!" confirmation shown right after booking a class (member
/// palette). The design's "Add to calendar" button is not built - the app has
/// no calendar/url_launcher package, the same reason the Receptionist invoice
/// "Download PDF" was dropped in Chunk 5. Web has no separate confirmation
/// page (it toasts "Booked in!"); this page is existing mobile behaviour and
/// is kept as is.
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
        child: TeamCenter(
          maxWidth: 640,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
            child: Column(
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.memberA.withValues(alpha: 0.2),
                        AppColors.memberB.withValues(alpha: 0.12),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    border: Border.all(color: AppColors.glassBorder),
                  ),
                  child: Column(
                    children: [
                      PopIn(
                        index: 0,
                        child: Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            gradient: AppColors.memberGrad,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.memberB.withValues(alpha: 0.4),
                                blurRadius: 22,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: Icon(
                            Icons.check_rounded,
                            size: 34,
                            color: AppColors.memberOnGrad,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      FadeUp(
                        index: 1,
                        child: Text(
                          "You're in!",
                          style: AppText.display(size: 24),
                        ),
                      ),
                      const SizedBox(height: 2),
                      FadeUp(
                        index: 2,
                        child: Text(
                          '${session.groupClass.name} · '
                          '${classTime(session.startTime)}',
                          textAlign: TextAlign.center,
                          style: AppText.body(
                            size: 13,
                            color: AppColors.inkFaint,
                          ),
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
                      _DetailRow(
                        label: 'Date',
                        value: fmtDayKey(session.dayKey),
                      ),
                      if (session.trainer != null)
                        _DetailRow(
                          label: 'Coach',
                          value: session.trainer!.name,
                        ),
                      if (session.branch != null)
                        _DetailRow(
                          label: 'Branch',
                          value: session.branch!.name,
                        ),
                      _DetailRow(
                        label: 'Spot',
                        value: '$takenSpots of ${session.capacity}',
                      ),
                      _DetailRow(
                        label: 'Time',
                        value: classTimeRange(
                          session.startTime,
                          session.endTime,
                        ),
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
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
