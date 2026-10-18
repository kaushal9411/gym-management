import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../models/member_booking.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart' show kListHeroHeight;
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../classes/presentation/class_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, teamCardSliver, teamSideInset, teamSnack;
import 'member_class_booked_screen.dart';

/// Member plane Classes tab (web's member-portal `/portal/classes` page),
/// kept in the member palette (lime -> teal): a fixed-height gradient hero
/// with the next booking (class, when, a "starts in" chip) and three stats
/// (this week / upcoming / attended), a Monday-first week bar with previous /
/// next week arrows and a dot per day's classes, that day's sessions (status
/// chip, trainer, branch, a spots-left bar, Book / Cancel booking) and a
/// "My bookings" list split into upcoming and past.
///
/// `GET /portal/classes` is branch-scoped server-side (the member's own
/// branch - no cross-branch browsing on the member plane); `GET
/// /portal/bookings` is folded in so an already-booked session shows
/// "Booked" + a cancel action instead of a Book button that would only come
/// back as a duplicate-booking error. Cancelling asks first (web's confirm
/// sheet); booking opens the existing "You're in!" page.
///
/// Dropped vs. web: nothing with an endpoint.
class MemberClassesScreen extends StatefulWidget {
  const MemberClassesScreen({super.key});

  @override
  State<MemberClassesScreen> createState() => _MemberClassesScreenState();
}

