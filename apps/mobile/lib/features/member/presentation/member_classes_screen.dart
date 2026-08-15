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
import 'member_class_booked_screen.dart';

/// Design frame "7. Classes" — a 5-day strip plus that day's sessions at
/// the member's own branch (`GET /portal/classes` is branch-scoped
/// server-side; there's no cross-branch browsing on the member plane).
///
/// `GET /portal/bookings` is folded in so an already-booked session shows
/// "Booked" + a cancel action instead of a Book button that would only
/// come back as a duplicate-booking error.
class MemberClassesScreen extends StatefulWidget {
  const MemberClassesScreen({super.key});

  @override
  State<MemberClassesScreen> createState() => _MemberClassesScreenState();
}

class _MemberClassesScreenState extends State<MemberClassesScreen> {
  late DateTime _selectedDay = _startOfToday;
  List<ClassSession> _sessions = const [];
  List<MemberBooking> _bookings = const [];
  bool _loading = true;
  String? _error;
  String? _busySessionId;

  static DateTime get _startOfToday {
    final now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  List<DateTime> get _days =>
      List.generate(5, (i) => _startOfToday.add(Duration(days: i)));

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = getIt<MemberPortalRepository>();
      final (sessions, bookings) = await (
        repo.classes(dateFrom: _selectedDay, dateTo: _selectedDay),
        repo.myBookings(),
      ).wait;
      if (!mounted) return;
      setState(() {
        _sessions = sessions;
        _bookings = bookings;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  MemberBooking? _bookingFor(String sessionId) {
    for (final b in _bookings) {
      if (b.sessionId == sessionId && b.status != 'CANCELLED') return b;
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
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busySessionId = null);
    }
  }

  Future<void> _cancel(MemberBooking booking, String sessionId) async {
    setState(() {
      _busySessionId = sessionId;
      _error = null;
    });
    try {
      await getIt<MemberPortalRepository>().cancelBooking(booking.id);
      if (!mounted) return;
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busySessionId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your branch', style: AppText.eyebrow()),
          Text('Group classes', style: AppText.display(size: 22)),
          const SizedBox(height: 14),
          Row(
            children: _days.map((day) {
              final selected = day == _selectedDay;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _selectedDay = day);
                      _load();
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        gradient: selected ? AppColors.memberGrad : null,
                        borderRadius: BorderRadius.circular(12),
                        border:
                            selected ? null : Border.all(color: AppColors.line),
                      ),
                      child: Column(
                        children: [
                          Text(
                            _weekdayLabel(day),
                            style: AppText.body(
                              size: 10,
                              weight: FontWeight.w800,
                              color: selected
                                  ? AppColors.memberOnGrad
                                  : AppColors.ink,
                            ),
                          ),
                          Text(
                            '${day.day}',
                            style: AppText.display(
                              size: 14,
                              color: selected
                                  ? AppColors.memberOnGrad
                                  : AppColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 10),
          ],
          Expanded(
            child: _loading
                ? const AppLoadingView(role: AppRole.member)
                : _sessions.isEmpty
                    ? const AppEmptyState(
                        icon: Icons.event_busy_outlined,
                        title: 'No classes this day',
                        message: 'Try another day on the strip above.',
                      )
                    : RefreshIndicator(
                        color: AppColors.memberB,
                        backgroundColor: AppColors.surface2,
                        onRefresh: _load,
                        child: ListView.builder(
                          padding: const EdgeInsets.only(bottom: 90),
                          itemCount: _sessions.length,
                          itemBuilder: (context, i) {
                            final session = _sessions[i];
                            return _SessionCard(
                              session: session,
                              booking: _bookingFor(session.id),
                              busy: _busySessionId == session.id,
                              onBook: () => _book(session),
                              onCancel: (b) => _cancel(b, session.id),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  static String _weekdayLabel(DateTime day) => switch (day.weekday) {
        DateTime.monday => 'Mon',
        DateTime.tuesday => 'Tue',
        DateTime.wednesday => 'Wed',
        DateTime.thursday => 'Thu',
        DateTime.friday => 'Fri',
        DateTime.saturday => 'Sat',
        _ => 'Sun',
      };
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({
    required this.session,
    required this.booking,
    required this.busy,
    required this.onBook,
    required this.onCancel,
  });

  final ClassSession session;
  final MemberBooking? booking;
  final bool busy;
  final VoidCallback onBook;
  final ValueChanged<MemberBooking> onCancel;

  @override
  Widget build(BuildContext context) {
    final spotsLeft = session.capacity - session.bookedCount;
    final isFull = spotsLeft <= 0;
    final isBooked = booking != null;

    return Opacity(
      opacity: isFull && !isBooked ? 0.5 : 1,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(
            color: isBooked ? AppColors.memberB : AppColors.line,
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
                        session.groupClass.name,
                        style: AppText.body(
                          size: 14,
                          weight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        '${session.startTime} – ${session.endTime}'
                        '${session.trainer != null ? ' · ${session.trainer!.name}' : ''}',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                AppPill(
                  label: isBooked
                      ? 'Booked'
                      : isFull
                          ? 'Full'
                          : '$spotsLeft left',
                  tone: isBooked
                      ? AppPillTone.success
                      : isFull
                          ? AppPillTone.danger
                          : AppPillTone.roleTint,
                  role: AppRole.member,
                ),
              ],
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
            ] else if (!isFull) ...[
              const SizedBox(height: 12),
              AppButton(
                label: 'Book',
                role: AppRole.member,
                loading: busy,
                onPressed: onBook,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
