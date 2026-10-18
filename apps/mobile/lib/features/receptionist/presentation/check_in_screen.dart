import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/qr_validation_result.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../shared/widgets/list_hero.dart';
import '../../../shared/widgets/slide_drawer_scaffold.dart';
import '../../attendance/presentation/attendance_member_card.dart';
import '../../attendance/presentation/attendance_sheets.dart';
import '../../attendance/presentation/attendance_ui.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Builds the camera view; swapped for a plain placeholder in widget tests
/// (the real `MobileScanner` needs a device).
typedef QrScannerBuilder = Widget Function(
  BuildContext context,
  void Function(BarcodeCapture capture) onDetect,
);

/// Design frame "4. Scan check-in" — the Receptionist's first tab.
///
/// The QR payload encodes as `fitcloud-member:{tenantId}:{qrCodeToken}` (see
/// `members` module) — this screen extracts the token, validates it
/// (`POST /attendance/validate-qr`), then either checks the member in
/// (`/attendance/check-in`), checks them out when they are already inside
/// (`/attendance/check-out`, web's "Check out" action on the same card), or
/// surfaces why they can't. "Search manually" opens the name / phone / ID
/// fallback. A small "This session" list records what was done since the tab
/// opened (local only — no extra endpoint is called).
class CheckInScreen extends StatefulWidget {
  const CheckInScreen({super.key, this.scannerBuilder});

  final QrScannerBuilder? scannerBuilder;

  @override
  State<CheckInScreen> createState() => _CheckInScreenState();
}

class _SessionEntry {
  const _SessionEntry(this.name, this.checkedIn, this.at);

  final String name;
  final bool checkedIn;
  final DateTime at;
}

class _CheckInScreenState extends State<CheckInScreen> {
  MobileScannerController? _controller;
  QrValidationResult? _result;
  bool _busy = false;
  bool _paused = false;
  String? _error;
  final _session = <_SessionEntry>[];

  @override
  void initState() {
    super.initState();
    if (widget.scannerBuilder == null) _controller = MobileScannerController();
  }

