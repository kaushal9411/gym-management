import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import '../widgets/hr_calendar_card.dart';
import '../widgets/hr_form_kit.dart';
import '../widgets/hr_ui.dart';
import 'setup_ui.dart';
import '../widgets/hr_widgets.dart';

/// **Shifts** (`GET /hr/shifts`, edit with `hr:settings_manage`): working
/// hours, late-grace minutes, weekly offs and which shift is the gym default.
/// The default shift cannot be un-defaulted / deleted and a shift with
/// employees cannot be deleted (the API answers 409 `INVALID_STATE`, shown as
/// is). Employees are assigned a shift from their own detail screen.
class ShiftsPanel extends StatelessWidget {
  const ShiftsPanel({super.key, required this.canEdit});

  final bool canEdit;

  Future<void> _delete(BuildContext context, HrShift s) async {
    final cubit = context.read<HrLoadCubit<List<HrShift>>>();
    final ok = await hrConfirmSheet(
      context,
      title: 'Delete ${s.name}?',
      message: 'This shift will be removed. Employees on it must be moved '
          'first.',
      confirmLabel: 'Delete shift',
    );
    if (!ok || !context.mounted) return;
    try {
      await getIt<HrRepository>().deleteShift(s.id);
      if (!context.mounted) return;
      hrSnack(context, '${s.name} deleted');
      cubit.load(silent: true);
    } on ApiException catch (e) {
      if (context.mounted) hrSnack(context, e.detailedMessage, error: true);
    }
  }

  Future<void> _edit(BuildContext context, HrShift? s) async {
    final cubit = context.read<HrLoadCubit<List<HrShift>>>();
    final changed = await showShiftSheet(context, shift: s);
    if (changed) cubit.load(silent: true);
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HrLoadCubit<List<HrShift>>, HrLoadState<List<HrShift>>>(
      builder: (context, state) => switch (state) {
        HrLoadLoading() => const HrSkeletonList(count: 2, height: 110),
        HrLoadError(:final message) => AppErrorView(
            message: message,
            onRetry: () => context.read<HrLoadCubit<List<HrShift>>>().load(),
          ),
        HrLoadLoaded(:final data) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (canEdit)
                HrSetupAddButton(
                  key: const Key('add-shift'),
                  label: 'Add shift',
                  onTap: () => _edit(context, null),
                ),
              if (data.isEmpty)
                const AppEmptyState(
                  title: 'No shifts',
                  message: 'Add a shift so late marks and weekly offs follow '
                      'your hours.',
                  icon: Icons.schedule_rounded,
                ),
              for (var i = 0; i < data.length; i++) ...[
                StaggeredCard(
                  index: i,
                  child: _ShiftCard(
                    shift: data[i],
                    canEdit: canEdit,
                    onEdit: () => _edit(context, data[i]),
                    onDelete: () => _delete(context, data[i]),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              if (!canEdit)
                const HrReadOnlyNote(
                  'You can view shifts but not change them.',
                ),
            ],
          ),
      },
    );
  }
}

class _ShiftCard extends StatelessWidget {
  const _ShiftCard({
    required this.shift,
    required this.canEdit,
    required this.onEdit,
    required this.onDelete,
  });

  final HrShift shift;
  final bool canEdit;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final s = shift;
    return Opacity(
      opacity: s.isActive ? 1 : 0.6,
      child: HrCard(
        accent: HrPalette.run,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(s.name, style: AppText.display(size: 16)),
                      if (s.isDefault)
                        const HrChip(
                          label: 'Default',
                          color: HrPalette.run,
                          icon: Icons.star_rounded,
                          dense: true,
                        ),
                      if (!s.isActive)
                        const HrChip(
                          label: 'Inactive',
                          color: HrPalette.notMarked,
                          dense: true,
                        ),
                    ],
                  ),
                ),
                if (canEdit) ...[
                  IconButton(
                    key: Key('edit-shift-${s.id}'),
                    tooltip: 'Edit ${s.name}',
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_rounded, size: 19),
                  ),
                  IconButton(
                    key: Key('delete-shift-${s.id}'),
                    tooltip: 'Delete ${s.name}',
                    onPressed: onDelete,
                    icon: const Icon(
                      Icons.delete_outline_rounded,
                      size: 20,
                      color: AppColors.danger,
                    ),
                  ),
                ],
              ],
            ),
            Text(
              '${hrTime12(s.startTime)} – ${hrTime12(s.endTime)}',
              style: AppText.display(size: 20, color: HrPalette.run),
            ),
            const SizedBox(height: 4),
            Text(
              'Late after ${s.graceMinutes} min grace · off '
              '${HrWeekday.shortList(s.weeklyOffDays)}',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  Icons.groups_rounded,
                  size: 14,
                  color: AppColors.inkSoft,
                ),
                const SizedBox(width: 4),
                Text(
                  '${s.employeeCount} employee${s.employeeCount == 1 ? '' : 's'}',
                  style: AppText.body(size: 12, weight: FontWeight.w800),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Create / edit a shift. Returns `true` when something was saved.
Future<bool> showShiftSheet(BuildContext context, {HrShift? shift}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.schedule_rounded,
      color: HrPalette.run,
      title: shift == null ? 'New shift' : 'Edit ${shift.name}',
      subtitle: 'Working hours, grace time and weekly offs',
      child: _ShiftForm(shift: shift),
    ),
  );
  return changed == true;
}

