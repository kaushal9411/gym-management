import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/body_measurement.dart';
import '../../../models/gym_member.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/measurement_form_fields.dart';
import '../../../shared/widgets/user_avatar.dart';

/// A focused view of just one member's measurement history — reached from
/// `MeasuredMembersScreen`. Deliberately NOT the full Member Detail screen
/// (`features/manager/presentation/member_detail_screen.dart`, which has
/// profile, membership, attendance, workout, diet, QR code, etc.) — this
/// shows only the member's name/avatar for context plus their measurement
/// history, matching web's equivalent `/measurements/[memberId]` page.
class MemberMeasurementsDetailScreen extends StatefulWidget {
  const MemberMeasurementsDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<MemberMeasurementsDetailScreen> createState() =>
      _MemberMeasurementsDetailScreenState();
}

class _MemberMeasurementsDetailScreenState
    extends State<MemberMeasurementsDetailScreen> {
  GymMember? _member;
  List<BodyMeasurement>? _measurements;
  String? _loadError;

  bool _formOpen = false;
  MeasurementFormController? _newForm;
  bool _saving = false;

  String? _editingId;
  MeasurementFormController? _editForm;
  bool _updating = false;

  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _newForm?.dispose();
    _editForm?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loadError = null);
    try {
      final results = await Future.wait([
        getIt<MemberRepository>().getById(widget.memberId),
        getIt<BodyMeasurementRepository>().listForMember(widget.memberId),
      ]);
      if (!mounted) return;
      setState(() {
        _member = results[0] as GymMember;
        _measurements = results[1] as List<BodyMeasurement>;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _loadError = e.message);
    }
  }

  Future<void> _save() async {
    final form = _newForm;
    if (form == null) return;
    setState(() => _saving = true);
    try {
      await getIt<BodyMeasurementRepository>()
          .create(widget.memberId, form.toInput());
      form.dispose();
      if (!mounted) return;
      setState(() {
        _newForm = null;
        _formOpen = false;
      });
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _startEdit(BodyMeasurement entry) {
    _editForm?.dispose();
    setState(() {
      _editingId = entry.id;
      _editForm = MeasurementFormController(initial: entry);
    });
  }

  Future<void> _saveEdit() async {
    final id = _editingId;
    final form = _editForm;
    if (id == null || form == null) return;
    setState(() => _updating = true);
    try {
      await getIt<BodyMeasurementRepository>().update(id, form.toInput());
      form.dispose();
      if (!mounted) return;
      setState(() {
        _editingId = null;
        _editForm = null;
      });
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _delete(String id) async {
    setState(() => _deletingId = id);
    try {
      await getIt<BodyMeasurementRepository>().delete(id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final member = _member;
    final measurements = _measurements;

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: Text(member?.name ?? 'Measurements'),
      ),
      body: SafeArea(
        top: false,
        child: measurements == null || member == null
            ? (_loadError != null
                ? AppErrorView(message: _loadError!, onRetry: _load)
                : const AppLoadingView())
            : RefreshIndicator(
                color: AppColors.staffB,
                backgroundColor: AppColors.surface2,
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 90),
                  children: [
                    Row(
                      children: [
                        UserAvatar(avatarUrl: member.profilePhotoUrl, name: member.name),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(member.name, style: AppText.body(size: 15, weight: FontWeight.w800)),
                              Text(
                                member.memberId,
                                style: AppText.body(size: 11, color: AppColors.inkFaint),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    if (_formOpen)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.surface2,
                          borderRadius: BorderRadius.circular(AppRadii.tile),
                          border: Border.all(color: AppColors.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            MeasurementFormFields(controller: _newForm!),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                Expanded(
                                  child: AppButton(
                                    label: 'Save measurement',
                                    size: AppButtonSize.small,
                                    loading: _saving,
                                    onPressed: _saving ? null : _save,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: AppButton(
                                    label: 'Cancel',
                                    variant: AppButtonVariant.ghost,
                                    size: AppButtonSize.small,
                                    onPressed: _saving
                                        ? null
                                        : () {
                                            _newForm?.dispose();
                                            setState(() {
                                              _newForm = null;
                                              _formOpen = false;
                                            });
                                          },
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )
                    else
                      AppButton(
                        label: 'Record measurement',
                        size: AppButtonSize.small,
                        fullWidth: false,
                        onPressed: () => setState(() {
                          _newForm = MeasurementFormController();
                          _formOpen = true;
                        }),
                      ),
                    const SizedBox(height: 16),
                    if (measurements.isEmpty)
                      Text(
                        'No measurements recorded yet.',
                        style: AppText.body(size: 12, color: AppColors.inkFaint),
                      )
                    else
                      for (final entry in measurements) ...[
                        if (_editingId == entry.id)
                          Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius: BorderRadius.circular(AppRadii.tile),
                              border: Border.all(color: AppColors.line),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                MeasurementFormFields(controller: _editForm!),
                                const SizedBox(height: 10),
                                Row(
                                  children: [
                                    Expanded(
                                      child: AppButton(
                                        label: 'Save',
                                        size: AppButtonSize.small,
                                        loading: _updating,
                                        onPressed: _updating ? null : _saveEdit,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: AppButton(
                                        label: 'Cancel',
                                        variant: AppButtonVariant.ghost,
                                        size: AppButtonSize.small,
                                        onPressed: _updating
                                            ? null
                                            : () {
                                                _editForm?.dispose();
                                                setState(() {
                                                  _editingId = null;
                                                  _editForm = null;
                                                });
                                              },
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              color: AppColors.surface2,
                              borderRadius: BorderRadius.circular(AppRadii.tile),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '${entry.recordedAt.day}/${entry.recordedAt.month}/${entry.recordedAt.year}',
                                        style: AppText.body(size: 12, weight: FontWeight.w700),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        entry.summary,
                                        style: AppText.body(size: 11, color: AppColors.inkFaint),
                                      ),
                                      if (entry.recordedBy != null) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          'Recorded by ${entry.recordedBy!.name}',
                                          style: AppText.body(size: 10, color: AppColors.inkFaint),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.inkFaint),
                                  visualDensity: VisualDensity.compact,
                                  onPressed: () => _startEdit(entry),
                                ),
                                _deletingId == entry.id
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: CircularProgressIndicator(strokeWidth: 2),
                                      )
                                    : IconButton(
                                        icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.danger),
                                        visualDensity: VisualDensity.compact,
                                        onPressed: () => _delete(entry.id),
                                      ),
                              ],
                            ),
                          ),
                      ],
                  ],
                ),
              ),
      ),
    );
  }
}
