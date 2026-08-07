import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/errors/app_exception.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/app_card.dart';
import '../../../../widgets/app_top_bar.dart';
import '../../data/attendance_repository.dart';

class QrCheckInPage extends StatefulWidget {
  const QrCheckInPage({super.key});

  @override
  State<QrCheckInPage> createState() => _QrCheckInPageState();
}

class _QrCheckInPageState extends State<QrCheckInPage> {
  final _scannerController = MobileScannerController();
  QrValidationResult? _result;
  bool _busy = false;
  String? _error;
  bool _paused = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_paused || _busy) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw == null) return;
    final token = AttendanceRepository.extractQrToken(raw);
    if (token == null) return;

    setState(() {
      _paused = true;
      _busy = true;
      _error = null;
    });
    try {
      final result =
          await context.read<AttendanceRepository>().validateQr(token);
      setState(() => _result = result);
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _act(bool checkingIn) async {
    final memberId = _result?.memberId;
    if (memberId == null) return;
    setState(() => _busy = true);
    try {
      if (checkingIn) {
        await context.read<AttendanceRepository>().checkIn(memberId);
      } else {
        await context.read<AttendanceRepository>().checkOut(memberId);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(checkingIn ? 'Checked in' : 'Checked out')),
        );
        setState(() {
          _result = null;
          _paused = false;
        });
      }
    } on AppException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            children: [
              const AppTopBar(caption: 'Front desk', title: 'Scan to check in'),
              const SizedBox(height: 14),
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  height: 260,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      MobileScanner(
                        controller: _scannerController,
                        onDetect: _onDetect,
                      ),
                      if (_busy)
                        const ColoredBox(
                          color: Colors.black38,
                          child: Center(
                            child:
                                CircularProgressIndicator(color: Colors.white),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),
              if (_error != null)
                Text(_error!, style: TextStyle(color: colors.danger)),
              if (_result != null) _ResultCard(result: _result!, onAct: _act),
              if (_result == null && _error == null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    "Align the member's QR within the frame",
                    style: TextStyle(color: colors.inkFaint),
                  ),
                ),
              const Spacer(),
              if (_paused)
                OutlinedButton(
                  onPressed: () => setState(() {
                    _result = null;
                    _error = null;
                    _paused = false;
                  }),
                  child: const Text('Scan another'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  final QrValidationResult result;
  final void Function(bool checkingIn) onAct;

  const _ResultCard({required this.result, required this.onAct});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppSemanticColors>()!;
    final eligible = result.valid;
    return AppCard(
      backgroundColor: eligible ? colors.successSoft : colors.dangerSoft,
      borderColor: Colors.transparent,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: Colors.white,
                foregroundColor: eligible ? colors.success : colors.danger,
                child: Text(result.memberName?.substring(0, 1) ?? '?'),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${result.memberName ?? 'Unknown'} · ${result.memberDisplayId ?? ''}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text(
                      result.reason ?? (eligible ? 'Eligible' : 'Not eligible'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: eligible ? colors.success : colors.danger,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (eligible) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed:
                        result.alreadyCheckedIn ? null : () => onAct(true),
                    child: const Text('Check in'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => onAct(false),
                    child: const Text('Check out'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

extension on List<Barcode> {
  Barcode? get firstOrNull => isEmpty ? null : first;
}
