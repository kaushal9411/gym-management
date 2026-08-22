import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/gym_member.dart';
import '../../../../repositories/member_repository.dart';
import '../../../../shared/widgets/app_button.dart';
import '../../../../shared/widgets/app_card.dart';

/// "Assign to a member" card on a plan's own detail/edit screen — mirrors
/// web's plan-detail assign card (member search + start-date picker +
/// assign button). Shared between Workout Plan and Diet Plan detail
/// screens via the [onAssign] callback, since both plan types' `assign()`
/// repository methods have the same `{memberId, startDate}` shape; the
/// caller supplies which repository to call. This is deliberately simpler
/// than the member-detail-embedded workout/diet cards (which show current
/// assignment + progress) — here there's no "current member" context, just
/// "search and assign."
class AssignToMemberCard extends StatefulWidget {
  const AssignToMemberCard({super.key, required this.onAssign});

  final Future<void> Function(String memberId, DateTime startDate) onAssign;

  @override
  State<AssignToMemberCard> createState() => _AssignToMemberCardState();
}

class _AssignToMemberCardState extends State<AssignToMemberCard> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<GymMember>? _results;
  GymMember? _selected;
  DateTime _startDate = DateTime.now();
  bool _assigning = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _search);
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() => _results = null);
      return;
    }
    try {
      final result = await getIt<MemberRepository>().list(search: query);
      if (!mounted) return;
      setState(() => _results = result.items);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      initialDate: _startDate,
    );
    if (picked == null) return;
    setState(() => _startDate = picked);
  }

  Future<void> _assign() async {
    final member = _selected;
    if (member == null) return;
    setState(() {
      _assigning = true;
      _error = null;
    });
    try {
      await widget.onAssign(member.id, _startDate);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Assigned to ${member.name}.')),
      );
      setState(() {
        _selected = null;
        _searchController.clear();
        _results = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _assigning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.person_add_alt_1_rounded,
                size: 15,
                color: AppColors.staffPillFg,
              ),
              const SizedBox(width: 6),
              Text('Assign to a member', style: AppText.eyebrow()),
            ],
          ),
          const SizedBox(height: 10),
          if (_error != null) ...[
            Text(
              _error!,
              style: AppText.body(size: 12, color: AppColors.danger),
            ),
            const SizedBox(height: 8),
          ],
          if (_selected != null)
            _SelectedMemberRow(
              member: _selected!,
              onClear: () => setState(() => _selected = null),
            )
          else ...[
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'Search members…',
                hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  color: AppColors.inkFaint,
                ),
                filled: true,
                fillColor: AppColors.surface3,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.field),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            if (_results != null && _results!.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...(_results!.take(5).map(
                    (m) => _SelectedMemberRow(
                      member: m,
                      onClear: null,
                      onTap: () => setState(() {
                        _selected = m;
                        _results = null;
                      }),
                    ),
                  )),
            ] else if (_results != null && _results!.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'No members found.',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
              ),
          ],
          const SizedBox(height: 10),
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadii.field),
              onTap: _pickStartDate,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface3,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_rounded,
                      size: 15,
                      color: AppColors.inkFaint,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Starts ${_startDate.day.toString().padLeft(2, '0')}/'
                      '${_startDate.month.toString().padLeft(2, '0')}/'
                      '${_startDate.year}',
                      style: AppText.body(size: 13, weight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          AppButton(
            label: 'Assign plan',
            size: AppButtonSize.small,
            fullWidth: false,
            loading: _assigning,
            onPressed: _selected == null ? null : _assign,
          ),
        ],
      ),
    );
  }
}

class _SelectedMemberRow extends StatelessWidget {
  const _SelectedMemberRow({
    required this.member,
    required this.onClear,
    this.onTap,
  });

  final GymMember member;
  final VoidCallback? onClear;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.tile),
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: AppColors.surface3,
            borderRadius: BorderRadius.circular(AppRadii.tile),
          ),
          child: Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: const BoxDecoration(
                  color: AppColors.staffSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  member.name.isEmpty ? '?' : member.name[0].toUpperCase(),
                  style: AppText.body(
                    size: 10,
                    weight: FontWeight.w800,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${member.name} · ${member.memberId}',
                  style: AppText.body(size: 12, weight: FontWeight.w700),
                ),
              ),
              if (onClear != null)
                GestureDetector(
                  onTap: onClear,
                  child: const Icon(
                    Icons.close_rounded,
                    size: 16,
                    color: AppColors.inkFaint,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
