import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/branch_option.dart';
import '../../../../repositories/branch_repository.dart';
import '../../../income/presentation/income_ui.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import 'rpt_format.dart';
import 'rpt_theme.dart';

/// The range of equal length that ends the day before [from] (web's
/// `previousRange`). Inputs and outputs are `YYYY-MM-DD`; the maths is in UTC
/// so a DST change cannot move a day.
({String from, String to}) rptPreviousRange(String from, String to) {
  DateTime parse(String s) => DateTime.utc(
        int.parse(s.substring(0, 4)),
        int.parse(s.substring(5, 7)),
        int.parse(s.substring(8, 10)),
      );
  final f = parse(from);
  final t = parse(to);
  final days = t.difference(f).inDays + 1;
  String fmt(DateTime d) => '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
  return (
    from: fmt(f.subtract(Duration(days: days))),
    to: fmt(f.subtract(const Duration(days: 1))),
  );
}

/// The longest range the report / analytics endpoints accept (the API
/// answers 422 beyond it).
const kRptMaxRangeDays = 366;

/// State of web's `useReportsControls`: period (+ custom range), compare
/// switch and branch. Own one per screen, hand it to a [RptPeriodBar] and
/// listen to reload:
///
/// ```dart
/// final controls = RptPeriodController()..addListener(_onScope);
/// controls.range      // (from: '2026-10-01', to: '2026-10-18')  local days
/// controls.previousRange // equal-length range before it
/// controls.rangeReady // false while the custom range is invalid / > 366 d
/// ```
///
/// [scope] changes whenever the data to fetch changes (range or branch);
/// [compare] only decides whether the previous range is wanted.
class RptPeriodController extends ChangeNotifier {
  RptPeriodController({
    IncomePeriod period = IncomePeriod.thisMonth,
    bool compare = true,
    String? branchId,
    DateTimeRange? custom,
  })  : _period = period,
        _compare = compare,
        _branchId = branchId,
        _custom = custom;

  IncomePeriod _period;
  DateTimeRange? _custom;
  bool _compare;
  String? _branchId;
  List<BranchOption> _branches = const [];

  IncomePeriod get period => _period;
  DateTimeRange? get custom => _custom;
  bool get compare => _compare;
  String? get branchId => _branchId;
  List<BranchOption> get branches => _branches;

  /// Local calendar days (`YYYY-MM-DD`) of the selected period.
  ({String from, String to}) get range => incomeRange(_period, _custom);

  /// Whole days in [range].
  int get days {
    final r = range;
    DateTime p(String s) => DateTime.utc(
          int.parse(s.substring(0, 4)),
          int.parse(s.substring(5, 7)),
          int.parse(s.substring(8, 10)),
        );
    return p(r.to).difference(p(r.from)).inDays + 1;
  }

  bool get rangeInverted => range.from.compareTo(range.to) > 0;
  bool get rangeTooLong => !rangeInverted && days > kRptMaxRangeDays;

  /// Safe to request: start <= end and within 366 days.
  bool get rangeReady => !rangeInverted && !rangeTooLong;

  ({String from, String to}) get previousRange =>
      rptPreviousRange(range.from, range.to);

  /// Web's `previousLabel` ("Last month" / "Month before" / "Previous
  /// period").
  String get previousLabel => _period.previousLabel;

  String get customLabel {
    final c = _custom;
    if (c == null) return 'Custom…';
    return '${dayMonth(c.start)} – ${dayMonth(c.end)}';
  }

  /// Changes when the data to load changes (range or branch).
  String get scope => '${range.from}|${range.to}|${_branchId ?? ''}';

  void setPeriod(IncomePeriod p) {
    _period = p;
    notifyListeners();
  }

  void setCustom(DateTimeRange r) {
    _custom = r;
    _period = IncomePeriod.custom;
    notifyListeners();
  }

  void setCompare(bool v) {
    if (v == _compare) return;
    _compare = v;
    notifyListeners();
  }

  void setBranch(String? id) {
    if (id == _branchId) return;
    _branchId = id;
    notifyListeners();
  }

  void setBranches(List<BranchOption> b) {
    _branches = b;
    notifyListeners();
  }

