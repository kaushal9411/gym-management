import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_forms.dart';
import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/hr_leave.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import '../widgets/hr_form_kit.dart';
import '../widgets/hr_ui.dart';
import '../widgets/hr_widgets.dart';
import 'setup_ui.dart';

/// **Leave types** (`GET /hr/leave-types?includeInactive=true`, edit with
/// `hr:leave_manage`): name, code, yearly quota (or unlimited), paid / unpaid,
/// carry-forward (+ cap), colour and active. A type that any request or balance
/// uses cannot be deleted - the API answers 409 `INVALID_STATE` (shown as is)
/// and the way out is to switch it inactive.
class LeaveTypesPanel extends StatelessWidget {
  const LeaveTypesPanel({super.key, required this.canEdit});

  final bool canEdit;

  Future<void> _edit(BuildContext context, HrLeaveType? t) async {
    final cubit = context.read<HrLoadCubit<List<HrLeaveType>>>();
    final changed = await showLeaveTypeSheet(context, type: t);
    if (changed) cubit.load(silent: true);
  }

  Future<void> _delete(BuildContext context, HrLeaveType t) async {
    final cubit = context.read<HrLoadCubit<List<HrLeaveType>>>();
    final ok = await hrConfirmSheet(
      context,
      title: 'Delete ${t.name}?',
      message: 'Types that already have requests or balances cannot be '
          'deleted - switch them inactive instead.',
      confirmLabel: 'Delete leave type',
    );
    if (!ok || !context.mounted) return;
    try {
      await getIt<HrRepository>().deleteLeaveType(t.id);
      if (!context.mounted) return;
      hrSnack(context, '${t.name} deleted');
      cubit.load(silent: true);
    } on ApiException catch (e) {
      if (context.mounted) hrSnack(context, e.detailedMessage, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<HrLoadCubit<List<HrLeaveType>>,
        HrLoadState<List<HrLeaveType>>>(
      builder: (context, state) => switch (state) {
        HrLoadLoading() => const HrSkeletonList(count: 3, height: 84),
        HrLoadError(:final message) => AppErrorView(
            message: message,
            onRetry: () =>
                context.read<HrLoadCubit<List<HrLeaveType>>>().load(),
          ),
        HrLoadLoaded(:final data) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (canEdit)
                HrSetupAddButton(
                  key: const Key('add-leave-type'),
                  label: 'Add leave type',
                  onTap: () => _edit(context, null),
                ),
              if (data.isEmpty)
                const AppEmptyState(
                  title: 'No leave types',
                  icon: Icons.beach_access_outlined,
                ),
              for (var i = 0; i < data.length; i++) ...[
                StaggeredCard(
                  index: i,
                  child: _TypeCard(
                    type: data[i],
                    canEdit: canEdit,
                    onEdit: () => _edit(context, data[i]),
                    onDelete: () => _delete(context, data[i]),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              if (!canEdit)
                const HrReadOnlyNote(
                  'You can view leave types but not change them.',
                ),
            ],
          ),
      },
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({
    required this.type,
    required this.canEdit,
    required this.onEdit,
    required this.onDelete,
  });

  final HrLeaveType type;
  final bool canEdit;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final t = type;
    final hue = HrPalette.leaveType(t.colorHex);
    final quota = t.yearlyQuota == null
        ? 'Unlimited'
        : '${hrDays(t.yearlyQuota!)} days / year';
    return Opacity(
      opacity: t.isActive ? 1 : 0.6,
      child: HrCard(
        accent: hue,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(t.name, style: AppText.display(size: 15.5)),
                      HrChip(label: t.code, color: hue, dense: true),
                      if (!t.isActive)
                        const HrChip(
                          label: 'Inactive',
                          color: HrPalette.notMarked,
                          dense: true,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$quota · ${t.isPaid ? 'Paid' : 'Unpaid'}'
                    '${t.carryForward ? ' · carry forward${t.carryForwardMax != null ? ' (max ${hrDays(t.carryForwardMax!)})' : ''}' : ''}',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.inkSoft,
                    ),
                  ),
                ],
              ),
            ),
            if (canEdit) ...[
              IconButton(
                key: Key('edit-type-${t.id}'),
                tooltip: 'Edit ${t.name}',
                onPressed: onEdit,
                icon: const Icon(Icons.edit_rounded, size: 19),
              ),
              IconButton(
                key: Key('delete-type-${t.id}'),
                tooltip: 'Delete ${t.name}',
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
      ),
    );
  }
}

/// Create / edit a leave type. Returns `true` when saved.
Future<bool> showLeaveTypeSheet(
  BuildContext context, {
  HrLeaveType? type,
}) async {
  final changed = await showTeamSheet<bool>(
    context,
    (ctx) => TeamSheetScaffold(
      icon: Icons.beach_access_rounded,
      color: HrPalette.onLeave,
      title: type == null ? 'New leave type' : 'Edit ${type.name}',
      subtitle: 'Quota, paid / unpaid and colour',
      child: _TypeForm(type: type),
    ),
  );
  return changed == true;
}

class _TypeForm extends StatefulWidget {
  const _TypeForm({this.type});

  final HrLeaveType? type;

  @override
  State<_TypeForm> createState() => _TypeFormState();
}

class _TypeFormState extends State<_TypeForm> {
  late final _name = TextEditingController(text: widget.type?.name ?? '');
  late final _code = TextEditingController(text: widget.type?.code ?? '');
  late final _quota = TextEditingController(
    text: widget.type?.yearlyQuota != null
        ? hrDays(widget.type!.yearlyQuota!)
        : '12',
  );
  late final _carryMax = TextEditingController(
    text: widget.type?.carryForwardMax != null
        ? hrDays(widget.type!.carryForwardMax!)
        : '',
  );
  late bool _unlimited =
      widget.type != null && widget.type!.yearlyQuota == null;
  late bool _paid = widget.type?.isPaid ?? true;
  late bool _carry = widget.type?.carryForward ?? false;
  late bool _active = widget.type?.isActive ?? true;
  late String _color = _initialColor();
  Map<String, String> _errors = {};
  String? _serverError;
  bool _busy = false;

  String _initialColor() {
    final c = widget.type?.colorHex.toLowerCase();
    return c != null && c.isNotEmpty ? c : HrPalette.leaveTypeChoices.first.$1;
  }

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    _quota.dispose();
    _carryMax.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final errors = validateLeaveTypeForm(
      name: _name.text,
      code: _code.text,
      unlimited: _unlimited,
      quotaText: _quota.text,
      carryForward: _carry,
      carryMaxText: _carryMax.text,
    );
    setState(() {
      _errors = errors;
      _serverError = null;
    });
    if (errors.isNotEmpty) return;
    final input = HrLeaveTypeInput(
      name: _name.text,
      code: _code.text,
      yearlyQuota: _unlimited ? null : hrParseNumber(_quota.text),
      isPaid: _paid,
      carryForward: _carry,
      carryForwardMax: hrParseNumber(_carryMax.text),
      color: _color,
      isActive: widget.type == null ? null : _active,
    );
    setState(() => _busy = true);
    try {
      final repo = getIt<HrRepository>();
      if (widget.type == null) {
        await repo.createLeaveType(input);
      } else {
        await repo.updateLeaveType(widget.type!.id, input);
      }
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      Navigator.of(context).pop(true);
      hrSnack(
        context,
        widget.type == null ? 'Leave type created' : 'Leave type saved',
      );
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
          key: const Key('type-name'),
          label: 'Name',
          controller: _name,
          hintText: 'e.g. Casual Leave',
          errorText: _errors['name'],
          textCapitalization: TextCapitalization.words,
        ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('type-code'),
          label: 'Code',
          controller: _code,
          hintText: 'CASUAL',
          errorText: _errors['code'],
          textCapitalization: TextCapitalization.characters,
          // The code identifies the type everywhere; it never changes.
          readOnly: widget.type != null,
          onChanged: (v) {
            final up = v.toUpperCase();
            if (up != v) {
              _code.value = TextEditingValue(
                text: up,
                selection: TextSelection.collapsed(offset: up.length),
              );
            }
          },
        ),
        const SizedBox(height: 12),
        AppLabeledField(
          key: const Key('type-quota'),
          label: 'Yearly quota (days)',
          controller: _quota,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          errorText: _errors['yearlyQuota'],
          readOnly: _unlimited,
          hintText: _unlimited ? 'Unlimited' : null,
        ),
        const SizedBox(height: 14),
        const HrFieldLabel('COLOUR'),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final c in HrPalette.leaveTypeChoices)
              Semantics(
                button: true,
                selected: _color == c.$1,
                label: c.$2,
                excludeSemantics: true,
                child: GestureDetector(
                  key: Key('color-${c.$2}'),
                  onTap: () => setState(() => _color = c.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: HrPalette.leaveType(c.$1),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color:
                            _color == c.$1 ? AppColors.ink : Colors.transparent,
                        width: 2.4,
                      ),
                    ),
                    child: _color == c.$1
                        ? const Icon(
                            Icons.check_rounded,
                            size: 18,
                            color: Colors.white,
                          )
                        : null,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 14),
        TeamToggleRow(
          title: 'Unlimited',
          subtitle: 'No yearly cap (e.g. unpaid leave)',
          value: _unlimited,
          color: HrPalette.onLeave,
          onChanged: (v) => setState(() => _unlimited = v),
        ),
        const SizedBox(height: 12),
        TeamToggleRow(
          title: 'Paid leave',
          subtitle: 'Paid days are not deducted from salary',
          value: _paid,
          color: HrPalette.onLeave,
          onChanged: (v) => setState(() => _paid = v),
        ),
        const SizedBox(height: 12),
        TeamToggleRow(
          title: 'Carry forward',
          subtitle: 'Unused days roll into the next leave year',
          value: _carry,
          color: HrPalette.onLeave,
          onChanged: (v) => setState(() => _carry = v),
        ),
        if (_carry) ...[
          const SizedBox(height: 12),
          AppLabeledField(
            key: const Key('type-carry-max'),
            label: 'Carry forward cap (days)',
            controller: _carryMax,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            hintText: 'No cap',
            errorText: _errors['carryForwardMax'],
          ),
        ],
        if (widget.type != null) ...[
          const SizedBox(height: 12),
          TeamToggleRow(
            title: 'Active',
            subtitle: 'Inactive types cannot be applied for',
            value: _active,
            color: HrPalette.onLeave,
            onChanged: (v) => setState(() => _active = v),
          ),
        ],
        HrFormMessage(_serverError),
        const SizedBox(height: 14),
        TeamGradientButton(
          key: const Key('type-save'),
          label: widget.type == null ? 'Create leave type' : 'Save leave type',
          icon: Icons.check_rounded,
          loading: _busy,
          onTap: _busy ? null : _save,
        ),
      ],
    );
  }
}
