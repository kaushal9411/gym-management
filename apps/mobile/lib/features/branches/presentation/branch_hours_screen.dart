import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'branch_ui.dart';
import 'widgets/branch_hours_editor.dart';

/// Operating hours (`PATCH /branches/:id` scoped to `operatingHours`): per
/// weekday open / close / closed with presets. The whole weekly object is
/// replaced on save (the API has no per-day patch); days the branch had no
/// hours for start from web's 06:00 - 22:00 default. Closing must be after
/// opening — flagged inline and blocked before sending.
class BranchHoursScreen extends StatefulWidget {
  const BranchHoursScreen({super.key, required this.branch});

  final Branch branch;

  @override
  State<BranchHoursScreen> createState() => _BranchHoursScreenState();
}

class _BranchHoursScreenState extends State<BranchHoursScreen> {
  late Map<String, DayHours> _hours = normalizeHours(
    widget.branch.operatingHours,
  );
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    final bad = branchWeekdays.where((d) {
      final h = _hours[d]!;
      final a = hhmmToMinutes(h.open);
      final b = hhmmToMinutes(h.close);
      return !h.closed && (a == null || b == null || b <= a);
    });
    if (bad.isNotEmpty) {
      setState(
        () => _error = 'Fix the opening / closing times for '
            '${bad.map((d) => kDayFull[d]).join(', ')}.',
      );
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BranchRepository>()
          .updateOperatingHours(widget.branch.id, _hours);
      if (!mounted) return;
      teamSnack(context, 'Operating hours saved.');
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
      title: 'Operating hours',
      icon: Icons.schedule_rounded,
      color: TeamColors.teal,
      saving: _saving,
      onSave: _save,
      error: _error,
      saveLabel: 'Save hours',
      sections: [
        TeamSectionCard(
          icon: Icons.schedule_rounded,
          color: TeamColors.teal,
          title: 'Weekly schedule',
          subtitle: 'Times are in the branch timezone (${b.timezone})',
          child: BranchHoursEditor(
            hours: _hours,
            onChanged: (h) => setState(() {
              _hours = h;
              _error = null;
            }),
          ),
        ),
      ],
    );
  }
}
