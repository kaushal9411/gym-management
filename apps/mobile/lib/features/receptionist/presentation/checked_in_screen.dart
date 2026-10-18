import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../attendance/presentation/attendance_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Design frame "4a. Checked in" — the confirmation after a front-desk
/// check-in: animated gradient hero with a spinning-ring tick, the member's
/// name and the time, and a "Scan next" button that pops back.
class CheckedInScreen extends StatelessWidget {
  const CheckedInScreen({super.key, required this.memberName});

  final String memberName;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          MeshHeroBackground(
            radius: const BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox(
              width: double.infinity,
              child: Padding(
                padding: EdgeInsets.fromLTRB(18, top + 40, 18, 40),
                child: Column(
                  children: [
                    Floating(
                      child: SpinningRing(
                        size: 104,
                        child: Container(
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: LinearGradient(
                              colors: [Color(0xFF10B981), Color(0xFF14B8A6)],
                            ),
                          ),
                          child: const PopIn(
                            index: 2,
                            child: Icon(
                              Icons.check_rounded,
                              color: Colors.white,
                              size: 52,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    Text(
                      'Checked in',
                      style: AppText.display(size: 26, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      memberName,
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 15,
                        weight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _WhenChip(time: fmtClock(DateTime.now())),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            child: TeamCenter(
              maxWidth: 640,
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  18,
                  24,
                  18,
                  18 + MediaQuery.of(context).padding.bottom,
                ),
                child: Column(
                  children: [
                    const Spacer(),
                    ShimmerButton(
                      colors: const [
                        TeamColors.indigo,
                        TeamColors.violet,
                        TeamColors.fuchsia,
                      ],
                      onTap: () => context.pop(),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.qr_code_scanner_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'Scan next',
                            style: AppText.body(
                              size: 15,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Translucent "9:41 AM" pill for the confirmation hero.
class _WhenChip extends StatelessWidget {
  const _WhenChip({required this.time});

  final String time;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.schedule_rounded, size: 15, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            time,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
