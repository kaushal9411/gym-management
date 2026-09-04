import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/measurement_form_fields.dart';

/// Create-and-assign in one step — unlike Workout/Diet Plans there's no
/// separate reusable "plan" to build first (a measurement entry only ever
/// belongs to one member, no template concept), so this screen combines
/// what those two split across "Create" + "Assign to member": search a
/// member, fill the values, save. Same inline member-search pattern as
/// `AssignToMemberCard` (workout/diet plans' own assign flow).
class NewMeasurementScreen extends StatefulWidget {
  const NewMeasurementScreen({super.key});

  @override
  State<NewMeasurementScreen> createState() => _NewMeasurementScreenState();
}

class _NewMeasurementScreenState extends State<NewMeasurementScreen> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  List<GymMember>? _results;
  GymMember? _selected;
  late final _form = MeasurementFormController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _form.dispose();
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

  Future<void> _save() async {
    final member = _selected;
    if (member == null) {
      setState(() => _error = 'Select a member first.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await getIt<BodyMeasurementRepository>().create(member.id, _form.toInput());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Measurement recorded for ${member.name}.')),
      );
      context.pushReplacement(
        AppRoutes.memberMeasurementsDetail,
        extra: member.id,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Record a measurement'),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_error != null) ...[
                Text(
                  _error!,
                  style: AppText.body(size: 12, color: AppColors.danger),
                ),
                const SizedBox(height: 10),
              ],
              Text('Member', style: AppText.eyebrow()),
              const SizedBox(height: 8),
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
                  ...(_results!.take(6).map(
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
              const SizedBox(height: 16),
              MeasurementFormFields(controller: _form),
              const SizedBox(height: 20),
              AppButton(
                label: 'Save measurement',
                loading: _saving,
                onPressed: _selected == null || _saving ? null : _save,
              ),
            ],
          ),
        ),
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
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: AppColors.staffSoft,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  member.name.isEmpty ? '?' : member.name[0].toUpperCase(),
                  style: AppText.body(
                    size: 11,
                    weight: FontWeight.w800,
                    color: AppColors.staffPillFg,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${member.name} · ${member.memberId}',
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              if (onClear != null)
                GestureDetector(
                  onTap: onClear,
                  child: const Icon(
                    Icons.close_rounded,
                    size: 18,
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
