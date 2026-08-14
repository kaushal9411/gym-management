import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/class_session.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/class_session_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';

/// Design frame "9b. + Add attendee".
class ClassAddAttendeeScreen extends StatefulWidget {
  const ClassAddAttendeeScreen({super.key, required this.session});

  final ClassSession session;

  @override
  State<ClassAddAttendeeScreen> createState() => _ClassAddAttendeeScreenState();
}

class _ClassAddAttendeeScreenState extends State<ClassAddAttendeeScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<GymMember>? _results;
  String? _error;
  String? _bookingId;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_onChanged);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onChanged() {
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

  Future<void> _book(GymMember member) async {
    setState(() => _bookingId = member.id);
    try {
      await getIt<ClassSessionRepository>().book(
        sessionId: widget.session.id,
        memberId: member.id,
      );
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _bookingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Add Attendee', style: AppText.display(size: 18)),
            Text(
              '${widget.session.groupClass.name} · ${widget.session.startTime}',
              style: AppText.eyebrow(),
            ),
          ],
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppLabeledField(
                label: 'Search members',
                hintText: 'Name or Member ID',
                controller: _searchController,
                onSubmitted: (_) => _search(),
                autofocus: true,
              ),
              const SizedBox(height: 12),
              Expanded(child: _buildResults()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResults() {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _search);
    if (_results == null) {
      return Center(
        child: Text(
          'Type to search members.',
          style: AppText.body(color: AppColors.inkFaint),
        ),
      );
    }
    if (_results!.isEmpty) {
      return const AppEmptyState(
        icon: Icons.search_off_outlined,
        title: 'No members found',
      );
    }
    return ListView.builder(
      itemCount: _results!.length,
      itemBuilder: (context, i) {
        final member = _results![i];
        final busy = _bookingId == member.id;
        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppRadii.card),
            onTap: busy ? null : () => _book(member),
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: const BoxDecoration(
                      color: AppColors.staffSoft,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      member.name.isEmpty ? '?' : member.name[0].toUpperCase(),
                      style: AppText.body(
                        size: 12,
                        weight: FontWeight.w800,
                        color: AppColors.staffPillFg,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          member.name,
                          style: AppText.body(
                            size: 13,
                            weight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          member.memberId,
                          style: AppText.body(
                            size: 11,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (busy)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    Container(
                      width: 26,
                      height: 26,
                      decoration: const BoxDecoration(
                        gradient: AppColors.staffGrad,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.add_rounded,
                        size: 16,
                        color: Colors.white,
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
