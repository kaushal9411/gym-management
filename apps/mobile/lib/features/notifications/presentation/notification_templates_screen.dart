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
import '../../../shared/widgets/list_hero.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'notification_ui.dart';

/// Web's `NOTIFICATION_CHANNELS` order: In-app, Email, Push, SMS, WhatsApp.
const kTemplateChannels = <(String, String, IconData)>[
  ('IN_APP', 'In-app', Icons.notifications_active_outlined),
  ('EMAIL', 'Email', Icons.mail_outline_rounded),
  ('PUSH', 'Push', Icons.smartphone_rounded),
  ('SMS', 'SMS', Icons.sms_outlined),
  ('WHATSAPP', 'WhatsApp', Icons.chat_outlined),
];

class _Group {
  const _Group(this.label, this.description, this.color, this.icon, this.types);

  final String label;
  final String description;
  final Color color;
  final IconData icon;
  final List<String> types;
}

/// Web's template groups (`notifications/settings/page.tsx`).
const _groups = <_Group>[
  _Group(
    'Membership',
    'Expiry reminders and renewals',
    TeamColors.indigo,
    Icons.how_to_reg_rounded,
    ['MEMBERSHIP_EXPIRY', 'MEMBERSHIP_RENEWAL'],
  ),
  _Group(
    'Payments',
    'Payment outcomes and reminders',
    TeamColors.green,
    Icons.credit_card_rounded,
    [
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'PAYMENT_OVERDUE',
      'INVOICE_DUE_SOON',
    ],
  ),
  _Group(
    'Attendance',
    'Check-ins and class reminders',
    TeamColors.teal,
    Icons.event_available_rounded,
    [
      'ATTENDANCE_CONFIRMATION',
      'CLASS_REMINDER',
      'CLASS_SCHEDULED_OR_CHANGED',
    ],
  ),
  _Group(
    'Plans',
    'Workout and diet assignments',
    TeamColors.amber,
    Icons.fitness_center_rounded,
    ['WORKOUT_ASSIGNMENT', 'DIET_ASSIGNMENT'],
  ),
  _Group(
    'Engagement',
    'Welcome and goodwill messages',
    TeamColors.fuchsia,
    Icons.volunteer_activism_rounded,
    [
      'NEW_MEMBER_REGISTRATION',
      'WELCOME_MESSAGE',
      'BIRTHDAY_WISHES',
      'WE_MISS_YOU',
    ],
  ),
];

/// Notification settings — web's `/notifications/settings`: the automatic
/// notification templates, grouped (Membership, Payments, Attendance, Plans,
/// Engagement), each with its title / body preview (`{{placeholders}}` shown
/// as chips), the delivery channels, an Active switch and Edit
/// (`GET` / `PATCH /notifications/templates`).
///
/// Needs `notifications:manage` — the key web's page and every template route
/// use. Without it the screen shows web's "managed by admins" state and makes
/// no request. The Owner menu's "Notification Templates" tile and this route
/// are unchanged; the Settings tab only appears with the key.
///
/// The Active switch saves immediately (`PATCH` with the template's current
/// fields) and updates from the server's response — no optimistic change.
/// **Dropped vs web**: nothing.
class NotificationTemplatesScreen extends StatefulWidget {
  const NotificationTemplatesScreen({super.key});

  @override
  State<NotificationTemplatesScreen> createState() =>
      _NotificationTemplatesScreenState();
}

