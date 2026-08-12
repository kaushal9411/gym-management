import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "9a. Class detail". The design's "Cancel session" action
/// (cancelling the whole class occurrence) has no matching endpoint —
/// `bookings/:id/cancel` only cancels one member's booking, there's no
/// `/class-sessions/:id/cancel` — dropped rather than faked; "+ Add
/// attendee" and per-attendee status are both real.
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
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(
          _session?.groupClass.name ?? 'Class',
          style: AppText.display(size: 18),
        ),
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : _session == null
                ? const AppLoadingView()
                : _buildContent(_session!),
      ),
    );
  }

  Widget _buildContent(ClassSessionDetail session) {
    final full = session.bookedCount >= session.capacity;
    final pct = session.capacity == 0
        ? 0.0
        : (session.bookedCount / session.capacity).clamp(0, 1).toDouble();
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        GlassCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Capacity', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${session.bookedCount} / ${session.capacity}',
                    style: AppText.display(size: 18),
                  ),
                  AppPill(
                    label: '${(pct * 100).round()}% full',
                    tone: full ? AppPillTone.danger : AppPillTone.roleTint,
                  ),
                ],
              ),
              const SizedBox(height: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: pct,
                  minHeight: 6,
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                  valueColor: const AlwaysStoppedAnimation(AppColors.staffB),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Attendees', style: AppText.eyebrow()),
              const SizedBox(height: 10),
              if (session.bookings.isEmpty)
                Text(
                  'No one booked yet.',
                  style: AppText.body(color: AppColors.inkFaint),
                )
              else
                ...session.bookings.map(
                  (b) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: const BoxDecoration(
                            color: AppColors.staffSoft,
                            shape: BoxShape.circle,
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            b.memberName.isEmpty
                                ? '?'
                                : b.memberName[0].toUpperCase(),
                            style: AppText.body(
                              size: 9,
                              weight: FontWeight.w800,
                              color: AppColors.staffPillFg,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            b.memberName,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        AppPill(label: b.status),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppButton(
          label: '+ Add attendee',
          size: AppButtonSize.small,
          onPressed: full
              ? null
              : () => context
                  .push(AppRoutes.classAddAttendee, extra: session)
                  .then((_) => _load()),
        ),
      ],
    );
  }
}
