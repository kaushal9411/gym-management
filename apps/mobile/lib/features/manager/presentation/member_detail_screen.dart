import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/config/env.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/attendance_summary.dart';
import '../../../models/body_measurement.dart';
import '../../../models/branch_option.dart';
import '../../../models/diet_plan.dart';
import '../../../models/gym_member.dart';
import '../../../models/member_diet_progress.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/staff_member.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import '../../../shared/widgets/user_avatar.dart';

/// Design frame "7. Member detail" — field set and section order now match
/// web's `/members/[memberId]` page (Prompt 62): header status actions,
/// membership actions (renew/extend/upgrade/downgrade/cancel), renewal +
/// freeze history, branch & trainer (independent saves), attendance
/// (manual check-in/out + recent visits), workout plan + progress, diet
/// plan + daily tracking, body measurement history, profile photo, QR
/// code, member portal access, GDPR export/erase. Everything below calls
/// the exact same endpoints web calls — see `MemberRepository`/
/// `AttendanceRepository`/`WorkoutPlanRepository`/`DietPlanRepository`/
/// `BodyMeasurementRepository`.
///
/// Deliberately NOT built here (a real gap, not an oversight): **Documents**
/// upload needs a general file picker (`image_picker` only handles
/// images — same limitation already documented on
/// `member_edit_health_screen.dart` and the member portal's own screens).
/// "View full history" for attendance opens the tenant-wide history list
/// (same route web links to), not a member-filtered one — the backend list
/// endpoint has no member preselect, matching web exactly.
class MemberDetailScreen extends StatefulWidget {
  const MemberDetailScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  GymMember? _member;
  List<BranchOption> _branchOptions = [];
  List<StaffMember> _trainers = [];
  String? _error;
  bool _busy = false;
  bool _uploadingPhoto = false;

  // Branch & trainer are edited independently of the member record, each
  // with its own "Save" action — mirrors web's two separate `PUT` calls.
  String? _selectedBranchId;
  String? _selectedTrainerId;
  bool _savingBranch = false;
  bool _savingTrainer = false;

  // Attendance / workout / diet load from separate endpoints than the
  // member record, so they're fetched alongside it rather than folded in.
  List<AttendanceRecord> _recentVisits = [];
  int _attendanceLimit = 5;
  bool _attendanceBusy = false;
  bool _loadingMoreVisits = false;

  MemberWorkoutProgress? _workout;
  bool _workoutBusy = false;
  String? _busyExerciseId;

  MemberDietProgress? _diet;
  bool _dietBusy = false;
  bool _savingDietTracking = false;
  MealType? _busyMealType;
  final _waterController = TextEditingController();
  final _weightController = TextEditingController();

