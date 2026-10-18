import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_ui.dart';

/// Width from which the week is laid out as seven columns (web's grid)
/// instead of the day strip + that day's sessions.
const kClassWeekGridBreak = 900.0;

/// Class calendar (web's `/classes/calendar`): the week's sessions, with
/// previous / next / Today navigation, a gradient [ListHero] and each
/// session opening its bookings ([AppRoutes.classSessionDetail]).
///
/// Two homes, same screen: the Receptionist shell's Classes tab (embedded,
/// no Scaffold, hamburger on the hero, "+" opening the class form exactly as
/// before) and a pushed page ([standalone], back arrow) opened from the
/// catalog's hero - web's "Calendar" button. "Regenerate sessions now"
/// (`POST /class-sessions/generate`) is shown with `classes:update`, as on
/// web.
///
/// `GET /class-sessions` needs an explicit date range, so one Monday-first
/// week is fetched at a time. Phones show a 7-day strip (with a dot per
/// session) and the selected day's sessions; wide screens show the seven
/// day columns.
class ClassesCalendarScreen extends StatefulWidget {
  const ClassesCalendarScreen({super.key, this.standalone = false});

  /// True when pushed as its own route (back arrow, own Scaffold).
  final bool standalone;

  @override
  State<ClassesCalendarScreen> createState() => _ClassesCalendarScreenState();
}

