import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/notification_template.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "17a. Notification templates" — the 10 system templates,
/// tenant overrides merged in. Tapping one opens frame "17b. Edit template"
/// (`NotificationTemplateFormScreen`).
class NotificationTemplatesScreen extends StatefulWidget {
  const NotificationTemplatesScreen({super.key});

  @override
  State<NotificationTemplatesScreen> createState() =>
      _NotificationTemplatesScreenState();
}

class _NotificationTemplatesScreenState
    extends State<NotificationTemplatesScreen> {
  List<NotificationTemplate>? _templates;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final templates =
          await getIt<TenantNotificationRepository>().listTemplates();
      if (!mounted) return;
      setState(() => _templates = templates);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final templates = _templates;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text('Notification Templates', style: AppText.display(size: 18)),
      ),
      body: SafeArea(
        top: false,
        child: templates == null
            ? _error != null
                ? AppErrorView(message: _error!, onRetry: _load)
                : const AppLoadingView()
            : ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                children: [
                  for (final t in templates)
                    _TemplateTile(
                      template: t,
                      onTap: () => context
                          .push(AppRoutes.editNotificationTemplate, extra: t)
                          .then((_) => _load()),
                    ),
                ],
              ),
      ),
    );
  }
}

class _TemplateTile extends StatelessWidget {
  const _TemplateTile({required this.template, required this.onTap});

  final NotificationTemplate template;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      template.label,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    Text(
                      '${template.channels.join(' + ')} · '
                      '${template.isActive ? 'Active' : 'Inactive'}'
                      '${template.isCustomized ? '' : ' · Default'}',
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