  @override
  void dispose() {
    _controller?.dispose();
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
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = attendanceErrorText(e));
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
      _session.insert(0, _SessionEntry(member.name, true, DateTime.now()));
      await context.push(AppRoutes.checkedIn, extra: member.name);
      if (mounted) _scanNext();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = attendanceErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmCheckOut() async {
    final member = _result?.member;
    if (member == null) return;
    setState(() => _busy = true);
    try {
      await getIt<AttendanceRepository>().checkOut(memberId: member.id);
      if (!mounted) return;
      _session.insert(0, _SessionEntry(member.name, false, DateTime.now()));
      teamSnack(context, '${member.name} checked out.');
      _scanNext();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = attendanceErrorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _search() async {
    await context.push(AppRoutes.searchMembers);
    if (mounted) _scanNext();
  }

  @override
  Widget build(BuildContext context) {
    final inCount = _session.where((e) => e.checkedIn).length;
    final outCount = _session.length - inCount;
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: ListHero(
            title: 'Check in',
            subtitle: "Scan a member's QR code, or search for them",
            side: 18 + teamSideInset(context),
            leading: ListHeroButton(
              icon: Icons.menu_rounded,
              onTap: () => SlideDrawerController.of(context)?.open(),
            ),
            trailing: [
              ListHeroButton(icon: Icons.search_rounded, onTap: _search),
            ],
            chips: [
              const AttendanceLiveChip(label: 'Scanner ready'),
              ListHeroChip(
                icon: Icons.login_rounded,
                label: '$inCount checked in',
              ),
              ListHeroChip(
                icon: Icons.logout_rounded,
                label: '$outCount checked out',
              ),
            ],
          ),
        ),
        SliverToBoxAdapter(
          child: TeamCenter(
            maxWidth: 720,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 90),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _ScannerFrame(
                    busy: _busy,
                    paused: _paused,
                    child: widget.scannerBuilder != null
                        ? widget.scannerBuilder!(context, _onDetect)
                        : MobileScanner(
                            controller: _controller,
                            onDetect: _onDetect,
                          ),
                  ),
                  const SizedBox(height: 14),
                  if (_error != null)
                    _ErrorBanner(message: _error!, onRetry: _scanNext)
                  else if (_result != null)
                    _resultCard(_result!)
                  else
                    const _ScanHint(),
                  const SizedBox(height: 12),
                  TeamOutlineButton(
                    label: 'Search manually',
                    icon: Icons.search_rounded,
                    onTap: _search,
                  ),
                  if (_session.isNotEmpty) ...[
                    const SizedBox(height: 22),
                    Text('This session', style: AppText.display(size: 17)),
                    const SizedBox(height: 10),
                    for (var i = 0; i < _session.length && i < 12; i++)
                      FadeUp(
                        index: i.clamp(0, 5),
                        child: _SessionRow(entry: _session[i]),
                      ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _resultCard(QrValidationResult r) {
    final member = r.member;
    if (member == null) {
      return _ErrorBanner(
        message: r.reason ?? 'QR code not recognized.',
        onRetry: _scanNext,
      );
    }
    final inside = r.alreadyCheckedIn;
    return FadeUp(
      index: 0,
      child: AttendanceMemberCard(
        name: member.name,
        code: member.memberId,
        photoUrl: member.profilePhotoUrl,
        // Already inside is a valid state to check *out* from.
        eligible: r.valid || inside,
        message: inside
            ? 'Already inside — check them out?'
            : (r.valid ? 'Eligible' : (r.reason ?? 'Not eligible')),
        tags: [
          TeamTag(
            label: member.status,
            color:
                member.status == 'ACTIVE' ? TeamColors.green : TeamColors.slate,
          ),
        ],
        actions: Column(
          children: [
            AttendanceActionRow(
              busy: _busy,
              onCheckIn: inside || !r.valid ? null : _confirmCheckIn,
              onCheckOut: inside ? _confirmCheckOut : null,
            ),
            const SizedBox(height: 8),
            Center(
              child: GestureDetector(
                onTap: _busy ? null : _scanNext,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    'Scan another',
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w800,
                      color: TeamColors.violet,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Camera view with animated corner brackets and a sweeping scan line.
class _ScannerFrame extends StatelessWidget {
  const _ScannerFrame({
    required this.child,
    required this.busy,
    required this.paused,
  });

  final Widget child;
  final bool busy;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    final color = paused ? TeamColors.green : TeamColors.fuchsia;
    return ClipRRect(
      borderRadius: BorderRadius.circular(26),
      child: Container(
        height: 260,
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            child,
            IgnorePointer(
              child: Looping(
                duration: const Duration(milliseconds: 2200),
                reverse: true,
                builder: (context, t) => Stack(
                  children: [
                    Positioned.fill(
                      child: Container(
                        margin: const EdgeInsets.all(26),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: color.withValues(alpha: 0.9),
                            width: 3,
                          ),
                          borderRadius: BorderRadius.circular(22),
                          boxShadow: [
                            BoxShadow(
                              color: color.withValues(alpha: 0.35 + 0.25 * t),
                              blurRadius: 18,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (!paused)
                      Positioned(
                        left: 40,
                        right: 40,
                        top: 40 + (260 - 80 - 4) * t,
                        child: Container(
                          height: 2.5,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.transparent,
                                color,
                                Colors.transparent,
                              ],
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (busy)
              Container(
                color: Colors.black54,
                child: const Center(
                  child: CircularProgressIndicator(color: Colors.white),
                ),
              ),
            Positioned(
              bottom: 10,
              left: 0,
              right: 0,
              child: Text(
                paused ? 'QR captured' : 'Align member QR within frame',
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanHint extends StatelessWidget {
  const _ScanHint();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: TeamColors.indigo.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(11),
            ),
            child: const Icon(
              Icons.qr_code_scanner_rounded,
              size: 18,
              color: TeamColors.indigo,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Hold the member’s QR code in front of the camera. '
              'You can check them in, or out if they are already inside.',
              style: AppText.body(
                size: 12.5,
                color: AppColors.inkSoft,
                weight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.danger),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: AppText.body(size: 13, color: AppColors.danger),
            ),
          ),
          TextButton(onPressed: onRetry, child: const Text('Scan again')),
        ],
      ),
    );
  }
}

class _SessionRow extends StatelessWidget {
  const _SessionRow({required this.entry});

  final _SessionEntry entry;

  @override
  Widget build(BuildContext context) {
    final color = entry.checkedIn ? TeamColors.green : TeamColors.rose;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.16),
              shape: BoxShape.circle,
            ),
            child: Icon(
              entry.checkedIn ? Icons.login_rounded : Icons.logout_rounded,
              size: 16,
              color: color,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              entry.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.body(size: 13, weight: FontWeight.w800),
            ),
          ),
          Text(
            '${entry.checkedIn ? 'In' : 'Out'} · ${fmtClock(entry.at)}',
            style: AppText.body(
              size: 11.5,
              color: color,
              weight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
