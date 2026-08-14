import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/notification_template.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

const _allChannels = ['IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WHATSAPP'];
const _channelLabels = {
  'IN_APP': 'In-app',
  'EMAIL': 'Email',
  'PUSH': 'Push',
  'SMS': 'SMS',
  'WHATSAPP': 'WhatsApp',
};

/// Design frame "17b. Edit template" — `PATCH
/// /notifications/templates/:type` always sends the full override (title +
/// body + channels + active), same "whole-thing replace" shape as
/// `updateSecuritySettings`.
class NotificationTemplateFormScreen extends StatefulWidget {
  const NotificationTemplateFormScreen({super.key, required this.template});

  final NotificationTemplate template;

  @override
  State<NotificationTemplateFormScreen> createState() =>
      _NotificationTemplateFormScreenState();
}

class _NotificationTemplateFormScreenState
    extends State<NotificationTemplateFormScreen> {
  late final _titleController =
      TextEditingController(text: widget.template.titleTemplate);
  late final _bodyController =
      TextEditingController(text: widget.template.bodyTemplate);
  late final Set<String> _channels = {...widget.template.channels};
  late bool _isActive = widget.template.isActive;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_channels.isEmpty) {
      setState(() => _error = 'Choose at least one channel');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<TenantNotificationRepository>().updateTemplate(
        widget.template.type,
        channels: _channels.toList(),
        titleTemplate: _titleController.text.trim(),
        bodyTemplate: _bodyController.text.trim(),
        isActive: _isActive,
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
        title: Text(widget.template.label),
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
              Text(
                widget.template.description,
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 14),
              Text('Channels', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _allChannels.map((c) {
                  final on = _channels.contains(c);
                  return GestureDetector(
                    onTap: () => setState(() {
                      on ? _channels.remove(c) : _channels.add(c);
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        gradient: on ? AppColors.staffGrad : null,
                        color: on ? null : AppColors.surface3,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        _channelLabels[c]!,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: on ? Colors.white : AppColors.inkSoft,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 14),
              AppLabeledField(label: 'Title', controller: _titleController),
              const SizedBox(height: 14),
              AppLabeledField(label: 'Body', controller: _bodyController),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Active',
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _isActive = !_isActive),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      width: 44,
                      height: 26,
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        gradient: _isActive ? AppColors.staffGrad : null,
                        color: _isActive ? null : AppColors.surface3,
                        borderRadius: BorderRadius.circular(99),
                      ),
                      alignment: _isActive
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        width: 20,
                        height: 20,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Save template',
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
