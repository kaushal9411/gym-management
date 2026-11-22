import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../models/hr_leave.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/list_hero.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../hr_palette.dart';
import '../widgets/hr_ui.dart';
import 'holidays_panel.dart';
import 'leave_types_panel.dart';
import 'policy_panel.dart';
import 'shifts_panel.dart';

enum HrSetupTab {
  shifts('Shifts', Icons.schedule_rounded),
  holidays('Holidays', Icons.celebration_rounded),
  leaveTypes('Leave types', Icons.beach_access_rounded),
  policy('Policy', Icons.rule_rounded);

  const HrSetupTab(this.label, this.icon);

  final String label;
  final IconData icon;
}

/// **Setup** - shifts, holidays, leave types and the HR policy (the web "Setup"
/// page as four tabs). Opens with `hr:view`; each tab is editable only with the
/// key the API enforces for it, exactly like the web:
///
/// * Shifts, Policy - `hr:settings_manage`
/// * Holidays, Leave types - `hr:leave_manage`
///
/// Everyone else sees the same data read-only. All edits happen in bottom
/// sheets, then the tab re-reads the server (no optimistic UI).
class HrSetupScreen extends StatefulWidget {
  const HrSetupScreen({super.key, this.initialTab = HrSetupTab.shifts});

  final HrSetupTab initialTab;

  @override
  State<HrSetupScreen> createState() => _HrSetupScreenState();
}

class _HrSetupScreenState extends State<HrSetupScreen> {
  late HrSetupTab _tab = widget.initialTab;
  int _year = AppClock.today().year;
  final _loaded = <HrSetupTab>{};

  late final HrLoadCubit<List<HrShift>> _shifts = HrLoadCubit(
    () => getIt<HrRepository>().shifts(),
  );
  late final HrLoadCubit<List<HrHoliday>> _holidays = HrLoadCubit(
    () => getIt<HrRepository>().holidays(year: _year),
  );
  late final HrLoadCubit<List<HrLeaveType>> _types = HrLoadCubit(
    () => getIt<HrRepository>().leaveTypes(includeInactive: true),
  );
  late final HrLoadCubit<HrPolicy> _policy = HrLoadCubit(
    () => getIt<HrRepository>().policy(),
  );

  @override
  void initState() {
    super.initState();
    _ensureLoaded(_tab);
  }

  @override
  void dispose() {
    _shifts.close();
    _holidays.close();
    _types.close();
    _policy.close();
    super.dispose();
  }

  void _ensureLoaded(HrSetupTab t) {
    if (!_loaded.add(t)) return;
    _reload(t);
  }

  void _reload(HrSetupTab t, {bool silent = false}) => switch (t) {
        HrSetupTab.shifts => _shifts.load(silent: silent),
        HrSetupTab.holidays => _holidays.load(silent: silent),
        HrSetupTab.leaveTypes => _types.load(silent: silent),
        HrSetupTab.policy => _policy.load(silent: silent),
      };

  Future<void> _refresh() async {
    _reload(_tab, silent: true);
    await Future<void>.delayed(const Duration(milliseconds: 400));
  }

  @override
  Widget build(BuildContext context) {
    final settings = hrCan(context, HrPerm.settingsManage);
    final leave = hrCan(context, HrPerm.leaveManage);
    final panel = switch (_tab) {
      HrSetupTab.shifts => ShiftsPanel(canEdit: settings),
      HrSetupTab.holidays => HolidaysPanel(
          canEdit: leave,
          year: _year,
          onYear: (y) {
            setState(() => _year = y);
            _holidays.load();
          },
        ),
      HrSetupTab.leaveTypes => LeaveTypesPanel(canEdit: leave),
      HrSetupTab.policy => PolicyPanel(canEdit: settings),
    };
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _shifts),
        BlocProvider.value(value: _holidays),
        BlocProvider.value(value: _types),
        BlocProvider.value(value: _policy),
      ],
      child: HrPage(
        title: 'Setup',
        subtitle: 'Shifts, holidays, leave types and policy',
        onRefresh: _refresh,
        chips: [
          ListHeroChip(icon: _tab.icon, label: _tab.label),
        ],
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final t in HrSetupTab.values)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Semantics(
                          button: true,
                          selected: t == _tab,
                          label: '${t.label} tab',
                          excludeSemantics: true,
                          child: TeamFilterChip(
                            key: Key('setup-tab-${t.name}'),
                            label: t.label,
                            selected: t == _tab,
                            color: HrPalette.run,
                            onTap: () {
                              if (t == _tab) return;
                              HapticFeedback.selectionClick();
                              setState(() => _tab = t);
                              _ensureLoaded(t);
                            },
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(child: panel),
        ],
      ),
    );
  }
}
