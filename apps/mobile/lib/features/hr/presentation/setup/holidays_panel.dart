import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../models/hr_leave.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import '../widgets/hr_form_kit.dart';
import '../widgets/hr_ui.dart';
import '../widgets/hr_widgets.dart';
import 'setup_ui.dart';

/// **Holidays** (`GET /hr/holidays?year=`, edit with `hr:leave_manage`): a year
/// stepper and the calendar grouped by month. Holidays are paid and are
/// skipped when leave days are counted. Add (date + name + optional note) and
/// remove; a holiday that belongs to one branch shows the branch name (the
/// branch scope itself is only set on the web, like the web form).
class HolidaysPanel extends StatelessWidget {
  const HolidaysPanel({
    super.key,
    required this.canEdit,
    required this.year,
    required this.onYear,
  });

  final bool canEdit;
  final int year;
  final ValueChanged<int> onYear;

  Future<void> _delete(BuildContext context, HrHoliday h) async {
    final cubit = context.read<HrLoadCubit<List<HrHoliday>>>();
    final ok = await hrConfirmSheet(
      context,
      title: 'Remove ${h.name}?',
      message: 'It stops counting as a paid holiday from now on. Existing '
          'leave requests keep their stored days.',
      confirmLabel: 'Remove holiday',
    );
    if (!ok || !context.mounted) return;
    try {
      await getIt<HrRepository>().deleteHoliday(h.id);
      if (!context.mounted) return;
      hrSnack(context, '${h.name} removed');
      cubit.load(silent: true);
    } on ApiException catch (e) {
      if (context.mounted) hrSnack(context, e.detailedMessage, error: true);
    }
  }

  Future<void> _add(BuildContext context) async {
    final cubit = context.read<HrLoadCubit<List<HrHoliday>>>();
    final changed = await showHolidaySheet(context, year: year);
    if (changed) cubit.load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _YearStepper(year: year, onChanged: onYear),
        const SizedBox(height: 12),
        if (canEdit)
          HrSetupAddButton(
            key: const Key('add-holiday'),
            label: 'Add holiday',
            onTap: () => _add(context),
          ),
        BlocBuilder<HrLoadCubit<List<HrHoliday>>, HrLoadState<List<HrHoliday>>>(
          builder: (context, state) => switch (state) {
            HrLoadLoading() => const HrSkeletonList(count: 3, height: 62),
            HrLoadError(:final message) => AppErrorView(
                message: message,
                onRetry: () =>
                    context.read<HrLoadCubit<List<HrHoliday>>>().load(),
              ),
            HrLoadLoaded(:final data) => data.isEmpty
                ? AppEmptyState(
                    title: 'No holidays in $year',
                    message: canEdit
                        ? 'Add public holidays so payroll and leave counting '
                            'stay accurate.'
                        : null,
                    icon: Icons.celebration_outlined,
                  )
                : _Grouped(
                    holidays: data,
                    canEdit: canEdit,
                    onDelete: (h) => _delete(context, h),
                  ),
          },
        ),
        if (!canEdit)
          const HrReadOnlyNote('You can view holidays but not change them.'),
      ],
    );
  }
}

class _YearStepper extends StatelessWidget {
  const _YearStepper({required this.year, required this.onChanged});

