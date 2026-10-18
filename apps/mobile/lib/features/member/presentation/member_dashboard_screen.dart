import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../models/gym_info.dart';
import '../../../models/member_invoice.dart';
import '../../../models/member_overview.dart';
import '../../../models/member_portal_profile.dart';
import '../../../models/member_visit.dart';
import '../../../models/member_workout_assignment.dart';
import '../../../repositories/member_portal_repository.dart';
import '../../../shared/widgets/adaptive_columns.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/motion.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamCenter, TeamColors;
import 'member_dashboard_detail_sheet.dart';
import 'member_pay_invoice_sheet.dart';
import 'member_renew_sheet.dart';
import 'widgets/member_dash_ui.dart';

/// Member Dashboard — web's `/portal/dashboard`, redesigned for phone and
/// tablet, in the member palette (lime → teal).
///
/// Same order as web: the hero (greeting, plan + validity, id / status /
/// branch chips, days-left ring, Total visits / Streak / This month, and the
/// Renew / Book class / My QR actions), six stat tiles, then the cards —
/// Attendance (12-week heatmap, weekday bars, best streak / avg visit / last
/// visit), Upcoming classes, Workout, Body snapshot, Recent invoices (with a
/// Pay strip for the first unpaid one), Your gym, My data.
///
/// Data: `GET /portal/overview` drives the hero, tiles and the attendance /
/// classes / workout / billing numbers (a failure shows the retry view, like
/// the page has nothing to show without it); `/portal/me` (QR, plan for the
/// sheets), visits, workout and invoices feed the tile detail sheets and the
/// invoices card; measurements and gym info load on their own and only their
/// card degrades. Tiles Membership, Visits, Workout and Outstanding open the
/// same detail sheets as before; the diet tile jumps to the Diet tab.
///
/// Dropped vs web: the "My data" card links to the existing export screen
/// instead of downloading inline; the hero does not extend behind the status
/// bar (the shell's SafeArea owns it); chart hover tooltips (long-press).
class MemberDashboardScreen extends StatefulWidget {
  const MemberDashboardScreen({required this.onQuickAction, super.key});

  /// Jumps the shell to the Workout (1) / Diet (2) / Classes (3) tab.
  final ValueChanged<int> onQuickAction;

  @override
  State<MemberDashboardScreen> createState() => _MemberDashboardScreenState();
}

class _MemberDashboardScreenState extends State<MemberDashboardScreen> {
  MemberOverview? _overview;
  MemberPortalProfile? _profile;
  List<MemberVisit> _visits = const [];
  MemberWorkoutAssignment? _workout;
  List<MemberInvoice> _invoices = const [];
  List<BodyMeasurement>? _measurements;
  bool _measurementsLoading = true;
  GymInfo? _gym;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<T?> _tolerant<T>(Future<T> f) async {
    try {
      return await f;
    } catch (_) {
      return null;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = _overview == null;
      _error = null;
    });
    final repo = getIt<MemberPortalRepository>();
    // Optional pieces start now and fill their cards when they land.
    _tolerant(repo.measurements()).then((m) {
      if (mounted) {
        setState(() {
          _measurements = m;
          _measurementsLoading = false;
        });
      }
    });
    _tolerant(repo.gymInfo()).then((g) {
      if (mounted && g != null) setState(() => _gym = g);
    });
    try {
      final overviewF = repo.overview();
      final profileF = repo.me();
      final visitsF = _tolerant(repo.attendance(limit: 60));
      final workoutF = _tolerant(repo.workout());
      final invoicesF = _tolerant(repo.invoices(limit: 20));
      final overview = await overviewF;
      final profile = await profileF;
      final visits = await visitsF;
      final workout = await workoutF;
      final invoices = await invoicesF;
      if (!mounted) return;
      setState(() {
        _overview = overview;
        _profile = profile;
        _visits = visits?.items ?? const [];
        _workout = workout;
        _invoices = invoices?.items ?? const [];
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not load your dashboard ($e)');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String get _greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  void _openDetail(MemberDashboardStatKind kind) {
    final profile = _profile;
    if (profile == null) return;
    showMemberDashboardDetailSheet(
      context,
      kind: kind,
      profile: profile,
      visits: _visits,
      workout: _workout,
      invoices: _invoices,
      onViewWorkout: () => widget.onQuickAction(1),
      onInvoicePaid: _load,
    );
  }

  Future<void> _renew() async {
    final plan = _overview?.membership?.planName ?? 'Membership';
    final renewed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberRenewSheet(planName: plan),
    );
    if (renewed == true) _load();
  }

  Future<void> _pay(MemberInvoice inv) async {
    final paid = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => MemberPayInvoiceSheet(
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.totalAmount,
      ),
    );
    if (paid == true) _load();
  }

