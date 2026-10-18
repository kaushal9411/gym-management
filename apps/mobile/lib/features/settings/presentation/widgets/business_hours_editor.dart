import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/business_hours.dart';
import '../../../team/presentation/widgets/team_ui.dart';

const _dayLabels = {
  'monday': 'Monday',
  'tuesday': 'Tuesday',
  'wednesday': 'Wednesday',
  'thursday': 'Thursday',
  'friday': 'Friday',
  'saturday': 'Saturday',
  'sunday': 'Sunday',
};

/// What the editor shows (and the chart counts) for a day with no saved entry
/// — web's own default, so the editor, the chart and a save all agree.
const kDefaultHoursDay = BusinessHoursDay(open: '06:00', close: '22:00');

BusinessHoursDay dayOf(BusinessHours h, String day) =>
    h[day] ?? kDefaultHoursDay;

/// Web's `BusinessHoursEditor`: one row per weekday with an open / close time
/// (24-hour `HH:MM`, as the API stores them) and a "Closed" switch.
class BusinessHoursEditor extends StatelessWidget {
  const BusinessHoursEditor({
    super.key,
    required this.value,
    required this.onChanged,
    this.disabled = false,
  });

  final BusinessHours value;
  final ValueChanged<BusinessHours> onChanged;
  final bool disabled;

  Future<void> _pick(
    BuildContext context,
    String day,
    bool opening,
  ) async {
    final cur = dayOf(value, day);
    final text =
        (opening ? cur.open : cur.close) ?? (opening ? '06:00' : '22:00');
    final parts = text.split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(parts.first) ?? 6,
        minute: parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0,
      ),
    );
    if (t == null) return;
    final hhmm = '${t.hour.toString().padLeft(2, '0')}:'
        '${t.minute.toString().padLeft(2, '0')}';
    onChanged(
      value.withDay(
        day,
        opening ? cur.copyWith(open: hhmm) : cur.copyWith(close: hhmm),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final day in kWeekdays)
          Builder(
            builder: (context) {
              final d = dayOf(value, day);
              Widget time(String label, String? v, bool opening) => Expanded(
                    child: Semantics(
                      button: true,
                      label: '${_dayLabels[day]} $label time',
                      child: GestureDetector(
                        onTap: (disabled || d.closed)
                            ? null
                            : () => _pick(context, day, opening),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: AppColors.surface3,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            d.closed ? '—' : (v ?? '--:--'),
                            style: AppText.tabular(
                              size: 13.5,
                              weight: FontWeight.w800,
                              color:
                                  d.closed ? AppColors.inkFaint : AppColors.ink,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.fromLTRB(12, 8, 6, 8),
                decoration: BoxDecoration(
                  color: d.closed
                      ? TeamColors.slate.withValues(alpha: 0.08)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  children: [
                    SizedBox(
                      width: 84,
                      child: Text(
                        _dayLabels[day]!,
                        style: AppText.body(size: 13, weight: FontWeight.w800),
                      ),
                    ),
                    time('opening', d.open, true),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Text(
                        'to',
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    time('closing', d.close, false),
                    const SizedBox(width: 6),
                    Column(
                      children: [
                        Switch(
                          value: d.closed,
                          activeThumbColor: Colors.white,
                          activeTrackColor: TeamColors.slate,
                          onChanged: disabled
                              ? null
                              : (v) => onChanged(
                                    value.withDay(day, d.copyWith(closed: v)),
                                  ),
                        ),
                        Text(
                          'Closed',
                          style: AppText.body(
                            size: 10,
                            color: AppColors.inkFaint,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}
