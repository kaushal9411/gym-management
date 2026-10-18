import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'measurement_form.dart';

/// Create-and-assign in one step — web's `/measurements/new`. Unlike Workout /
/// Diet Plans there is no reusable template to build first (an entry belongs
/// to exactly one member), so this page combines "create" + "assign": search
/// and pick a member, fill the values, save. On success it opens that
/// member's measurement page.
///
/// Reached only from the list's "+" / empty state, which are shown with
/// `measurements:create`. The member search is the same `GET /members?search=`
/// the other assign flows use (web's `MemberCheckinSearch`).
class NewMeasurementScreen extends StatefulWidget {
  const NewMeasurementScreen({super.key});

  @override
  State<NewMeasurementScreen> createState() => _NewMeasurementScreenState();
}

class _NewMeasurementScreenState extends State<NewMeasurementScreen> {
  late final MeasurementFormController _form = MeasurementFormController();
  List<GymMember>? _results;
  bool _searching = false;
  GymMember? _selected;
  bool _saving = false;
  String? _error;
  int _searchSeq = 0;

  @override
  void dispose() {
    _form.dispose();
    super.dispose();
  }

  Future<void> _search(String query) async {
    final seq = ++_searchSeq;
    if (query.isEmpty) {
      setState(() {
        _results = null;
        _searching = false;
      });
      return;
    }
    setState(() => _searching = true);
    try {
      final result = await getIt<MemberRepository>().list(search: query);
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _results = result.items;
        _searching = false;
      });
    } on ApiException catch (e) {
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _error = e.message;
        _searching = false;
      });
    } catch (e) {
      if (!mounted || seq != _searchSeq) return;
      setState(() {
        _error = 'Could not search members.';
        _searching = false;
      });
    }
  }

  Future<void> _save() async {
    final member = _selected;
    if (member == null) {
      setState(() => _error = 'Select a member first.');
      return;
    }
    final problem = _form.validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BodyMeasurementRepository>()
          .create(member.id, _form.toInput());
      if (!mounted) return;
      teamSnack(context, 'Measurement recorded for ${member.name}.');
      context.pushReplacement(
        AppRoutes.memberMeasurementsDetail,
        extra: member.id,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not save the measurement. Try again.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      bottomNavigationBar: TeamBottomBar(
        child: Row(
          children: [
            Expanded(
              child: TeamOutlineButton(
                label: 'Cancel',
                onTap: _saving ? null : () => context.pop(),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              flex: 2,
              child: TeamGradientButton(
                label: 'Save measurement',
                icon: Icons.check_rounded,
                loading: _saving,
                gradient: TeamColors.ctaGreen,
                onTap: _selected == null || _saving ? null : _save,
              ),
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MeshHeroBackground(
              radius: const BorderRadius.vertical(bottom: Radius.circular(30)),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  18 + teamSideInset(context),
                  top + 6,
                  18 + teamSideInset(context),
                  24,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PROGRESS',
                      style: AppText.eyebrow(
                        color: Colors.white.withValues(alpha: 0.8),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Record a measurement',
                      style: AppText.display(size: 27, color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Pick a member and log their latest body measurements.',
                      style: AppText.body(
                        size: 13,
                        weight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.88),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            TeamCenter(
              maxWidth: 840,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    TeamSectionCard(
                      icon: Icons.person_search_rounded,
                      color: TeamColors.indigo,
                      title: 'Member',
                      child: _memberPicker(),
                    ),
                    const SizedBox(height: 14),
                    TeamSectionCard(
                      icon: Icons.straighten_rounded,
                      color: TeamColors.teal,
                      title: 'Measurement values',
                      child: MeasurementFormFields(
                        controller: _form,
                        enabled: !_saving,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _memberPicker() {
    final m = _selected;
    if (m != null) {
      return Container(
        padding: const EdgeInsets.fromLTRB(10, 8, 4, 8),
        decoration: BoxDecoration(
          color: TeamColors.indigo.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: TeamColors.indigo.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            UserAvatar(avatarUrl: m.profilePhotoUrl, name: m.name, size: 38),
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
                    '${m.memberId} · ${m.branch.name}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 11.5,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Change member',
              icon: Icon(Icons.close_rounded, color: AppColors.inkSoft),
              onPressed:
                  _saving ? null : () => setState(() => _selected = null),
            ),
          ],
        ),
      );
    }
    final results = _results;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSearchField(
          hint: 'Search member by name, email, or member ID…',
          onSearch: _search,
        ),
        if (_searching)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        else if (results != null && results.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              'No members found.',
              style: AppText.body(size: 12.5, color: AppColors.inkFaint),
            ),
          )
        else if (results != null) ...[
          const SizedBox(height: 6),
          for (final r in results.take(6))
            TeamPersonRow(
              name: r.name,
              detail: '${r.memberId} · ${r.branch.name}',
              color: TeamColors.indigo,
              avatarUrl: r.profilePhotoUrl,
              onTap: () => setState(() {
                _selected = r;
                _results = null;
              }),
            ),
        ],
      ],
    );
  }
}
