import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/hr/hr_load_cubit.dart';
import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/app_clock.dart';
import '../../../../models/hr_enums.dart';
import '../../../../models/hr_setup.dart';
import '../../../../repositories/hr_repository.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../hr_palette.dart';
import 'hr_form_kit.dart';
import 'hr_ui.dart';
import 'hr_widgets.dart';

/// The **monthly grid** (`GET /hr/attendance/monthly?month=`, `hr:view`):
/// employee x day, each cell tinted with its status colour AND a glyph (colour
/// is never the only signal), a "P" (attended) and "A" (absent) column per
/// person and a legend. Scrolls sideways with the names pinned on the left.
/// A tap on a cell reports `(row, date)`; the host opens the manual-mark form
/// (or the read-only day sheet).
class HrMonthlyGridView extends StatefulWidget {
  const HrMonthlyGridView({
    super.key,
    required this.onCell,
    this.initialMonth,
    this.reloadKey = 0,
  });

  final void Function(HrGridRow row, DateTime date) onCell;
  final String? initialMonth;

  /// Bump to re-read the grid (after a mark).
  final int reloadKey;

  @override
  State<HrMonthlyGridView> createState() => _HrMonthlyGridViewState();
}

class _HrMonthlyGridViewState extends State<HrMonthlyGridView> {
  late String _month = widget.initialMonth ?? HrMonthStepper.currentKey();
  late final HrLoadCubit<HrMonthlyGrid> _cubit = HrLoadCubit(
    () => getIt<HrRepository>().monthlyGrid(_month),
  )..load();

  @override
  void didUpdateWidget(HrMonthlyGridView old) {
    super.didUpdateWidget(old);
    if (old.reloadKey != widget.reloadKey) _cubit.load(silent: true);
  }

  @override
  void dispose() {
    _cubit.close();
    super.dispose();
  }

  static const double _cell = 32;
  static const double _rowH = 42;
  static const double _nameW = 112;

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: _cubit,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HrMonthStepper(
            month: _month,
            onChanged: (m) {
              setState(() => _month = m);
              _cubit.load();
            },
          ),
          const SizedBox(height: 12),
          BlocBuilder<HrLoadCubit<HrMonthlyGrid>, HrLoadState<HrMonthlyGrid>>(
            builder: (context, state) => switch (state) {
              HrLoadLoading() => const HrSkeletonList(count: 4, height: 54),
              HrLoadError(:final message) => AppErrorView(
                  message: message,
                  onRetry: _cubit.load,
                ),
              HrLoadLoaded(:final data) => data.rows.isEmpty
                  ? const AppEmptyState(
                      title: 'No employees',
                      message: 'Nobody is on the roster for this month.',
                      icon: Icons.groups_outlined,
                    )
                  : _grid(context, data),
            },
          ),
        ],
      ),
    );
  }

  Widget _grid(BuildContext context, HrMonthlyGrid g) {
    final today = AppClock.today();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          key: const Key('monthly-grid'),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Pinned names.
              SizedBox(
                width: _nameW,
                child: Column(
                  children: [
                    Container(
                      height: _rowH,
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 10),
                      child: Text(
                        'Employee',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ),
                    for (final r in g.rows)
                      Container(
                        height: _rowH,
                        alignment: Alignment.centerLeft,
                        padding: const EdgeInsets.only(left: 10, right: 4),
                        decoration: BoxDecoration(
                          border:
                              Border(top: BorderSide(color: AppColors.line)),
                        ),
                        child: Row(
                          children: [
                            HrAvatar(employee: r.employee, size: 22),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                r.employee.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.body(
                                  size: 11.5,
                                  weight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Column(
                    children: [
                      SizedBox(
                        height: _rowH,
                        child: Row(
                          children: [
                            for (final d in g.days)
                              SizedBox(
                                width: _cell + 4,
                                child: Center(
                                  child: Text(
                                    '${d.day}',
                                    style: AppText.body(
                                      size: 11,
                                      weight: FontWeight.w800,
                                      color: d == today
                                          ? HrPalette.run
                                          : AppColors.inkFaint,
                                    ),
                                  ),
                                ),
                              ),
                            SizedBox(
                              width: 34,
                              child: Center(
                                child: Text(
                                  'P',
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w900,
                                    color: HrPalette.present,
                                  ),
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 34,
                              child: Center(
                                child: Text(
                                  'A',
                                  style: AppText.body(
                                    size: 11,
                                    weight: FontWeight.w900,
                                    color: HrPalette.absent,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      for (final r in g.rows)
                        Container(
                          height: _rowH,
                          decoration: BoxDecoration(
                            border:
                                Border(top: BorderSide(color: AppColors.line)),
                          ),
                          child: Row(
                            children: [
                              for (var i = 0; i < g.days.length; i++)
                                _GridCell(
                                  key: Key('cell-${r.employee.userId}-$i'),
                                  name: r.employee.name,
                                  date: g.days[i],
                                  status: i < r.cells.length
                                      ? r.cells[i]
                                      : DayStatus.notMarked,
                                  size: _cell,
                                  onTap: () => widget.onCell(r, g.days[i]),
                                ),
                              SizedBox(
                                width: 34,
                                child: Center(
                                  child: Text(
                                    '${r.attended}',
                                    style: AppText.body(
                                      size: 12,
                                      weight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: 34,
                                child: Center(
                                  child: Text(
                                    '${r.stats.absent}',
                                    style: AppText.body(
                                      size: 12,
                                      weight: FontWeight.w900,
                                      color: HrPalette.absent,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        HrLegend(
          items: [
            for (final s in HrPalette.legend)
              (s.label, HrPalette.status(s), HrPalette.glyph(s)),
          ],
        ),
      ],
    );
  }
}

class _GridCell extends StatelessWidget {
  const _GridCell({
    super.key,
    required this.name,
    required this.date,
    required this.status,
    required this.size,
    required this.onTap,
  });

  final String name;
  final DateTime date;
  final DayStatus status;
  final double size;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = HrPalette.status(status);
    final quiet =
        status == DayStatus.notMarked || status == DayStatus.notJoined;
    return Semantics(
      button: true,
      label: '$name, ${hrDateWd(date)}: ${status.label}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          width: size + 4,
          height: size + 4,
          child: Center(
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: c.withValues(alpha: quiet ? 0.08 : 0.2),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(HrPalette.glyph(status), size: 14, color: c),
            ),
          ),
        ),
      ),
    );
  }
}