class _ShiftForm extends StatefulWidget {
  const _ShiftForm({this.shift});

  final HrShift? shift;

  @override
  State<_ShiftForm> createState() => _ShiftFormState();
}

class _ShiftFormState extends State<_ShiftForm> {
  late final _name = TextEditingController(text: widget.shift?.name ?? '');
  late final _grace = TextEditingController(
    text: '${widget.shift?.graceMinutes ?? 10}',
  );
  late String _start = widget.shift?.startTime ?? '06:00';
  late String _end = widget.shift?.endTime ?? '21:00';
  late List<String> _off = widget.shift?.weeklyOffDays ?? const ['SUNDAY'];
  late bool _default = widget.shift?.isDefault ?? false;
  late bool _active = widget.shift?.isActive ?? true;
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _grace.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final errors = validateShiftForm(
      name: _name.text,
      startTime: _start,
      endTime: _end,
      graceText: _grace.text,
    );
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    final input = HrShiftInput(
      name: _name.text,
      startTime: _start,
      endTime: _end,
      graceMinutes: hrParseNumber(_grace.text)!.round(),
      weeklyOffDays: _off,
      isDefault: _default,
      isActive: widget.shift == null ? null : _active,
    );
    setState(() => _busy = true);
    try {
      final repo = getIt<HrRepository>();
      if (widget.shift == null) {
        await repo.createShift(input);
      } else {
        await repo.updateShift(widget.shift!.id, input);
      }
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(context, widget.shift == null ? 'Shift created' : 'Shift saved');
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
        AppLabeledField(
          key: const Key('shift-name'),
          label: 'Name',
          controller: _name,
          hintText: 'e.g. Morning',
          errorText: _errors['name'],
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: HrTimeTile(
                key: const Key('shift-start'),
                label: 'Starts',
                value: _start,
                errorText: _errors['startTime'],
                onChanged: (v) => setState(() => _start = v),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: HrTimeTile(
                key: const Key('shift-end'),
                label: 'Ends',
                value: _end,
                errorText: _errors['endTime'],
                onChanged: (v) => setState(() => _end = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('shift-grace'),
          label: 'Grace (minutes)',
          controller: _grace,
          keyboardType: TextInputType.number,
          errorText: _errors['graceMinutes'],
        ),
        const SizedBox(height: 14),
        const HrFieldLabel('WEEKLY OFF'),
        HrWeekdayChips(
          selected: _off,
          onChanged: (v) => setState(() => _off = v),
        ),
        const SizedBox(height: 14),
        TeamToggleRow(
          title: 'Default shift',
          subtitle: 'Used by employees without their own shift',
          value: _default,
          color: HrPalette.run,
          // The current default cannot be switched off - make another shift
          // the default instead (API rule).
          onChanged: widget.shift?.isDefault == true
              ? null
              : (v) => setState(() => _default = v),
        ),
        if (widget.shift != null) ...[
          const SizedBox(height: 12),
          TeamToggleRow(
            title: 'Active',
            subtitle: 'Inactive shifts cannot be assigned',
            value: _active,
            color: HrPalette.run,
            onChanged: widget.shift!.isDefault
                ? null
                : (v) => setState(() => _active = v),
          ),
        ],
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('shift-save'),
          label: widget.shift == null ? 'Create shift' : 'Save shift',
          icon: Icons.check_rounded,
          loading: _busy,
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}
