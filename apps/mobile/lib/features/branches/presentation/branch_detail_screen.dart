import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'branch_actions.dart';
import 'branch_ui.dart';
import 'widgets/branch_holidays_editor.dart';
import 'widgets/branch_hours_editor.dart';

const _tabNames = ['Overview', 'Schedule', 'Manage'];

/// Branch profile (`GET /branches/:id`), redesigned to mirror web's
/// `/branches/[branchId]` page and the Member / Staff profiles: animated
/// gradient hero (call / map / WhatsApp / edit), four summary tiles and three
/// tabs.
///
/// - **Overview** — capacity ring with members vs capacity / max members /
///   max staff, contact (with call / WhatsApp / email), address (with an
///   "Open in maps" link, coordinates, timezone) and notes. Each card has an
///   Edit chip gated by `branches:update`.
/// - **Schedule** — the weekly operating hours (today highlighted) and the
///   holidays, each with its own edit screen.
/// - **Manage** — profile completeness checklist, the lifecycle actions web
///   puts in the hero (Set as default, Activate / Deactivate, Delete — gated by
///   `branches:update` / `activate` / `delete`) and record dates.
///
/// The Members / Staff tiles open a sheet listing the first 20 people of the
/// branch (needs `members:view` / `staff:view`), tapping one opens their
/// profile. Soft-deleted branches 404 on this endpoint, so the list opens a
/// restore sheet for them instead of this screen.
///
/// Dropped vs. web: nothing with an endpoint — web's page is just the edit
/// form plus the hero actions, all of which are here. "Open now" isn't
/// claimed: the branch timezone can't be resolved without a tz database, so
/// "Today" simply shows the saved hours of the device's weekday.
class BranchDetailScreen extends StatefulWidget {
  const BranchDetailScreen({super.key, required this.branchId});

  final String branchId;

  @override
  State<BranchDetailScreen> createState() => _BranchDetailScreenState();
}

