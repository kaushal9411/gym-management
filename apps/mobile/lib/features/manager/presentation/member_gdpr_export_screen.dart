import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_repository.dart';
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

/// Staff-triggered GDPR data-portability export for an arbitrary member
/// (`GET /members/:id/gdpr-export`), mirroring web's "Data & privacy →
/// Export data". Same "no file-saving package, so show what the bundle
/// contains instead of pretending to save it" approach already established
/// by the member portal's own self-export screen
/// (`member/member_data_export_screen.dart`), which hits a different
/// endpoint (`/portal/gdpr-export`, self-service only).
class MemberGdprExportScreen extends StatefulWidget {
  const MemberGdprExportScreen({
    super.key,
    required this.memberId,
    required this.memberName,
  });

  final String memberId;
  final String memberName;

  @override
  State<MemberGdprExportScreen> createState() => _MemberGdprExportScreenState();
}

class _MemberGdprExportScreenState extends State<MemberGdprExportScreen> {
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
      final data = await getIt<MemberRepository>().gdprExport(widget.memberId);
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
        title: Text('Data export', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: _loading
            ? const AppLoadingView()
            : _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : export == null
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                        child: Column(
                          children: [
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(0x298B5CF6),
                                    Color(0x14FF6B5B),
                                  ],
                                ),
                                borderRadius:
                                    BorderRadius.circular(AppRadii.card),
                                border:
                                    Border.all(color: AppColors.glassBorder),
                              ),
                              child: Column(
                                children: [
                                  Container(
                                    width: 56,
                                    height: 56,
                                    decoration: const BoxDecoration(
                                      gradient: AppColors.staffGrad,
                                      shape: BoxShape.circle,
                                    ),
                                    alignment: Alignment.center,
                                    child: const Icon(
                                      Icons.shield_outlined,
                                      size: 26,
                                      color: Colors.white,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    "${widget.memberName}'s data export",
                                    textAlign: TextAlign.center,
                                    style: AppText.display(size: 18),
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
                                    'Everything FitCloud stores about '
                                    '${widget.memberName} — profile, '
                                    'attendance, plans, invoices, payments, '
                                    'and bookings.',
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
