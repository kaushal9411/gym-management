import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'branch_ui.dart';
import 'widgets/branch_holidays_editor.dart';

/// Holidays (`PATCH /branches/:id` scoped to `holidays`): one-off closures as
/// `{date: YYYY-MM-DD, label?}`, at most 100. The whole list is replaced on
/// save, so removing every entry saves an empty list.
class BranchHolidaysScreen extends StatefulWidget {
  const BranchHolidaysScreen({super.key, required this.branch});

  final Branch branch;

  @override
  State<BranchHolidaysScreen> createState() => _BranchHolidaysScreenState();
}

class _BranchHolidaysScreenState extends State<BranchHolidaysScreen> {
  late List<BranchHoliday> _holidays = sortedHolidays(widget.branch.holidays);
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BranchRepository>()
          .updateHolidays(widget.branch.id, _holidays);
      if (!mounted) return;
      teamSnack(context, 'Holidays saved.');
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.branch;
    return BranchEditScaffold(
      name: b.name,
      subtitle:
          [b.branchCode, if (b.location.isNotEmpty) b.location].join(' · '),
      title: 'Holidays',
      icon: Icons.beach_access_rounded,
      color: TeamColors.violet,
      saving: _saving,
      onSave: _save,
      error: _error,
      saveLabel: 'Save holidays',
      sections: [
        TeamSectionCard(
          icon: Icons.beach_access_rounded,
          color: TeamColors.violet,
          title: 'Closures',
          subtitle: '${_holidays.length} of $kMaxHolidays used',
          child: BranchHolidaysEditor(
            holidays: _holidays,
            onChanged: (h) => setState(() {
              _holidays = h;
              _error = null;
            }),
          ),
        ),
      ],
    );
  }
}
