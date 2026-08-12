import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';

class AnnouncementFormScreen extends StatefulWidget {
  const AnnouncementFormScreen({super.key});

  @override
  State<AnnouncementFormScreen> createState() => _AnnouncementFormScreenState();
}

class _AnnouncementFormScreenState extends State<AnnouncementFormScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  AnnouncementAudience _audience = AnnouncementAudience.all;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Give this announcement a title');
      return;
    }
    if (body.isEmpty) {
      setState(() => _error = 'Write the announcement body');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await getIt<AnnouncementRepository>().create(
        title: title,
        body: body,
        audience: _audience,
      );
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
        title: const Text('New Announcement'),
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
                label: 'Title',
                controller: _titleController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Message',
                controller: _bodyController,
                textInputAction: TextInputAction.newline,
              ),
              const SizedBox(height: 14),
              Text('Audience', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              CategoryChipSelector<AnnouncementAudience>(
                options: AnnouncementAudience.values,
                labelOf: (a) => a.label,
                value: _audience,
                onChanged: (a) => setState(() => _audience = a),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save as draft',
                loading: _loading,
                onPressed: _submit,
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
