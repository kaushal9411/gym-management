import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Menu-accessed screen (no design frame — added alongside the mobile
/// permission-parity work; every other staff role already got full-parity
/// menu tiles per explicit user request, and a member's own body
/// measurement history is the natural counterpart of the trainer/owner-side
/// "Record measurement" flow on `member_detail_screen.dart`). Read-only: a
/// member never edits their own measurements, only a trainer/owner/manager
/// logs them — `GET /portal/measurements`.
class MemberMeasurementsScreen extends StatefulWidget {
  const MemberMeasurementsScreen({super.key});

  @override
  State<MemberMeasurementsScreen> createState() =>
      _MemberMeasurementsScreenState();
}

class _MemberMeasurementsScreenState extends State<MemberMeasurementsScreen> {
  List<BodyMeasurement>? _entries;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final entries = await getIt<MemberPortalRepository>().measurements();
      if (!mounted) return;
      setState(() => _entries = entries);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = _entries;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Body Measurements'),
      ),
      body: SafeArea(
        top: false,
        child: entries == null
            ? (_error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : const AppLoadingView(role: AppRole.member))
            : entries.isEmpty
                ? const AppEmptyState(
                    icon: Icons.straighten_outlined,
                    title: 'No measurements yet',
                    message: 'Ask your trainer to log your first check-in.',
                  )
                : RefreshIndicator(
                    color: AppColors.memberB,
                    backgroundColor: AppColors.surface2,
                    onRefresh: _load,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                      itemCount: entries.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) =>
                          _MeasurementCard(entry: entries[index]),
                    ),
                  ),
      ),
    );
  }
}

class _MeasurementCard extends StatelessWidget {
  const _MeasurementCard({required this.entry});

  final BodyMeasurement entry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${entry.recordedAt.day}/${entry.recordedAt.month}/${entry.recordedAt.year}',
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              if (entry.recordedBy != null)
                Text(
                  'by ${entry.recordedBy!.name}',
                  style: AppText.body(size: 10, color: AppColors.inkFaint),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            entry.summary,
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          if (entry.notes != null && entry.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              entry.notes!,
              style: AppText.body(size: 11, color: AppColors.inkFaint),
            ),
          ],
        ],
      ),
    );
  }
}
