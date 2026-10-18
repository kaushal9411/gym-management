import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_ui.dart';

/// Session detail (web's calendar dialog): gradient hero (class, date, time,
/// branch, booked / capacity, trainer, status), the capacity bar and the
/// attendee list - each non-cancelled booking with the member's code, who
/// booked them (STAFF / MEMBER) and its status.
///
/// With `bookings:manage` (web's gate; the API's `POST /bookings` and
/// `/bookings/:id/cancel` use the same key) a `BOOKED` row has a cancel
/// button and, while the session is `SCHEDULED` and not full, "Book a member
/// in" opens the member search. Without it the page is read-only.
///
/// The design's "Cancel session" (the whole occurrence) has no endpoint -
/// `/bookings/:id/cancel` cancels one member's booking and there is no
/// `/class-sessions/:id/cancel` - so it stays dropped rather than faked.
class ClassSessionDetailScreen extends StatefulWidget {
  const ClassSessionDetailScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  State<ClassSessionDetailScreen> createState() =>
      _ClassSessionDetailScreenState();
}

class _ClassSessionDetailScreenState extends State<ClassSessionDetailScreen> {
  ClassSessionDetail? _session;
  String? _error;
  String? _cancellingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final session =
          await getIt<ClassSessionRepository>().getById(widget.sessionId);
      if (!mounted) return;
      setState(() => _session = session);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load this session ($e)');
    }
  }

  Future<void> _cancel(ClassBooking b) async {
    final ok = await confirmTeam(
      context,
      title: "Cancel ${b.memberName}'s booking?",
      message: 'They will be removed from this session and the seat opens up.',
      confirmLabel: 'Cancel booking',
      destructive: true,
    );
    if (!ok || !mounted) return;
    setState(() => _cancellingId = b.id);
    try {
      await getIt<ClassSessionRepository>().cancelBooking(b.id);
      if (!mounted) return;
      teamSnack(context, "${b.memberName}'s booking cancelled.");
      await _load();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _cancellingId = null);
    }
  }

  Future<void> _addAttendee(ClassSessionDetail s) async {
    await context.push(AppRoutes.classAddAttendee, extra: s);
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = _session;
    final hero = s != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Class session' : 'Class'),
      ),
      body: _error != null
          ? SafeArea(child: AppErrorView(message: _error!, onRetry: _load))
          : s == null
              ? const AppLoadingView()
              : _content(s),
    );
  }

  Widget _content(ClassSessionDetail s) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canManage = teamCan(context, 'bookings:manage');
    final color = classAccent(s.groupClass.name);
    final canBook = canManage && s.isScheduled && !s.isFull;
    final pct = s.capacity == 0
        ? 0
        : ((s.bookedCount / s.capacity).clamp(0, 1) * 100).round();

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          ClassHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: ClassGlyph(
                    name: s.groupClass.name,
                    color: color,
                    size: 74,
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    s.groupClass.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 25, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    [
                      fmtDayKey(s.dayKey),
                      classTimeRange(s.startTime, s.endTime),
                      if (s.branch != null) s.branch!.name,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(
                        '${s.bookedCount}/${s.capacity} booked',
                        icon: Icons.groups_rounded,
                      ),
                      if (s.trainer != null)
                        TeamHeroPill(
                          s.trainer!.name,
                          icon: Icons.person_rounded,
                        ),
                      if (!s.isScheduled)
                        TeamHeroPill(
                          sessionStatusLabel(s.status),
                          dot: sessionTone(s.status),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          TeamCenter(
            maxWidth: 820,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TeamSectionCard(
                    icon: Icons.event_seat_rounded,
                    color: capacityTone(s.bookedCount, s.capacity, base: color),
                    title: 'Capacity',
                    trailing: TeamTag(
                      label: '$pct% full',
                      color: capacityTone(
                        s.bookedCount,
                        s.capacity,
                        base: color,
                      ),
                    ),
                    child: CapacityBar(
                      booked: s.bookedCount,
                      capacity: s.capacity,
                      base: color,
                    ),
                  ),
                  const SizedBox(height: 14),
                  TeamSectionCard(
                    icon: Icons.groups_rounded,
                    color: TeamColors.indigo,
                    title: 'Attendees',
                    subtitle: plural(s.bookings.length, 'booking'),
                    child: s.bookings.isEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Text(
                              'No one is booked in yet.',
                              style: AppText.body(
                                size: 13,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          )
                        : Column(
                            children: [
                              for (final b in s.bookings)
                                _AttendeeRow(
                                  key: ValueKey('booking-${b.id}'),
                                  booking: b,
                                  canCancel: canManage && b.status == 'BOOKED',
                                  cancelling: _cancellingId == b.id,
                                  onCancel: () => _cancel(b),
                                ),
                            ],
                          ),
                  ),
                  if (canBook) ...[
                    const SizedBox(height: 14),
                    TeamGradientButton(
                      label: 'Book a member in',
                      icon: Icons.person_add_alt_1_rounded,
                      onTap: () => _addAttendee(s),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AttendeeRow extends StatelessWidget {
  const _AttendeeRow({
    super.key,
    required this.booking,
    required this.canCancel,
    required this.cancelling,
    required this.onCancel,
  });

  final ClassBooking booking;
  final bool canCancel;
  final bool cancelling;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final b = booking;
    final tone = bookingTone(b.status);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [tone, Color.lerp(tone, TeamColors.fuchsia, 0.5)!],
              ),
            ),
            alignment: Alignment.center,
            child: Text(
              initialsOf(b.memberName),
              style: AppText.body(
                size: 11,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  b.memberName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 13.5, weight: FontWeight.w800),
                ),
                Text(
                  [
                    if (b.memberCode != null) b.memberCode!,
                    if (b.bookedByRole != null)
                      'by ${prettyEnum(b.bookedByRole)}',
                  ].join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          ClassStatusChip(label: bookingStatusLabel(b.status), color: tone),
          if (canCancel)
            cancelling
                ? const Padding(
                    padding: EdgeInsets.all(10),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    tooltip: "Cancel ${b.memberName}'s booking",
                    onPressed: onCancel,
                    icon: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: AppColors.inkFaint,
                    ),
                  ),
        ],
      ),
    );
  }
}
