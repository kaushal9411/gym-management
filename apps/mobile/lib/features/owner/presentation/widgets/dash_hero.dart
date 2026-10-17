import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_routes.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../models/dashboard_kpis.dart';
import 'dash_ui.dart';

const _weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const _months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

String _greeting(DateTime now) {
  if (now.hour < 12) return 'Good morning';
  if (now.hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/// Web's `DashboardHero`: date, greeting, the shared 7/30/90-day range,
/// quick actions (each hidden without its permission) and the three
/// "today at a glance" tiles (only with `reports:view`).
class DashHero extends StatelessWidget {
  const DashHero({
    super.key,
    required this.firstName,
    required this.tenantName,
    required this.kpis,
    required this.rangeDays,
    required this.onRangeChanged,
    required this.canAddMember,
    required this.canRecordPayment,
    required this.canCheckIn,
  });

  final String firstName;
  final String tenantName;
  final DashboardKpis? kpis;
  final int rangeDays;
  final ValueChanged<int> onRangeChanged;
  final bool canAddMember;
  final bool canRecordPayment;
  final bool canCheckIn;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final date =
        '${_weekdays[now.weekday - 1]}, ${now.day} ${_months[now.month - 1]} ${now.year}';
    final actions = <Widget>[
      if (canAddMember)
        _HeroAction(
          icon: Icons.person_add_alt_1_rounded,
          label: 'Add member',
          onTap: () => context.push(AppRoutes.memberForm),
        ),
      if (canRecordPayment)
        _HeroAction(
          icon: Icons.account_balance_wallet_rounded,
          label: 'Record payment',
          onTap: () => context.push(AppRoutes.recordPayment),
        ),
      if (canCheckIn)
        _HeroAction(
          icon: Icons.how_to_reg_rounded,
          label: 'Check in',
          onTap: () => context.push(AppRoutes.attendance),
        ),
    ];
    final k = kpis;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: Dash.heroGradient,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C3AED).withValues(alpha: 0.32),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            date.toUpperCase(),
            style: AppText.body(
              size: 10,
              weight: FontWeight.w800,
              color: Colors.white.withValues(alpha: 0.82),
            ).copyWith(letterSpacing: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            '${_greeting(now)}, $firstName',
            style: AppText.display(size: 26, color: Colors.white),
          ),
          const SizedBox(height: 2),
          Text(
            "Here's how $tenantName is doing today.",
            style: AppText.body(
              size: 13,
              color: Colors.white.withValues(alpha: 0.86),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                for (final d in const [7, 30, 90])
                  Expanded(
                    child: Semantics(
                      button: true,
                      selected: rangeDays == d,
                      label: 'Last $d days',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => onRangeChanged(d),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 9),
                          decoration: BoxDecoration(
                            color: rangeDays == d
                                ? Colors.white
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(9),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '$d days',
                            style: AppText.body(
                              size: 12,
                              weight: rangeDays == d
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                              color: rangeDays == d
                                  ? const Color(0xFF4338CA)
                                  : Colors.white.withValues(alpha: 0.92),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (actions.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                for (var i = 0; i < actions.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(child: actions[i]),
                ],
              ],
            ),
          ],
          if (k != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _GlanceTile(
                    color: Dash.aqua,
                    value: k.todaysAttendance.toDouble(),
                    label: 'Check-ins today',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _GlanceTile(
                    color: Dash.warning,
                    value: k.expiringMemberships.toDouble(),
                    label: 'Expiring in 30 days',
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _GlanceTile(
                    color: Dash.danger,
                    value: k.outstandingPayments,
                    label: 'Due now',
                    money: true,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroAction extends StatelessWidget {
  const _HeroAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withValues(alpha: 0.28)),
            ),
            child: Column(
              children: [
                Icon(icon, size: 16, color: Colors.white),
                const SizedBox(height: 3),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

/// White tile on the gradient, same on both themes (like web's hero).
class _GlanceTile extends StatelessWidget {
  const _GlanceTile({
    required this.color,
    required this.value,
    required this.label,
    this.money = false,
  });

  final Color color;
  final double value;
  final String label;
  final bool money;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 22,
              height: 3,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(9),
              ),
            ),
            const SizedBox(height: 6),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: DashCountUp(
                value: value,
                format: (n) => money
                    ? Formatters.currencyCompact(n)
                    : n.round().toString(),
                style: AppText.display(
                  size: 22,
                  color: const Color(0xFF16132B),
                ),
              ),
            ),
            Text(
              label,
              maxLines: 2,
              style: AppText.body(
                size: 10.5,
                weight: FontWeight.w600,
                color: const Color(0xFF5B5878),
              ),
            ),
          ],
        ),
      );
}