  List<BodyMeasurement> _measurements = [];
  bool _measurementFormOpen = false;
  bool _savingMeasurement = false;
  String? _deletingMeasurementId;
  final _measurementWeightController = TextEditingController();
  final _measurementHeightController = TextEditingController();
  final _measurementBodyFatController = TextEditingController();
  final _measurementChestController = TextEditingController();
  final _measurementWaistController = TextEditingController();
  final _measurementHipsController = TextEditingController();
  final _measurementBicepsController = TextEditingController();
  final _measurementThighsController = TextEditingController();
  final _measurementNotesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _loadPickerOptions();
    _loadTracking();
  }

  @override
  void dispose() {
    _waterController.dispose();
    _weightController.dispose();
    _measurementWeightController.dispose();
    _measurementHeightController.dispose();
    _measurementBodyFatController.dispose();
    _measurementChestController.dispose();
    _measurementWaistController.dispose();
    _measurementHipsController.dispose();
    _measurementBicepsController.dispose();
    _measurementThighsController.dispose();
    _measurementNotesController.dispose();
    super.dispose();
  }

  Future<void> _loadTracking() async {
    await Future.wait([
      _loadAttendance(),
      _loadWorkout(),
      _loadDiet(),
      _loadMeasurements(),
    ]);
  }

  Future<void> _loadMeasurements() async {
    try {
      final measurements = await getIt<BodyMeasurementRepository>()
          .listForMember(widget.memberId);
      if (!mounted) return;
      setState(() => _measurements = measurements);
    } on ApiException {
      // Non-fatal — the Body measurements card just shows an empty state
      // (also how a role without `measurements:view` degrades — the same
      // "silently empty" pattern as Attendance above, not a crash).
    }
  }

  Future<void> _saveMeasurement() async {
    double? num(TextEditingController c) => double.tryParse(c.text.trim());
    setState(() => _savingMeasurement = true);
    try {
      await getIt<BodyMeasurementRepository>().create(
        widget.memberId,
        BodyMeasurementFormInput(
          weightKg: num(_measurementWeightController),
          heightCm: num(_measurementHeightController),
          bodyFatPercent: num(_measurementBodyFatController),
          chestCm: num(_measurementChestController),
          waistCm: num(_measurementWaistController),
          hipsCm: num(_measurementHipsController),
          bicepsCm: num(_measurementBicepsController),
          thighsCm: num(_measurementThighsController),
          notes: _measurementNotesController.text.trim().isEmpty
              ? null
              : _measurementNotesController.text.trim(),
        ),
      );
      for (final c in [
        _measurementWeightController,
        _measurementHeightController,
        _measurementBodyFatController,
        _measurementChestController,
        _measurementWaistController,
        _measurementHipsController,
        _measurementBicepsController,
        _measurementThighsController,
        _measurementNotesController,
      ]) {
        c.clear();
      }
      await _loadMeasurements();
      if (mounted) setState(() => _measurementFormOpen = false);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _savingMeasurement = false);
    }
  }

  Future<void> _deleteMeasurement(BodyMeasurement entry) async {
    final ok = await _confirm(
      title: 'Delete this measurement?',
      content: 'Recorded ${_formatDate(entry.recordedAt)} — this cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok) return;
    setState(() => _deletingMeasurementId = entry.id);
    try {
      await getIt<BodyMeasurementRepository>().delete(entry.id);
      await _loadMeasurements();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _deletingMeasurementId = null);
    }
  }

  Future<void> _loadAttendance() async {
    try {
      final result = await getIt<AttendanceRepository>().getMemberAttendance(
        widget.memberId,
        limit: _attendanceLimit,
      );
      if (!mounted) return;
      setState(() => _recentVisits = result.items);
    } on ApiException {
      // Non-fatal — the Attendance card just shows an empty state.
    }
  }

  Future<void> _loadWorkout() async {
    try {
      final workout = await getIt<WorkoutPlanRepository>()
          .currentForMember(widget.memberId);
      if (!mounted) return;
      setState(() => _workout = workout);
    } on ApiException {
      // Non-fatal — the Workout card just shows "no active plan".
    }
  }

  Future<void> _loadDiet() async {
    try {
      final diet =
          await getIt<DietPlanRepository>().currentForMember(widget.memberId);
      if (!mounted) return;
      setState(() {
        _diet = diet;
        final log = diet?.logFor(DateTime.now());
        _waterController.text = log?.waterIntakeMl?.toString() ?? '';
        _weightController.text = log?.weightKg?.toStringAsFixed(1) ?? '';
      });
    } on ApiException {
      // Non-fatal — the Diet card just shows "no active plan".
    }
  }

  Future<void> _checkIn() async {
    setState(() => _attendanceBusy = true);
    try {
      await getIt<AttendanceRepository>().manualCheckIn(
        memberId: widget.memberId,
        branchId: _member?.branch.id,
      );
      await _loadAttendance();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _attendanceBusy = false);
    }
  }

  Future<void> _checkOut() async {
    setState(() => _attendanceBusy = true);
    try {
      await getIt<AttendanceRepository>()
          .manualCheckOut(memberId: widget.memberId);
      await _loadAttendance();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _attendanceBusy = false);
    }
  }

  /// The same list endpoint just isn't member-scoped past `limit` — "view
  /// full history" widens the page in place rather than opening a route,
  /// since web's own "View full history" link goes to the tenant-wide
  /// history screen (unfiltered), not a member-specific one.
  Future<void> _loadMoreVisits() async {
    setState(() {
      _attendanceLimit = 50;
      _loadingMoreVisits = true;
    });
    await _loadAttendance();
    if (mounted) setState(() => _loadingMoreVisits = false);
  }

  Future<void> _removeWorkout() async {
    final workout = _workout;
    if (workout == null) return;
    final ok = await _confirm(
      title: 'Remove workout plan?',
      content:
          '${_member!.name} will lose access to "${workout.workoutPlanName}".',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;
    setState(() => _workoutBusy = true);
    try {
      await getIt<WorkoutPlanRepository>().removeAssignment(workout.id);
      await _loadWorkout();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _workoutBusy = false);
    }
  }

  Future<void> _markExercise(
    String exerciseId,
    ExerciseProgressStatus status,
  ) async {
    final workout = _workout;
    if (workout == null) return;
    setState(() => _busyExerciseId = exerciseId);
    try {
      await getIt<WorkoutPlanRepository>().markProgress(
        assignmentId: workout.id,
        exerciseId: exerciseId,
        status: status,
      );
      await _loadWorkout();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busyExerciseId = null);
    }
  }

  Future<void> _removeDiet() async {
    final diet = _diet;
    if (diet == null) return;
    final ok = await _confirm(
      title: 'Remove diet plan?',
      content: '${_member!.name} will lose access to "${diet.dietPlanName}".',
      confirmLabel: 'Remove',
      destructive: true,
    );
    if (!ok) return;
    setState(() => _dietBusy = true);
    try {
      await getIt<DietPlanRepository>().removeAssignment(diet.id);
      await _loadDiet();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _dietBusy = false);
    }
  }

  Future<void> _saveDietTracking() async {
    final diet = _diet;
    if (diet == null) return;
    final water = int.tryParse(_waterController.text.trim());
    final weight = double.tryParse(_weightController.text.trim());
    setState(() => _savingDietTracking = true);
    try {
      final updated = await getIt<DietPlanRepository>().updateProgress(
        assignmentId: diet.id,
        date: DateTime.now(),
        waterIntakeMl: water,
        weightKg: weight,
      );
      if (mounted) setState(() => _diet = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _savingDietTracking = false);
    }
  }

  Future<void> _markMeal(MealType type, ExerciseProgressStatus status) async {
    final diet = _diet;
    if (diet == null) return;
    setState(() => _busyMealType = type);
    try {
      final updated = await getIt<DietPlanRepository>().updateProgress(
        assignmentId: diet.id,
        date: DateTime.now(),
        mealsStatus: {type: status},
      );
      if (mounted) setState(() => _diet = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busyMealType = null);
    }
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final member = await getIt<MemberRepository>().getById(widget.memberId);
      if (!mounted) return;
      setState(() {
        _member = member;
        _selectedBranchId = member.branch.id;
        _selectedTrainerId = member.trainer?.id;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    }
  }

  Future<void> _loadPickerOptions() async {
    try {
      final branchesFuture = getIt<BranchRepository>().assignable();
      final trainersFuture = getIt<StaffRepository>().list(
        limit: 100,
        role: StaffRole.trainer,
        status: 'ACTIVE',
      );
      final branches = await branchesFuture;
      final trainers = await trainersFuture;
      if (!mounted) return;
      setState(() {
        _branchOptions = branches;
        _trainers = trainers.items;
      });
    } on ApiException {
      // Non-fatal — the Branch & trainer card just shows the current
      // read-only values without a picker if this fails.
    }
  }

  Future<void> _runAction(
    Future<void> Function() action, {
    bool reload = true,
  }) async {
    setState(() => _busy = true);
    try {
      await action();
      if (reload) await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm({
    required String title,
    required String content,
    required String confirmLabel,
    bool destructive = false,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => context.pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(true),
            child: Text(
              confirmLabel,
              style: TextStyle(
                color: destructive ? AppColors.danger : AppColors.staffPillFg,
              ),
            ),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  /// Shared by `_logGuestVisit`/`_logPtSession` below — a single optional
  /// text field, same `AlertDialog` styling as `_confirm`.
  Future<String?> _promptText({
    required String title,
    required String label,
    required String confirmLabel,
  }) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(labelText: label),
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => context.pop(controller.text.trim()),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    controller.dispose();
    return result;
  }

  Future<void> _logGuestVisit() async {
    final guestName = await _promptText(
      title: 'Log guest visit',
      label: 'Guest name (optional)',
      confirmLabel: 'Log visit',
    );
    if (guestName == null) return;
    await _runAction(
      () => getIt<MemberRepository>().logGuestVisit(
        widget.memberId,
        guestName: guestName,
      ),
    );
  }

  Future<void> _logPtSession() async {
    final notes = await _promptText(
      title: 'Log PT session',
      label: 'Notes (optional)',
      confirmLabel: 'Log session',
    );
    if (notes == null) return;
    await _runAction(
      () => getIt<MemberRepository>().logPtSession(
        widget.memberId,
        notes: notes,
      ),
    );
  }

  Future<void> _resume() =>
      _runAction(() => getIt<MemberRepository>().resume(widget.memberId));

  Future<void> _activate() =>
      _runAction(() => getIt<MemberRepository>().activate(widget.memberId));

  Future<void> _deactivate() async {
    final ok = await _confirm(
      title: 'Deactivate ${_member!.name}?',
      content: 'They will no longer be able to check in.',
      confirmLabel: 'Deactivate',
      destructive: true,
    );
    if (!ok) return;
    await _runAction(
      () => getIt<MemberRepository>().deactivate(widget.memberId),
    );
  }

  Future<void> _delete() async {
    final ok = await _confirm(
      title: 'Delete ${_member!.name}?',
      content: 'This can be undone with Restore, from a manager or owner '
          'account.',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok) return;
    setState(() => _busy = true);
    try {
      await getIt<MemberRepository>().softDelete(widget.memberId);
      if (!mounted) return;
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
      setState(() => _busy = false);
    }
  }

  Future<void> _restore() =>
      _runAction(() => getIt<MemberRepository>().restore(widget.memberId));

  Future<void> _saveBranch() async {
    final branchId = _selectedBranchId;
    if (branchId == null || branchId == _member!.branch.id) return;
    setState(() => _savingBranch = true);
    try {
      await getIt<MemberRepository>().transferBranch(widget.memberId, branchId);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _savingBranch = false);
    }
  }

  Future<void> _saveTrainer() async {
    if (_selectedTrainerId == _member!.trainer?.id) return;
    setState(() => _savingTrainer = true);
    try {
      await getIt<MemberRepository>()
          .assignTrainer(widget.memberId, _selectedTrainerId);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _savingTrainer = false);
    }
  }

  Future<void> _extend() async {
    final daysController = TextEditingController();
    final days = await showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: const Text('Extend membership'),
        content: TextField(
          controller: daysController,
          autofocus: true,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: AppColors.ink),
          decoration: const InputDecoration(labelText: 'Extend by (days)'),
        ),
        actions: [
          TextButton(
            onPressed: () => context.pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () =>
                context.pop(int.tryParse(daysController.text.trim())),
            child: const Text('Extend'),
          ),
        ],
      ),
    );
    if (days == null || days <= 0) return;
    await _runAction(
      () => getIt<MemberRepository>().extend(widget.memberId, days),
    );
  }

  Future<void> _cancelMembership() async {
    final ok = await _confirm(
      title: 'Cancel membership?',
      content:
          '${_member!.name} will lose access once the current period ends.',
      confirmLabel: 'Cancel membership',
      destructive: true,
    );
    if (!ok) return;
    await _runAction(
      () => getIt<MemberRepository>().cancelMembership(widget.memberId),
    );
  }

  Future<void> _regenerateQr() => _runAction(
        () => getIt<MemberRepository>().regenerateQrCode(widget.memberId),
      );

  Future<void> _sendPortalInvite() => _runAction(
        () => getIt<MemberRepository>().sendPortalInvite(widget.memberId),
        reload: false,
      );

  Future<void> _eraseData() async {
    final ok = await _confirm(
      title: "Erase ${_member!.name}'s data?",
      content: 'Profile, contact, and medical fields are anonymized and '
          'portal access is revoked. Financial records are retained for '
          'accounting, stripped of identifying info. This cannot be undone.',
      confirmLabel: 'Erase data',
      destructive: true,
    );
    if (!ok) return;
    await _runAction(
      () => getIt<MemberRepository>().gdprErase(widget.memberId),
    );
  }

  Future<void> _pickPhoto(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 85,
    );
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    setState(() => _uploadingPhoto = true);
    try {
      await getIt<MemberRepository>().update(widget.memberId, {
        'profilePhotoUrl': 'data:image/jpeg;base64,${base64Encode(bytes)}',
      });
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  void _showPhotoOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Take a photo'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () {
                Navigator.pop(sheetContext);
                _pickPhoto(ImageSource.gallery);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final member = _member;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        title: const Text('Member'),
        actions: [
          if (member != null) _buildOverflowMenu(member),
        ],
      ),
      body: SafeArea(
        top: false,
        child: _error != null
            ? AppErrorView(message: _error!, onRetry: _load)
            : member == null
                ? const AppLoadingView()
                : _buildContent(member),
      ),
    );
  }

  /// Rare/destructive status actions live behind the AppBar's overflow
  /// menu rather than crowding the hero — Freeze/Resume (the common case)
  /// stays a visible pill instead.
  Widget _buildOverflowMenu(GymMember member) {
    final deleted = member.deletedAt != null;
    return PopupMenuButton<String>(
      icon: const Icon(Icons.more_vert_rounded, color: AppColors.ink),
      color: AppColors.surface2,
      onSelected: (value) => switch (value) {
        'restore' => _restore(),
        'activate' => _activate(),
        'deactivate' => _deactivate(),
        'delete' => _delete(),
        _ => null,
      },
      itemBuilder: (context) => [
        if (deleted)
          const PopupMenuItem(value: 'restore', child: Text('Restore'))
        else ...[
          PopupMenuItem(
            value: member.status == 'ACTIVE' ? 'deactivate' : 'activate',
            child: Text(member.status == 'ACTIVE' ? 'Deactivate' : 'Activate'),
          ),
          const PopupMenuItem(
            value: 'delete',
            child: Text('Delete', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ],
    );
  }

  Widget _buildContent(GymMember member) {
    final membership = member.currentMembership;
    final deleted = member.deletedAt != null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
      children: [
        _buildHero(member, deleted),
        const SizedBox(height: 20),
        GlassCard(
          padding: const EdgeInsets.all(18),
          gradientOverlay: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0x298B5CF6), Color(0x14FF6B5B)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                membership?.planName ?? 'No active plan',
                style: AppText.eyebrow(color: AppColors.staffPillFg),
              ),
              const SizedBox(height: 4),
              Text(
                membership == null
                    ? 'Assign a plan from Renew'
                    : membership.status == 'PENDING'
                        ? 'Starts ${_formatDate(membership.startDate)}'
                        : 'Ends ${_formatDate(membership.endDate)}',
                style: AppText.display(size: 18),
              ),
              if (member.planUsage != null &&
                  (member.planUsage!.guestPassesIncluded > 0 ||
                      member.planUsage!.ptSessionsIncluded > 0 ||
                      member.planUsage!.groupClassesIncluded > 0 ||
                      member.planUsage!.freezeDaysLimit != null)) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 14,
                  runSpacing: 4,
                  children: [
                    if (member.planUsage!.guestPassesIncluded > 0)
                      Text(
                        'Guest passes: ${member.planUsage!.guestPassesUsed}/${member.planUsage!.guestPassesIncluded}',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    if (member.planUsage!.ptSessionsIncluded > 0)
                      Text(
                        'PT sessions: ${member.planUsage!.ptSessionsUsed}/${member.planUsage!.ptSessionsIncluded}',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    if (member.planUsage!.groupClassesIncluded > 0)
                      Text(
                        'Group classes: ${member.planUsage!.groupClassesUsed}/${member.planUsage!.groupClassesIncluded}',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    if (member.planUsage!.freezeDaysLimit != null)
                      Text(
                        'Freeze days: ${member.planUsage!.freezeDaysUsed}/${member.planUsage!.freezeDaysLimit}',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                  ],
                ),
              ],
              if (membership != null &&
                  membership.status == 'ACTIVE' &&
                  member.planUsage != null &&
                  (member.planUsage!.guestPassesIncluded > 0 ||
                      member.planUsage!.ptSessionsIncluded > 0)) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    if (member.planUsage!.guestPassesIncluded > 0)
                      AppButton(
                        label: 'Log guest visit',
                        size: AppButtonSize.small,
                        variant: AppButtonVariant.ghost,
                        onPressed: _logGuestVisit,
                      ),
                    if (member.planUsage!.ptSessionsIncluded > 0)
                      AppButton(
                        label: 'Log PT session',
                        size: AppButtonSize.small,
                        variant: AppButtonVariant.ghost,
                        onPressed: _logPtSession,
                      ),
                  ],
                ),
              ],
              if (membership != null) ...[
                const SizedBox(height: 16),
                AppButton(
                  label: 'Renew',
                  size: AppButtonSize.small,
                  onPressed: () => context
                      .push(AppRoutes.memberRenew, extra: member)
                      .then((_) => _load()),
                ),
                const SizedBox(height: 10),
                _buildMembershipActions(member, membership),
              ] else
                AppButton(
                  label: 'Choose a plan',
                  size: AppButtonSize.small,
                  onPressed: () => context
                      .push(AppRoutes.memberRenew, extra: member)
                      .then((_) => _load()),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CardHeading(icon: Icons.badge_outlined, title: 'Details'),
              const SizedBox(height: 10),
              _DetailRow(label: 'Member ID', value: member.memberId),
              _DetailRow(label: 'Phone', value: member.phone ?? '—'),
              _DetailRow(label: 'Email', value: member.email ?? '—'),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _ActionTile(
          icon: Icons.badge_outlined,
          title: 'Edit personal info',
          subtitle: 'Name, contact, gender, DOB, health basics',
          onTap: () => context
              .push(AppRoutes.memberEditPersonal, extra: member)
              .then((_) => _load()),
        ),
        const SizedBox(height: 8),
        _ActionTile(
          icon: Icons.location_on_outlined,
          title: 'Edit address & emergency contact',
          subtitle: 'Where they live, who to call',
          onTap: () => context
              .push(AppRoutes.memberEditAddress, extra: member)
              .then((_) => _load()),
        ),
        const SizedBox(height: 8),
        _ActionTile(
          icon: Icons.favorite_outline_rounded,
          title: 'Edit health & notes',
          subtitle: 'Medical conditions, allergies, goals',
          onTap: () => context
              .push(AppRoutes.memberEditHealth, extra: member)
              .then((_) => _load()),
        ),
        const SizedBox(height: 16),
        _buildBranchTrainerCard(member),
        if (member.membershipHistory.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildHistoryCard(
            icon: Icons.history_rounded,
            title: 'Renewal history',
            children: member.membershipHistory
                .map(
                  (h) => _HistoryRow(
                    title: h.planName,
                    subtitle: '${_formatDate(h.startDate)} – '
                        '${_formatDate(h.endDate)} · Auto-renew: '
                        '${h.autoRenew ? 'Yes' : 'No'}',
                    trailing:
                        '${AppCurrency.symbol}${h.priceAtAssignment.toStringAsFixed(0)}',
                    status: h.status,
                  ),
                )
                .toList(),
          ),
        ],
        if (member.freezeHistory.isNotEmpty) ...[
          const SizedBox(height: 16),
          _buildHistoryCard(
            icon: Icons.ac_unit_rounded,
            title: 'Freeze history',
            children: member.freezeHistory
                .map(
                  (h) => _HistoryRow(
                    title: _formatDateTime(h.frozenAt),
                    subtitle: h.unfrozenAt == null
                        ? 'Still frozen'
                        : 'Unfrozen ${_formatDateTime(h.unfrozenAt!)}',
                    trailing: h.reason ?? '—',
                  ),
                )
                .toList(),
          ),
        ],
        const SizedBox(height: 16),
        _buildAttendanceCard(),
        const SizedBox(height: 16),
        _buildWorkoutCard(),
        const SizedBox(height: 16),
        _buildDietCard(),
        const SizedBox(height: 16),
        _buildMeasurementsCard(),
        const SizedBox(height: 16),
        _buildQrCard(member),
        const SizedBox(height: 16),
        _buildPortalCard(member),
        const SizedBox(height: 16),
        _buildPrivacyCard(member),
      ],
    );
  }

  Widget _buildHero(GymMember member, bool deleted) {
    return Column(
      children: [
        GestureDetector(
          onTap: _uploadingPhoto ? null : _showPhotoOptions,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              UserAvatar(
                avatarUrl: member.profilePhotoUrl,
                name: member.name,
                size: 88,
              ),
              if (_uploadingPhoto)
                Container(
                  width: 88,
                  height: 88,
                  decoration: const BoxDecoration(
                    color: Colors.black45,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  ),
                ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    gradient: AppColors.staffGrad,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.bg, width: 3),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.camera_alt_rounded,
                    size: 14,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          member.name,
          style: AppText.display(size: 19),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 2),
        Text(
          member.memberId,
          style: AppText.body(
            size: 12.5,
            color: AppColors.inkFaint,
            weight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 10),
        _StatusPill(status: member.status, deleted: deleted),
        if (!deleted) ...[
          const SizedBox(height: 12),
          AppButton(
            label: member.status == 'FROZEN' ? 'Resume' : 'Freeze',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: _busy,
            icon: member.status == 'FROZEN'
                ? Icons.play_arrow_rounded
                : Icons.ac_unit_rounded,
            onPressed: member.status == 'FROZEN'
                ? _resume
                : () => context
                    .push(AppRoutes.memberFreeze, extra: member.id)
                    .then((_) => _load()),
          ),
        ],
      ],
    );
  }

  Widget _buildMembershipActions(
    GymMember member,
    CurrentMembershipSummary membership,
  ) {
    return Row(
      children: [
        Expanded(
          child: _MembershipActionTile(
            icon: Icons.more_time_rounded,
            label: 'Extend',
            color: AppColors.inkSoft,
            onTap: _extend,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _MembershipActionTile(
            icon: Icons.trending_up_rounded,
            label: 'Upgrade',
            color: AppColors.success,
            onTap: () => context
                .push(AppRoutes.memberUpgrade, extra: member)
                .then((_) => _load()),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _MembershipActionTile(
            icon: Icons.trending_down_rounded,
            label: 'Downgrade',
            color: AppColors.warning,
            onTap: () => context
                .push(AppRoutes.memberDowngrade, extra: member)
                .then((_) => _load()),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _MembershipActionTile(
            icon: Icons.cancel_outlined,
            label: 'Cancel',
            color: AppColors.danger,
            onTap: _cancelMembership,
          ),
        ),
      ],
    );
  }

  Widget _buildBranchTrainerCard(GymMember member) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(
            icon: Icons.storefront_outlined,
            title: 'Branch & trainer',
          ),
          const SizedBox(height: 12),
          if (_branchOptions.isEmpty)
            _DetailRow(label: 'Branch', value: member.branch.name)
          else ...[
            _SectionLabelRow(
              label: 'Branch',
              showSave: _selectedBranchId != member.branch.id,
              saving: _savingBranch,
              onSave: _saveBranch,
            ),
            const SizedBox(height: 6),
            CategoryChipSelector<String>(
              options: _branchOptions.map((b) => b.id).toList(),
              labelOf: (id) =>
                  _branchOptions.firstWhere((b) => b.id == id).name,
              value: _selectedBranchId ?? member.branch.id,
              onChanged: (id) => setState(() => _selectedBranchId = id),
            ),
          ],
          const SizedBox(height: 16),
          _SectionLabelRow(
            label: 'Trainer',
            showSave: _selectedTrainerId != member.trainer?.id,
            saving: _savingTrainer,
            onSave: _saveTrainer,
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Chip(
                label: 'No trainer assigned',
                selected: _selectedTrainerId == null,
                onTap: () => setState(() => _selectedTrainerId = null),
              ),
              for (final t in _trainers)
                _Chip(
                  label: t.name,
                  selected: _selectedTrainerId == t.id,
                  onTap: () => setState(() => _selectedTrainerId = t.id),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryCard({
    required IconData icon,
    required String title,
    required List<Widget> children,
  }) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: icon, title: title),
          const SizedBox(height: 8),
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.line),
            children[i],
          ],
        ],
      ),
    );
  }

  Widget _buildAttendanceCard() {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: Icons.login_rounded, title: 'Attendance'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Check in',
                  size: AppButtonSize.small,
                  icon: Icons.login_rounded,
                  loading: _attendanceBusy,
                  onPressed: _attendanceBusy ? null : _checkIn,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppButton(
                  label: 'Check out',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  icon: Icons.logout_rounded,
                  loading: _attendanceBusy,
                  onPressed: _attendanceBusy ? null : _checkOut,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Recent visits',
                style: AppText.body(
                  size: 12,
                  color: AppColors.inkFaint,
                  weight: FontWeight.w700,
                ),
              ),
              if (_recentVisits.length >= _attendanceLimit)
                GestureDetector(
                  onTap: _loadingMoreVisits ? null : _loadMoreVisits,
                  child: Text(
                    _loadingMoreVisits ? 'Loading…' : 'View full history',
                    style: AppText.body(
                      size: 11,
                      color: AppColors.staffPillFg,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (_recentVisits.isEmpty)
            Text(
              'No visits recorded yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else
            for (var i = 0; i < _recentVisits.length; i++) ...[
              if (i > 0) const Divider(height: 1, color: AppColors.line),
              _VisitRow(record: _recentVisits[i]),
            ],
        ],
      ),
    );
  }

  Widget _buildWorkoutCard() {
    final workout = _workout;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: Icons.fitness_center_rounded, title: 'Workout'),
          const SizedBox(height: 12),
          if (workout == null)
            Text(
              'No active workout plan.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'On ${workout.workoutPlanName}',
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${workout.durationWeeks}w, ${workout.level.label}',
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                AppButton(
                  label: 'Remove',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  fullWidth: false,
                  foregroundColor: AppColors.danger,
                  loading: _workoutBusy,
                  onPressed: _workoutBusy ? null : _removeWorkout,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Started ${_formatDate(workout.startDate)} · '
              '${workout.progressPercent}% complete '
              '(${workout.completedCount}/${workout.totalExercises})',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            if (workout.progress.isNotEmpty) const SizedBox(height: 12),
            for (final entry in workout.progress) ...[
              _ExerciseRow(
                entry: entry,
                busy: _busyExerciseId == entry.exerciseId,
                onDone: () => _markExercise(
                  entry.exerciseId,
                  ExerciseProgressStatus.completed,
                ),
                onSkip: () => _markExercise(
                  entry.exerciseId,
                  ExerciseProgressStatus.skipped,
                ),
              ),
              const SizedBox(height: 8),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildDietCard() {
    final diet = _diet;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: Icons.restaurant_rounded, title: 'Diet'),
          const SizedBox(height: 12),
          if (diet == null)
            Text(
              'No active diet plan.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'On ${diet.dietPlanName}',
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        diet.dailyCalories != null
                            ? '${diet.durationDays}d, '
                                '${diet.dailyCalories} kcal/day'
                            : '${diet.durationDays}d',
                        style: AppText.body(
                          size: 11,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
                AppButton(
                  label: 'Remove',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  fullWidth: false,
                  foregroundColor: AppColors.danger,
                  loading: _dietBusy,
                  onPressed: _dietBusy ? null : _removeDiet,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Started ${_formatDate(diet.startDate)} · '
              '${diet.progressPercent}% adherence '
              '(${diet.daysLogged} day${diet.daysLogged == 1 ? '' : 's'} '
              'logged)',
              style: AppText.body(
                size: 11,
                color: AppColors.inkFaint,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
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
                  Text(
                    "Today's tracking (${_formatDate(DateTime.now())})",
                    style: AppText.eyebrow(),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _TrackingField(
                          label: 'Water intake (ml)',
                          controller: _waterController,
                          integerOnly: true,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _TrackingField(
                          label: 'Weight (kg)',
                          controller: _weightController,
                          integerOnly: false,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  AppButton(
                    label: 'Save tracking',
                    size: AppButtonSize.small,
                    fullWidth: false,
                    loading: _savingDietTracking,
                    onPressed: _savingDietTracking ? null : _saveDietTracking,
                  ),
                ],
              ),
            ),
            if (diet.mealTypes.isNotEmpty) const SizedBox(height: 12),
            for (final mealType in diet.mealTypes) ...[
              _DietMealRow(
                mealType: mealType,
                status: diet.logFor(DateTime.now())?.mealsStatus[mealType] ??
                    ExerciseProgressStatus.pending,
                busy: _busyMealType == mealType,
                onDone: () =>
                    _markMeal(mealType, ExerciseProgressStatus.completed),
                onSkip: () =>
                    _markMeal(mealType, ExerciseProgressStatus.skipped),
              ),
              const SizedBox(height: 8),
            ],
          ],
        ],
      ),
    );
  }

  /// Trainer/Owner/Manager-logged historical body-measurement trend log —
  /// separate from the profile's single current height/weight fields at the
  /// top of this screen. A role without `measurements:create`/`:delete`
  /// still sees this card (backend 403s the action, surfaced via the
  /// snackbar) — same unconditional-render convention as every other card
  /// here (see this file's doc comment: no permission checks anywhere in
  /// this screen, unlike web's `hasPermission` gating).
  Widget _buildMeasurementsCard() {
    final latest = _measurements.isEmpty ? null : _measurements.first;
    final history = _measurements.length > 1 ? _measurements.sublist(1) : const <BodyMeasurement>[];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: Icons.straighten_rounded, title: 'Body measurements'),
          const SizedBox(height: 12),
          if (latest == null)
            Text(
              'No measurements recorded yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _formatDate(latest.recordedAt),
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        latest.summary,
                        style: AppText.body(size: 11, color: AppColors.inkFaint),
                      ),
                      if (latest.recordedBy != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          'Recorded by ${latest.recordedBy!.name}',
                          style: AppText.body(size: 10, color: AppColors.inkFaint),
                        ),
                      ],
                    ],
                  ),
                ),
                AppButton(
                  label: 'Delete',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  fullWidth: false,
                  foregroundColor: AppColors.danger,
                  loading: _deletingMeasurementId == latest.id,
                  onPressed: _deletingMeasurementId != null
                      ? null
                      : () => _deleteMeasurement(latest),
                ),
              ],
            ),
          const SizedBox(height: 12),
          if (_measurementFormOpen)
            _MeasurementForm(
              weightController: _measurementWeightController,
              heightController: _measurementHeightController,
              bodyFatController: _measurementBodyFatController,
              chestController: _measurementChestController,
              waistController: _measurementWaistController,
              hipsController: _measurementHipsController,
              bicepsController: _measurementBicepsController,
              thighsController: _measurementThighsController,
              notesController: _measurementNotesController,
              saving: _savingMeasurement,
              onSave: _saveMeasurement,
              onCancel: () => setState(() => _measurementFormOpen = false),
            )
          else
            AppButton(
              label: 'Record measurement',
              size: AppButtonSize.small,
              fullWidth: false,
              onPressed: () => setState(() => _measurementFormOpen = true),
            ),
          if (history.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text('History (${history.length})', style: AppText.eyebrow()),
            const SizedBox(height: 8),
            for (final entry in history) ...[
              _MeasurementHistoryRow(
                entry: entry,
                deleting: _deletingMeasurementId == entry.id,
                onDelete: _deletingMeasurementId != null
                    ? null
                    : () => _deleteMeasurement(entry),
              ),
              const SizedBox(height: 8),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildQrCard(GymMember member) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(icon: Icons.qr_code_2_rounded, title: 'QR code'),
          const SizedBox(height: 12),
          if (member.qrCodeImageUrl != null)
            Center(
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.field),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.tile),
                  child: Image.network(
                    _reachableImageUrl(member.qrCodeImageUrl!),
                    width: 150,
                    height: 150,
                    errorBuilder: (_, __, ___) => SizedBox(
                      width: 150,
                      height: 150,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.qr_code_2_rounded,
                            size: 32,
                            color: AppColors.inkFaint,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            "Couldn't load QR code",
                            textAlign: TextAlign.center,
                            style: AppText.body(
                              size: 10,
                              color: AppColors.inkFaint,
                              weight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          const SizedBox(height: 12),
          AppButton(
            label: 'Regenerate QR code',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: _busy,
            onPressed: _regenerateQr,
          ),
        ],
      ),
    );
  }

  Widget _buildPortalCard(GymMember member) {
    final hasEmail = member.email != null && member.email!.isNotEmpty;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _CardHeading(
            icon: Icons.smartphone_rounded,
            title: 'Member portal',
          ),
          const SizedBox(height: 8),
          Text(
            hasEmail
                ? "Let ${member.name} log in on their own to view "
                    'attendance, workout/diet plans, invoices, and their QR '
                    'code.'
                : "Let ${member.name} log in on their own to view "
                    'attendance, workout/diet plans, invoices, and their QR '
                    'code. Add an email on file first.',
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          const SizedBox(height: 10),
          AppButton(
            label: 'Enable portal access',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: _busy,
            onPressed: hasEmail ? _sendPortalInvite : null,
          ),
        ],
      ),
    );
  }

  Widget _buildPrivacyCard(GymMember member) {
    return Column(
      children: [
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _CardHeading(
                icon: Icons.privacy_tip_outlined,
                title: 'Data & privacy',
              ),
              const SizedBox(height: 8),
              Text(
                'Download everything on file for ${member.name} — profile, '
                'attendance, plans, invoices, payments, and bookings.',
                style: AppText.body(size: 12, color: AppColors.inkFaint),
              ),
              const SizedBox(height: 10),
              AppButton(
                label: 'Export data',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                fullWidth: false,
                onPressed: () => context.push(
                  AppRoutes.memberGdprExport,
                  extra: member,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.dangerSoft,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.warning_amber_rounded,
                    size: 16,
                    color: AppColors.danger,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Erase personal data',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w800,
                      color: AppColors.danger,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                "Anonymizes ${member.name}'s profile, contact, and medical "
                'fields and revokes portal access — financial records are '
                'retained for accounting, stripped of identifying info. '
                'This cannot be undone.',
                style: AppText.body(size: 11.5, color: AppColors.inkSoft),
              ),
              const SizedBox(height: 10),
              AppButton(
                label: 'Erase data',
                variant: AppButtonVariant.ghost,
                size: AppButtonSize.small,
                fullWidth: false,
                foregroundColor: AppColors.danger,
                loading: _busy,
                onPressed: _eraseData,
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  String _formatDateTime(DateTime d) =>
      '${_formatDate(d)}, ${d.hour.toString().padLeft(2, '0')}:'
      '${d.minute.toString().padLeft(2, '0')}:'
      '${d.second.toString().padLeft(2, '0')}';
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppText.body(
              size: 13,
              color: AppColors.inkFaint,
              weight: FontWeight.w600,
            ),
          ),
          Text(value, style: AppText.body(size: 13, weight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Storage URLs (QR codes, photos) are built server-side from
/// `S3_PUBLIC_URL_BASE`, which points at `localhost` — reachable from a
/// browser on the dev machine (web) but not from a phone on the LAN.
/// Swap in the same host the API client already uses (a real IP for a
/// physical device, `10.0.2.2` for the emulator) so the image actually
/// loads instead of erroring.
String _reachableImageUrl(String url) {
  final uri = Uri.tryParse(url);
  if (uri == null || (uri.host != 'localhost' && uri.host != '127.0.0.1')) {
    return url;
  }
  final apiHost = Uri.parse(Env.apiBaseUrl).host;
  return uri.replace(host: apiHost).toString();
}

Color _historyStatusColor(String status) => switch (status) {
      'ACTIVE' => AppColors.success,
      'PENDING' => AppColors.warning,
      'SUPERSEDED' => AppColors.inkFaint,
      'CANCELLED' => AppColors.danger,
      _ => AppColors.inkFaint,
    };

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.status,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final String? status;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                trailing,
                style: AppText.tabular(size: 13, weight: FontWeight.w700),
              ),
              if (status != null) ...[
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: _historyStatusColor(status!).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  child: Text(
                    status!,
                    style: AppText.body(
                      size: 9,
                      weight: FontWeight.w800,
                      color: _historyStatusColor(status!),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status, required this.deleted});

  final String status;
  final bool deleted;

  @override
  Widget build(BuildContext context) {
    final label = deleted ? 'DELETED' : status;
    final color = deleted
        ? AppColors.danger
        : switch (status) {
            'ACTIVE' => AppColors.success,
            'FROZEN' => AppColors.warning,
            _ => AppColors.inkFaint,
          };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: AppText.body(size: 10, weight: FontWeight.w800, color: color),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            gradient: selected ? AppColors.staffGrad : null,
            color: selected ? null : AppColors.surface3,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w700,
              color: selected ? Colors.white : AppColors.inkSoft,
            ),
          ),
        ),
      ),
    );
  }
}