  void _showQr() {
    final url = _profile?.qrCodeImageUrl;
    if (url == null) return;
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        title: Text('Check-in QR code', style: AppText.display(size: 18)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Show this at the front desk to check in.',
              style: AppText.body(size: 12.5, color: AppColors.inkFaint),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: memberQrImage(url),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const AppLoadingView(role: AppRole.member);
    final o = _overview;
    if (o == null) {
      return AppErrorView(
        message: _error ?? 'Could not load your dashboard.',
        onRetry: _load,
        role: AppRole.member,
      );
    }

    // Name/photo follow the session so a self-service edit shows up here
    // immediately (this tab is cached by the shell's IndexedStack).
    final session = context.watch<SessionCubit>().state;
    final sessionMember =
        session is SessionAuthenticatedMember ? session.member : null;
    final displayName = (sessionMember?.name.isNotEmpty ?? false)
        ? sessionMember!.name
        : o.member.name;

    return RefreshIndicator(
      color: AppColors.memberB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 90),
        children: [
          MemberHero(
            overview: o,
            greeting: _greeting,
            displayName: displayName,
            avatarUrl: sessionMember?.profilePhotoUrl ?? o.member.photoUrl,
            hasQr: (_profile?.qrCodeImageUrl ?? '').isNotEmpty,
            onRenew: _renew,
            onBook: () => widget.onQuickAction(3),
            onQr: _showQr,
            onProfile: () => context.push(AppRoutes.memberProfile),
          ),
          TeamCenter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _tiles(o),
                  const SizedBox(height: 14),
                  AdaptiveColumns(
                    fullWidth: [
                      StaggeredReveal(
                        index: 1,
                        child: MemberAttendanceCard(
                          attendance: o.attendance,
                          onHistory: () =>
                              context.push(AppRoutes.memberAttendance),
                        ),
                      ),
                    ],
                    children: [
                      MemberClassesCard(
                        classes: o.upcomingClasses,
                        onBook: () => widget.onQuickAction(3),
                      ),
                      MemberWorkoutCard(
                        workout: o.workout,
                        onOpen: () => widget.onQuickAction(1),
                      ),
                      MemberBodyCard(
                        measurements: _measurements,
                        loading: _measurementsLoading,
                        onAll: () => context.push(AppRoutes.memberMeasurements),
                      ),
                      MemberBillingCard(
                        invoices: _invoices,
                        billing: o.billing,
                        onAll: () => context.push(AppRoutes.memberInvoices),
                        onPay: _pay,
                      ),
                      MemberGymCard(
                        overview: o,
                        gym: _gym,
                        onMore: () => context.push(AppRoutes.memberGymInfo),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  MemberDataCard(
                    onExport: () => context.push(AppRoutes.memberDataExport),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tiles(MemberOverview o) {
    final m = o.membership;
    final a = o.attendance;
    final w = o.workout;
    final d = o.diet;
    final msColor = m == null
        ? TeamColors.slate
        : m.expired
            ? TeamColors.rose
            : (m.daysLeft <= 7 ? TeamColors.amber : TeamColors.violet);
    final due = o.billing.outstanding;
    String count(double v) => v.round().toString();
    return MemberTileGrid(
      tiles: [
        MemberStatTile(
          label: 'Membership',
          icon: Icons.event_available_rounded,
          color: msColor,
          value: m == null
              ? const Text('None')
              : m.expired
                  ? const Text('Expired')
                  : AnimatedNumber(
                      value: m.daysLeft.toDouble(),
                      format: (v) => '${v.round()}d left',
                    ),
          hint: m == null
              ? 'Talk to the front desk'
              : '${m.expired ? 'Ended' : 'Ends'} ${_short(m.endDate)}',
          progress: m == null || m.totalDays <= 0 ? null : m.remainingFraction,
          onTap: () => _openDetail(MemberDashboardStatKind.membership),
        ),
        MemberStatTile(
          label: 'Visits this month',
          icon: Icons.login_rounded,
          color: TeamColors.sky,
          value: AnimatedNumber(
            value: a.thisMonthVisits.toDouble(),
            format: count,
          ),
          hint: 'vs ${a.previousMonthVisits} last month',
          delta: a.deltaPercent,
          onTap: () => _openDetail(MemberDashboardStatKind.attendance),
        ),
        MemberStatTile(
          label: 'Current streak',
          icon: Icons.local_fire_department_rounded,
          color: const Color(0xFFF97316),
          value: AnimatedNumber(
            value: a.currentStreakDays.toDouble(),
            format: (v) => '${v.round()}d',
          ),
          hint:
              'Best ${a.bestStreakDays} ${a.bestStreakDays == 1 ? 'day' : 'days'}',
        ),
        MemberStatTile(
          label: 'Workout progress',
          icon: Icons.fitness_center_rounded,
          color: const Color(0xFFF97316),
          value: w == null
              ? const Text('—')
              : AnimatedNumber(
                  value: w.progressPercent.toDouble(),
                  format: (v) => '${v.round()}%',
                ),
          hint: w == null
              ? 'No plan assigned'
              : '${w.completedExercises}/${w.totalExercises} exercises',
          progress: w == null ? null : w.progressPercent / 100,
          onTap: () => _openDetail(MemberDashboardStatKind.workout),
        ),
        if (d != null)
          MemberStatTile(
            label: 'Diet today',
            icon: Icons.restaurant_rounded,
            color: d.loggedToday ? TeamColors.green : TeamColors.amber,
            value: Text(d.loggedToday ? 'Logged' : 'Not yet'),
            hint: d.waterTodayMl != null
                ? '${d.waterTodayMl} ml water'
                : d.dailyCalories != null
                    ? '${d.dailyCalories} kcal plan'
                    : d.planName,
            onTap: () => widget.onQuickAction(2),
          )
        else
          MemberStatTile(
            label: 'Total visits',
            icon: Icons.login_rounded,
            color: TeamColors.green,
            value: AnimatedNumber(
              value: a.totalVisits.toDouble(),
              format: count,
            ),
            hint: 'All time',
            onTap: () => _openDetail(MemberDashboardStatKind.attendance),
          ),
        MemberStatTile(
          label: 'Outstanding',
          icon: Icons.account_balance_wallet_outlined,
          color: due > 0 ? TeamColors.amber : TeamColors.green,
          value: due > 0
              ? AnimatedNumber(value: due, format: memberMoney)
              : const Text('All paid'),
          hint: due > 0
              ? '${o.billing.outstandingInvoiceCount} '
                  '${o.billing.outstandingInvoiceCount == 1 ? 'invoice' : 'invoices'}'
                  '${o.billing.nextDueDate != null ? ' · due ${_short(o.billing.nextDueDate!)}' : ''}'
              : 'Nothing due',
          onTap: () => _openDetail(MemberDashboardStatKind.outstanding),
        ),
      ],
    );
  }

  String _short(String iso) {
    final d = DateTime.tryParse(iso);
    if (d == null) return iso;
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${d.day} ${m[d.month - 1]}';
  }
}