class _ClassesCalendarScreenState extends State<ClassesCalendarScreen> {
  late DateTime _weekStart = startOfWeek(DateTime.now());
  late DateTime _selected = DateTime.now();
  List<ClassSession>? _sessions;
  String? _error;
  bool _generating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _error = null);
    final weekStart = _weekStart;
    try {
      final sessions = await getIt<ClassSessionRepository>().list(
        dateFrom: weekStart,
        dateTo: addDays(weekStart, 6),
      );
      if (!mounted || weekStart != _weekStart) return;
      setState(() {
        _sessions = sessions;
        _error = null;
      });
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (e) {
      _fail('Could not load the calendar ($e)');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    if (_sessions != null) {
      teamSnack(context, message, error: true);
    } else {
      setState(() => _error = message);
    }
  }

  void _shiftWeek(int weeks) {
    final next = addDays(_weekStart, 7 * weeks);
    _goToWeek(next, DateTime.now());
  }

  void _today() => _goToWeek(startOfWeek(DateTime.now()), DateTime.now());

  void _goToWeek(DateTime weekStart, DateTime today) {
    final containsToday = dateKey(startOfWeek(today)) == dateKey(weekStart);
    setState(() {
      _weekStart = weekStart;
      _selected = containsToday ? today : weekStart;
      _sessions = null;
    });
    _load();
  }

  Future<void> _generate() async {
    setState(() => _generating = true);
    try {
      final created = await getIt<ClassSessionRepository>().generate();
      if (!mounted) return;
      teamSnack(context, '$created session(s) generated.');
      await _load(silent: true);
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _generating = false);
    }
  }

  Future<void> _openSession(ClassSession s) async {
    await context.push(AppRoutes.classSessionDetail, extra: s.id);
    if (mounted) _load(silent: true);
  }

  Future<void> _create() async {
    await context.push(AppRoutes.classForm);
    if (mounted) _load(silent: true);
  }

  List<ClassSession> _forDay(String key) =>
      (_sessions ?? const <ClassSession>[])
          .where((s) => s.dayKey == key)
          .toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));

  @override
  Widget build(BuildContext context) {
    final body = _body(context);
    if (!widget.standalone) return body;
    return Scaffold(backgroundColor: AppColors.bg, body: body);
  }

  Widget _body(BuildContext context) {
    final canGenerate = teamCan(context, 'classes:update');
    final top = widget.standalone ? MediaQuery.of(context).padding.top : 0.0;
    final wide = MediaQuery.sizeOf(context).width >= kClassWeekGridBreak;
    final selectedKey = dateKey(_selected);
    final dayItems = _forDay(selectedKey);

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: () => _load(silent: true),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(child: _hero(top, canGenerate)),
          SliverToBoxAdapter(
            child: TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _weekNav(),
                    const SizedBox(height: 12),
                    if (!wide) _dayStrip(),
                  ],
                ),
              ),
            ),
          ),
          if (_error != null && _sessions == null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: AppErrorView(message: _error!, onRetry: _load),
            )
          else if (_sessions == null)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: AppLoadingView(),
            )
          else if (wide)
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
                  child: _weekGrid(),
                ),
              ),
            )
          else ...[
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
                  child: Text(
                    '${fmtDayKey(selectedKey)} · '
                    '${plural(dayItems.length, 'class', 'classes')}',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w800,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ),
              ),
            ),
            if (dayItems.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: AppEmptyState(
                  icon: Icons.event_busy_outlined,
                  title: 'No classes this day',
                  message: 'Try another day on the strip above.',
                ),
              )
            else
              teamCardSliver<ClassSession>(
                context,
                items: dayItems,
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 96),
                builder: (s, i) => SessionCard(
                  key: ValueKey('session-${s.id}'),
                  session: s,
                  onTap: () => _openSession(s),
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _hero(double top, bool canGenerate) {
    final sessions = _sessions ?? const <ClassSession>[];
    final booked = sessions.fold(0, (a, s) => a + s.bookedCount);
    final seats = sessions.fold(0, (a, s) => a + s.capacity);
    final days = List.generate(7, (i) => addDays(_weekStart, i));
    return ListHero(
      title: 'Class calendar',
      subtitle: '${dayMonth(days.first)} – ${dayMonth(days.last)} '
          '${days.last.year}',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: widget.standalone
          ? ListHeroButton(
              icon: Icons.arrow_back_rounded,
              onTap: () => context.pop(),
            )
          : ListHeroButton(
              icon: Icons.menu_rounded,
              onTap: () => SlideDrawerController.of(context)?.open(),
            ),
      trailing: [
        if (canGenerate)
          ListHeroButton(
            icon: Icons.refresh_rounded,
            onTap: _generating ? null : _generate,
          ),
        if (!widget.standalone)
          ListHeroButton(icon: Icons.add_rounded, onTap: _create),
      ],
      chips: [
        ListHeroChip(
          icon: Icons.event_available_rounded,
          label: plural(sessions.length, 'session'),
        ),
        ListHeroChip(
          icon: Icons.groups_rounded,
          label: '$booked/$seats booked',
        ),
        if (_generating)
          const ListHeroChip(
            icon: Icons.refresh_rounded,
            label: 'Generating…',
          ),
      ],
    );
  }

  Widget _weekNav() {
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
    final days = List.generate(7, (i) => addDays(_weekStart, i));
    return Row(
      children: [
        arrow(
          Icons.chevron_left_rounded,
          'Previous week',
          () => _shiftWeek(-1),
        ),
        const SizedBox(width: 8),
        arrow(Icons.chevron_right_rounded, 'Next week', () => _shiftWeek(1)),
        const SizedBox(width: 8),
        TeamFilterChip(label: 'Today', selected: false, onTap: _today),
        const Spacer(),
        Text(
          '${dayMonth(days.first)} – ${dayMonth(days.last)}',
          style: AppText.body(
            size: 12.5,
            weight: FontWeight.w700,
            color: AppColors.inkSoft,
          ),
        ),
      ],
    );
  }

  Widget _dayStrip() {
    final todayKey = dateKey(DateTime.now());
    final selectedKey = dateKey(_selected);
    return Row(
      children: List.generate(7, (i) {
        final day = addDays(_weekStart, i);
        final key = dateKey(day);
        final selected = key == selectedKey;
        final count = _forDay(key).where((s) => s.isScheduled).length;
        return Expanded(
          child: GestureDetector(
            key: ValueKey('day-$key'),
            onTap: () => setState(() => _selected = day),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                gradient: selected ? TeamColors.cta : null,
                borderRadius: BorderRadius.circular(14),
                border: selected ? null : Border.all(color: AppColors.line),
                color: selected ? null : AppColors.surface2,
              ),
              child: Column(
                children: [
                  Text(
                    dowLabel(day),
                    style: AppText.body(
                      size: 10,
                      weight: FontWeight.w800,
                      color: selected ? Colors.white : AppColors.inkSoft,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${day.day}',
                    style: AppText.display(
                      size: 15,
                      color: selected
                          ? Colors.white
                          : (key == todayKey
                              ? TeamColors.violet
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
                            margin: const EdgeInsets.symmetric(horizontal: 1),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color:
                                  selected ? Colors.white : TeamColors.violet,
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
    );
  }

  Widget _weekGrid() {
    final todayKey = dateKey(DateTime.now());
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List.generate(7, (i) {
        final day = addDays(_weekStart, i);
        final key = dateKey(day);
        final items = _forDay(key);
        final isToday = key == todayKey;
        final color = TeamColors.rotation[i % TeamColors.rotation.length];
        return Expanded(
          child: Container(
            key: ValueKey('col-$key'),
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isToday ? color : color.withValues(alpha: 0.22),
                width: isToday ? 1.6 : 1,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        color.withValues(alpha: isToday ? 0.3 : 0.16),
                        Colors.transparent,
                      ],
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(
                        dowLabel(day),
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w800,
                          color: isToday ? color : AppColors.ink,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        dayMonth(day),
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(6),
                  child: items.isEmpty
                      ? Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 10,
                          ),
                          child: Text(
                            'No sessions',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        )
                      : Column(
                          children: [
                            for (final s in items)
                              SessionCard(
                                key: ValueKey('session-${s.id}'),
                                session: s,
                                dense: true,
                                accent: color,
                                onTap: () => _openSession(s),
                              ),
                          ],
                        ),
                ),
              ],
            ),
          ),
        );
      }),
    );
  }
}

/// One session in the calendar: class, time range, trainer / branch, a
/// booked-of-capacity bar and a status chip when it isn't `SCHEDULED`.
class SessionCard extends StatelessWidget {
  const SessionCard({
    super.key,
    required this.session,
    required this.onTap,
    this.dense = false,
    this.accent,
  });

  final ClassSession session;
  final VoidCallback onTap;

  /// The narrow card of the week grid.
  final bool dense;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final s = session;
    final color = accent ?? classAccent(s.groupClass.name);
    final meta = [
      if (s.trainer != null) s.trainer!.name,
      if (s.branch != null) s.branch!.name,
    ].join(' · ');
    return Opacity(
      opacity: s.status == 'CANCELLED' ? 0.55 : 1,
      child: Container(
        margin: EdgeInsets.only(bottom: dense ? 6 : 10),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(dense ? 12 : AppRadii.card),
          border: Border.all(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 4, color: color),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.all(dense ? 8 : 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  s.groupClass.name,
                                  maxLines: dense ? 2 : 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: dense ? 12 : 14.5,
                                    weight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              if (!dense && !s.isScheduled)
                                ClassStatusChip(
                                  label: sessionStatusLabel(s.status),
                                  color: sessionTone(s.status),
                                ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Icon(
                                Icons.schedule_rounded,
                                size: dense ? 11 : 13,
                                color: color,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  classTimeRange(s.startTime, s.endTime),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: dense ? 10.5 : 12.5,
                                    weight: FontWeight.w700,
                                    color: AppColors.inkSoft,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (meta.isNotEmpty && !dense) ...[
                            const SizedBox(height: 2),
                            Text(
                              meta,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w600,
                                color: AppColors.inkFaint,
                              ),
                            ),
                          ],
                          SizedBox(height: dense ? 6 : 10),
                          CapacityBar(
                            booked: s.bookedCount,
                            capacity: s.capacity,
                            base: color,
                            showCaption: !dense,
                          ),
                          if (dense) ...[
                            const SizedBox(height: 4),
                            Text(
                              '${s.bookedCount}/${s.capacity}'
                              '${s.isScheduled ? '' : ' · ${sessionStatusLabel(s.status)}'}',
                              style: AppText.body(
                                size: 10.5,
                                weight: FontWeight.w800,
                                color: capacityTone(
                                  s.bookedCount,
                                  s.capacity,
                                  base: color,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