class _NotificationTemplatesScreenState
    extends State<NotificationTemplatesScreen> {
  late final NotificationAccess _access;
  List<NotificationTemplate>? _templates;
  String? _error;
  String? _toggling;

  @override
  void initState() {
    super.initState();
    _access = NotificationAccess.of(context);
    if (_access.canManage) _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final t = await getIt<TenantNotificationRepository>().listTemplates();
      if (mounted) setState(() => _templates = t);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not load templates ($e)');
    }
  }

  Future<void> _toggle(NotificationTemplate t) async {
    if (_toggling != null) return;
    setState(() => _toggling = t.type);
    try {
      final updated =
          await getIt<TenantNotificationRepository>().updateTemplate(
        t.type,
        channels: t.channels,
        titleTemplate: t.titleTemplate,
        bodyTemplate: t.bodyTemplate,
        isActive: !t.isActive,
      );
      if (!mounted) return;
      setState(() {
        _templates = [
          for (final x in _templates ?? const <NotificationTemplate>[])
            x.type == updated.type ? updated : x,
        ];
      });
      teamSnack(
        context,
        t.isActive ? '${t.label} disabled.' : '${t.label} enabled.',
      );
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (_) {
      if (mounted) {
        teamSnack(context, 'Could not update the template.', error: true);
      }
    } finally {
      if (mounted) setState(() => _toggling = null);
    }
  }

  Future<void> _edit(NotificationTemplate t) async {
    final saved = await context.push<bool>(
      AppRoutes.editNotificationTemplate,
      extra: t,
    );
    if (saved == true && mounted) {
      teamSnack(context, 'Template updated.');
      _load();
    }
  }

  Widget _hero(double top) {
    final list = _templates ?? const <NotificationTemplate>[];
    final channels = {
      for (final t in list)
        if (t.isActive) ...t.channels,
    }.length;
    return ListHero(
      title: 'Notification settings',
      subtitle: 'Customize the title, body and delivery channels of every '
          'automatic notification.',
      topInset: top,
      side: 18 + teamSideInset(context),
      leading: ListHeroButton(
        icon: Icons.arrow_back_rounded,
        onTap: () => context.pop(),
      ),
      chips: [
        if (_templates != null) ...[
          ListHeroChip(
            icon: Icons.toggle_on_rounded,
            label: '${list.where((t) => t.isActive).length} active',
          ),
          ListHeroChip(
            icon: Icons.edit_note_rounded,
            label: '${list.where((t) => t.isCustomized).length} customized',
          ),
          ListHeroChip(
            icon: Icons.hub_outlined,
            label: '$channels ${channels == 1 ? 'channel' : 'channels'} in use',
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top;
    if (!_access.canManage) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            _hero(top),
            Expanded(
              child: AppEmptyState(
                icon: Icons.lock_outline_rounded,
                title: 'Notification settings are managed by admins',
                message: "You don't have permission to manage notification "
                    'templates. Ask your gym owner for the '
                    'notifications:manage permission.',
              ),
            ),
          ],
        ),
      );
    }
    final list = _templates;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.staffB,
        backgroundColor: AppColors.surface2,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _hero(top)),
            SliverToBoxAdapter(
              child: TeamCenter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      NotificationTabs(
                        active: NotificationPage.settings,
                        access: _access,
                      ),
                      const SizedBox(height: 14),
                      if (_error != null)
                        SizedBox(
                          height: 240,
                          child: AppErrorView(message: _error!, onRetry: _load),
                        )
                      else if (list == null)
                        const SizedBox(height: 240, child: AppLoadingView())
                      else
                        ..._sections(list),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _sections(List<NotificationTemplate> list) {
    final byType = {for (final t in list) t.type: t};
    final grouped = {for (final g in _groups) ...g.types};
    final extra = list.where((t) => !grouped.contains(t.type)).toList();
    final out = <Widget>[];
    var i = 0;
    for (final g in _groups) {
      final items = [
        for (final type in g.types)
          if (byType[type] != null) byType[type]!,
      ];
      if (items.isEmpty) continue;
      out
        ..add(
          FadeUp(
            index: i++,
            child: _GroupCard(
              label: g.label,
              description: g.description,
              color: g.color,
              icon: g.icon,
              templates: items,
              toggling: _toggling,
              onToggle: _toggle,
              onEdit: _edit,
            ),
          ),
        )
        ..add(const SizedBox(height: 14));
    }
    if (extra.isNotEmpty) {
      out.add(
        _GroupCard(
          label: 'Other',
          description: '',
          color: TeamColors.violet,
          icon: Icons.notifications_rounded,
          templates: extra,
          toggling: _toggling,
          onToggle: _toggle,
          onEdit: _edit,
        ),
      );
    }
    return out;
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({
    required this.label,
    required this.description,
    required this.color,
    required this.icon,
    required this.templates,
    required this.toggling,
    required this.onToggle,
    required this.onEdit,
  });

  final String label;
  final String description;
  final Color color;
  final IconData icon;
  final List<NotificationTemplate> templates;
  final String? toggling;
  final ValueChanged<NotificationTemplate> onToggle;
  final ValueChanged<NotificationTemplate> onEdit;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color.withValues(alpha: 0.18), Colors.transparent],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 17, color: color),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: AppText.display(size: 15)),
                      if (description.isNotEmpty)
                        Text(
                          description,
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
            child: LayoutBuilder(
              builder: (context, c) {
                final cols = c.maxWidth >= 760 ? 2 : 1;
                const gap = 10.0;
                final w = (c.maxWidth - gap * (cols - 1)) / cols;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final t in templates)
                      SizedBox(
                        width: w,
                        child: _TemplateCard(
                          template: t,
                          color: color,
                          toggling: toggling == t.type,
                          onToggle: () => onToggle(t),
                          onEdit: () => onEdit(t),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// `{{placeholder}}` tokens shown as tinted code chips inside a preview.
class TemplatePreviewText extends StatelessWidget {
  const TemplatePreviewText(
    this.text, {
    super.key,
    required this.style,
    this.maxLines,
  });

  final String text;
  final TextStyle style;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in RegExp(r'\{\{[^}]+\}\}').allMatches(text)) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      spans.add(
        TextSpan(
          text: m.group(0),
          style: style.copyWith(
            color: TeamColors.violet,
            fontWeight: FontWeight.w800,
            backgroundColor: TeamColors.violet.withValues(alpha: 0.14),
          ),
        ),
      );
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return Text.rich(
      TextSpan(children: spans, style: style),
      maxLines: maxLines,
      overflow: maxLines == null ? TextOverflow.clip : TextOverflow.ellipsis,
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({
    required this.template,
    required this.color,
    required this.toggling,
    required this.onToggle,
    required this.onEdit,
  });

  final NotificationTemplate template;
  final Color color;
  final bool toggling;
  final VoidCallback onToggle;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final t = template;
    final accent = t.isActive ? color : AppColors.line;
    return Opacity(
      opacity: t.isActive ? 1 : 0.85,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(height: 4, color: accent),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 6,
                              runSpacing: 4,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  t.label,
                                  style: AppText.body(
                                    size: 14.5,
                                    weight: FontWeight.w800,
                                  ),
                                ),
                                if (t.isCustomized)
                                  TeamTag(
                                    label: 'Customized',
                                    color: color,
                                    icon: Icons.edit_rounded,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 2),
                            Text(
                              t.description,
                              style: AppText.body(
                                size: 11.5,
                                color: AppColors.inkFaint,
                                weight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        children: [
                          Semantics(
                            label: '${t.label} active',
                            toggled: t.isActive,
                            child: Switch(
                              value: t.isActive,
                              activeThumbColor: Colors.white,
                              activeTrackColor: TeamColors.violet,
                              onChanged: toggling ? null : (_) => onToggle(),
                            ),
                          ),
                          Text(
                            t.isActive ? 'Active' : 'Disabled',
                            style: AppText.body(
                              size: 11,
                              weight: FontWeight.w800,
                              color: t.isActive
                                  ? TeamColors.green
                                  : AppColors.inkFaint,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.surface3,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TemplatePreviewText(
                          t.titleTemplate,
                          style:
                              AppText.body(size: 12.5, weight: FontWeight.w800),
                        ),
                        const SizedBox(height: 4),
                        TemplatePreviewText(
                          t.bodyTemplate,
                          maxLines: 3,
                          style: AppText.body(
                            size: 11.5,
                            color: AppColors.inkSoft,
                            weight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: Wrap(
                          spacing: 5,
                          runSpacing: 5,
                          children: [
                            for (final c in kTemplateChannels)
                              _ChannelPill(
                                label: c.$2,
                                icon: c.$3,
                                on: t.channels.contains(c.$1),
                                color: color,
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: onEdit,
                        icon: const Icon(Icons.edit_rounded, size: 15),
                        label: const Text('Edit'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.ink,
                          side: BorderSide(color: AppColors.line),
                          visualDensity: VisualDensity.compact,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChannelPill extends StatelessWidget {
  const _ChannelPill({
    required this.label,
    required this.icon,
    required this.on,
    required this.color,
  });

  final String label;
  final IconData icon;
  final bool on;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: on ? '$label enabled' : '$label off',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: on ? color.withValues(alpha: 0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(
            color: on ? Colors.transparent : AppColors.line,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: on ? color : AppColors.inkFaint),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w700,
                color: on ? color : AppColors.inkFaint,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
