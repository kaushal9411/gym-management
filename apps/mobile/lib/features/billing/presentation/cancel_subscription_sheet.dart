import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/billing_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// How the tenant chose to end the subscription.
enum CancelResult { atPeriodEnd, immediately }

/// web's cancel confirm bar ("Cancel at period end" / "Cancel immediately" /
/// "Keep subscription") as a bottom sheet. The call itself
/// (`POST /subscription/cancel`) happens inside the sheet so it can show the
/// loading state and the server's error; it pops the [CancelResult] only on
/// success, `null` when the tenant keeps the subscription.
Future<CancelResult?> showCancelSubscriptionSheet(BuildContext context) =>
    showTeamSheet<CancelResult>(context, (_) => const _CancelSheet());

class _CancelSheet extends StatefulWidget {
  const _CancelSheet();

  @override
  State<_CancelSheet> createState() => _CancelSheetState();
}

class _CancelSheetState extends State<_CancelSheet> {
  CancelResult? _busy;
  String? _error;

  Future<void> _cancel(CancelResult kind) async {
    if (_busy != null) return;
    // Ending it right now is not reversible from this screen — web clicks
    // straight through, a phone tap deserves one more confirmation.
    if (kind == CancelResult.immediately) {
      final ok = await confirmTeam(
        context,
        title: 'Cancel immediately?',
        message: 'This ends your subscription right now and cannot be undone '
            'from this screen.',
        confirmLabel: 'Yes, cancel now',
        destructive: true,
      );
      if (!ok || !mounted) return;
    }
    setState(() {
      _busy = kind;
      _error = null;
    });
    try {
      await getIt<BillingRepository>()
          .cancel(immediate: kind == CancelResult.immediately);
      if (!mounted) return;
      Navigator.of(context).pop(kind);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not cancel ($e)');
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = _busy != null;
    return TeamSheetScaffold(
      icon: Icons.cancel_outlined,
      color: TeamColors.rose,
      title: 'Cancel subscription',
      subtitle: 'Choose how this subscription should end',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) ...[
            FormAlert(message: _error!),
            const SizedBox(height: 12),
          ],
          Text(
            '"Cancel at period end" keeps your plan running until the '
            'current period finishes. "Cancel immediately" ends it now.',
            style: AppText.body(
              size: 12.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          TeamOutlineButton(
            key: const ValueKey('cancel-period-end'),
            label: _busy == CancelResult.atPeriodEnd
                ? 'Cancelling…'
                : 'Cancel at period end',
            icon: Icons.event_busy_rounded,
            onTap: busy ? null : () => _cancel(CancelResult.atPeriodEnd),
          ),
          const SizedBox(height: 10),
          TeamGradientButton(
            key: const ValueKey('cancel-now'),
            label: 'Cancel immediately',
            icon: Icons.block_rounded,
            loading: _busy == CancelResult.immediately,
            gradient: const LinearGradient(
              colors: [Color(0xFFE11D48), TeamColors.rose],
            ),
            onTap: busy ? null : () => _cancel(CancelResult.immediately),
          ),
          const SizedBox(height: 6),
          TextButton(
            key: const ValueKey('cancel-keep'),
            onPressed: busy ? null : () => Navigator.of(context).pop(),
            child: Text(
              'Keep subscription',
              style: AppText.body(
                size: 13.5,
                weight: FontWeight.w800,
                color: TeamColors.violet,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
