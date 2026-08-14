import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/gym_profile.dart';
import '../../../repositories/gym_settings_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "11a-i. Social Media" — `PATCH /settings/profile/social-links`.
class GymSocialScreen extends StatefulWidget {
  const GymSocialScreen({super.key, required this.socialLinks});

  final SocialLinks? socialLinks;

  @override
  State<GymSocialScreen> createState() => _GymSocialScreenState();
}

class _GymSocialScreenState extends State<GymSocialScreen> {
  late final _facebookController =
      TextEditingController(text: widget.socialLinks?.facebook ?? '');
  late final _instagramController =
      TextEditingController(text: widget.socialLinks?.instagram ?? '');
  late final _twitterController =
      TextEditingController(text: widget.socialLinks?.twitter ?? '');
  late final _youtubeController =
      TextEditingController(text: widget.socialLinks?.youtube ?? '');
  late final _linkedinController =
      TextEditingController(text: widget.socialLinks?.linkedin ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _facebookController.dispose();
    _instagramController.dispose();
    _twitterController.dispose();
    _youtubeController.dispose();
    _linkedinController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<GymSettingsRepository>().updateSocialLinks(
        facebook: _facebookController.text.trim(),
        instagram: _instagramController.text.trim(),
        twitter: _twitterController.text.trim(),
        youtube: _youtubeController.text.trim(),
        linkedin: _linkedinController.text.trim(),
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Social Media'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                const SizedBox(height: 8),
                FormAlert(message: _error!),
              ],
              const SizedBox(height: 16),
              AppLabeledField(
                label: 'Facebook',
                hintText: 'https://facebook.com/yourgym',
                controller: _facebookController,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Instagram',
                hintText: 'https://instagram.com/yourgym',
                controller: _instagramController,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Twitter / X',
                hintText: 'https://x.com/yourgym',
                controller: _twitterController,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'YouTube',
                hintText: 'https://youtube.com/@yourgym',
                controller: _youtubeController,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'LinkedIn',
                hintText: 'https://linkedin.com/company/yourgym',
                controller: _linkedinController,
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save changes',
                loading: _saving,
                onPressed: _save,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
