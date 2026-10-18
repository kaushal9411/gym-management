import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../bloc/session/session_cubit.dart';
import '../../../../bloc/session/session_state.dart';
import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/user_profile.dart';
import '../../../team/presentation/widgets/team_ui.dart';
import '../analytics/analytics_logic.dart';
import '../kit/kit.dart';

/// Who may see what on the Reports Center. **Entry points are unchanged**
/// (Owner "Reports" tab, Menu -> Analytics); inside the hub the gating now
/// mirrors web's hub and uses the same keys the API enforces:
///
///  * insights (period bar, KPIs, charts) — `reports:view` (as before: the
///    old header hid itself without it);
///  * report tiles — `reports:view` (every `/reports/*` route requires it);
///  * analytics tiles + the hero's Analytics button — `analytics:view`;
///  * Scheduled Reports tile / panel — `reports:view` (`GET /reports/scheduled`).
///
/// Managing schedules (`reports:export`) is gated in the Scheduled screens.
class HubAccess {
  const HubAccess(this.user);

  static HubAccess of(BuildContext context) {
    final s = context.read<SessionCubit>().state;
    return HubAccess(s is SessionAuthenticatedStaff ? s.user : null);
  }

  final UserProfile? user;

  bool _has(String key) => user?.hasPermission(key) ?? false;

  bool get canViewReports => _has('reports:view');
  bool get canViewAnalytics => _has('analytics:view');
  bool get canExport => _has('reports:export');

  bool allows(HubEntry e) =>
      e.permission == 'analytics:view' ? canViewAnalytics : canViewReports;
}

/// Catalogue groups (web's `REPORT_CATEGORIES`).
enum HubCategory { members, finance, attendance, staffOps, analytics }

extension HubCategoryX on HubCategory {
  String get label => switch (this) {
        HubCategory.members => 'Members',
        HubCategory.finance => 'Finance',
        HubCategory.attendance => 'Attendance',
        HubCategory.staffOps => 'Staff & Operations',
        HubCategory.analytics => 'Analytics',
      };

  String get description => switch (this) {
        HubCategory.members => 'Memberships, status and progress',
        HubCategory.finance => 'Revenue, expenses and payments',
        HubCategory.attendance => 'Check-ins and footfall',
        HubCategory.staffOps => 'Team, trainers and branches',
        HubCategory.analytics => 'Trends and comparisons over time',
      };

  Color get color => switch (this) {
        HubCategory.members => RptAccent.members.color,
        HubCategory.finance => RptAccent.finance.color,
        HubCategory.attendance => RptAccent.attendance.color,
        HubCategory.staffOps => RptAccent.staff.color,
        HubCategory.analytics => RptAccent.analytics.color,
      };
}

/// One report or analytics view on the hub.
class HubEntry {
  const HubEntry({
    required this.title,
    required this.description,
    required this.icon,
    required this.category,
    required this.route,
    this.accent,
    this.permission = 'reports:view',
    this.extra,
  });

  final String title;
  final String description;
  final IconData icon;
  final HubCategory category;
  final String route;

  /// Overrides the category colour (Branch Performance is "operations").
  final Color? accent;

  /// `reports:view` or `analytics:view`.
  final String permission;

  /// Route `extra` (the analytics view to open).
  final Object? extra;

  Color get color => accent ?? category.color;
}

HubEntry _analytics(AnalyticsView v, Color color) => HubEntry(
      title: v.title,
      description: switch (v) {
        AnalyticsView.revenue => 'Income vs expenses over time.',
        AnalyticsView.attendance => 'Daily check-in volume.',
        AnalyticsView.membershipGrowth => 'Active membership count over time.',
        AnalyticsView.newMembers => 'Sign-ups per day.',
        AnalyticsView.retention => 'How many members stay.',
        AnalyticsView.collection => 'Collected vs refunded over time.',
        AnalyticsView.branches => 'Members, revenue and attendance by branch.',
      },
      icon: v.icon,
      category: HubCategory.analytics,
      route: AppRoutes.analytics,
      accent: color,
      permission: 'analytics:view',
      extra: v,
    );

