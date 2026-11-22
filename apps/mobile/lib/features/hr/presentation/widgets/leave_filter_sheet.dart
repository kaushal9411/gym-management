import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_attendance.dart';
import '../../../../models/hr_leave.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import 'hr_form_kit.dart';
import 'hr_widgets.dart';

/// The Leaves inbox filters besides the status chips: employee, leave type and
/// an overlap date range (`GET /hr/leaves?userId&leaveTypeId&from&to`).
class HrLeaveFilter {
  const HrLeaveFilter({this.employee, this.type, this.from, this.to});

  final HrEmployeeRef? employee;
  final HrLeaveType? type;
  final DateTime? from;
  final DateTime? to;

  static const none = HrLeaveFilter();

  bool get isActive =>
      employee != null || type != null || from != null || to != null;

  /// How many of the four filters are set (badge on the filter button).
  int get count => [employee, type, from, to].where((x) => x != null).length;

  /// `null` when valid, else why not (`to` before `from`).
  String? get rangeError => from != null && to != null && to!.isBefore(from!)
      ? 'The end date must be on or after the start date.'
      : null;
}

/// Sheet for [HrLeaveFilter]; returns the new filter (or [HrLeaveFilter.none]
/// on Reset), `null` when dismissed.
Future<HrLeaveFilter?> showLeaveFilterSheet(
  BuildContext context, {
  required HrLeaveFilter current,
}) {
  return showTeamSheet<HrLeaveFilter>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.filter_list_rounded,
      color: HrPalette.run,
      title: 'Filter requests',
      subtitle: 'Employee, leave type and dates',
      child: _FilterForm(current: current),
    ),
  );
}

class _FilterForm extends StatefulWidget {
  const _FilterForm({required this.current});

  final HrLeaveFilter current;

  @override
  State<_FilterForm> createState() => _FilterFormState();
}

class _FilterFormState extends State<_FilterForm> {
  late HrEmployeeRef? _employee = widget.current.employee;
  late HrLeaveType? _type = widget.current.type;
  late DateTime? _from = widget.current.from;
  late DateTime? _to = widget.current.to;
  List<HrLeaveType>? _types;
  String? _typesError;

  @override
  void initState() {
    super.initState();
    _loadTypes();
  }

  Future<void> _loadTypes() async {
    try {
      final t = await getIt<HrRepository>().leaveTypes(includeInactive: true);
      if (mounted) setState(() => _types = t);
    } on ApiException catch (e) {
      if (mounted) setState(() => _typesError = e.message);
    }
  }

  HrLeaveFilter get _filter =>
      HrLeaveFilter(employee: _employee, type: _type, from: _from, to: _to);

  Future<void> _pickEmployee() async {
    final e = await showHrEmployeePicker(context);
    if (e != null && mounted) setState(() => _employee = e);
  }

  Future<void> _pickDate(bool from) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      initialDate: (from ? _from : _to) ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 2, 12, 31),
    );
    if (d != null && mounted) {
      setState(() => from ? _from = d : _to = d);
    }
  }

  Widget _tile(String label, String? value, VoidCallback onTap, Key key) =>
      Expanded(
        child: Semantics(
          button: true,
          label: '$label, ${value ?? 'any'}',
          excludeSemantics: true,
          child: InkWell(
            key: key,
            borderRadius: BorderRadius.circular(14),
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: value == null ? AppColors.line : HrPalette.run,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w700,
                      color: AppColors.inkFaint,
                    ),
                  ),
                  Text(
                    value ?? 'Any',
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final err = _filter.rangeError;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const HrFieldLabel('EMPLOYEE'),
        Row(
          children: [
            _tile(
              'Employee',
              _employee?.name,
              _pickEmployee,
              const Key('filter-employee'),
            ),
            if (_employee != null)
              IconButton(
                key: const Key('filter-employee-clear'),
                tooltip: 'Clear employee',
                onPressed: () => setState(() => _employee = null),
                icon: const Icon(Icons.close_rounded),
              ),
          ],
        ),
        const SizedBox(height: 14),
        const HrFieldLabel('LEAVE TYPE'),
        if (_typesError != null)
          Text(
            _typesError!,
            style: AppText.body(size: 12, color: AppColors.danger),
          )
        else if (_types == null)
          const HrShimmerBox(height: 38, radius: 14)
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TeamFilterChip(
                key: const Key('filter-type-all'),
                label: 'All types',
                selected: _type == null,
                color: HrPalette.run,
                onTap: () => setState(() => _type = null),
              ),
              for (final t in _types!)
                TeamFilterChip(
                  key: Key('filter-type-${t.id}'),
                  label: t.name,
                  selected: _type?.id == t.id,
                  color: HrPalette.leaveType(t.colorHex),
                  onTap: () => setState(() => _type = t),
                ),
            ],
          ),
        const SizedBox(height: 14),
        const HrFieldLabel('DATES (OVERLAPPING)'),
        Row(
          children: [
            _tile(
              'From',
              _from == null ? null : hrDateY(_from!),
              () => _pickDate(true),
              const Key('filter-from'),
            ),
            const SizedBox(width: 10),
            _tile(
              'To',
              _to == null ? null : hrDateY(_to!),
              () => _pickDate(false),
              const Key('filter-to'),
            ),
          ],
        ),
        if (err != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              err,
              key: const Key('filter-range-error'),
              style: AppText.body(
                size: 12,
                weight: FontWeight.w700,
                color: AppColors.danger,
              ),
            ),
          ),
        const SizedBox(height: 16),
        TeamGradientButton(
          key: const Key('filter-apply'),
          label: 'Apply filters',
          icon: Icons.check_rounded,
          onTap: err != null ? null : () => Navigator.of(context).pop(_filter),
        ),
        const SizedBox(height: 10),
        TeamOutlineButton(
          key: const Key('filter-reset'),
          label: 'Reset',
          icon: Icons.restart_alt_rounded,
          onTap: () => Navigator.of(context).pop(HrLeaveFilter.none),
        ),
      ],
    );
  }
}
