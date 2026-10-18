import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../models/branch_option.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'announcement_rich_text.dart';
import 'announcement_ui.dart';

/// New / edit announcement — web's announcement dialog as a full page.
///
/// Same fields and rules as web: Title and Body (formatted text: bold,
/// italic, underline, bullets, links — stored as the same HTML web renders),
/// Audience (Everyone / Members only / Staff only), Branch (optional) and
/// "Expires on" (optional), with a live preview of the card. Saving creates a
/// DRAFT ("Save as draft") or, when editing a draft / scheduled one, updates
/// it ("Save changes", `PATCH`). "Title and body are required." is web's
/// validation text. The branch and expiry are sent like web: only when set;
/// `expiresAt` as a plain `YYYY-MM-DD` day.
///
/// This app's create flow has always offered "Publish now" and "Schedule…"
/// straight from the form (create the draft, then publish it / open the
/// schedule screen); that is kept, and — like web's Publish / Schedule
/// actions — needs `announcements:publish`. Pass [editing] to edit; the screen
/// pops `true` after a change so the list reloads.
class AnnouncementFormScreen extends StatefulWidget {
  const AnnouncementFormScreen({super.key, this.editing});

  final Announcement? editing;

  @override
  State<AnnouncementFormScreen> createState() => _AnnouncementFormScreenState();
}

enum _Busy { none, save, publish, schedule }

class _AnnouncementFormScreenState extends State<AnnouncementFormScreen> {
  late final AnnouncementAccess _access;
  final _title = TextEditingController();
  final _body = AnnouncementTextController();
  final _branchText = TextEditingController();
  AnnouncementAudience _audience = AnnouncementAudience.all;
  String? _branchId;
  DateTime? _expires;
  List<BranchOption> _branches = [];
  _Busy _busy = _Busy.none;
  String? _error;

  bool get _editing => widget.editing != null;
  bool get _saving => _busy != _Busy.none;