/// Small icon + eyebrow-style title used at the top of every card on this
/// screen, so a scan down the page reads as one consistent visual system
/// instead of a stack of plain text labels.
class _CardHeading extends StatelessWidget {
  const _CardHeading({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: AppColors.staffPillFg),
        const SizedBox(width: 6),
        Text(title, style: AppText.eyebrow()),
      ],
    );
  }
}

/// A section label with an inline "Save" action that only appears once
/// the picker's pending value actually differs from what's saved — mirrors
/// web's per-field save buttons for Branch/Trainer without a second full
/// -width button competing for attention below the chips.
class _SectionLabelRow extends StatelessWidget {
  const _SectionLabelRow({
    required this.label,
    required this.showSave,
    required this.saving,
    required this.onSave,
  });

  final String label;
  final bool showSave;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: AppText.body(
            size: 12,
            color: AppColors.inkFaint,
            weight: FontWeight.w700,
          ),
        ),
        if (showSave)
          AppButton(
            label: 'Save',
            variant: AppButtonVariant.ghost,
            size: AppButtonSize.small,
            fullWidth: false,
            loading: saving,
            onPressed: onSave,
          ),
      ],
    );
  }
}

/// Chevron-style navigation row (icon badge + title + subtitle), same tile
/// chrome as `MyProfileScreen`'s `_MenuTile` — replaces the old stack of
/// full-width ghost "Edit …" buttons with the settings-list pattern
/// already established elsewhere in the app.
class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.card),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface2,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.staffSoft,
                  borderRadius: BorderRadius.circular(AppRadii.tile),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 18, color: AppColors.staffPillFg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                    Text(
                      subtitle,
                      style: AppText.body(
                        size: 11,
                        color: AppColors.inkFaint,
                        weight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.inkFaint,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One tile in the membership 2x2 action grid — a compact bordered tile
/// (icon over label) instead of a text pill, so four actions of very
/// different weight (a routine Extend vs. a destructive Cancel) read as
/// visually distinct at a glance via `color`.
class _MembershipActionTile extends StatelessWidget {
  const _MembershipActionTile({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.tile),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(AppRadii.tile),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 17, color: color),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 10,
                  weight: FontWeight.w800,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _dateTimeLabel(DateTime d) => '${d.day.toString().padLeft(2, '0')}/'
    '${d.month.toString().padLeft(2, '0')}/${d.year}, '
    '${d.hour.toString().padLeft(2, '0')}:'
    '${d.minute.toString().padLeft(2, '0')}:'
    '${d.second.toString().padLeft(2, '0')}';

String _timeLabel(DateTime d) => '${d.hour.toString().padLeft(2, '0')}:'
    '${d.minute.toString().padLeft(2, '0')}';

String _attendanceMethodLabel(String? method) => switch (method) {
      'MANUAL' => 'Manual',
      'QR_CODE' => 'QR code',
      'BIOMETRIC' => 'Biometric',
      'FACE_RECOGNITION' => 'Face recognition',
      'NFC' => 'NFC',
      'RFID' => 'RFID',
      _ => 'Unknown',
    };

/// One row of "Recent visits" — mirrors web's attendance history row
/// (check-in – check-out, method, status pill).
class _VisitRow extends StatelessWidget {
  const _VisitRow({required this.record});

  final AttendanceRecord record;

  @override
  Widget build(BuildContext context) {
    final checkOut = record.checkOutTime;
    final title = checkOut == null
        ? _dateTimeLabel(record.checkInTime)
        : '${_dateTimeLabel(record.checkInTime)} – ${_timeLabel(checkOut)}';
    final checkedIn = record.status == 'CHECKED_IN';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  _attendanceMethodLabel(record.method),
                  style: AppText.body(size: 11, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          AppPill(
            label: checkedIn ? 'Checked in' : 'Checked out',
            tone: checkedIn ? AppPillTone.warning : AppPillTone.success,
          ),
        ],
      ),
    );
  }
}

/// One exercise row in the Workout card — same "title + status pill, Done/
/// Skip buttons while not completed" shape as the member portal's own
/// workout screen, just reading/writing through the staff-facing endpoints.
class _ExerciseRow extends StatelessWidget {
  const _ExerciseRow({
    required this.entry,
    required this.busy,
    required this.onDone,
    required this.onSkip,
  });

  final ExerciseProgressEntry entry;
  final bool busy;
  final VoidCallback onDone;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final isDone = entry.status == ExerciseProgressStatus.completed;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.tile),
        border: Border.all(
          color: isDone
              ? AppColors.success.withValues(alpha: 0.3)
              : AppColors.line,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${entry.exerciseName} (${entry.dayOfWeek.label})',
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: switch (entry.status) {
                  ExerciseProgressStatus.completed => 'Completed',
                  ExerciseProgressStatus.skipped => 'Skipped',
                  ExerciseProgressStatus.pending => 'Pending',
                },
                tone: switch (entry.status) {
                  ExerciseProgressStatus.completed => AppPillTone.success,
                  ExerciseProgressStatus.skipped => AppPillTone.neutral,
                  ExerciseProgressStatus.pending => AppPillTone.warning,
                },
              ),
            ],
          ),
          if (!isDone) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Done',
                    size: AppButtonSize.small,
                    loading: busy,
                    onPressed: busy ? null : onDone,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: AppButton(
                    label: 'Skip',
                    variant: AppButtonVariant.ghost,
                    size: AppButtonSize.small,
                    onPressed: busy ? null : onSkip,
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

/// Compact numeric field for the diet card's water/weight tracking inputs.
class _TrackingField extends StatelessWidget {
  const _TrackingField({
    required this.label,
    required this.controller,
    required this.integerOnly,
  });

  final String label;
  final TextEditingController controller;
  final bool integerOnly;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppText.body(
            size: 11,
            color: AppColors.inkFaint,
            weight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: TextInputType.numberWithOptions(decimal: !integerOnly),
          inputFormatters: [
            FilteringTextInputFormatter.allow(
              integerOnly ? RegExp(r'^\d*') : RegExp(r'^\d*\.?\d{0,2}'),
            ),
          ],
          style: AppText.body(size: 14, weight: FontWeight.w600),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: AppColors.surface3,
            hintText: '—',
            hintStyle: AppText.body(color: AppColors.inkFaint),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: const BorderSide(color: AppColors.line),
            ),
          ),
        ),
      ],
    );
  }
}

