import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
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
  bool _publishingNow = false;
  bool _schedulingNext = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  /// Creates the draft, then either publishes it immediately or hands it
  /// off to frame "15b. Schedule Announcement" — the design's two CTAs
  /// map to the same draft, diverging only after it exists.
  Future<void> _submit({required bool publishNow}) async {
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
      if (publishNow) {
        _publishingNow = true;
      } else {
        _schedulingNext = true;
      }
      _error = null;
    });
    try {
      final repo = getIt<AnnouncementRepository>();
      final created = await repo.create(
        title: title,
        body: body,
        audience: _audience,
      );
      if (publishNow) {
        await repo.publish(created.id);
        if (!mounted) return;
        context.pop();
      } else {
        if (!mounted) return;
        await context.push(
          AppRoutes.scheduleAnnouncement,
          extra: created,
        );
        if (!mounted) return;
        context.pop();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) {
        setState(() {
          _publishingNow = false;
          _schedulingNext = false;
        });
      }
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
                hintText: 'e.g. Holiday hours this weekend',
                controller: _titleController,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Message',
                hintText: 'Write your announcement…',
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
              Row(
                children: [
                  Expanded(
                    child: AppButton(
                      label: 'Schedule',
                      variant: AppButtonVariant.ghost,
                      loading: _schedulingNext,
                      onPressed: _publishingNow
                          ? null
                          : () => _submit(publishNow: false),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: AppButton(
                      label: 'Publish now',
                      loading: _publishingNow,
                      onPressed: _schedulingNext
                          ? null
                          : () => _submit(publishNow: true),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
