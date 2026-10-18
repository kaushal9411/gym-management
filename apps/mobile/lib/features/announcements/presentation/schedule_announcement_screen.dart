import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'announcement_ui.dart';

enum _Preset { hour, tomorrow, custom }

/// Schedule an announcement — web's "Schedule announcement" dialog as a page
/// (`POST /tenant-announcements/:id/schedule`, perm `announcements:publish`).
///
/// Same as web: quick presets (In 1 hour, Tomorrow 9am, Custom), a "Publish
/// at" date and time, "Pick a future date and time." validation, and a
/// "Goes out Sat, 18 Oct, 3:30 pm · in 1h 20m" confirmation line. The chosen
/// local time is sent as a UTC instant (`toUtc()`), so it means the same
/// moment on the server. Pops `true` after scheduling.
class ScheduleAnnouncementScreen extends StatefulWidget {
  const ScheduleAnnouncementScreen({super.key, required this.announcement});

  final Announcement announcement;

  @override
  State<ScheduleAnnouncementScreen> createState() =>
      _ScheduleAnnouncementScreenState();
}

class _ScheduleAnnouncementScreenState
    extends State<ScheduleAnnouncementScreen> {
  _Preset _preset = _Preset.custom;
  DateTime? _publishAt;
  final _dateText = TextEditingController();
  final _timeText = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _dateText.dispose();
    _timeText.dispose();
    super.dispose();
  }

  DateTime _presetValue(_Preset p) {
    final n = DateTime.now();
    return switch (p) {
      _Preset.hour => DateTime(n.year, n.month, n.day, n.hour + 1, n.minute),
      _Preset.tomorrow => DateTime(n.year, n.month, n.day + 1, 9),
      _Preset.custom => n,
    };
  }

  String _dateLabel(DateTime d) => annDay(d);

  String _timeLabel(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'pm' : 'am'}';
  }

  void _set(DateTime? d) {
    _publishAt = d;
    _dateText.text = d == null ? '' : _dateLabel(d);
    _timeText.text = d == null ? '' : _timeLabel(d);
  }

  void _pick(_Preset p) {
    setState(() {
      _preset = p;
      _error = null;
      if (p != _Preset.custom) _set(_presetValue(p));
    });
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final cur = _publishAt ?? now;
    final d = await showDatePicker(
      context: context,
      initialDate: cur.isBefore(now) ? now : cur,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: DateTime(now.year + 2),
    );
    if (d == null) return;
    setState(() {
      _preset = _Preset.custom;
      _error = null;
      _set(DateTime(d.year, d.month, d.day, cur.hour, cur.minute));
    });
  }

  Future<void> _pickTime() async {
    final cur = _publishAt ?? DateTime.now();
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: cur.hour, minute: cur.minute),
    );
    if (t == null) return;
    setState(() {
      _preset = _Preset.custom;
      _error = null;
      _set(DateTime(cur.year, cur.month, cur.day, t.hour, t.minute));
    });
  }

  bool get _valid {
    final p = _publishAt;
    return p != null && p.isAfter(DateTime.now());
  }

  Future<void> _submit() async {
    if (_saving) return;
    if (!_valid) {
      setState(() => _error = 'Pick a future date and time.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<AnnouncementRepository>().schedule(
        widget.announcement.id,
        _publishAt!,
      );
      if (!mounted) return;
      teamSnack(context, 'Announcement scheduled.');
      context.pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not schedule ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final p = _publishAt;
    const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Schedule announcement'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MeshHeroBackground(
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
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.35),
                        ),
                      ),
                      child: const Icon(
                        Icons.event_available_rounded,
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
                            '“${widget.announcement.title}”',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style:
                                AppText.display(size: 20, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Choose when this announcement is published.',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w600,
                              color: Colors.white.withValues(alpha: 0.88),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            TeamCenter(
              maxWidth: 640,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    TeamFormSection(
                      icon: Icons.schedule_rounded,
                      color: TeamColors.amber,
                      title: 'Publish at',
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            TeamFilterChip(
                              label: 'In 1 hour',
                              selected: _preset == _Preset.hour,
                              color: TeamColors.amber,
                              onTap: () => _pick(_Preset.hour),
                            ),
                            TeamFilterChip(
                              label: 'Tomorrow 9am',
                              selected: _preset == _Preset.tomorrow,
                              color: TeamColors.amber,
                              onTap: () => _pick(_Preset.tomorrow),
                            ),
                            TeamFilterChip(
                              label: 'Custom',
                              selected: _preset == _Preset.custom,
                              color: TeamColors.amber,
                              onTap: () => _pick(_Preset.custom),
                            ),
                          ],
                        ),
                        AppLabeledField(
                          label: 'Date',
                          hintText: 'Pick a date',
                          icon: Icons.event_rounded,
                          iconColor: TeamColors.indigo,
                          controller: _dateText,
                          readOnly: true,
                          onTap: _saving ? null : _pickDate,
                        ),
                        AppLabeledField(
                          label: 'Time',
                          hintText: 'Pick a time',
                          icon: Icons.access_time_rounded,
                          iconColor: TeamColors.violet,
                          controller: _timeText,
                          readOnly: true,
                          onTap: _saving ? null : _pickTime,
                        ),
                        if (_valid)
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: TeamColors.indigo.withValues(alpha: 0.12),
                              borderRadius:
                                  BorderRadius.circular(AppRadii.card),
                            ),
                            child: Text(
                              'Goes out ${wd[p!.weekday - 1]}, ${annDateTime(p)} · '
                              '${annRelative(p, DateTime.now())}',
                              style: AppText.body(
                                size: 13,
                                weight: FontWeight.w800,
                                color: TeamColors.indigo,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    TeamGradientButton(
                      label: 'Schedule',
                      icon: Icons.event_available_rounded,
                      loading: _saving,
                      onTap: _submit,
                    ),
                    const SizedBox(height: 8),
                    TextButton(
                      onPressed: _saving ? null : () => context.pop(),
                      child: const Text('Cancel'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