/// One meal row in the Diet card — same shape as [_ExerciseRow].
class _DietMealRow extends StatelessWidget {
  const _DietMealRow({
    required this.mealType,
    required this.status,
    required this.busy,
    required this.onDone,
    required this.onSkip,
  });

  final MealType mealType;
  final ExerciseProgressStatus status;
  final bool busy;
  final VoidCallback onDone;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final isDone = status == ExerciseProgressStatus.completed;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.tile),
        border: Border.all(
          color: isDone
              ? AppColors.success.withValues(alpha: 0.3)
              : AppColors.line,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  mealType.label,
                  style: AppText.body(size: 13, weight: FontWeight.w700),
                ),
              ),
              AppPill(
                label: switch (status) {
                  ExerciseProgressStatus.completed => 'Completed',
                  ExerciseProgressStatus.skipped => 'Skipped',
                  ExerciseProgressStatus.pending => 'Pending',
                },
                tone: switch (status) {
                  ExerciseProgressStatus.completed => AppPillTone.success,
                  ExerciseProgressStatus.skipped => AppPillTone.neutral,
                  ExerciseProgressStatus.pending => AppPillTone.warning,
                },
              ),
            ],
          ),
          if (!isDone) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Done',
                    size: AppButtonSize.small,
                    loading: busy,
                    onPressed: busy ? null : onDone,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: AppButton(
                    label: 'Skip',
                    variant: AppButtonVariant.ghost,
                    size: AppButtonSize.small,
                    onPressed: busy ? null : onSkip,
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

/// The "Record measurement" inline form — same 2-column `_TrackingField`
/// grid pattern as the Diet card's tracking box above, just more fields
/// (every field optional, mirrors web's `MeasurementFormFields`).
class _MeasurementForm extends StatelessWidget {
  const _MeasurementForm({
    required this.weightController,
    required this.heightController,
    required this.bodyFatController,
    required this.chestController,
    required this.waistController,
    required this.hipsController,
    required this.bicepsController,
    required this.thighsController,
    required this.notesController,
    required this.saving,
    required this.onSave,
    required this.onCancel,
  });

  final TextEditingController weightController;
  final TextEditingController heightController;
  final TextEditingController bodyFatController;
  final TextEditingController chestController;
  final TextEditingController waistController;
  final TextEditingController hipsController;
  final TextEditingController bicepsController;
  final TextEditingController thighsController;
  final TextEditingController notesController;
  final bool saving;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(AppRadii.tile),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _TrackingField(
                  label: 'Weight (kg)',
                  controller: weightController,
                  integerOnly: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TrackingField(
                  label: 'Height (cm)',
                  controller: heightController,
                  integerOnly: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _TrackingField(
                  label: 'Body fat (%)',
                  controller: bodyFatController,
                  integerOnly: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TrackingField(
                  label: 'Chest (cm)',
                  controller: chestController,
                  integerOnly: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _TrackingField(
                  label: 'Waist (cm)',
                  controller: waistController,
                  integerOnly: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TrackingField(
                  label: 'Hips (cm)',
                  controller: hipsController,
                  integerOnly: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _TrackingField(
                  label: 'Biceps (cm)',
                  controller: bicepsController,
                  integerOnly: false,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _TrackingField(
                  label: 'Thighs (cm)',
                  controller: thighsController,
                  integerOnly: false,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'Notes',
            style: AppText.body(
              size: 11,
              color: AppColors.inkFaint,
              weight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: notesController,
            style: AppText.body(size: 14, weight: FontWeight.w600),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: AppColors.surface3,
              hintText: 'Optional',
              hintStyle: AppText.body(color: AppColors.inkFaint),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.field),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Save measurement',
                  size: AppButtonSize.small,
                  loading: saving,
                  onPressed: saving ? null : onSave,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: AppButton(
                  label: 'Cancel',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  onPressed: saving ? null : onCancel,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// One past entry in the Body measurements card's collapsed history list —
/// same row shape as `_VisitRow` above (date + summary + a trailing action).
class _MeasurementHistoryRow extends StatelessWidget {
  const _MeasurementHistoryRow({
    required this.entry,
    required this.deleting,
    required this.onDelete,
  });

  final BodyMeasurement entry;
  final bool deleting;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
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
              ],
            ),
          ),
          deleting
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : IconButton(
                  icon: const Icon(
                    Icons.delete_outline_rounded,
                    size: 18,
                    color: AppColors.danger,
                  ),
                  onPressed: onDelete,
                  visualDensity: VisualDensity.compact,
                ),
        ],
      ),
    );
  }
}
