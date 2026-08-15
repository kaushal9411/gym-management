import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';

const _dayLabels = {
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
};

/// Design frame "8c. Operating hours" — per-weekday open/close/closed,
/// `PATCH /branches/:id` scoped to `operatingHours`.
class BranchHoursScreen extends StatefulWidget {
  const BranchHoursScreen({super.key, required this.branch});

  final Branch branch;

  @override
  State<BranchHoursScreen> createState() => _BranchHoursScreenState();
}

class _BranchHoursScreenState extends State<BranchHoursScreen> {
  late final Map<String, DayHours> _hours = {
    for (final day in branchWeekdays)
      day: widget.branch.operatingHours[day] ?? const DayHours(),
  };
  bool _saving = false;
  String? _error;

  Future<void> _pickTime(String day, {required bool isOpen}) async {
    final current = _hours[day]!;
    final initial = _parseTime(isOpen ? current.open : current.close) ??
        const TimeOfDay(hour: 6, minute: 0);
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked == null) return;
    final formatted =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    setState(() {
      _hours[day] = DayHours(
        open: isOpen ? formatted : current.open,
        close: isOpen ? current.close : formatted,
        closed: current.closed,
      );
    });
  }

  TimeOfDay? _parseTime(String? value) {
    if (value == null) return null;
    final parts = value.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return TimeOfDay(hour: h, minute: m);
  }

  void _toggleClosed(String day) {
    final current = _hours[day]!;
    setState(() {
      _hours[day] = DayHours(
        open: current.open,
        close: current.close,
        closed: !current.closed,
      );
    });
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BranchRepository>()
          .updateOperatingHours(widget.branch.id, _hours);
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
            Text('Operating Hours', style: AppText.display(size: 18)),
            Text(widget.branch.name, style: AppText.eyebrow()),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          children: [
            if (_error != null) ...[
              FormAlert(message: _error!),
              const SizedBox(height: 12),
            ],
            for (final day in branchWeekdays)
              _DayRow(
                label: _dayLabels[day]!,
                hours: _hours[day]!,
                onTapOpen: () => _pickTime(day, isOpen: true),
                onTapClose: () => _pickTime(day, isOpen: false),
                onToggleClosed: () => _toggleClosed(day),
              ),
            const SizedBox(height: 20),
            AppButton(label: 'Save hours', loading: _saving, onPressed: _save),
          ],
        ),
      ),
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.label,
    required this.hours,
    required this.onTapOpen,
    required this.onTapClose,
    required this.onToggleClosed,
  });

  final String label;
  final DayHours hours;
  final VoidCallback onTapOpen;
  final VoidCallback onTapClose;
  final VoidCallback onToggleClosed;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: Text(
              label,
              style: AppText.body(size: 13, weight: FontWeight.w700),
            ),
          ),
          if (hours.closed)
            Expanded(
              child: Text(
                'Closed',
                textAlign: TextAlign.center,
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
            )
          else
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _TimeChip(label: hours.open ?? '—', onTap: onTapOpen),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: Text('–',
                        style: AppText.body(color: AppColors.inkFaint)),
                  ),
                  _TimeChip(label: hours.close ?? '—', onTap: onTapClose),
                ],
              ),
            ),
          GestureDetector(
            onTap: onToggleClosed,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                gradient: hours.closed ? null : AppColors.staffGrad,
                color: hours.closed ? AppColors.surface3 : null,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Text(
                hours.closed ? 'Closed' : 'Open',
                style: AppText.body(
                  size: 10,
                  weight: FontWeight.w800,
                  color: hours.closed ? AppColors.inkSoft : Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimeChip extends StatelessWidget {
  const _TimeChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surface3,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          style: AppText.body(size: 12, weight: FontWeight.w700),
        ),
      ),
    );
  }
}