class _BranchDetailScreenState extends State<BranchDetailScreen> {
  Branch? _branch;
  String? _error;
  bool _busy = false;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final branch = await getIt<BranchRepository>().getById(widget.branchId);
      if (!mounted) return;
      setState(() => _branch = branch);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not load this branch ($e)');
    }
  }

  Future<void> _push(String route, Branch b) =>
      context.push(route, extra: b).then((_) => _load());

  Future<void> _run(BranchAction action) async {
    final b = _branch!;
    setState(() => _busy = true);
    try {
      final done = await runBranchAction(context, b, action);
      if (!mounted) return;
      if (done && action == BranchAction.delete) {
        context.pop();
        return;
      }
      if (done) await _load();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _openPeople({required bool members}) {
    final b = _branch!;
    showTeamSheet<void>(
      context,
      (sheetContext) => TeamSheetScaffold(
        icon: members ? Icons.groups_rounded : Icons.badge_rounded,
        title: members ? 'Members' : 'Staff',
        subtitle: b.name,
        color: members ? TeamColors.violet : TeamColors.teal,
        child: _BranchPeople(
          branchId: b.id,
          members: members,
          onOpen: (id) {
            Navigator.of(sheetContext).pop();
            context.push(
              members ? AppRoutes.memberDetail : AppRoutes.staffDetail,
              extra: id,
            );
          },
        ),
      ),
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final b = _branch;
    final hero = b != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: Text(hero ? 'Branch' : 'Branches'),
        actions: [if (b != null && _error == null) _overflow(b)],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : b == null
                ? const AppLoadingView()
                : _content(b),
      ),
    );
  }

  List<BranchAction> _actions(Branch b) => availableBranchActions(
        b,
        canUpdate: teamCan(context, 'branches:update'),
        canActivate: teamCan(context, 'branches:activate'),
        canDelete: teamCan(context, 'branches:delete'),
        canRestore: teamCan(context, 'branches:restore'),
      );

  Widget _overflow(Branch b) {
    final canUpdate = teamCan(context, 'branches:update');
    final actions = _actions(b);
    if (!canUpdate && actions.isEmpty) return const SizedBox.shrink();
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded),
      color: AppColors.surface2,
      onSelected: (v) {
        if (v == 'edit') {
          _push(AppRoutes.branchForm, b);
        } else {
          _run(BranchAction.values.firstWhere((a) => a.name == v));
        }
      },
      itemBuilder: (_) => [
        if (canUpdate)
          const PopupMenuItem(value: 'edit', child: Text('Edit branch')),
        for (final a in actions)
          PopupMenuItem(
            value: a.name,
            child: Text(
              a.label,
              style: a == BranchAction.delete
                  ? const TextStyle(color: AppColors.danger)
                  : null,
            ),
          ),
      ],
    );
  }

  Widget _content(Branch b) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final canUpdate = teamCan(context, 'branches:update');
    final canMembers = teamCan(context, 'members:view');
    final canStaff = teamCan(context, 'staff:view');
    final tone = branchTone(b);
    final maps = directionsUri(b);
    final hasPhone = b.phone != null && b.phone!.isNotEmpty;
    final hasWa = b.whatsappNumber != null && b.whatsappNumber!.isNotEmpty;
    final today = b.operatingHours[todayKey()];
    final usage = b.capacityUsage;

    return RefreshIndicator(
      color: AppColors.staffB,
      backgroundColor: AppColors.surface2,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          BranchHeroShell(
            topInset: top,
            child: Column(
              children: [
                FadeUp(
                  index: 0,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      SpinningRing(
                        size: 104,
                        child: Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF312E81), Color(0xFFC026D3)],
                            ),
                          ),
                          child: const Center(
                            child: Icon(
                              Icons.storefront_rounded,
                              size: 44,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                      Positioned(
                        left: 4,
                        top: 6,
                        child: Container(
                          padding: const EdgeInsets.all(3),
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: PulseDot(color: tone, size: 10),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 1,
                  child: Text(
                    b.name,
                    textAlign: TextAlign.center,
                    style: AppText.display(size: 27, color: Colors.white),
                  ),
                ),
                const SizedBox(height: 4),
                FadeUp(
                  index: 2,
                  child: Text(
                    [
                      if (b.branchCode.isNotEmpty) b.branchCode,
                      if (b.location.isNotEmpty) b.location,
                    ].join(' · '),
                    textAlign: TextAlign.center,
                    style: AppText.body(
                      size: 12.5,
                      weight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                FadeUp(
                  index: 3,
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      TeamHeroPill(branchStatus(b), dot: tone),
                      if (b.isDefault)
                        const TeamHeroPill(
                          'Default branch',
                          icon: Icons.star_rounded,
                        ),
                      TeamHeroPill(
                        b.allowCheckIn ? 'Check-in on' : 'Check-in off',
                        icon: b.allowCheckIn
                            ? Icons.how_to_reg_rounded
                            : Icons.do_not_disturb_on_rounded,
                      ),
                      TeamHeroPill(b.timezone, icon: Icons.public_rounded),
                    ],
                  ),
                ),
                if (hasPhone || maps != null || hasWa || canUpdate) ...[
                  const SizedBox(height: 14),
                  FadeUp(
                    index: 4,
                    child: Row(
                      children: [
                        if (hasPhone)
                          TeamHeroAction(
                            label: 'Call',
                            icon: Icons.call_rounded,
                            onTap: () => branchLaunch(
                              context,
                              Uri(scheme: 'tel', path: b.phone),
                            ),
                          ),
                        if (hasWa) ...[
                          if (hasPhone) const SizedBox(width: 8),
                          TeamHeroAction(
                            label: 'Chat',
                            icon: Icons.chat_rounded,
                            onTap: () => branchLaunch(
                              context,
                              whatsappUri(b.whatsappNumber!),
                            ),
                          ),
                        ],
                        if (maps != null) ...[
                          if (hasPhone || hasWa) const SizedBox(width: 8),
                          TeamHeroAction(
                            label: 'Map',
                            icon: Icons.directions_rounded,
                            onTap: () => branchLaunch(context, maps),
                          ),
                        ],
                        if (canUpdate) ...[
                          if (hasPhone || hasWa || maps != null)
                            const SizedBox(width: 8),
                          TeamHeroAction(
                            label: 'Edit',
                            icon: Icons.edit_rounded,
                            onTap: () => _push(AppRoutes.branchForm, b),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              16 + teamSideInset(context),
              14,
              16 + teamSideInset(context),
              14,
            ),
            child: TeamSummaryGrid(
              tiles: [
                TeamSummaryTile(
                  index: 0,
                  icon: Icons.groups_rounded,
                  color: TeamColors.violet,
                  label: 'Members',
                  number: b.memberCount,
                  hint: b.maxMembers != null
                      ? 'of ${b.maxMembers} max'
                      : canMembers
                          ? 'Tap to see who'
                          : 'Assigned here',
                  onTap: canMembers ? () => _openPeople(members: true) : null,
                ),
                TeamSummaryTile(
                  index: 1,
                  icon: Icons.badge_rounded,
                  color: TeamColors.teal,
                  label: 'Staff',
                  number: b.staffCount,
                  hint: b.maxStaff != null
                      ? 'of ${b.maxStaff} max'
                      : canStaff
                          ? 'Tap to see who'
                          : 'Assigned here',
                  onTap: canStaff ? () => _openPeople(members: false) : null,
                ),
                if (usage != null)
                  TeamSummaryTile(
                    index: 2,
                    icon: Icons.speed_rounded,
                    color: usageColor(b.memberCount / b.capacity!),
                    label: 'Capacity used',
                    number: (b.memberCount / b.capacity! * 100).round(),
                    suffix: '%',
                    hint: '${b.memberCount} of ${b.capacity}',
                  )
                else
                  const TeamSummaryTile(
                    index: 2,
                    icon: Icons.speed_rounded,
                    color: TeamColors.slate,
                    label: 'Capacity used',
                    text: 'Not set',
                    hint: 'No capacity limit',
                  ),
                TeamSummaryTile(
                  index: 3,
                  icon: Icons.schedule_rounded,
                  color: TeamColors.amber,
                  label: 'Today · ${kDayShort[todayKey()]}',
                  text: today == null
                      ? 'Not set'
                      : today.closed
                          ? 'Closed'
                          : 'Open',
                  hint: today == null || today.closed ? 'Hours' : today.label,
                ),
              ],
            ),
          ),
          TeamTabBar(
            names: _tabNames,
            index: _tab,
            onChanged: (i) => setState(() => _tab = i),
          ),
          const SizedBox(height: 14),
          Padding(
            padding:
                EdgeInsets.symmetric(horizontal: 16 + teamSideInset(context)),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) => FadeTransition(
                opacity: anim,
                child: SlideTransition(
                  position: Tween(
                    begin: const Offset(0.04, 0),
                    end: Offset.zero,
                  ).animate(anim),
                  child: child,
                ),
              ),
              child: Column(
                key: ValueKey(_tab),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: switch (_tab) {
                  0 => _overview(b, canUpdate),
                  1 => _schedule(b, canUpdate),
                  _ => _manage(b),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Overview ──────────────────────────────────────────────────────────────

  List<Widget> _overview(Branch b, bool canUpdate) {
    void edit() => _push(AppRoutes.branchForm, b);
    final usage = b.capacityUsage;
    final maps = directionsUri(b);
    final hasPhone = b.phone != null && b.phone!.isNotEmpty;
    final hasEmail = b.email != null && b.email!.isNotEmpty;
    final hasWa = b.whatsappNumber != null && b.whatsappNumber!.isNotEmpty;
    final cards = <Widget>[
      TeamSectionCard(
        icon: Icons.speed_rounded,
        color: TeamColors.rose,
        title: 'Capacity & limits',
        subtitle: 'How full the branch is',
        onEdit: canUpdate ? edit : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                AnimatedRing(
                  value: usage ?? 0,
                  size: 96,
                  stroke: 10,
                  colors: usage == null
                      ? [TeamColors.slate, TeamColors.slate]
                      : [
                          usageColor(usage),
                          Color.lerp(
                            usageColor(usage),
                            TeamColors.fuchsia,
                            0.4,
                          )!,
                        ],
                  track: AppColors.surface3,
                  child: usage == null
                      ? Text(
                          '—',
                          style: AppText.display(
                            size: 20,
                            color: AppColors.inkFaint,
                          ),
                        )
                      : CountUp(
                          value: (usage * 100).round(),
                          suffix: '%',
                          style: AppText.display(
                            size: 20,
                            color: usageColor(usage),
                          ),
                        ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        b.capacity == null
                            ? 'No capacity set'
                            : '${b.memberCount} of ${b.capacity} places used',
                        style: AppText.body(size: 14, weight: FontWeight.w800),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        b.capacity == null
                            ? 'Add a capacity to track how full this branch is.'
                            : 'Members assigned to this branch against its '
                                'capacity.',
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w600,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (b.maxMembers != null || b.maxStaff != null) ...[
              const SizedBox(height: 14),
              if (b.maxMembers != null)
                UsageBar(
                  label: 'Members vs maximum',
                  used: b.memberCount,
                  limit: b.maxMembers,
                ),
              if (b.maxMembers != null && b.maxStaff != null)
                const SizedBox(height: 10),
              if (b.maxStaff != null)
                UsageBar(
                  label: 'Staff vs maximum',
                  used: b.staffCount,
                  limit: b.maxStaff,
                ),
            ],
            const SizedBox(height: 8),
            TeamCheckRow(
              label: b.allowCheckIn
                  ? 'Members can check in here'
                  : 'Check-in is switched off',
              ok: b.allowCheckIn,
              color: TeamColors.teal,
            ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.contact_phone_rounded,
        color: TeamColors.indigo,
        title: 'Contact',
        subtitle: 'How people reach the branch',
        onEdit: canUpdate ? edit : null,
        child: Column(
          children: [
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.call_rounded,
                  label: 'Phone',
                  value: b.phone,
                  color: TeamColors.green,
                ),
                TeamFieldTile(
                  icon: Icons.chat_rounded,
                  label: 'WhatsApp',
                  value: b.whatsappNumber,
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.mail_rounded,
                  label: 'Email',
                  value: b.email,
                  color: TeamColors.rose,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                TeamQuickAction(
                  icon: Icons.call_rounded,
                  label: 'Call',
                  color: TeamColors.green,
                  onTap: hasPhone
                      ? () => branchLaunch(
                            context,
                            Uri(scheme: 'tel', path: b.phone),
                          )
                      : null,
                ),
                TeamQuickAction(
                  icon: Icons.chat_rounded,
                  label: 'WhatsApp',
                  color: TeamColors.teal,
                  onTap: hasWa
                      ? () =>
                          branchLaunch(context, whatsappUri(b.whatsappNumber!))
                      : null,
                ),
                TeamQuickAction(
                  icon: Icons.mail_rounded,
                  label: 'Email',
                  color: TeamColors.indigo,
                  onTap: hasEmail
                      ? () => branchLaunch(
                            context,
                            Uri(scheme: 'mailto', path: b.email),
                          )
                      : null,
                ),
              ],
            ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.place_rounded,
        color: TeamColors.amber,
        title: 'Address',
        subtitle: 'Where the branch is',
        onEdit: canUpdate ? edit : null,
        child: Column(
          children: [
            TeamTileGrid(
              tiles: [
                TeamFieldTile(
                  icon: Icons.home_work_rounded,
                  label: 'Address line 1',
                  value: b.addressLine1,
                  color: TeamColors.amber,
                ),
                TeamFieldTile(
                  icon: Icons.signpost_rounded,
                  label: 'Address line 2',
                  value: b.addressLine2,
                  color: TeamColors.amber,
                ),
                TeamFieldTile(
                  icon: Icons.location_city_rounded,
                  label: 'City',
                  value: b.city,
                  color: TeamColors.indigo,
                ),
                TeamFieldTile(
                  icon: Icons.map_rounded,
                  label: 'State',
                  value: b.state,
                  color: TeamColors.teal,
                ),
                TeamFieldTile(
                  icon: Icons.flag_rounded,
                  label: 'Country',
                  value: b.country,
                  color: TeamColors.rose,
                ),
                TeamFieldTile(
                  icon: Icons.markunread_mailbox_rounded,
                  label: 'Postal code',
                  value: b.postalCode,
                  color: TeamColors.violet,
                ),
                TeamFieldTile(
                  icon: Icons.my_location_rounded,
                  label: 'Coordinates',
                  value:
                      b.hasCoordinates ? '${b.latitude}, ${b.longitude}' : null,
                  color: TeamColors.sky,
                ),
                TeamFieldTile(
                  icon: Icons.public_rounded,
                  label: 'Timezone',
                  value: b.timezone,
                  color: TeamColors.green,
                ),
              ],
            ),
            if (maps != null) ...[
              const SizedBox(height: 10),
              TeamOutlineButton(
                label: 'Open in maps',
                icon: Icons.directions_rounded,
                onTap: () => branchLaunch(context, maps),
              ),
            ],
          ],
        ),
      ),
      if (b.notes != null && b.notes!.isNotEmpty)
        TeamSectionCard(
          icon: Icons.sticky_note_2_rounded,
          color: TeamColors.sky,
          title: 'Notes',
          onEdit: canUpdate ? edit : null,
          child: Text(
            b.notes!,
            style: AppText.body(size: 13, color: AppColors.inkSoft),
          ),
        ),
    ];
    return _spaced(cards);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────

  List<Widget> _schedule(Branch b, bool canUpdate) {
    final hours = normalizeHours(b.operatingHours);
    final today = todayKey();
    final totalMinutes = branchWeekdays
        .where((d) => b.operatingHours.containsKey(d))
        .fold(0, (a, d) => a + openMinutes(hours[d]!));
    final openDays = branchWeekdays
        .where(
          (d) =>
              b.operatingHours.containsKey(d) && !b.operatingHours[d]!.closed,
        )
        .length;
    final sorted = sortedHolidays(b.holidays);
    final upcoming = sorted.where((h) {
      final d = h.parsed;
      return d == null || daysFromToday(d) >= 0;
    }).toList();
    final pastCount = sorted.length - upcoming.length;
    return _spaced([
      TeamSectionCard(
        icon: Icons.schedule_rounded,
        color: TeamColors.teal,
        title: 'Operating hours',
        subtitle: 'In the branch timezone (${b.timezone})',
        onEdit: canUpdate ? () => _push(AppRoutes.branchHours, b) : null,
        child: b.operatingHours.isEmpty
            ? Text(
                'No operating hours saved yet.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (final d in branchWeekdays)
                    _HoursLine(
                      day: kDayFull[d]!,
                      hours: b.operatingHours[d],
                      isToday: d == today,
                    ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(
                        Icons.timelapse_rounded,
                        size: 14,
                        color: TeamColors.teal,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Open $openDays ${openDays == 1 ? 'day' : 'days'} a week'
                          ' · ${formatHours(totalMinutes)} in total',
                          style: AppText.body(
                            size: 12,
                            weight: FontWeight.w700,
                            color: AppColors.inkSoft,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
      ),
      TeamSectionCard(
        icon: Icons.beach_access_rounded,
        color: TeamColors.violet,
        title: 'Holidays',
        subtitle: '${upcoming.length} upcoming'
            '${pastCount > 0 ? ' · $pastCount past' : ''}',
        onEdit: canUpdate ? () => _push(AppRoutes.branchHolidays, b) : null,
        child: upcoming.isEmpty
            ? Text(
                sorted.isEmpty
                    ? 'No holidays added yet.'
                    : 'No upcoming holidays - $pastCount past '
                        '${pastCount == 1 ? 'closure' : 'closures'} on record.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            : Column(
                children: [
                  for (final h in upcoming.take(8)) HolidayTile(holiday: h),
                  if (upcoming.length > 8)
                    Text(
                      '+${upcoming.length - 8} more',
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ),
                    ),
                ],
              ),
      ),
    ]);
  }

  // ── Manage ────────────────────────────────────────────────────────────────

  List<Widget> _manage(Branch b) {
    final checks = [
      (
        'Phone or email',
        (b.phone ?? '').isNotEmpty || (b.email ?? '').isNotEmpty,
      ),
      ('Address', (b.addressLine1 ?? '').isNotEmpty),
      ('City', (b.city ?? '').isNotEmpty),
      ('Location pin (coordinates)', b.hasCoordinates),
      ('Operating hours', b.operatingHours.isNotEmpty),
      ('Capacity', b.capacity != null),
      ('Holidays', b.holidays.isNotEmpty),
    ];
    final ok = checks.where((c) => c.$2).length;
    final ratio = ok / checks.length;
    final actions = _actions(b);
    String hint(BranchAction a) => switch (a) {
          BranchAction.setDefault => 'Make this the primary location',
          BranchAction.deactivate => 'Hide it from branch pickers',
          BranchAction.activate => 'Make it available again',
          BranchAction.delete => 'Soft-delete - can be restored from the list',
          BranchAction.restore => 'Bring it back',
        };
    return _spaced([
      TeamSectionCard(
        icon: Icons.checklist_rounded,
        color: TeamColors.green,
        title: 'Profile completeness',
        subtitle: '$ok of ${checks.length} details filled in',
        child: Row(
          children: [
            AnimatedRing(
              value: ratio,
              size: 84,
              stroke: 9,
              colors: const [TeamColors.green, TeamColors.teal],
              track: AppColors.surface3,
              child: CountUp(
                value: (ratio * 100).round(),
                suffix: '%',
                style: AppText.display(size: 17, color: TeamColors.green),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                children: [
                  for (final c in checks) TeamCheckRow(label: c.$1, ok: c.$2),
                ],
              ),
            ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.tune_rounded,
        color: TeamColors.violet,
        title: 'Status & lifecycle',
        subtitle: b.isDefault
            ? 'This is the default branch'
            : 'Currently ${branchStatus(b).toLowerCase()}',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (b.isDefault)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(
                  "The default branch can't be deactivated or deleted - set "
                  'another branch as default first.',
                  style: AppText.body(
                    size: 12,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            if (actions.isEmpty)
              Text(
                'You do not have permission to change this branch.',
                style: AppText.body(size: 12.5, color: AppColors.inkFaint),
              )
            else
              for (final a in actions)
                TeamActionTile(
                  icon: a.icon,
                  label: a.label,
                  hint: hint(a),
                  color: a.color,
                  busy: _busy,
                  onTap: () => _run(a),
                ),
          ],
        ),
      ),
      TeamSectionCard(
        icon: Icons.history_rounded,
        color: TeamColors.slate,
        title: 'Record',
        child: TeamTileGrid(
          tiles: [
            TeamFieldTile(
              icon: Icons.tag_rounded,
              label: 'Branch code',
              value: b.branchCode,
              color: TeamColors.indigo,
            ),
            TeamFieldTile(
              icon: Icons.event_rounded,
              label: 'Created',
              value: fmtDateTime(b.createdAt).replaceFirst('Never', ''),
              color: TeamColors.sky,
            ),
            TeamFieldTile(
              icon: Icons.update_rounded,
              label: 'Last updated',
              value: fmtDateTime(b.updatedAt).replaceFirst('Never', ''),
              color: TeamColors.teal,
            ),
          ],
        ),
      ),
    ]);
  }

  List<Widget> _spaced(List<Widget> cards) => [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(height: 14),
          FadeUp(index: i, child: cards[i]),
        ],
      ];
}

/// One weekday line of the hours card.
class _HoursLine extends StatelessWidget {
  const _HoursLine({
    required this.day,
    required this.hours,
    required this.isToday,
  });

  final String day;
  final DayHours? hours;
  final bool isToday;

  @override
  Widget build(BuildContext context) {
    final h = hours;
    final closed = h?.closed ?? false;
    final unset = h == null;
    final color = unset
        ? AppColors.inkFaint
        : closed
            ? TeamColors.rose
            : TeamColors.teal;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: isToday
            ? TeamColors.violet.withValues(alpha: 0.10)
            : color.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(
          color: isToday ? TeamColors.violet : color.withValues(alpha: 0.18),
          width: isToday ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Text(
                  day,
                  style: AppText.body(size: 13, weight: FontWeight.w800),
                ),
                if (isToday) ...[
                  const SizedBox(width: 7),
                  const TeamTag(label: 'Today', color: TeamColors.violet),
                ],
              ],
            ),
          ),
          Icon(
            unset
                ? Icons.remove_circle_outline_rounded
                : closed
                    ? Icons.lock_clock_rounded
                    : Icons.access_time_rounded,
            size: 14,
            color: color,
          ),
          const SizedBox(width: 6),
          Text(
            h?.label ?? 'Not set',
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w800,
              color: unset ? AppColors.inkFaint : color,
            ),
          ),
        ],
      ),
    );
  }
}

/// First 20 members / staff of a branch inside the summary-tile sheets.
class _BranchPeople extends StatefulWidget {
  const _BranchPeople({
    required this.branchId,
    required this.members,
    required this.onOpen,
  });

  final String branchId;
  final bool members;
  final ValueChanged<String> onOpen;

  @override
  State<_BranchPeople> createState() => _BranchPeopleState();
}

typedef _Person = ({String id, String name, String detail, String? photo});

class _BranchPeopleState extends State<_BranchPeople> {
  late Future<(List<_Person>, int)> _future = _fetch();

  Future<(List<_Person>, int)> _fetch() async {
    if (widget.members) {
      final page = await getIt<MemberRepository>().list(
        branchId: widget.branchId,
        limit: 20,
        sortBy: 'createdAt',
        sortDir: 'desc',
      );
      return (
        [
          for (final m in page.items)
            (
              id: m.id,
              name: m.name,
              detail: '${m.memberId} · ${prettyEnum(m.status)}',
              photo: m.profilePhotoUrl,
            ),
        ],
        page.total,
      );
    }
    final page = await getIt<StaffRepository>().list(
      branchId: widget.branchId,
      limit: 20,
    );
    return (
      [
        for (final s in page.items)
          (
            id: s.id,
            name: s.name,
            detail: '${s.role.label} · ${s.employeeId}',
            photo: s.avatarUrl,
          ),
      ],
      page.total,
    );
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.members ? TeamColors.violet : TeamColors.teal;
    return FutureBuilder<(List<_Person>, int)>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 28),
            child: Center(child: CircularProgressIndicator()),
          );
        }
        if (snap.hasError) {
          final e = snap.error;
          return Column(
            children: [
              Text(
                e is ApiException ? e.message : 'Could not load ($e)',
                style: AppText.body(size: 13, color: AppColors.danger),
              ),
              TextButton(
                onPressed: () => setState(() => _future = _fetch()),
                child: const Text('Retry'),
              ),
            ],
          );
        }
        final (people, total) = snap.data!;
        if (people.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              widget.members
                  ? 'No members are assigned to this branch yet.'
                  : 'No staff are assigned to this branch yet.',
              style: AppText.body(size: 13, color: AppColors.inkFaint),
            ),
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final p in people)
              TeamPersonRow(
                name: p.name,
                detail: p.detail,
                color: color,
                avatarUrl: p.photo,
                onTap: () => widget.onOpen(p.id),
              ),
            if (total > people.length)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'Showing the first ${people.length} of $total.',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}