  /// Loads the branch picker's options (`GET /branches/assignable`). Never
  /// throws: on failure the picker just offers "All branches".
  Future<void> loadBranches() async {
    try {
      setBranches(await getIt<BranchRepository>().assignable());
    } catch (_) {}
  }

  /// Opens the date-range picker; picking a range selects Custom.
  Future<void> pickCustom(BuildContext context) async {
    final now = DateTime.now();
    final r = range;
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(now.year + 1),
      initialDateRange: _period == IncomePeriod.custom
          ? _custom
          : DateTimeRange(
              start: DateTime.parse(r.from),
              end: DateTime.parse(r.to),
            ),
    );
    if (picked != null) setCustom(picked);
  }

  /// Opens the branch sheet ("All branches" + each active branch).
  Future<void> pickBranch(BuildContext context) async {
    final v = await pickOneSheet(
      context,
      title: 'Branch',
      options: [for (final b in _branches) (b.id, b.name)],
      current: _branchId,
      clearLabel: 'All branches',
    );
    if (v == null) return;
    setBranch(v.isEmpty ? null : v);
  }

  String get branchLabel {
    final id = _branchId;
    if (id == null) return 'All branches';
    for (final b in _branches) {
      if (b.id == id) return b.name;
    }
    return 'Branch';
  }
}

/// Web's `PeriodBar`: period chips (Today / 7 days / This month / Last month
/// / 90 days / Custom…), the branch picker and the "Compare with previous
/// period" switch, bound to a [RptPeriodController].
///
///  * [showPeriod] false -> branch-only bar for point-in-time reports (web:
///    "This report is a current snapshot, so it has no date range.").
///  * [showCompare] / [showBranch] hide those controls.
///  * Shows the previous range under the switch while comparing, and a
///    warning while the custom range is invalid or longer than 366 days.
class RptPeriodBar extends StatelessWidget {
  const RptPeriodBar({
    super.key,
    required this.controller,
    this.showPeriod = true,
    this.showCompare = true,
    this.showBranch = true,
    this.accent = RptColors.indigo,
  });

  final RptPeriodController controller;
  final bool showPeriod;
  final bool showCompare;
  final bool showBranch;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final c = controller;
        return Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(showPeriod ? 'PERIOD' : 'SCOPE', style: AppText.eyebrow()),
              const SizedBox(height: 8),
              if (showPeriod)
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final p in IncomePeriod.values)
                        if (p != IncomePeriod.custom) ...[
                          TeamFilterChip(
                            label: p.label,
                            selected: c.period == p,
                            color: accent,
                            onTap: () => c.setPeriod(p),
                          ),
                          const SizedBox(width: 8),
                        ],
                      TeamFilterChip(
                        label: c.period == IncomePeriod.custom
                            ? c.customLabel
                            : 'Custom…',
                        selected: c.period == IncomePeriod.custom,
                        color: accent,
                        onTap: () => c.pickCustom(context),
                      ),
                    ],
                  ),
                )
              else
                Text(
                  'This report is a current snapshot, so it has no date range.',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.inkFaint,
                    weight: FontWeight.w600,
                  ),
                ),
              if (showPeriod && !c.rangeReady) ...[
                const SizedBox(height: 8),
                Text(
                  c.rangeInverted
                      ? 'Start date must be on or before the end date.'
                      : 'Range may not exceed $kRptMaxRangeDays days.',
                  style: AppText.body(
                    size: 12,
                    color: RptColors.rose,
                    weight: FontWeight.w700,
                  ),
                ),
              ],
              if (showBranch) ...[
                const SizedBox(height: 10),
                TeamToolbarButton(
                  icon: Icons.storefront_rounded,
                  label: c.branchLabel,
                  active: c.branchId != null,
                  onTap: () => c.pickBranch(context),
                ),
              ],
              if (showPeriod && showCompare) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Compare with previous period',
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Switch(
                      key: const ValueKey('rpt-compare'),
                      value: c.compare,
                      activeThumbColor: Colors.white,
                      activeTrackColor: RptColors.violet,
                      onChanged: c.setCompare,
                    ),
                  ],
                ),
                if (c.compare && c.rangeReady)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Text(
                      'Previous period: '
                      '${rptShortDate(c.previousRange.from)} – '
                      '${rptShortDate(c.previousRange.to)}',
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ],
          ),
        );
      },
    );
  }
}
