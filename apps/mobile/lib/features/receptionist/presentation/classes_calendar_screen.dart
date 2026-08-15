import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

const _weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// Design frame "9. Classes calendar" — a 7-day strip (today ± a few days)
/// and that day's sessions. `GET /class-sessions` requires an explicit
/// date range, so this fetches one week at a time. The "+" opens frame
/// "18. Create class" (`ClassFormScreen`).
class ClassesCalendarScreen extends StatefulWidget {
  const ClassesCalendarScreen({super.key});

  @override
  State<ClassesCalendarScreen> createState() => _ClassesCalendarScreenState();
}

class _ClassesCalendarScreenState extends State<ClassesCalendarScreen> {
  late final DateTime _weekStart = _startOfWeek(DateTime.now());
  late DateTime _selected = DateTime.now();
  List<ClassSession>? _sessions;
  String? _error;

  static DateTime _startOfWeek(DateTime d) =>
      DateTime(d.year, d.month, d.day).subtract(Duration(days: d.weekday - 1));

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final sessions = await getIt<ClassSessionRepository>().list(
        dateFrom: _weekStart,
        dateTo: _weekStart.add(const Duration(days: 6)),
      );
      if (!mounted) return;
      setState(() => _sessions = sessions);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = context.watch<SessionCubit>().state;
    final tenantName =
        session is SessionAuthenticatedStaff ? session.tenant.name : '';
    final selectedKey = _dateKey(_selected);
    final dayItems = (_sessions ?? [])
        .where((s) => s.sessionDate.startsWith(selectedKey))
        .toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tenantName, style: AppText.eyebrow()),
                    Text('Classes', style: AppText.display(size: 22)),
                  ],
                ),
              ),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () =>
                      context.push(AppRoutes.classForm).then((_) => _load()),
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      gradient: AppColors.staffGrad,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.add_rounded,
                      size: 18,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: List.generate(7, (i) {
              final day = _weekStart.add(Duration(days: i));
              final selected = _dateKey(day) == selectedKey;
              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selected = day),
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      gradient: selected ? AppColors.staffGrad : null,
                      color: selected ? null : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border:
                          selected ? null : Border.all(color: AppColors.line),
                    ),
                    child: Column(
                      children: [
                        Text(
                          _weekdayLabels[i],
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
                            size: 14,
                            color: selected ? Colors.white : AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : _sessions == null
                    ? const AppLoadingView()
                    : dayItems.isEmpty
                        ? const AppEmptyState(
                            icon: Icons.event_busy_outlined,
                            title: 'No classes this day',
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.only(bottom: 90),
                            itemCount: dayItems.length,
                            itemBuilder: (context, i) =>
                                _SessionCard(session: dayItems[i]),
                          ),
          ),
        ],
      ),
    );
  }

  String _dateKey(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.session});

  final ClassSession session;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () =>
            context.push(AppRoutes.classSessionDetail, extra: session.id),
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: const Border(
              left: BorderSide(color: AppColors.staffA, width: 3),
              top: BorderSide(color: AppColors.line),
              right: BorderSide(color: AppColors.line),
              bottom: BorderSide(color: AppColors.line),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      session.groupClass.name,
                      style: AppText.body(size: 14, weight: FontWeight.w700),
                    ),
                    Text(
                      '${session.startTime} – ${session.endTime}'
                      '${session.trainer != null ? ' · ${session.trainer!.name}' : ''}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              AppPill(
                label: '${session.bookedCount}/${session.capacity}',
                tone: session.bookedCount >= session.capacity
                    ? AppPillTone.danger
                    : AppPillTone.roleTint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