  final int year;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          IconButton(
            key: const Key('year-prev'),
            tooltip: 'Previous year',
            onPressed: () => onChanged(year - 1),
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Expanded(
            child: Semantics(
              liveRegion: true,
              child: Text(
                '$year',
                textAlign: TextAlign.center,
                style: AppText.display(size: 18),
              ),
            ),
          ),
          IconButton(
            key: const Key('year-next'),
            tooltip: 'Next year',
            onPressed: () => onChanged(year + 1),
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}

class _Grouped extends StatelessWidget {
  const _Grouped({
    required this.holidays,
    required this.canEdit,
    required this.onDelete,
  });

  final List<HrHoliday> holidays;
  final bool canEdit;
  final ValueChanged<HrHoliday> onDelete;

  @override
  Widget build(BuildContext context) {
    final byMonth = <int, List<HrHoliday>>{};
    for (final h in holidays) {
      byMonth.putIfAbsent(h.date.month, () => []).add(h);
    }
    final months = byMonth.keys.toList()..sort();
    final today = AppClock.today();
    var i = 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final m in months) ...[
          HrSectionHeader(
            title: hrMonthLabel(byMonth[m]!.first.date.year, m),
          ),
          for (final h in byMonth[m]!) ...[
            StaggeredCard(
              index: i++,
              child: Opacity(
                opacity: h.date.isBefore(today) ? 0.7 : 1,
                child: HrCard(
                  padding: const EdgeInsets.all(10),
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: HrPalette.holiday.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${h.date.day}',
                              style: AppText.display(
                                size: 16,
                                color: HrPalette.holiday,
                              ),
                            ),
                            Text(
                              hrDate(h.date).split(' ').last.toUpperCase(),
                              style: AppText.body(
                                size: 9,
                                weight: FontWeight.w800,
                                color: HrPalette.holiday,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              h.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 14,
                                weight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              [
                                hrDateWd(h.date),
                                h.branchName ?? 'all branches',
                                if (h.description != null &&
                                    h.description!.isNotEmpty)
                                  h.description!,
                              ].join(' · '),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w600,
                                color: AppColors.inkFaint,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (canEdit)
                        IconButton(
                          key: Key('delete-holiday-${h.id}'),
                          tooltip: 'Remove ${h.name}',
                          onPressed: () => onDelete(h),
                          icon: const Icon(
                            Icons.delete_outline_rounded,
                            size: 20,
                            color: AppColors.danger,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ],
    );
  }
}

/// Add a holiday. Returns `true` when it was created.
Future<bool> showHolidaySheet(BuildContext context, {required int year}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.celebration_rounded,
      color: HrPalette.holiday,
      title: 'Add holiday',
      subtitle: 'Paid, and skipped when counting leave days',
      child: _HolidayForm(year: year),
    ),
  );
  return changed == true;
}

class _HolidayForm extends StatefulWidget {
  const _HolidayForm({required this.year});

  final int year;

  @override
  State<_HolidayForm> createState() => _HolidayFormState();
}

class _HolidayFormState extends State<_HolidayForm> {
  final _name = TextEditingController();
  final _note = TextEditingController();
  late DateTime? _date = DateTime(widget.year, 1, 1);
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _pick() async {
    final d = await showDatePicker(
      context: context,
      initialDate: _date ?? DateTime(widget.year, 1, 1),
      firstDate: DateTime(widget.year - 1),
      lastDate: DateTime(widget.year + 2, 12, 31),
    );
    if (d != null) setState(() => _date = DateTime(d.year, d.month, d.day));
  }

  Future<void> _save() async {
    final errors = validateHolidayForm(date: _date, name: _name.text);
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    setState(() => _busy = true);
    try {
      await getIt<HrRepository>().createHoliday(
        date: _date!,
        name: _name.text,
        description: _note.text,
      );
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(context, '${_name.text.trim()} added to the calendar');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _errors = hrServerFieldErrors(e);
        _serverError = e.detailedMessage;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HrFieldLabel('DATE'),
        Semantics(
          button: true,
          label: 'Holiday date, ${_date == null ? 'not set' : hrDateY(_date!)}',
          excludeSemantics: true,
          child: InkWell(
            key: const Key('holiday-date'),
            borderRadius: BorderRadius.circular(14),
            onTap: _pick,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _errors['date'] != null
                      ? AppColors.danger
                      : AppColors.line,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.event_rounded,
                    size: 18,
                    color: HrPalette.holiday,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _date == null ? 'Pick a date' : hrDateY(_date!),
                      style: AppText.body(weight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_errors['date'] != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              _errors['date']!,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('holiday-name'),
          label: 'Name',
          controller: _name,
          hintText: 'e.g. Diwali',
          errorText: _errors['name'],
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('holiday-note'),
          label: 'Note (optional)',
          controller: _note,
        ),
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('holiday-save'),
          label: 'Add holiday',
          icon: Icons.check_rounded,
          loading: _busy,
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}
