import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/notification_template.dart';
import '../../../repositories/tenant_notification_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'notification_templates_screen.dart'
    show TemplatePreviewText, kTemplateChannels;

/// Edit one notification template — web's template edit dialog (title, body,
/// delivery channels, Active) as a full page. Saves with `PATCH
/// /notifications/templates/:type` (the whole thing is replaced, as web
/// does) and pops `true` so the settings page reloads. Placeholders like
/// `{{memberName}}` are filled in automatically when the notification is sent.
///
/// Keeps the app's existing "choose at least one channel" check (web has no
/// client validation; the API decides).
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
  void initState() {
    super.initState();
    for (final c in [_titleController, _bodyController]) {
      c.addListener(() {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
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
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not save the template ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final form = _form();
    final preview = _preview();
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Edit template'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _hero(top),
            TeamCenter(
              maxWidth: wide ? 1100 : 760,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    if (wide)
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(flex: 3, child: form),
                          const SizedBox(width: 16),
                          Expanded(flex: 2, child: preview),
                        ],
                      )
                    else ...[
                      form,
                      const SizedBox(height: 14),
                      preview,
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero(double top) {
    return MeshHeroBackground(
      radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          18 + teamSideInset(context),
          top + 4,
          18 + teamSideInset(context),
          22,
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
              ),
              child: const Icon(
                Icons.mark_email_unread_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.template.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Placeholders like {{memberName}} are filled in '
                    'automatically.',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const TeamHeroPill(
                    'Notification settings',
                    icon: Icons.settings_rounded,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _form() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamFormSection(
          icon: Icons.title_rounded,
          color: TeamColors.indigo,
          title: 'Title & body',
          children: [
            AppLabeledField(
              label: 'Title',
              icon: Icons.title_rounded,
              iconColor: TeamColors.indigo,
              controller: _titleController,
              textCapitalization: TextCapitalization.sentences,
            ),
            AppLabeledField(
              label: 'Body',
              icon: Icons.notes_rounded,
              iconColor: TeamColors.violet,
              controller: _bodyController,
              minLines: 4,
              maxLines: 8,
              textCapitalization: TextCapitalization.sentences,
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.hub_outlined,
          color: TeamColors.teal,
          title: 'Channels',
          subtitle: 'Where this notification is delivered',
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in kTemplateChannels)
                  FilterChip(
                    avatar: Icon(
                      c.$3,
                      size: 16,
                      color: _channels.contains(c.$1)
                          ? Colors.white
                          : AppColors.inkSoft,
                    ),
                    label: Text(c.$2),
                    selected: _channels.contains(c.$1),
                    showCheckmark: false,
                    selectedColor: TeamColors.teal,
                    backgroundColor: AppColors.surface3,
                    side: BorderSide.none,
                    labelStyle: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w800,
                      color: _channels.contains(c.$1)
                          ? Colors.white
                          : AppColors.inkSoft,
                    ),
                    onSelected: _saving
                        ? null
                        : (on) => setState(() {
                              on ? _channels.add(c.$1) : _channels.remove(c.$1);
                              _error = null;
                            }),
                  ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.toggle_on_rounded,
          color: TeamColors.green,
          title: 'Status',
          children: [
            TeamToggleRow(
              title: 'Active',
              subtitle: 'Turn off to stop sending this notification',
              icon: Icons.power_settings_new_rounded,
              color: TeamColors.green,
              value: _isActive,
              onChanged: _saving ? null : (v) => setState(() => _isActive = v),
            ),
          ],
        ),
      ],
    );
  }

  Widget _preview() {
    return TeamSectionCard(
      icon: Icons.visibility_rounded,
      color: TeamColors.violet,
      title: 'Preview',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surface3,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TemplatePreviewText(
                    _titleController.text,
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  TemplatePreviewText(
                    _bodyController.text,
                    style: AppText.body(
                      size: 12.5,
                      color: AppColors.inkSoft,
                      weight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            TeamGradientButton(
              label: 'Save template',
              icon: Icons.check_rounded,
              loading: _saving,
              onTap: _save,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _saving ? null : () => context.pop(),
              child: const Text('Cancel'),
            ),
          ],
        ),
      ),
    );
  }
}
