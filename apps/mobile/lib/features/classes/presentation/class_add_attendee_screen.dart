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
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_ui.dart';

/// "Book a member in": search members by name or member ID
/// (`GET /members?search=`), pick one, confirm, and the member is booked into
/// the session (`POST /bookings`) - web's calendar dialog flow (search, then
/// "Confirm booking"). The API enforces eligibility (active, non-frozen
/// membership, capacity, plan quota) and its reason is shown verbatim.
/// Pops after a successful booking so the session page reloads.
class ClassAddAttendeeScreen extends StatefulWidget {
  const ClassAddAttendeeScreen({super.key, required this.session});

  final ClassSession session;

  @override
  State<ClassAddAttendeeScreen> createState() => _ClassAddAttendeeScreenState();
}

class _ClassAddAttendeeScreenState extends State<ClassAddAttendeeScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<GymMember>? _results;
  bool _searching = false;
  String? _error;
  String? _bookingId;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _search);
    setState(() {});
  }

  Future<void> _search() async {
    final query = _controller.text.trim();
    if (query.isEmpty) {
      setState(() {
        _results = null;
        _error = null;
      });
      return;
    }
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final result = await getIt<MemberRepository>().list(search: query);
      if (!mounted || query != _controller.text.trim()) return;
      setState(() => _results = result.items);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Could not search members ($e)');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _book(GymMember member) async {
    final ok = await confirmTeam(
      context,
      title: 'Book ${member.name} in?',
      message: '${widget.session.groupClass.name} · '
          '${fmtDayKey(widget.session.dayKey)} · '
          '${classTimeRange(widget.session.startTime, widget.session.endTime)}',
      confirmLabel: 'Confirm booking',
    );
    if (!ok || !mounted) return;
    setState(() => _bookingId = member.id);
    try {
      await getIt<ClassSessionRepository>().book(
        sessionId: widget.session.id,
        memberId: member.id,
      );
      if (!mounted) return;
      teamSnack(context, '${member.name} booked in.');
      context.pop();
    } on ApiException catch (e) {
      if (mounted) teamSnack(context, e.detailedMessage, error: true);
    } catch (e) {
      if (mounted) teamSnack(context, 'Something went wrong ($e)', error: true);
    } finally {
      if (mounted) setState(() => _bookingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.session;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Book a member in'),
      ),
      body: Column(
        children: [
          ClassHeroShell(
            topInset: top,
            bottom: 18,
            child: Row(
              children: [
                ClassGlyph(
                  name: s.groupClass.name,
                  color: classAccent(s.groupClass.name),
                  size: 50,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.groupClass.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(size: 20, color: Colors.white),
                      ),
                      Text(
                        '${fmtDayKey(s.dayKey)} · '
                        '${classTimeRange(s.startTime, s.endTime)}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.88),
                        ),
                      ),
                    ],
                  ),
                ),
                TeamHeroPill(
                  '${s.bookedCount}/${s.capacity}',
                  icon: Icons.groups_rounded,
                ),
              ],
            ),
          ),
          Expanded(
            child: TeamCenter(
              maxWidth: 820,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    TextField(
                      controller: _controller,
                      onChanged: _onChanged,
                      onSubmitted: (_) => _search(),
                      autofocus: true,
                      style: AppText.body(size: 14, weight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Search member by name, email, or member ID…',
                        hintStyle:
                            AppText.body(size: 14, color: AppColors.inkFaint),
                        filled: true,
                        fillColor: AppColors.surface2,
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          size: 19,
                          color: AppColors.inkFaint,
                        ),
                        suffixIcon: _searching
                            ? const Padding(
                                padding: EdgeInsets.all(14),
                                child: SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.field),
                          borderSide: BorderSide(color: AppColors.line),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.field),
                          borderSide: BorderSide(color: AppColors.line),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadii.field),
                          borderSide:
                              const BorderSide(color: TeamColors.violet),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Expanded(child: _buildResults()),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResults() {
    if (_error != null) return AppErrorView(message: _error!, onRetry: _search);
    final results = _results;
    if (results == null) {
      return Center(
        child: Text(
          'Type to search members.',
          style: AppText.body(color: AppColors.inkFaint),
        ),
      );
    }
    if (results.isEmpty) {
      return const AppEmptyState(
        icon: Icons.search_off_outlined,
        title: 'No members found',
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 32),
      itemCount: results.length,
      itemBuilder: (context, i) {
        final member = results[i];
        final busy = _bookingId == member.id;
        final color = classAccent(member.name);
        return Container(
          key: ValueKey('member-${member.id}'),
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          clipBehavior: Clip.antiAlias,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: busy ? null : () => _book(member),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    ClassGlyph(name: member.name, color: color, size: 38),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            member.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            member.memberId,
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w600,
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
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          gradient: TeamColors.cta,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.add_rounded,
                          size: 17,
                          color: Colors.white,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
