import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Sections of the GDPR bundle, in the order the API returns them.
const _sections = <String, String>{
  'attendance': 'Visits',
  'workoutPlans': 'Workout plans',
  'dietPlans': 'Diet plans',
  'invoices': 'Invoices',
  'payments': 'Payments',
  'documents': 'Documents',
  'classBookings': 'Class bookings',
};

/// Design frame "8f. Data export", with corrected copy: the design promises
/// "we'll email a download link within 24 hours", but `GET
/// /portal/gdpr-export` builds and returns the bundle inline — no email, no
/// job queue. Since the app has no file-saving package, the export can't be
/// written to disk either, so this screen reports exactly what the bundle
/// contains rather than implying a delivery that never happens.
class MemberDataExportScreen extends StatefulWidget {
  const MemberDataExportScreen({super.key});

  @override
  State<MemberDataExportScreen> createState() => _MemberDataExportScreenState();
}

class _MemberDataExportScreenState extends State<MemberDataExportScreen> {
  Map<String, dynamic>? _export;
  bool _loading = true;
  String? _error;

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
      final data = await getIt<MemberPortalRepository>().gdprExport();
      if (!mounted) return;
      setState(() => _export = data);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final export = _export;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('My data', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView(role: AppRole.member)
            : _error != null
                ? AppErrorView(
                    message: _error!,
                    onRetry: _load,
                    role: AppRole.member,
                  )
                : export == null
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        child: Column(
                          children: [
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(28),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0x2EC6F135),
                                    Color(0x1A14E0B4),
                                  ],
                                ),
                                borderRadius:
                                    BorderRadius.circular(AppRadii.card),
                                border: Border.all(
                                  color: AppColors.glassBorder,
                                ),
                              ),
                              child: Column(
                                children: [
                                  Container(
                                    width: 64,
                                    height: 64,
                                    decoration: const BoxDecoration(
                                      gradient: AppColors.memberGrad,
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: const Icon(
                                      Icons.shield_outlined,
                                      size: 28,
                                      color: AppColors.memberOnGrad,
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  Text(
                                    'Your data export',
                                    style: AppText.display(size: 20),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                            Expanded(
                              child: ListView(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface2,
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.card,
                                      ),
                                      border: Border.all(color: AppColors.line),
                                    ),
                                    child: Column(
                                      children: [
                                        for (final entry in _sections.entries)
                                          _CountRow(
                                            label: entry.value,
                                            count: (export[entry.key] as List?)
                                                    ?.length ??
                                                0,
                                          ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Everything FitCloud stores about you, including '
                                    'your profile. Ask the front desk for a copy to '
                                    'take away.',
                                    style: AppText.body(
                                      size: 12,
                                      color: AppColors.inkFaint,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            AppButton(
                              label: 'Done',
                              role: AppRole.member,
                              onPressed: () => context.pop(),
                            ),
                          ],
                        ),
                      ),
      ),
    );
  }
}

class _CountRow extends StatelessWidget {
  const _CountRow({required this.label, required this.count});

  final String label;
  final int count;

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
          Text(
            '$count',
            style: AppText.body(size: 13, weight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
