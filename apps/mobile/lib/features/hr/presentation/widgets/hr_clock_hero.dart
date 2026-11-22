import 'package:flutter/material.dart';

import '../../../../bloc/hr/hr_me_cubit.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_summary.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../hr_palette.dart';
import 'hr_calendar_card.dart';
import 'hr_widgets.dart';

/// The My HR header: gradient hero with the live clock ring, today's
/// shift / late indicator, and the big Check in / Check out button.
///
/// Everything it shows comes from `GET /hr/me/summary` - the button is driven
/// by the server's own `canCheckIn` / `canCheckOut`, never by guessing from
/// the time of day.
class HrClockHero extends StatelessWidget {
  const HrClockHero({
    super.key,
    required this.summary,
    required this.onBack,
    required this.onBell,
    required this.onCheckIn,
    required this.onCheckOut,
    this.punching,
    this.topInset = 0,
    this.side = 18,
  });

  final HrMeSummary summary;
  final HrPunch? punching;
  final VoidCallback onBack;
  final VoidCallback onBell;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;
  final double topInset;
  final double side;

  static String greeting(int hour) => hour < 12
      ? 'Good morning'
      : hour < 17
          ? 'Good afternoon'
          : 'Good evening';

  @override
  Widget build(BuildContext context) {
    final today = summary.today;
    final att = today.attendance;
    final shift = summary.employee.shift;
    final first = summary.employee.ref.name.trim().split(RegExp(r'\s+')).first;

    final canIn = today.canCheckIn;
    final canOut = today.canCheckOut;
    final done = att.hasCheckedIn && att.hasCheckedOut;

    final String label;
    final IconData icon;
    final List<Color> colors;
    VoidCallback? onTap;
    if (canIn) {
      label = 'Check in';
      icon = Icons.login_rounded;
      colors = HrPalette.clockIn;
      onTap = onCheckIn;
    } else if (canOut) {
      label = 'Check out';
      icon = Icons.logout_rounded;
      colors = HrPalette.clockOut;
      onTap = onCheckOut;
    } else if (done) {
      label = 'Done for today';
      icon = Icons.check_circle_rounded;
      colors = HrPalette.clockIn;
    } else if (att.status == DayStatus.onLeave) {
      label = 'On leave';
      icon = Icons.beach_access_rounded;
      colors = HrPalette.clockIdle;
    } else {
      label = 'Not available';
      icon = Icons.lock_clock_rounded;
      colors = HrPalette.clockIdle;
    }
    final busy = punching != null;

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: HrPalette.clockCard,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
      ),
      padding: EdgeInsets.fromLTRB(side, 14 + topInset, side, 22),
      child: Column(
        children: [
          Row(
            children: [
              ListHeroButton(icon: Icons.arrow_back_rounded, onTap: onBack),
              const Spacer(),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Semantics(
                    button: true,
                    label: summary.unreadNotifications > 0
                        ? 'HR updates, ${summary.unreadNotifications} unread'
                        : 'HR updates',
                    excludeSemantics: true,
                    child: ListHeroButton(
                      icon: Icons.notifications_rounded,
                      onTap: onBell,
                    ),
                  ),
                  if (summary.unreadNotifications > 0)
                    Positioned(
                      right: -3,
                      top: -3,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 5,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF5C7A),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Text(
                          '${summary.unreadNotifications}',
                          style: AppText.body(
                            size: 10,
                            weight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          HrLiveClock(
            builder: (context, now) {
              final hh = now.hour % 12 == 0 ? 12 : now.hour % 12;
              final mm = now.minute.toString().padLeft(2, '0');
              final ss = now.second.toString().padLeft(2, '0');
              // Worked-time arc: elapsed (or final) over the shift length.
              final shiftMin =
                  (shift?.lengthMinutes ?? 0) > 0 ? shift!.lengthMinutes : 480;
              double progress = 0;
              String? live;
              if (att.hasCheckedIn && !att.hasCheckedOut) {
                final start = att.checkInAt?.toLocal();
                if (start != null) {
                  final m = DateTime.now().difference(start).inMinutes;
                  progress = m / shiftMin;
                  live = 'Working ${hrDuration(m < 0 ? 0 : m)}';
                }
              } else if (done && att.workedMinutes != null) {
                progress = att.workedMinutes! / shiftMin;
                live = 'Worked ${hrDuration(att.workedMinutes!)}';
              }
              return Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      '${greeting(now.hour)}, $first',
                      style: AppText.display(size: 21, color: Colors.white),
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      hrDateWd(now),
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Semantics(
                    label: 'Current time $hh:$mm ${now.hour < 12 ? 'AM' : 'PM'}'
                        '${live == null ? '' : ', $live'}',
                    excludeSemantics: true,
                    child: HrClockRing(
                      size: 208,
                      seconds: now.second,
                      progress: progress,
                      color: colors.first,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$hh:$mm',
                            style: AppText.display(
                              size: 40,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            '$ss  ${now.hour < 12 ? 'AM' : 'PM'}',
                            style: AppText.tabular(
                              size: 12.5,
                              color: Colors.white.withValues(alpha: 0.75),
                            ),
                          ),
                          if (live != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              live,
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w800,
                                color: Colors.white.withValues(alpha: 0.92),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 4),
          HrPunchButton(
            key: const Key('hr-punch-button'),
            label: label,
            icon: icon,
            colors: colors,
            busy: busy,
            done: done,
            onTap: onTap,
          ),
          const SizedBox(height: 2),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 8,
            runSpacing: 8,
            children: _chips(today, shift),
          ),
        ],
      ),
    );
  }

  List<Widget> _chips(HrToday today, HrShiftRef? shift) {
    final att = today.attendance;
    final chips = <Widget>[
      HrHeroChip(
        icon: Icons.schedule_rounded,
        label: shift == null
            ? 'No shift assigned'
            : '${shift.name} · ${hrTime12(shift.startTime)} – '
                '${hrTime12(shift.endTime)}',
      ),
    ];
    if (today.holidayName != null) {
      chips.add(
        HrHeroChip(
          icon: Icons.celebration_rounded,
          label: today.holidayName!,
        ),
      );
    } else if (today.isWeeklyOff) {
      chips.add(
        const HrHeroChip(icon: Icons.bedtime_rounded, label: 'Weekly off'),
      );
    }
    if (att.hasCheckedIn) {
      chips.add(
        HrHeroChip(
          icon: Icons.login_rounded,
          label: 'In ${hrTime12(att.checkInTime)}',
        ),
      );
      chips.add(
        att.lateMinutes > 0
            ? HrHeroChip(
                icon: Icons.running_with_errors_rounded,
                label: 'Late by ${hrDuration(att.lateMinutes)}',
              )
            : const HrHeroChip(
                icon: Icons.verified_rounded,
                label: 'On time',
              ),
      );
    }
    if (att.hasCheckedOut) {
      chips.add(
        HrHeroChip(
          icon: Icons.logout_rounded,
          label: 'Out ${hrTime12(att.checkOutTime)}',
        ),
      );
    }
    if (!att.hasCheckedIn && att.status == DayStatus.onLeave) {
      chips.add(
        HrHeroChip(
          icon: Icons.beach_access_rounded,
          label: att.leaveType?.name ?? 'On leave',
        ),
      );
    }
    return chips;
  }
}