class _MemberClassesScreenState extends State<MemberClassesScreen> {
  late DateTime _weekStart = startOfWeek(DateTime.now());
  late DateTime _selectedDay = DateTime.now();
  List<ClassSession> _sessions = const [];
  List<MemberBooking> _bookings = const [];
  bool _loading = true;
  String? _error;
  String? _busySessionId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    final weekStart = _weekStart;
    try {
      final repo = getIt<MemberPortalRepository>();
      final (sessions, bookings) = await (
        repo.classes(dateFrom: weekStart, dateTo: addDays(weekStart, 6)),
        repo.myBookings(),
      ).wait;
      if (!mounted || weekStart != _weekStart) return;
      setState(() {
        _sessions = sessions;
        _bookings = bookings;
        _error = null;
      });
    } on ApiException catch (e) {
      if (mounted && weekStart == _weekStart) {
        setState(() => _error = e.message);
      }
    } catch (e) {
      if (mounted && weekStart == _weekStart) {
        setState(() => _error = 'Could not load classes ($e)');
      }
    } finally {
      if (mounted && weekStart == _weekStart) setState(() => _loading = false);
    }
  }

  void _shiftWeek(int weeks) {
    final next = addDays(_weekStart, 7 * weeks);
    final today = DateTime.now();
    final containsToday = dateKey(startOfWeek(today)) == dateKey(next);
    setState(() {
      _weekStart = next;
      _selectedDay = containsToday ? today : next;
      _sessions = const [];
    });
    _load();
  }

  MemberBooking? _bookingFor(String sessionId) {
    for (final b in _bookings) {
      if (b.sessionId == sessionId && b.status == 'BOOKED') return b;
    }
    return null;
  }

  Future<void> _book(ClassSession session) async {
    setState(() {
      _busySessionId = session.id;
      _error = null;
    });
    try {
      await getIt<MemberPortalRepository>().bookClass(session.id);
      if (!mounted) return;
      await context.push(
        AppRoutes.memberClassBooked,
        extra: ClassBookedArgs(session: session, day: _selectedDay),
      );
      if (!mounted) return;
      await _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not book this class ($e)');
    } finally {
      if (mounted) setState(() => _busySessionId = null);
    }
  }

  Future<void> _confirmCancel(
    MemberBooking booking, {
    String? sessionId,
  }) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: AppColors.surface2,
      constraints: const BoxConstraints(maxWidth: 640),
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Cancel this booking?', style: AppText.display(size: 18)),
              const SizedBox(height: 4),
              Text(
                '${booking.className} · ${fmtDayKey(booking.dayKey)} · '
                '${classTimeRange(booking.startTime, booking.endTime)}',
                style: AppText.body(size: 13, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Keep it',
                      role: AppRole.member,
                      variant: AppButtonVariant.ghost,
                      onPressed: () => Navigator.of(ctx).pop(false),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: 'Cancel booking',
                      role: AppRole.member,
                      onPressed: () => Navigator.of(ctx).pop(true),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    setState(() {
      _busySessionId = sessionId ?? booking.sessionId;
      _error = null;
    });
    try {
      await getIt<MemberPortalRepository>().cancelBooking(booking.id);
      if (!mounted) return;
      teamSnack(context, 'Booking cancelled.');
      await _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not cancel this booking ($e)');
      }
    } finally {
      if (mounted) setState(() => _busySessionId = null);
    }
  }

  // ── derived ───────────────────────────────────────────────────────────────

  List<ClassSession> _forDay(String key) =>
      _sessions.where((s) => s.dayKey == key).toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));

  List<MemberBooking> _upcoming(DateTime now) => _bookings
      .where(
        (b) =>
            b.status == 'BOOKED' &&
            !sessionEnd(b.dayKey, b.endTime).isBefore(now),
      )
      .toList()
    ..sort(
      (a, b) => sessionStart(a.dayKey, a.startTime)
          .compareTo(sessionStart(b.dayKey, b.startTime)),
    );

  List<MemberBooking> _past(List<MemberBooking> upcoming) {
    final ids = {for (final b in upcoming) b.id};
    return (_bookings.where((b) => !ids.contains(b.id)).toList()
          ..sort(
            (a, b) => sessionStart(b.dayKey, b.startTime)
                .compareTo(sessionStart(a.dayKey, a.startTime)),
          ))
        .take(8)
        .toList();
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = _upcoming(now);
    final past = _past(upcoming);
    final selectedKey = dateKey(_selectedDay);
    final daySessions = _forDay(selectedKey);

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(silent: true),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _hero(now, upcoming)),
          SliverToBoxAdapter(
            child: TeamCenter(
              maxWidth: 1100,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _weekBar(),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      FormAlert(message: _error!),
                    ],
                    const SizedBox(height: 14),
                    Text(
                      '${fmtDayKey(selectedKey)} · '
                      '${plural(daySessions.length, 'class', 'classes')}',
                      style: AppText.body(
                        size: 13,
                        weight: FontWeight.w800,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: AppLoadingView(role: AppRole.member),
              ),
            )
          else if (daySessions.isEmpty)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: AppEmptyState(
                  icon: Icons.event_busy_outlined,
                  title: 'No classes this day',
                  message: 'Try another day on the strip above, or check '
                      'next week.',
                ),
              ),
            )
          else
            teamCardSliver<ClassSession>(
              context,
              items: daySessions,
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 8),
              builder: (s, i) => _SessionCard(
                key: ValueKey('msession-${s.id}'),
                session: s,
                booking: _bookingFor(s.id),
                now: now,
                busy: _busySessionId == s.id,
                onBook: () => _book(s),
                onCancel: (b) => _confirmCancel(b, sessionId: s.id),
              ),
            ),
          SliverToBoxAdapter(
            child: TeamCenter(
              maxWidth: 1100,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 96),
                child: _myBookings(upcoming, past),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(DateTime now, List<MemberBooking> upcoming) {
    final next = upcoming.isEmpty ? null : upcoming.first;
    final weekKeys = {
      for (var i = 0; i < 7; i++) dateKey(addDays(startOfWeek(now), i)),
    };
    final thisWeek = _bookings
        .where((b) => b.status == 'BOOKED' && weekKeys.contains(b.dayKey))
        .length;
    final attended = _bookings.where((b) => b.status == 'ATTENDED').length;
    final onGrad = AppColors.memberOnGrad;
    final side = 18 + teamSideInset(context);

    Widget stat(String label, int value) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: onGrad.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: onGrad.withValues(alpha: 0.18)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CountUp(
                  value: value,
                  style: AppText.display(size: 19, color: onGrad),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w700,
                    color: onGrad.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ),
        );

    return Container(
      decoration: const BoxDecoration(
        gradient: AppColors.memberGrad,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(side, 14, side, 18),
        child: SizedBox(
          height: kListHeroHeight - 32,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: () => SlideDrawerController.of(context)?.open(),
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: onGrad.withValues(alpha: 0.12),
                        border:
                            Border.all(color: onGrad.withValues(alpha: 0.3)),
                      ),
                      child: Icon(Icons.menu_rounded, size: 20, color: onGrad),
                    ),
                  ),
                  const Spacer(),
                  if (next != null)
                    _HeroPill(
                      icon: Icons.schedule_rounded,
                      label:
                          'Starts ${countdownLabel(sessionStart(next.dayKey, next.startTime).difference(now))}',
                    )
                  else if (!_loading)
                    const _HeroPill(
                      icon: Icons.event_busy_rounded,
                      label: 'No upcoming bookings',
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                next?.className ?? 'Book a class',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(size: 25, color: onGrad),
              ),
              const SizedBox(height: 2),
              Text(
                next == null
                    ? 'Pick a day below and reserve your spot.'
                    : '${fmtDayKey(next.dayKey)} · '
                        '${classTimeRange(next.startTime, next.endTime)} · '
                        '${next.branchName}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w600,
                  color: onGrad.withValues(alpha: 0.8),
                ),
              ),
              const Spacer(),
              Row(
                children: [
                  stat('This week', thisWeek),
                  stat('Upcoming', upcoming.length),
                  stat('Attended', attended),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _weekBar() {
    final days = List.generate(7, (i) => addDays(_weekStart, i));
    final todayKey = dateKey(DateTime.now());
    final selectedKey = dateKey(_selectedDay);

    Widget arrow(IconData icon, String tip, VoidCallback onTap) => Tooltip(
          message: tip,
          child: GestureDetector(
            onTap: onTap,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.line),
              ),
              child: Icon(icon, size: 20, color: AppColors.ink),
            ),
          ),
        );

    return Column(
      children: [
        Row(
          children: [
            arrow(
              Icons.chevron_left_rounded,
              'Previous week',
              () => _shiftWeek(-1),
            ),
            Expanded(
              child: Text(
                '${dayMonth(days.first)} – ${dayMonth(days.last)}',
                textAlign: TextAlign.center,
                style: AppText.body(size: 13, weight: FontWeight.w800),
              ),
            ),
            arrow(
              Icons.chevron_right_rounded,
              'Next week',
              () => _shiftWeek(1),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: List.generate(7, (i) {
            final day = days[i];
            final key = dateKey(day);
            final selected = key == selectedKey;
            final count = _forDay(key).where((s) => s.isScheduled).length;
            return Expanded(
              child: GestureDetector(
                key: ValueKey('mday-$key'),
                onTap: () => setState(() => _selectedDay = day),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    gradient: selected ? AppColors.memberGrad : null,
                    color: selected ? null : AppColors.surface2,
                    borderRadius: BorderRadius.circular(14),
                    border: selected ? null : Border.all(color: AppColors.line),
                  ),
                  child: Column(
                    children: [
                      Text(
                        dowLabel(day),
                        style: AppText.body(
                          size: 10,
                          weight: FontWeight.w800,
                          color: selected
                              ? AppColors.memberOnGrad
                              : AppColors.inkSoft,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${day.day}',
                        style: AppText.display(
                          size: 15,
                          color: selected
                              ? AppColors.memberOnGrad
                              : (key == todayKey
                                  ? AppColors.memberB
                                  : AppColors.ink),
                        ),
                      ),
                      const SizedBox(height: 3),
                      SizedBox(
                        height: 6,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            for (var k = 0; k < count.clamp(0, 3); k++)
                              Container(
                                width: 5,
                                height: 5,
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 1),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: selected
                                      ? AppColors.memberOnGrad
                                      : AppColors.memberB,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _myBookings(List<MemberBooking> upcoming, List<MemberBooking> past) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: AppColors.memberGrad,
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(
                    Icons.event_available_rounded,
                    size: 17,
                    color: AppColors.memberOnGrad,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('My bookings', style: AppText.display(size: 16)),
                      Text(
                        upcoming.isEmpty
                            ? 'Nothing booked yet'
                            : plural(upcoming.length, 'upcoming booking'),
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (upcoming.isEmpty && past.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 18),
              child: Text(
                'No bookings yet. Book a class above and it will show up here.',
                style: AppText.body(
                  size: 13,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            )
          else ...[
            for (final b in upcoming)
              _BookingRow(
                key: ValueKey('mbooking-${b.id}'),
                booking: b,
                onTap: () => _confirmCancel(b),
              ),
            if (past.isNotEmpty)
              Container(
                width: double.infinity,
                color: AppColors.surface3,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Text(
                  'PAST',
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w800,
                    color: AppColors.inkFaint,
                  ).copyWith(letterSpacing: 0.8),
                ),
              ),
            for (final b in past)
              _BookingRow(
                key: ValueKey('mbooking-${b.id}'),
                booking: b,
                past: true,
              ),
          ],
        ],
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final onGrad = AppColors.memberOnGrad;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: onGrad.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: onGrad.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: onGrad),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppText.body(
              size: 11.5,
              weight: FontWeight.w800,
              color: onGrad,
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    super.key,
    required this.session,
    required this.booking,
    required this.now,
    required this.busy,
    required this.onBook,
    required this.onCancel,
  });

  final ClassSession session;
  final MemberBooking? booking;
  final DateTime now;
  final bool busy;
  final VoidCallback onBook;
  final ValueChanged<MemberBooking> onCancel;

  @override
  Widget build(BuildContext context) {
    final s = session;
    final full = s.isFull;
    final ended = sessionEnded(s, now);
    final isBooked = booking != null;
    final tone = isBooked
        ? AppColors.success
        : full
            ? AppColors.danger
            : (s.capacity > 0 && s.bookedCount / s.capacity >= 0.75)
                ? AppColors.warning
                : AppColors.memberB;
    final ratio =
        s.capacity <= 0 ? 0.0 : (s.bookedCount / s.capacity).clamp(0.0, 1.0);
    final left = s.capacity - s.bookedCount;

    final (String, AppPillTone)? chip = isBooked
        ? ('Booked', AppPillTone.success)
        : !s.isScheduled
            ? (sessionStatusLabel(s.status), AppPillTone.neutral)
            : ended
                ? ('Ended', AppPillTone.neutral)
                : full
                    ? ('Full', AppPillTone.danger)
                    : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: isBooked ? AppColors.memberB : AppColors.line,
          width: isBooked ? 1.4 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      s.groupClass.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 15, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule_rounded,
                          size: 13,
                          color: AppColors.memberB,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          classTimeRange(s.startTime, s.endTime),
                          style: AppText.body(
                            size: 12.5,
                            weight: FontWeight.w700,
                            color: AppColors.memberB,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (chip != null)
                AppPill(label: chip.$1, tone: chip.$2, role: AppRole.member),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              if (s.trainer != null)
                _Meta(Icons.person_rounded, s.trainer!.name),
              if (s.branch != null) _Meta(Icons.place_rounded, s.branch!.name),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.groups_rounded, size: 13, color: AppColors.inkFaint),
              const SizedBox(width: 4),
              Text(
                '${s.bookedCount}/${s.capacity} booked',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: AppColors.inkSoft,
                ),
              ),
              const Spacer(),
              Text(
                full
                    ? 'Full'
                    : plural(left < 0 ? 0 : left, 'spot left', 'spots left'),
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w800,
                  color: tone,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          GrowBar(
            ratio: ratio,
            height: 7,
            track: AppColors.surface3,
            colors: [tone, tone.withValues(alpha: 0.55)],
          ),
          if (isBooked) ...[
            const SizedBox(height: 12),
            AppButton(
              label: 'Cancel booking',
              role: AppRole.member,
              variant: AppButtonVariant.ghost,
              loading: busy,
              onPressed: () => onCancel(booking!),
            ),
          ] else if (s.isScheduled && !full && !ended) ...[
            const SizedBox(height: 12),
            AppButton(
              label: 'Book this class',
              role: AppRole.member,
              loading: busy,
              onPressed: onBook,
            ),
          ],
        ],
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.label);

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: AppColors.inkFaint),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppText.body(
            size: 12,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      ],
    );
  }
}

class _BookingRow extends StatelessWidget {
  const _BookingRow({
    super.key,
    required this.booking,
    this.past = false,
    this.onTap,
  });

  final MemberBooking booking;
  final bool past;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final b = booking;
    final (label, tone) = switch (b.status) {
      'ATTENDED' => ('Attended', AppPillTone.success),
      'NO_SHOW' => ('Missed', AppPillTone.danger),
      'CANCELLED' => ('Cancelled', AppPillTone.neutral),
      _ => ('Booked', AppPillTone.roleTint),
    };
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: (past ? AppColors.inkFaint : AppColors.memberB)
                      .withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(
                  Icons.event_rounded,
                  size: 17,
                  color: past ? AppColors.inkFaint : AppColors.memberB,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      b.className,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    Text(
                      '${fmtDayKey(b.dayKey)} · '
                      '${classTimeRange(b.startTime, b.endTime)} · '
                      '${b.branchName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AppPill(label: label, tone: tone, role: AppRole.member),
            ],
          ),
        ),
      ),
    );
  }
}