/// All 11 reports + 7 analytics views (web's `REPORT_CATALOG`), with the
/// descriptions web uses.
final List<HubEntry> kHubCatalog = [
  const HubEntry(
    title: 'Membership Report',
    description: 'Members with plan, status, and dates.',
    icon: Icons.assignment_rounded,
    category: HubCategory.members,
    route: AppRoutes.membershipReport,
  ),
  const HubEntry(
    title: 'Member Progress',
    description: 'Workout and diet adherence.',
    icon: Icons.insights_rounded,
    category: HubCategory.members,
    route: AppRoutes.memberProgressReport,
  ),
  const HubEntry(
    title: 'Expiring Memberships',
    description: 'Memberships ending within 30 days.',
    icon: Icons.hourglass_bottom_rounded,
    category: HubCategory.members,
    route: AppRoutes.expiringMembershipsReport,
  ),
  const HubEntry(
    title: 'Active vs Inactive',
    description: 'Member count by status.',
    icon: Icons.pie_chart_rounded,
    category: HubCategory.members,
    route: AppRoutes.churnReport,
  ),
  const HubEntry(
    title: 'Revenue Report',
    description: 'Successful payments over time.',
    icon: Icons.trending_up_rounded,
    category: HubCategory.finance,
    route: AppRoutes.revenueReport,
  ),
  const HubEntry(
    title: 'Expense Report',
    description: 'Recorded expenses over time.',
    icon: Icons.account_balance_wallet_rounded,
    category: HubCategory.finance,
    route: AppRoutes.expenseReport,
  ),
  const HubEntry(
    title: 'Payment Report',
    description: 'Every payment, with status.',
    icon: Icons.credit_card_rounded,
    category: HubCategory.finance,
    route: AppRoutes.paymentReport,
  ),
  const HubEntry(
    title: 'Attendance Report',
    description: 'Check-ins and check-outs over time.',
    icon: Icons.how_to_reg_rounded,
    category: HubCategory.attendance,
    route: AppRoutes.attendanceReport,
  ),
  const HubEntry(
    title: 'Staff Report',
    description: 'Managers, trainers, and receptionists.',
    icon: Icons.badge_rounded,
    category: HubCategory.staffOps,
    route: AppRoutes.staffReport,
  ),
  const HubEntry(
    title: 'Trainer Performance',
    description: 'Assigned members and active plans.',
    icon: Icons.emoji_events_rounded,
    category: HubCategory.staffOps,
    route: AppRoutes.staffPerformanceReport,
  ),
  const HubEntry(
    title: 'Branch Performance',
    description: 'Members, revenue, and attendance per branch.',
    icon: Icons.storefront_rounded,
    category: HubCategory.staffOps,
    route: AppRoutes.branchPerformanceReport,
    accent: RptColors.sky,
  ),
  _analytics(AnalyticsView.revenue, RptColors.green),
  _analytics(AnalyticsView.attendance, RptColors.teal),
  _analytics(AnalyticsView.membershipGrowth, RptColors.indigo),
  _analytics(AnalyticsView.newMembers, RptColors.indigo),
  _analytics(AnalyticsView.retention, RptColors.violet),
  _analytics(AnalyticsView.collection, RptColors.green),
  _analytics(AnalyticsView.branches, RptColors.sky),
];

/// Entries the viewer may open, narrowed by [query] and [category] — pure so
/// the gating matrix can be unit-tested.
List<HubEntry> filterHubEntries(
  HubAccess access, {
  String query = '',
  HubCategory? category,
}) {
  final q = query.trim().toLowerCase();
  return [
    for (final e in kHubCatalog)
      if (access.allows(e) &&
          (category == null || e.category == category) &&
          (q.isEmpty ||
              '${e.title} ${e.description}'.toLowerCase().contains(q)))
        e,
  ];
}