  @override
  void initState() {
    super.initState();
    _access = AnnouncementAccess.of(context);
    final e = widget.editing;
    if (e != null) {
      _title.text = e.title;
      _body.text = AnnouncementMarkup.fromHtml(e.body);
      _audience = e.audience;
      _branchId = e.branchId;
      _branchText.text = e.branchName ?? '';
      final x = e.expiresAt;
      // `expiresAt` is a date column: keep its calendar day.
      if (x != null) {
        _expires = x.isUtc
            ? DateTime(x.year, x.month, x.day)
            : DateTime(x.toLocal().year, x.toLocal().month, x.toLocal().day);
      }
    }
    for (final c in [_title, _body]) {
      c.addListener(() {
        if (mounted) setState(() {});
      });
    }
    _loadBranches();
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _branchText.dispose();
    super.dispose();
  }

  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (mounted) setState(() => _branches = b);
    } catch (_) {
      // Optional field: without the list the branch picker offers nothing.
    }
  }

  Future<void> _pickBranch() async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    setState(() {
      _branchId = v.isEmpty ? null : v;
      _branchText.text = v.isEmpty
          ? ''
          : _branches
              .firstWhere(
                (b) => b.id == v,
                orElse: () => BranchOption(id: v, name: 'Branch'),
              )
              .name;
    });
  }

  /// Validates and saves; returns the saved announcement, or null after
  /// showing the error.
  Future<Announcement?> _persist(_Busy kind) async {
    if (_saving) return null;
    final title = _title.text.trim();
    if (title.isEmpty || AnnouncementMarkup.isBlank(_body.text)) {
      setState(() => _error = 'Title and body are required.');
      return null;
    }
    setState(() {
      _busy = kind;
      _error = null;
    });
    try {
      final repo = getIt<AnnouncementRepository>();
      final html = AnnouncementMarkup.toHtml(_body.text);
      final expires = _expires == null ? null : isoDate(_expires!);
      return _editing
          ? await repo.update(
              widget.editing!.id,
              title: title,
              body: html,
              audience: _audience,
              branchId: _branchId,
              expiresAt: expires,
            )
          : await repo.create(
              title: title,
              body: html,
              audience: _audience,
              branchId: _branchId,
              expiresAt: expires,
            );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not save the announcement ($e)');
      }
    }
    if (mounted) setState(() => _busy = _Busy.none);
    return null;
  }

  Future<void> _saveDraft() async {
    final saved = await _persist(_Busy.save);
    if (saved == null || !mounted) return;
    teamSnack(
        context, _editing ? 'Announcement updated.' : 'Announcement drafted.',);
    context.pop(true);
  }

  Future<void> _publishNow() async {
    final saved = await _persist(_Busy.publish);
    if (saved == null || !mounted) return;
    try {
      await getIt<AnnouncementRepository>().publish(saved.id);
      if (!mounted) return;
      teamSnack(context, 'Announcement published.');
      context.pop(true);
    } on ApiException catch (e) {
      // The draft exists now; say so and leave the form to retry.
      if (mounted) {
        setState(() {
          _busy = _Busy.none;
          _error =
              'Saved as a draft, but publishing failed: ${e.detailedMessage}';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = _Busy.none;
          _error = 'Saved as a draft, but publishing failed ($e)';
        });
      }
    }
  }

  Future<void> _scheduleNext() async {
    final saved = await _persist(_Busy.schedule);
    if (saved == null || !mounted) return;
    setState(() => _busy = _Busy.none);
    await context.push<bool>(AppRoutes.scheduleAnnouncement, extra: saved);
    if (!mounted) return;
    // The draft exists either way, so the list should reload.
    context.pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final form = _form();
    final side = _side();
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(_editing ? 'Edit announcement' : 'New announcement'),
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
                          Expanded(flex: 2, child: side),
                        ],
                      )
                    else ...[
                      form,
                      const SizedBox(height: 14),
                      side,
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
                Icons.campaign_rounded,
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
                    _editing ? 'Edit announcement' : 'New announcement',
                    style: AppText.display(size: 22, color: Colors.white),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Write the announcement, choose who sees it and '
                    'optionally when it expires.',
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TeamHeroPill(
                    _editing ? 'Communication · Edit' : 'Communication · New',
                    icon: Icons.campaign_rounded,
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
          icon: Icons.edit_note_rounded,
          color: TeamColors.fuchsia,
          title: 'Message',
          children: [
            AppLabeledField(
              label: 'Title',
              hintText: 'e.g. Pool closed for maintenance',
              icon: Icons.title_rounded,
              iconColor: TeamColors.fuchsia,
              controller: _title,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.next,
            ),
            Text(
              'BODY',
              style: AppText.eyebrow(),
            ),
            AnnouncementEditor(
              controller: _body,
              enabled: !_saving,
            ),
            Text(
              'Format with the toolbar: **bold**, *italic*, ++underline++, '
              '- bullet lines and [links](https://…).',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.groups_rounded,
          color: TeamColors.teal,
          title: 'Audience',
          children: [
            for (final a in AnnouncementAudience.values)
              TeamChoiceCard(
                title: audienceLabel(a),
                description: audienceHint(a),
                icon: audienceIcon(a),
                color: audienceColor(a),
                selected: _audience == a,
                onTap: _saving ? null : () => setState(() => _audience = a),
              ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.tune_rounded,
          color: TeamColors.amber,
          title: 'Targeting & expiry',
          subtitle: 'Both optional',
          children: [
            AppLabeledField(
              label: 'Branch (optional)',
              hintText: 'All branches',
              icon: Icons.storefront_rounded,
              iconColor: TeamColors.amber,
              controller: _branchText,
              readOnly: true,
              onTap: _saving ? null : _pickBranch,
              suffixIcon: const Icon(Icons.arrow_drop_down_rounded),
            ),
            TeamDateField(
              label: 'Expires on (optional)',
              icon: Icons.hourglass_bottom_rounded,
              iconColor: TeamColors.rose,
              value: _expires,
              firstDate: DateTime(2020),
              lastDate: DateTime(DateTime.now().year + 5),
              onChanged: (d) => setState(() => _expires = d),
            ),
          ],
        ),
      ],
    );
  }

  /// Web's live preview, then the actions.
  Widget _side() {
    final title = _title.text.trim();
    final blank = AnnouncementMarkup.isBlank(_body.text);
    final e = _expires;
    return TeamSectionCard(
      icon: Icons.visibility_rounded,
      color: TeamColors.violet,
      title: 'Live preview',
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              clipBehavior: Clip.antiAlias,
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(width: 6, color: TeamColors.slate),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: [
                                const TeamTag(
                                  label: 'Draft',
                                  color: TeamColors.slate,
                                ),
                                TeamTag(
                                  label: audienceShort(_audience),
                                  color: audienceColor(_audience),
                                  icon: audienceIcon(_audience),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              title.isEmpty ? 'Your title appears here' : title,
                              style: AppText.display(
                                size: 16,
                                color: title.isEmpty
                                    ? AppColors.inkFaint
                                    : AppColors.ink,
                              ),
                            ),
                            const SizedBox(height: 6),
                            if (blank)
                              Text(
                                'Your message appears here.',
                                style: AppText.body(
                                  size: 13,
                                  color: AppColors.inkFaint,
                                ),
                              )
                            else
                              AnnouncementBody(
                                html: AnnouncementMarkup.toHtml(_body.text),
                              ),
                            if (e != null) ...[
                              const SizedBox(height: 8),
                              Text(
                                'Expires ${annDay(e)}',
                                style: AppText.body(
                                  size: 11.5,
                                  color: AppColors.inkFaint,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            TeamGradientButton(
              label: _editing ? 'Save changes' : 'Save as draft',
              icon: Icons.check_rounded,
              loading: _busy == _Busy.save,
              onTap: _saving ? null : _saveDraft,
            ),
            if (!_editing && _access.canPublish) ...[
              const SizedBox(height: 10),
              TeamOutlineButton(
                label: 'Save & publish now',
                icon: Icons.send_rounded,
                onTap: _saving ? null : _publishNow,
              ),
              const SizedBox(height: 8),
              TeamOutlineButton(
                label: 'Save & schedule…',
                icon: Icons.event_rounded,
                onTap: _saving ? null : _scheduleNext,
              ),
            ],
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
