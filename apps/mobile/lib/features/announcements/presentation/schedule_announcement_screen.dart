import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/announcement.dart';
import '../../../repositories/announcement_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "15b. Schedule Announcement" — `POST
/// /tenant-announcements/:id/schedule`, called on an already-created draft
/// (see `AnnouncementFormScreen`'s "Schedule" button).
class ScheduleAnnouncementScreen extends StatefulWidget {
  const ScheduleAnnouncementScreen({super.key, required this.announcement});

  final Announcement announcement;

  @override
  State<ScheduleAnnouncementScreen> createState() =>
      _ScheduleAnnouncementScreenState();
}

class _ScheduleAnnouncementScreenState
    extends State<ScheduleAnnouncementScreen> {
  DateTime _date = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _time = const TimeOfDay(hour: 9, minute: 0);
  late final _dateController = TextEditingController(text: _formatDate(_date));
  late final _timeController =
      TextEditingController(text: _time.format(context));
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _dateController.dispose();
    _timeController.dispose();
    super.dispose();
  }

  static String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _date = picked;
        _dateController.text = _formatDate(picked);
      });
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time);
    if (picked != null) {
      setState(() {
        _time = picked;
        _timeController.text = picked.format(context);
      });
    }
  }

  Future<void> _confirm() async {
    final publishAt = DateTime(
      _date.year,
      _date.month,
      _date.day,
      _time.hour,
      _time.minute,
    );
    if (!publishAt.isAfter(DateTime.now())) {
      setState(() => _error = 'Pick a time in the future');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<AnnouncementRepository>()
          .schedule(widget.announcement.id, publishAt);
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Schedule Announcement', style: AppText.display(size: 18)),
            Text(widget.announcement.title, style: AppText.eyebrow()),
          ],
        ),
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
                label: 'Publish date',
                controller: _dateController,
                readOnly: true,
                onTap: _pickDate,
              ),
              const SizedBox(height: 14),
              AppLabeledField(
                label: 'Publish time',
                controller: _timeController,
                readOnly: true,
                onTap: _pickTime,
              ),
              const SizedBox(height: 16),
              AppCard(
                child: Text(
                  'This announcement stays a draft until the scheduled '
                  'time, then publishes automatically.',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w700,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Confirm schedule',
                loading: _saving,
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
