import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/gym_member.dart';
import '../../../../repositories/member_repository.dart';
import '../../../../repositories/diet_plan_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/app_state_views.dart';
import '../../../../shared/widgets/user_avatar.dart';
import '../../../team/presentation/widgets/team_ui.dart';

/// "Assign this plan to a member", as on web's plan page: a member (searched,
/// or fixed when the flow already knows who) and a start date on a calendar,
/// then `POST /diet-plans/:id/assign`. One implementation for the Owner /
/// Manager plan page and the Trainer's per-client flow; [onAssigned] runs
/// after the server accepted it.
class AssignDietPanel extends StatefulWidget {
  const AssignDietPanel({
    super.key,
    required this.planId,
    required this.onAssigned,
    this.member,
  });

  final String planId;

  /// Fixed member (Trainer flow); null shows the member search.
  final GymMember? member;
  final ValueChanged<GymMember> onAssigned;

  @override
  State<AssignDietPanel> createState() => _AssignDietPanelState();
}

class _AssignDietPanelState extends State<AssignDietPanel> {
  final _search = TextEditingController();
  Timer? _debounce;

  GymMember? _selected;
  List<GymMember>? _results;
  String? _searchError;
  DateTime _start = _today();
  bool _assigning = false;
  String? _error;

  static DateTime _today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  @override
  void initState() {
    super.initState();
    _selected = widget.member;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _runSearch);
    setState(() {});
  }

  Future<void> _runSearch() async {
    final q = _search.text.trim();
    if (q.isEmpty) {
      setState(() {
        _results = null;
        _searchError = null;
      });
      return;
    }
    try {
      final r = await getIt<MemberRepository>().list(search: q, limit: 8);
      if (!mounted) return;
      setState(() {
        _results = r.items;
        _searchError = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _searchError = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _searchError = 'Could not search members ($e)');
    }
  }

  void _pick(GymMember m) {
    setState(() {
      _selected = m;
      _results = null;
      _search.clear();
      _error = null;
    });
  }

  Future<void> _assign() async {
    final m = _selected;
    if (m == null) {
      setState(() => _error = 'Pick a member first.');
      return;
    }
    setState(() {
      _assigning = true;
      _error = null;
    });
    try {
      await getIt<DietPlanRepository>().assign(
        planId: widget.planId,
        memberId: m.id,
        startDate: _start,
      );
      if (!mounted) return;
      teamSnack(context, 'Assigned to ${m.name}.');
      if (widget.member == null) setState(() => _selected = null);
      widget.onAssigned(m);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Something went wrong ($e).');
    } finally {
      if (mounted) setState(() => _assigning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _selected;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_error != null) ...[
          FormAlert(message: _error!),
          const SizedBox(height: 12),
        ],
        if (m == null) _memberSearch() else _memberRow(m),
        const SizedBox(height: 14),
        TeamDateField(
          label: 'Start date',
          icon: Icons.event_available_rounded,
          iconColor: TeamColors.green,
          value: _start,
          clearable: false,
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 730)),
          onChanged: (d) {
            if (d != null) setState(() => _start = d);
          },
        ),
        const SizedBox(height: 14),
        TeamGradientButton(
          label: 'Assign plan',
          icon: Icons.person_add_alt_1_rounded,
          loading: _assigning,
          onTap: _assign,
        ),
      ],
    );
  }

  Widget _memberRow(GymMember m) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface3,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          UserAvatar(avatarUrl: m.profilePhotoUrl, name: m.name, size: 40),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  m.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(size: 14, weight: FontWeight.w800),
                ),
                Text(
                  m.memberId,
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ],
            ),
          ),
          if (widget.member == null)
            IconButton(
              tooltip: 'Choose another member',
              icon: Icon(Icons.close_rounded, color: AppColors.inkFaint),
              onPressed: () => setState(() => _selected = null),
            ),
        ],
      ),
    );
  }

  Widget _memberSearch() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppLabeledField(
          label: 'Member',
          hintText: 'Search by name, email or member ID…',
          icon: Icons.search_rounded,
          iconColor: TeamColors.indigo,
          controller: _search,
          onChanged: _onSearch,
        ),
        if (_searchError != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _searchError!,
              style: AppText.body(size: 12, color: AppColors.danger),
            ),
          ),
        if (_results != null && _results!.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'No members found.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            ),
          ),
        if (_results != null)
          for (final r in _results!)
            Material(
              key: ValueKey('member-${r.id}'),
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => _pick(r),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 7),
                  child: Row(
                    children: [
                      UserAvatar(
                        avatarUrl: r.profilePhotoUrl,
                        name: r.name,
                        size: 34,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          '${r.name} · ${r.memberId}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body(
                            size: 13,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.add_circle_outline_rounded,
                        size: 19,
                        color: TeamColors.indigo,
                      ),
                    ],
                  ),
                ),
              ),
            ),
      ],
    );
  }
}
