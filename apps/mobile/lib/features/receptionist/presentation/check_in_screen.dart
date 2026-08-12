import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/qr_validation_result.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../shared/widgets/app_button.dart';

/// Design frame "4. Scan check-in". The QR payload encodes as
/// `fitcloud-member:{tenantId}:{qrCodeToken}` (see `members` module) — this
/// screen extracts the token, validates it, then either checks the member
/// in or surfaces why they can't.
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key});

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _CheckInScreenState extends State<CheckInScreen> {
  final _controller = MobileScannerController();
  QrValidationResult? _result;
  bool _busy = false;
  bool _paused = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_paused || _busy) return;
    if (capture.barcodes.isEmpty) return;
    final raw = capture.barcodes.first.rawValue;
    if (raw == null) return;
    final parts = raw.split(':');
    if (parts.length < 3 || parts[0] != 'fitcloud-member') return;
    final token = parts.sublist(2).join(':');

    setState(() {
      _paused = true;
      _busy = true;
      _error = null;
    });
    try {
      final result = await getIt<AttendanceRepository>().validateQr(token);
      if (!mounted) return;
      setState(() => _result = result);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _scanNext() {
    setState(() {
      _result = null;
      _error = null;
      _paused = false;
    });
  }

  Future<void> _confirmCheckIn() async {
    final member = _result?.member;
    if (member == null) return;
    setState(() => _busy = true);
    try {
      await getIt<AttendanceRepository>().checkIn(memberId: member.id);
      if (!mounted) return;
      await context.push(
        AppRoutes.checkedIn,
        extra: member.name,
      );
      _scanNext();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Front desk', style: AppText.eyebrow()),
          Text('Check in', style: AppText.display(size: 22)),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.glass),
            child: SizedBox(
              height: 210,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  MobileScanner(controller: _controller, onDetect: _onDetect),
                  IgnorePointer(
                    child: Container(
                      margin: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: AppColors.staffA,
                          width: 3,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 10,
                    left: 0,
                    right: 0,
                    child: Text(
                      'Align member QR within frame',
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.staffPillFg,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          if (_error != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.dangerSoft,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.danger),
              ),
              child: Text(
                _error!,
                style: AppText.body(size: 13, color: AppColors.danger),
              ),
            )
          else if (_result != null)
            _EligibilityCard(result: _result!),
          const SizedBox(height: 14),
          AppButton(
            label: 'Check in',
            loading: _busy,
            onPressed: (_result?.valid ?? false) ? _confirmCheckIn : null,
          ),
          const SizedBox(height: 10),
          Center(
            child: GestureDetector(
              onTap: () => context
                  .push(AppRoutes.searchMembers)
                  .then((_) => _scanNext()),
              child: Text('or search manually', style: AppText.eyebrow()),
            ),
          ),
        ],
      ),
    );
  }
}

class _EligibilityCard extends StatelessWidget {
  const _EligibilityCard({required this.result});

  final QrValidationResult result;

  @override
  Widget build(BuildContext context) {
    final member = result.member;
    final eligible = result.valid;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: eligible ? AppColors.successSoft : AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: eligible ? AppColors.success : AppColors.danger,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              member == null || member.name.isEmpty
                  ? '?'
                  : member.name[0].toUpperCase(),
              style: AppText.body(
                size: 13,
                weight: FontWeight.w800,
                color: eligible ? AppColors.success : AppColors.danger,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  member == null
                      ? 'Unrecognized QR code'
                      : '${member.name} · ${member.memberId}',
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                Text(
                  result.reason ?? (eligible ? 'Eligible' : 'Not eligible'),
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: eligible ? AppColors.success : AppColors.danger,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
