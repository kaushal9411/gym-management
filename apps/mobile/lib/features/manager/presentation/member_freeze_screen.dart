import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "7b. Freeze". `POST /:id/freeze` only takes an optional
/// `reason` — no duration param, so the design's duration-picker chips and
/// "resumes automatically on \<date>" messaging don't match a real backend
/// behavior (freeze is open-ended until a staff member calls `/resume`).
/// Dropped rather than faked.
class MemberFreezeScreen extends StatefulWidget {
  const MemberFreezeScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<MemberFreezeScreen> createState() => _MemberFreezeScreenState();
}

class _MemberFreezeScreenState extends State<MemberFreezeScreen> {
  final _reasonController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<MemberRepository>()
          .freeze(widget.memberId, reason: _reasonController.text.trim());
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Freeze Membership'),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 8),
              if (_error != null) ...[
                FormAlert(message: _error!),
                const SizedBox(height: 12),
              ],
              AppLabeledField(
                label: 'Reason (optional)',
                controller: _reasonController,
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: 12),
              Text(
                'The member stays frozen until manually resumed from their '
                'profile — there is no automatic resume date.',
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Freeze membership',
                loading: _loading,
                onPressed: _confirm,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