/// "Report catalogue": search, category chips with counts and the entries
/// grouped by category as tappable cards (1 column on phones, 2 / 3 from
/// 600 / 1000 dp).
class HubCatalogue extends StatefulWidget {
  const HubCatalogue({super.key, required this.access});

  final HubAccess access;

  @override
  State<HubCatalogue> createState() => _HubCatalogueState();
}

class _HubCatalogueState extends State<HubCatalogue> {
  String _query = '';
  HubCategory? _category;

  @override
  Widget build(BuildContext context) {
    final allowed = filterHubEntries(widget.access);
    if (allowed.isEmpty) return const SizedBox.shrink();
    final shown = filterHubEntries(
      widget.access,
      query: _query,
      category: _category,
    );
    final cats = [
      for (final c in HubCategory.values)
        if (allowed.any((e) => e.category == c)) c,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Report catalogue', style: AppText.display(size: 19)),
        const SizedBox(height: 2),
        Text(
          'Detailed reports and analytics views.',
          style: AppText.body(
            size: 12.5,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        TeamSearchField(
          hint: 'Search reports…',
          onSearch: (v) => setState(() => _query = v),
        ),
        const SizedBox(height: 10),
        RptFilterChips<HubCategory?>(
          color: RptColors.violet,
          value: _category,
          onChanged: (v) => setState(() => _category = v),
          chips: [
            RptChip<HubCategory?>(null, 'All', count: allowed.length),
            for (final c in cats)
              RptChip<HubCategory?>(
                c,
                c.label,
                count: allowed.where((e) => e.category == c).length,
                dot: c.color,
              ),
          ],
        ),
        const SizedBox(height: 14),
        if (shown.isEmpty)
          const RptChartEmpty(
            height: 120,
            message: 'No reports match — try a different search or category.',
            icon: Icons.search_off_rounded,
          )
        else
          for (final c in cats)
            if (shown.any((e) => e.category == c)) ...[
              _GroupHeader(category: c),
              const SizedBox(height: 8),
              _CardGrid(
                entries: [
                  for (final e in shown)
                    if (e.category == c) e,
                ],
              ),
              const SizedBox(height: 16),
            ],
      ],
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.category});

  final HubCategory category;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: category.color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 8),
        Text(category.label.toUpperCase(), style: AppText.eyebrow()),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            category.description,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.body(
              size: 11.5,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _CardGrid extends StatelessWidget {
  const _CardGrid({required this.entries});

  final List<HubEntry> entries;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final cols = box.maxWidth >= 1000
            ? 3
            : box.maxWidth >= 600
                ? 2
                : 1;
        const gap = 10.0;
        final w = (box.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (var i = 0; i < entries.length; i++)
              SizedBox(
                width: w,
                child: RptReveal(
                  index: i,
                  child: HubEntryCard(entry: entries[i]),
                ),
              ),
          ],
        );
      },
    );
  }
}

/// One catalogue card: gradient icon chip, title, two-line description and an
/// "Open" cue in the entry's colour.
class HubEntryCard extends StatelessWidget {
  const HubEntryCard({super.key, required this.entry});

  final HubEntry entry;

  @override
  Widget build(BuildContext context) {
    final c = entry.color;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: () => context.push(entry.route, extra: entry.extra),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [c.withValues(alpha: 0.13), Colors.transparent],
            ),
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: c.withValues(alpha: 0.22)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [c, Color.lerp(c, RptColors.fuchsia, 0.45)!],
                  ),
                  borderRadius: BorderRadius.circular(13),
                  boxShadow: [
                    BoxShadow(
                      color: c.withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Icon(entry.icon, size: 21, color: Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(size: 14, weight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body(
                        size: 11.5,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Open',
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w800,
                            color: c,
                          ),
                        ),
                        const SizedBox(width: 2),
                        Icon(Icons.arrow_outward_rounded, size: 14, color: c),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
