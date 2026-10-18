import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

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
import '../../../models/member_payment.dart';
import '../../../models/membership_plan.dart';
import '../../../models/member_workout_progress.dart';
import '../../../models/staff_member.dart';
import '../../../models/workout_plan.dart';
import '../../../repositories/attendance_repository.dart';
import '../../../repositories/body_measurement_repository.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/diet_plan_repository.dart';
import '../../../repositories/finance_repository.dart';
import '../../../repositories/payment_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../repositories/workout_plan_repository.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_pill.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/category_chip_selector.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../../shared/widgets/user_avatar.dart';
import 'widgets/member_detail_anim.dart';

/// Design frame "7. Member detail" (redesigned): gradient hero (Call/WhatsApp/
/// Freeze + amount-due card with payment link), six summary tiles, then five
/// section tabs — Overview, Membership, Training, Profile, Access & data. Every
/// card web has lands in one tab. Field set and section order otherwise match
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
  int _tab = 0;
  List<GuestVisit> _guestVisits = [];
  final _guestNameController = TextEditingController();
  bool _loggingGuest = false;
  bool _guestFormOpen = false;
  MembershipPlan? _plan;
  bool _pickingWorkout = false;
  bool _pickingDiet = false;
  List<(String, String)>? _workoutOptions;
  List<(String, String)>? _dietOptions;
  String? _pickedWorkout;
  String? _pickedDiet;
  bool _assigningPlan = false;
  final _scroll = ScrollController();
  final _titleOpacity = ValueNotifier<double>(1);
  List<MemberPayment> _payments = [];
  int _attendanceTotal = 0;
  List<AttendanceRecord> _monthRecords = [];
  DateTime _calMonth = DateTime(DateTime.now().year, DateTime.now().month);
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
    _scroll.addListener(() {
      final o = (1 - _scroll.offset / 48).clamp(0.0, 1.0);
      if (o != _titleOpacity.value) _titleOpacity.value = o;
    });
    _load();
    _loadPickerOptions();
    _loadTracking();
    _loadPayments();
    _loadGuestVisits();
  }

  @override
  void dispose() {
    _scroll.dispose();
    _guestNameController.dispose();
    _titleOpacity.dispose();
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
    double? num(TextEditingController c) =>
        double.tryParse(c.text.trim().replaceAll(',', '.'));
    final checks = <(String, TextEditingController, double, double, bool)>[
      ('Weight (kg)', _measurementWeightController, 0, 500, false),
      ('Height (cm)', _measurementHeightController, 0, 300, false),
      ('Body fat (%)', _measurementBodyFatController, 0, 80, true),
      ('Chest (cm)', _measurementChestController, 0, 300, false),
      ('Waist (cm)', _measurementWaistController, 0, 300, false),
      ('Hips (cm)', _measurementHipsController, 0, 300, false),
      ('Biceps (cm)', _measurementBicepsController, 0, 150, false),
      ('Thighs (cm)', _measurementThighsController, 0, 200, false),
    ];
    var filled = 0;
    for (final c in checks) {
      if (c.$2.text.trim().isEmpty) continue;
      filled++;
      final v = num(c.$2);
      if (v == null) {
        _showMeasurementError('${c.$1} must be a number.');
        return;
      }
      if (v > c.$4 || v < c.$3 || (!c.$5 && v == 0)) {
        _showMeasurementError(
          c.$5
              ? '${c.$1} must be between ${c.$3.round()} and ${c.$4.round()}.'
              : '${c.$1} must be more than 0 and at most ${c.$4.round()}.',
        );
        return;
      }
    }
    if (filled == 0) {
      _showMeasurementError('Enter at least one measurement.');
      return;
    }
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
      _showMeasurementError(e.detailedMessage);
    } finally {
      if (mounted) setState(() => _savingMeasurement = false);
    }
  }

  void _showMeasurementError(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 5),
        ),
      );
  }

  Future<void> _deleteMeasurement(BodyMeasurement entry) async {
    final ok = await _confirm(
      title: 'Delete this measurement?',
      content:
          'Recorded ${_formatDate(entry.recordedAt)} — this cannot be undone.',
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
      final month = await getIt<AttendanceRepository>().getMemberAttendance(
        widget.memberId,
        limit: 100,
      );
      if (!mounted) return;
      setState(() {
        _recentVisits = result.items;
        _attendanceTotal = result.total;
        _monthRecords = month.items;
      });
    } on ApiException {
      // Non-fatal — the Attendance card just shows an empty state.
    }
  }

  Future<void> _loadPayments() async {
    try {
      final result = await getIt<PaymentRepository>().list(
        memberId: widget.memberId,
        limit: 50,
      );
      if (!mounted) return;
      final items = [...result.items]
        ..sort((a, b) => b.paymentDate.compareTo(a.paymentDate));
      setState(() => _payments = items);
    } on ApiException {
      // Non-fatal — money tiles fall back to the member's outstanding total.
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
      _loadPlan(member);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'Could not read this member: $e');
    }
  }

  Future<void> _loadGuestVisits() async {
    try {
      final visits = await getIt<MemberRepository>().listGuestVisits(
        widget.memberId,
      );
      if (mounted) setState(() => _guestVisits = visits);
    } on ApiException {
      // Non-fatal — the Guest passes card just shows no history.
    }
  }

  Future<void> _logGuestInline() async {
    setState(() => _loggingGuest = true);
    try {
      final name = _guestNameController.text.trim();
      await getIt<MemberRepository>().logGuestVisit(
        widget.memberId,
        guestName: name.isEmpty ? null : name,
      );
      _guestNameController.clear();
      await Future.wait([_load(), _loadGuestVisits()]);
      if (mounted) setState(() => _guestFormOpen = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Guest visit logged'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.detailedMessage),
          backgroundColor: AppColors.danger,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _loggingGuest = false);
    }
  }

  Future<void> _loadPlan(GymMember member) async {
    final m = member.currentMembership;
    if (m == null) {
      if (mounted) setState(() => _plan = null);
      return;
    }
    if (_plan?.id == m.planId) return;
    try {
      final plan = await getIt<MembershipPlanRepository>().getById(m.planId);
      if (mounted) setState(() => _plan = plan);
    } on ApiException {
      // Non-fatal — the "What's in this plan" card just stays hidden.
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
    String? successMessage,
  }) async {
    setState(() => _busy = true);
    try {
      await action();
      if (reload) await _load();
      if (successMessage != null && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(successMessage)));
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.detailedMessage)));
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
    // Not disposed here: the dialog is still animating closed and its
    // TextField would hit a disposed controller (red screen). A plain
    // controller with no listeners is safe to leave to the GC.
    return result;
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
        notes: notes.isEmpty ? null : notes,
      ),
      successMessage: 'PT session logged',
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
          style: TextStyle(color: AppColors.ink),
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
        successMessage: 'Portal activation email sent.',
      );

  Future<void> _sendPortalPasswordReset() => _runAction(
        () =>
            getIt<MemberRepository>().sendPortalPasswordReset(widget.memberId),
        reload: false,
        successMessage: 'Password reset link sent.',
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
    final hero = member != null && _error == null;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: hero,
      appBar: AppBar(
        backgroundColor: hero ? Colors.transparent : AppColors.bg,
        foregroundColor: hero ? Colors.white : null,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: hero
            ? ValueListenableBuilder<double>(
                valueListenable: _titleOpacity,
                builder: (context, o, child) =>
                    Opacity(opacity: o, child: child),
                child: const Text('Member profile'),
              )
            : const Text('Member'),
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
      icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
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

  // ── Redesigned layout: gradient hero · summary tiles · section tabs ──────
  // Every card web's /members/[memberId] shows lands in exactly one tab.

  static const _kIndigo = Color(0xFF6366F1);
  static const _tabNames = [
    'Overview',
    'Membership',
    'Training',
    'Profile',
    'Access & data',
  ];

  String _money(double v) => '${AppCurrency.symbol}${v.round()}';

  double get _totalPaid => _payments
      .where((p) => p.status == 'SUCCESS')
      .fold(0.0, (s, p) => s + p.finalAmount);

  String _pretty(String? v) {
    if (v == null || v.isEmpty) return '—';
    final t = v.replaceAll('_', ' ').toLowerCase();
    return t[0].toUpperCase() + t.substring(1);
  }

  String _dateOrDash(String? iso) {
    final d = iso == null ? null : DateTime.tryParse(iso);
    return d == null ? '—' : _formatDate(d.toLocal());
  }

  String _orDash(String? v) => (v == null || v.trim().isEmpty) ? '—' : v;

  Future<void> _refreshAll() async {
    await Future.wait([
      _load(),
      _loadAttendance(),
      _loadPayments(),
      _loadTracking(),
    ]);
  }

  Widget _buildContent(GymMember member) {
    final deleted = member.deletedAt != null;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight - 8;
    return RefreshIndicator(
      onRefresh: _refreshAll,
      edgeOffset: top,
      child: ListView(
        controller: _scroll,
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          _buildHero(member, deleted, top),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _buildSummaryTiles(member),
          ),
          const SizedBox(height: 14),
          _buildTabBar(),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              key: ValueKey(_tab),
              children: _tabBody(member, deleted),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _gapped(List<Widget> cards) => [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          FadeUp(index: i, child: cards[i]),
        ],
      ];

  List<Widget> _tabBody(GymMember member, bool deleted) {
    final membership = member.currentMembership;
    switch (_tab) {
      case 0:
        return _gapped([
          if (membership != null) _buildProgressCard(member, membership),
          _buildPlanIncludesCard(member),
          _buildUsageCard(member),
          _buildGuestCard(member),
          _buildPaymentsCard(member),
          _buildCalendarCard(),
          _buildAttendanceCard(),
        ]);
      case 1:
        return _gapped([
          _buildMembershipCard(member, membership),
          if (member.membershipHistory.isNotEmpty)
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
          _buildHistoryCard(
            icon: Icons.ac_unit_rounded,
            title: 'Freeze history',
            children: member.freezeHistory.isEmpty
                ? [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'This membership has never been frozen.',
                        style: AppText.body(
                          size: 12,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ),
                  ]
                : member.freezeHistory
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
        ]);
      case 2:
        return _gapped([
          _buildWorkoutCard(),
          _buildDietCard(),
          _buildMeasurementsCard(),
        ]);
      case 3:
        return _gapped([
          _infoCard(
            icon: Icons.badge_outlined,
            color: _kIndigo,
            title: 'Personal info',
            onEdit: () => context
                .push(AppRoutes.memberEditPersonal, extra: member)
                .then((_) => _load()),
            fields: [
              ('Email', _orDash(member.email)),
              ('Phone', _orDash(member.phone)),
              ('Gender', _pretty(member.gender)),
              ('Date of birth', _dateOrDash(member.dateOfBirth)),
              ('Blood group', _orDash(member.bloodGroup)),
              (
                'Height / Weight',
                '${member.height == null ? '—' : '${member.height!.round()} cm'}'
                    ' / ${member.weight == null ? '—' : '${member.weight} kg'}'
              ),
              ('Occupation', _orDash(member.occupation)),
              ('Member ID', member.memberId),
            ],
          ),
          _infoCard(
            icon: Icons.contact_page_outlined,
            color: AppColors.staffB,
            title: 'Extended info',
            onEdit: () => context
                .push(AppRoutes.memberEditExtended, extra: member)
                .then((_) => _load()),
            fields: [
              ('Father name / Aadhaar', _orDash(member.fatherNameOrAadhaar)),
              ('Marital status', _pretty(member.maritalStatus)),
              ('Anniversary', _dateOrDash(member.anniversary)),
              ('Goal', _pretty(member.goal)),
              (
                'Registration fee',
                member.registrationFee == null
                    ? '—'
                    : '${AppCurrency.symbol}${member.registrationFee}'
              ),
              ('Body type', _pretty(member.bodyType)),
              ('Food preference', _pretty(member.foodPreference)),
              ('Heard about us', _pretty(member.awarenessSource)),
              (
                'Referred by',
                member.referredByName == null
                    ? '—'
                    : '${member.referredByName} (${member.referredByMemberCode})'
              ),
            ],
          ),
          _infoCard(
            icon: Icons.location_on_outlined,
            color: AppColors.warning,
            title: 'Address',
            onEdit: () => context
                .push(AppRoutes.memberEditAddress, extra: member)
                .then((_) => _load()),
            fields: [
              ('Address', _orDash(member.addressLine)),
              ('City', _orDash(member.city)),
              ('State', _orDash(member.state)),
              ('Country', _orDash(member.country)),
              ('Postal code', _orDash(member.postalCode)),
            ],
          ),
          _infoCard(
            icon: Icons.phone_in_talk_outlined,
            color: AppColors.danger,
            title: 'Emergency contact',
            onEdit: () => context
                .push(AppRoutes.memberEditAddress, extra: member)
                .then((_) => _load()),
            fields: [
              ('Name', _orDash(member.emergencyContactName)),
              ('Relation', _orDash(member.emergencyContactRelation)),
              ('Phone', _orDash(member.emergencyContactPhone)),
            ],
          ),
          _buildHealthCard(member),
          _infoCard(
            icon: Icons.sticky_note_2_outlined,
            color: AppColors.memberB,
            title: 'Notes',
            onEdit: () => context
                .push(AppRoutes.memberEditHealth, extra: member)
                .then((_) => _load()),
            fields: [('Notes', _orDash(member.notes))],
            single: true,
          ),
          _buildBranchTrainerCard(member),
        ]);
      default:
        return _gapped([
          _buildQrCard(member),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CardHeading(
                  icon: Icons.fingerprint_rounded,
                  title: 'Photo & biometric',
                ),
                const SizedBox(height: 10),
                _DetailRow(
                  label: 'Biometric ID',
                  value: _orDash(member.biometricId),
                ),
                const SizedBox(height: 8),
                AppButton(
                  label: 'Change profile photo',
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.small,
                  icon: Icons.camera_alt_rounded,
                  loading: _uploadingPhoto,
                  onPressed: _uploadingPhoto ? null : _showPhotoOptions,
                ),
              ],
            ),
          ),
          _buildPortalCard(member),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _CardHeading(
                  icon: Icons.attach_file_rounded,
                  title: 'Documents',
                ),
                const SizedBox(height: 8),
                Text(
                  'Uploading documents needs a general file picker, which this '
                  'app does not have yet — manage member documents from the '
                  'web portal.',
                  style: AppText.body(size: 12, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
          _buildPrivacyCard(member),
        ]);
    }
  }

  // ── hero ────────────────────────────────────────────────────────────────

  Widget _heroPill(String text, {IconData? icon, Color? dot}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot != null) ...[
            PulseDot(color: dot, size: 8),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[
            Icon(icon, size: 13, color: Colors.white),
            const SizedBox(width: 5),
          ],
          Text(
            text,
            style: AppText.body(
              size: 11,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _call(String phone) =>
      launchUrl(Uri(scheme: 'tel', path: phone));

  Future<void> _whatsapp(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final full = digits.length == 10 ? '91$digits' : digits;
    return launchUrl(
      Uri.parse('https://wa.me/$full'),
      mode: LaunchMode.externalApplication,
    );
  }

  Future<void> _sendPaymentLink(GymMember member, double due) async {
    final ok = await _confirm(
      title: 'Send payment link?',
      content: 'Create a payment link for ${_money(due)} and send it to '
          '${member.name}?',
      confirmLabel: 'Send',
    );
    if (!ok) return;
    await _runAction(
      () async {
        await getIt<FinanceRepository>().createPaymentLink(
          memberId: member.id,
          amount: due,
          notifyEmail: member.email != null && member.email!.isNotEmpty,
          notifySms: member.phone != null && member.phone!.isNotEmpty,
        );
        await _loadPayments();
      },
      reload: false,
      successMessage: 'Payment link sent.',
    );
  }

  int get _streak {
    final days = <DateTime>{
      for (final r in _monthRecords)
        DateTime(
          r.checkInTime.toLocal().year,
          r.checkInTime.toLocal().month,
          r.checkInTime.toLocal().day,
        ),
    };
    final now = DateTime.now();
    var d = DateTime(now.year, now.month, now.day);
    if (!days.contains(d)) d = DateTime(d.year, d.month, d.day - 1);
    var n = 0;
    while (days.contains(d)) {
      n++;
      d = DateTime(d.year, d.month, d.day - 1);
    }
    return n;
  }

  Widget _buildHero(GymMember member, bool deleted, double topInset) {
    final m = member.currentMembership;
    final dotColor = deleted
        ? const Color(0xFFFDA4AF)
        : member.status == 'ACTIVE'
            ? const Color(0xFF6EE7B7)
            : member.status == 'FROZEN'
                ? const Color(0xFF7DD3FC)
                : const Color(0xFFFCD34D);
    final phone = member.phone;
    final hasPhone = phone != null && phone.isNotEmpty;
    final gender = member.gender == null ? '' : ' · ${_pretty(member.gender)}';
    final streak = _streak;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          bottom: 52,
          child: const MeshHeroBackground(
            radius: BorderRadius.vertical(bottom: Radius.circular(34)),
            child: SizedBox.expand(),
          ),
        ),
        Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(16, 8 + topInset, 16, 20),
              child: SizedBox(
                width: double.infinity,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Column(
                      children: [
                        FadeUp(
                          index: 0,
                          child: GestureDetector(
                            onTap: _uploadingPhoto ? null : _showPhotoOptions,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                SpinningRing(
                                  size: 104,
                                  child: UserAvatar(
                                    avatarUrl: member.profilePhotoUrl,
                                    name: member.name,
                                    size: 96,
                                  ),
                                ),
                                if (_uploadingPhoto)
                                  Positioned.fill(
                                    child: Container(
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
                                  ),
                                Positioned(
                                  right: 2,
                                  bottom: 4,
                                  child: Container(
                                    width: 26,
                                    height: 26,
                                    decoration: const BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt_rounded,
                                      size: 14,
                                      color: Color(0xFF4338CA),
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
                                    child: PulseDot(color: dotColor, size: 10),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        FadeUp(
                          index: 1,
                          child: Text(
                            member.name,
                            textAlign: TextAlign.center,
                            style:
                                AppText.display(size: 28, color: Colors.white),
                          ),
                        ),
                        const SizedBox(height: 4),
                        FadeUp(
                          index: 2,
                          child: Text(
                            '${member.memberId}$gender · joined '
                            '${_formatDate(member.joiningDate)}',
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
                              _heroPill(
                                deleted ? 'Deleted' : _pretty(member.status),
                                dot: dotColor,
                              ),
                              if (m != null)
                                _heroPill(
                                  m.planName,
                                  icon: Icons.badge_outlined,
                                ),
                              if (m != null)
                                _heroPill(
                                  'Till ${_formatDate(m.endDate)}',
                                  icon: Icons.event_rounded,
                                ),
                              _heroPill(
                                member.branch.name,
                                icon: Icons.place_outlined,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                        FadeUp(
                          index: 4,
                          child: Row(
                            children: [
                              if (hasPhone)
                                Expanded(
                                  child: _heroAction(
                                    'Call',
                                    Icons.call_rounded,
                                    () => _call(phone),
                                  ),
                                ),
                              if (hasPhone) const SizedBox(width: 8),
                              if (hasPhone)
                                Expanded(
                                  child: _heroAction(
                                    'WhatsApp',
                                    Icons.chat_rounded,
                                    () => _whatsapp(phone),
                                  ),
                                ),
                              if (hasPhone && !deleted)
                                const SizedBox(width: 8),
                              if (!deleted)
                                Expanded(
                                  child: _heroAction(
                                    member.status == 'FROZEN'
                                        ? 'Resume'
                                        : 'Freeze',
                                    member.status == 'FROZEN'
                                        ? Icons.play_arrow_rounded
                                        : Icons.ac_unit_rounded,
                                    _busy
                                        ? null
                                        : member.status == 'FROZEN'
                                            ? _resume
                                            : () => context
                                                .push(
                                                  AppRoutes.memberFreeze,
                                                  extra: member.id,
                                                )
                                                .then((_) => _load()),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (streak >= 2)
                      Positioned(
                        right: 0,
                        top: 78,
                        child: Floating(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.25),
                                  blurRadius: 16,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Text(
                              '🔥 $streak-day streak',
                              style: AppText.body(
                                size: 11.5,
                                weight: FontWeight.w800,
                                color: const Color(0xFFBE123C),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: FadeUp(index: 5, child: _buildDueCard(member, deleted)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _heroAction(String label, IconData icon, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.32)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: Colors.white),
            const SizedBox(width: 6),
            Text(
              label,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDueCard(GymMember member, bool deleted) {
    final due = member.outstandingAmount;
    final paid = _totalPaid;
    final billed = paid + due;
    final pct = billed > 0 ? (paid / billed).clamp(0.0, 1.0) : 1.0;
    final owing = due > 0;
    final accent = owing ? const Color(0xFFE11D48) : const Color(0xFF10B981);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.line),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C3AED).withValues(alpha: 0.28),
            blurRadius: 30,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              AnimatedRing(
                value: pct,
                size: 84,
                stroke: 10,
                colors: owing
                    ? const [Color(0xFFE11D48), Color(0xFFC026D3)]
                    : const [Color(0xFF10B981), Color(0xFF14E0B4)],
                track: accent.withValues(alpha: 0.14),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CountUp(
                      value: (pct * 100).round(),
                      suffix: '%',
                      style: AppText.display(size: 19),
                    ),
                    Text(
                      'PAID',
                      style: AppText.body(
                        size: 9,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      owing ? 'AMOUNT DUE' : 'ALL PAID UP',
                      style: AppText.body(
                        size: 10.5,
                        weight: FontWeight.w800,
                        color: accent,
                      ).copyWith(letterSpacing: 1.2),
                    ),
                    ShaderMask(
                      shaderCallback: (r) => LinearGradient(
                        colors: owing
                            ? const [Color(0xFFBE123C), Color(0xFFC026D3)]
                            : const [Color(0xFF047857), Color(0xFF14E0B4)],
                      ).createShader(r),
                      child: CountUp(
                        value: due,
                        prefix: AppCurrency.symbol,
                        style: AppText.display(size: 34, color: Colors.white),
                      ),
                    ),
                    Text(
                      '${_money(paid)} paid of ${_money(billed)}',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (owing && !deleted) ...[
            const SizedBox(height: 12),
            ShimmerButton(
              colors: const [Color(0xFFE11D48), Color(0xFFC026D3)],
              onTap: _busy ? null : () => _sendPaymentLink(member, due),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.send_rounded, size: 15, color: Colors.white),
                  const SizedBox(width: 6),
                  Text(
                    'Send payment link',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ── summary tiles ───────────────────────────────────────────────────────

  bool _isThisMonth(DateTime d) {
    final now = DateTime.now();
    final l = d.toLocal();
    return l.year == now.year && l.month == now.month;
  }

  String _lastVisitLabel() {
    if (_recentVisits.isEmpty) return '—';
    final t = _recentVisits.first.checkInTime.toLocal();
    final now = DateTime.now();
    final days = DateTime(now.year, now.month, now.day)
        .difference(DateTime(t.year, t.month, t.day))
        .inDays;
    if (days <= 0) return 'Today';
    if (days == 1) return 'Yesterday';
    return '$days days ago';
  }

  void _openSheet(
    String title,
    IconData icon,
    Color color,
    List<Widget> children,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (ctx) => ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(ctx).size.height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 4, 18, 12),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 16, color: color),
                  ),
                  const SizedBox(width: 10),
                  Text(title, style: AppText.display(size: 17)),
                ],
              ),
            ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 24),
                children: children,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openVisitsSheet() => _openSheet(
        'Recent visits',
        Icons.calendar_month_rounded,
        _kIndigo,
        _recentVisits.isEmpty
            ? [
                Text(
                  'No visits recorded yet.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
              ]
            : [
                for (var i = 0; i < _recentVisits.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: AppColors.line),
                  _VisitRow(record: _recentVisits[i]),
                ],
              ],
      );

  void _openPaymentsSheet() => _openSheet(
        'Payments',
        Icons.account_balance_wallet_rounded,
        AppColors.success,
        _payments.isEmpty
            ? [
                Text(
                  'No payments recorded yet.',
                  style: AppText.body(size: 13, color: AppColors.inkFaint),
                ),
              ]
            : [
                for (var i = 0; i < _payments.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: AppColors.line),
                  _paymentRow(_payments[i]),
                ],
              ],
      );

  Widget _summaryTile({
    required int index,
    required IconData icon,
    required Color color,
    required Color color2,
    String? text,
    num? number,
    String prefix = '',
    String suffix = '',
    required String label,
    VoidCallback? onTap,
  }) {
    final valueStyle = AppText.display(size: 22, color: color);
    return FadeUp(
      index: 6 + index,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(12, 12, 8, 8),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                color.withValues(alpha: 0.22),
                color.withValues(alpha: 0.04),
              ],
            ),
            border: Border.all(color: color.withValues(alpha: 0.32)),
          ),
          child: Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned(
                right: -26,
                top: -26,
                child: Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      gradient: LinearGradient(colors: [color, color2]),
                    ),
                    child: Icon(icon, size: 16, color: Colors.white),
                  ),
                  const SizedBox(height: 8),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: number != null
                        ? CountUp(
                            value: number,
                            prefix: prefix,
                            suffix: suffix,
                            style: valueStyle,
                          )
                        : Text(text ?? '', style: valueStyle),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      size: 10,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryTiles(GymMember member) {
    final now = DateTime.now();
    final monthVisits =
        _monthRecords.where((r) => _isThisMonth(r.checkInTime)).length;
    final m = member.currentMembership;
    final daysLeft = m == null
        ? null
        : m.endDate.difference(now).inDays.clamp(0, 100000) +
            (m.endDate.isAfter(now) ? 1 : 0);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final owing = member.outstandingAmount > 0;
    final low = daysLeft != null && daysLeft <= 7;
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 9,
      crossAxisSpacing: 9,
      childAspectRatio: 1.0,
      children: [
        _summaryTile(
          index: 0,
          icon: Icons.calendar_today_rounded,
          color: _kIndigo,
          color2: AppColors.staffB,
          number: monthVisits,
          label: 'Visits · ${months[now.month - 1]}',
          onTap: _openVisitsSheet,
        ),
        _summaryTile(
          index: 1,
          icon: Icons.local_fire_department_rounded,
          color: AppColors.staffB,
          color2: const Color(0xFFC026D3),
          number: _attendanceTotal,
          label: 'Total visits',
          onTap: _openVisitsSheet,
        ),
        _summaryTile(
          index: 2,
          icon: Icons.schedule_rounded,
          color: AppColors.memberB,
          color2: const Color(0xFF22D3EE),
          text: _lastVisitLabel(),
          label: 'Last visit',
          onTap: _openVisitsSheet,
        ),
        _summaryTile(
          index: 3,
          icon: Icons.account_balance_wallet_rounded,
          color: AppColors.success,
          color2: AppColors.memberB,
          number: _totalPaid.round(),
          prefix: AppCurrency.symbol,
          label: 'Total paid',
          onTap: _openPaymentsSheet,
        ),
        _summaryTile(
          index: 4,
          icon: Icons.currency_rupee_rounded,
          color: owing ? AppColors.danger : AppColors.success,
          color2: owing ? const Color(0xFFF97316) : AppColors.memberB,
          number: member.outstandingAmount.round(),
          prefix: AppCurrency.symbol,
          label: 'Due now',
          onTap: _openPaymentsSheet,
        ),
        _summaryTile(
          index: 5,
          icon: Icons.hourglass_bottom_rounded,
          color: low ? AppColors.warning : _kIndigo,
          color2: low ? const Color(0xFFF97316) : AppColors.staffB,
          number: daysLeft,
          suffix: ' days',
          text: daysLeft == null ? 'No plan' : null,
          label: 'Left on plan',
        ),
      ],
    );
  }

  Widget _buildTabBar() {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _tabNames.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, i) {
          final selected = i == _tab;
          return GestureDetector(
            onTap: () => setState(() => _tab = i),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(99),
                gradient: selected
                    ? const LinearGradient(
                        colors: [
                          Color(0xFF6366F1),
                          Color(0xFF8B5CF6),
                          Color(0xFFC026D3),
                        ],
                      )
                    : null,
                color: selected ? null : AppColors.surface,
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.4),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ]
                    : null,
                border: selected ? null : Border.all(color: AppColors.line),
              ),
              child: Text(
                _tabNames[i],
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w700,
                  color: selected ? Colors.white : AppColors.inkSoft,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Overview cards ──────────────────────────────────────────────────────

  Widget _panel({
    required IconData icon,
    required Color color,
    required String title,
    String? badge,
    Color? badgeColor,
    Widget? action,
    required Widget child,
  }) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      color,
                      Color.lerp(color, const Color(0xFFC026D3), 0.45)!,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 15, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Expanded(child: Text(title, style: AppText.display(size: 14.5))),
              if (action != null) ...[action, const SizedBox(width: 8)],
              if (badge != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: (badgeColor ?? color).withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    badge,
                    style: AppText.body(
                      size: 10.5,
                      weight: FontWeight.w700,
                      color: badgeColor ?? color,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _kv(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w600,
                color: AppColors.inkFaint,
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: AppText.body(size: 12.5, weight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );

  Widget _gradBar(double ratio, Color color) => GrowBar(
        ratio: ratio,
        height: 8,
        track: AppColors.surface3,
        colors: [color, Color.lerp(color, const Color(0xFFC026D3), 0.5)!],
      );

  MembershipHistoryEntry? _historyFor(
    GymMember member,
    CurrentMembershipSummary m,
  ) {
    for (final h in member.membershipHistory) {
      if (h.planName == m.planName && h.startDate == m.startDate) return h;
    }
    return null;
  }

  Widget _buildProgressCard(GymMember member, CurrentMembershipSummary m) {
    final now = DateTime.now();
    final total = m.endDate.difference(m.startDate).inDays.clamp(1, 100000);
    final left = m.endDate.difference(now).inDays.clamp(0, 100000);
    final pending = m.status == 'PENDING' || now.isBefore(m.startDate);
    final ratio = pending ? 1.0 : (left / total).clamp(0.0, 1.0);
    final h = _historyFor(member, m);
    return _panel(
      icon: Icons.badge_outlined,
      color: AppColors.memberB,
      title: 'Membership progress',
      badge: m.status,
      child: Column(
        children: [
          Row(
            children: [
              AnimatedRing(
                value: ratio,
                size: 116,
                stroke: 12,
                colors: const [Color(0xFF14E0B4), Color(0xFF22D3EE)],
                track: AppColors.memberB.withValues(alpha: 0.16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CountUp(
                      value: pending ? total : left,
                      style: AppText.display(size: 28),
                    ),
                    Text(
                      pending ? 'days (not started)' : 'days left',
                      textAlign: TextAlign.center,
                      style: AppText.body(
                        size: 9.5,
                        weight: FontWeight.w600,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  children: [
                    _kv('Plan', m.planName),
                    _kv('Starts', _formatDate(m.startDate)),
                    _kv('Ends', _formatDate(m.endDate)),
                    if (h != null)
                      _kv(
                        'Price',
                        '${AppCurrency.symbol}${h.priceAtAssignment.round()}',
                      ),
                    _kv('Auto-renew', m.autoRenew ? 'On' : 'Off'),
                  ],
                ),
              ),
            ],
          ),
          if (!pending && left <= 7) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                left == 0
                    ? 'Expires today — renew now to avoid a gap.'
                    : 'Expires in $left days — renew now to avoid a gap.',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w700,
                  color: AppColors.warning,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPlanIncludesCard(GymMember member) {
    final plan = _plan;
    final m = member.currentMembership;
    if (plan == null || m == null) return const SizedBox.shrink();
    final rows = <(String, String, bool)>[
      (
        'Gym access',
        plan.gymAccessAllBranches ? 'All branches' : 'Home branch only',
        true,
      ),
      (
        'PT sessions',
        plan.ptSessionsIncluded > 0
            ? '${plan.ptSessionsIncluded} included'
            : 'Not included',
        plan.ptSessionsIncluded > 0,
      ),
      (
        'Group classes',
        plan.groupClassesIncluded > 0
            ? '${plan.groupClassesIncluded} included'
            : 'Not included',
        plan.groupClassesIncluded > 0,
      ),
      (
        'Diet consultation',
        plan.dietConsultationIncluded ? 'Included' : 'Not included',
        plan.dietConsultationIncluded,
      ),
      (
        'Locker access',
        plan.lockerAccess ? 'Included' : 'Not included',
        plan.lockerAccess,
      ),
      (
        'Guest passes',
        plan.guestPasses > 0 ? '${plan.guestPasses} included' : 'Not included',
        plan.guestPasses > 0,
      ),
      (
        'Freeze',
        !plan.freezeAllowed
            ? 'Not allowed'
            : plan.freezeDaysLimit == null
                ? 'Allowed, no day limit'
                : 'Up to ${plan.freezeDaysLimit} days',
        plan.freezeAllowed,
      ),
    ];
    final included = rows.where((r) => r.$3).length;
    return _panel(
      icon: Icons.checklist_rounded,
      color: AppColors.success,
      title: "What's in ${plan.name}",
      badge: '$included of ${rows.length} included',
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) Divider(height: 1, color: AppColors.line),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: (rows[i].$3 ? AppColors.success : AppColors.danger)
                          .withValues(alpha: 0.16),
                    ),
                    child: Icon(
                      rows[i].$3 ? Icons.check_rounded : Icons.close_rounded,
                      size: 14,
                      color: rows[i].$3 ? AppColors.success : AppColors.danger,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      rows[i].$1,
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    rows[i].$2,
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: rows[i].$3 ? AppColors.ink : AppColors.inkFaint,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildUsageCard(GymMember member) {
    final u = member.planUsage;
    final m = member.currentMembership;
    final active = m?.status == 'ACTIVE';
    // (label, icon, used, limit, color, unit) — limit null/0 = not included.
    final items = <(String, IconData, int, int?, Color, String)>[
      (
        'PT sessions',
        Icons.fitness_center_rounded,
        u?.ptSessionsUsed ?? 0,
        u == null || u.ptSessionsIncluded <= 0 ? null : u.ptSessionsIncluded,
        AppColors.staffB,
        'sessions',
      ),
      (
        'Group classes',
        Icons.groups_rounded,
        u?.groupClassesUsed ?? 0,
        u == null || u.groupClassesIncluded <= 0
            ? null
            : u.groupClassesIncluded,
        AppColors.memberB,
        'classes',
      ),
      (
        'Guest passes',
        Icons.card_giftcard_rounded,
        u?.guestPassesUsed ?? 0,
        u == null || u.guestPassesIncluded <= 0 ? null : u.guestPassesIncluded,
        AppColors.warning,
        'passes',
      ),
      (
        'Freeze days',
        Icons.ac_unit_rounded,
        u?.freezeDaysUsed ?? 0,
        u?.freezeDaysLimit,
        const Color(0xFF22D3EE),
        'days',
      ),
    ];
    final tracked = items.where((i) => i.$4 != null).length;
    return _panel(
      icon: Icons.checklist_rounded,
      color: AppColors.staffB,
      title: 'Plan usage',
      badge: m == null ? null : '$tracked of ${items.length} tracked',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (m == null)
            Text(
              'No active plan.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) Divider(height: 1, color: AppColors.line),
              _usageRow(items[i]),
            ],
          if (active && (u?.ptSessionsIncluded ?? 0) > 0) ...[
            const SizedBox(height: 12),
            AppButton(
              label: 'Log PT session',
              size: AppButtonSize.small,
              variant: AppButtonVariant.ghost,
              icon: Icons.add_rounded,
              onPressed: _logPtSession,
            ),
          ],
        ],
      ),
    );
  }

  Widget _usageRow((String, IconData, int, int?, Color, String) item) {
    final (label, icon, used, limit, color, unit) = item;
    final included = limit != null && limit > 0;
    final exhausted = included && used >= limit;
    final statusColor = !included
        ? AppColors.inkFaint
        : exhausted
            ? AppColors.warning
            : AppColors.success;
    final statusIcon = !included
        ? Icons.remove_rounded
        : exhausted
            ? Icons.priority_high_rounded
            : Icons.check_rounded;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: statusColor.withValues(alpha: 0.16),
            ),
            child: Icon(statusIcon, size: 15, color: statusColor),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 14, color: included ? color : statusColor),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        label,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w700,
                          color: included ? AppColors.ink : AppColors.inkFaint,
                        ),
                      ),
                    ),
                    Text(
                      included
                          ? '$used of $limit used'
                          : 'Not included in plan',
                      style: AppText.body(
                        size: 11.5,
                        weight: FontWeight.w600,
                        color:
                            included ? AppColors.inkSoft : AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
                if (included) ...[
                  const SizedBox(height: 6),
                  _gradBar(used / limit, color),
                  const SizedBox(height: 4),
                  Text(
                    exhausted ? 'All $unit used' : '${limit - used} $unit left',
                    style: AppText.body(
                      size: 10.5,
                      color: exhausted ? AppColors.warning : AppColors.inkFaint,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuestCard(GymMember member) {
    final u = member.planUsage;
    final included = u?.guestPassesIncluded ?? 0;
    final used = u?.guestPassesUsed ?? 0;
    final active = member.currentMembership?.status == 'ACTIVE';
    final remaining = included - used;
    const warm = [Color(0xFFFFB648), Color(0xFFFF5C7A)];
    return _panel(
      icon: Icons.card_giftcard_rounded,
      color: AppColors.warning,
      title: 'Guest visits',
      badge: included > 0 ? '$used of $included used' : null,
      action: active
          ? _headerAction(
              _guestFormOpen ? 'Close' : 'Add',
              _guestFormOpen ? Icons.close_rounded : Icons.add_rounded,
              () => setState(() => _guestFormOpen = !_guestFormOpen),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (included > 0)
            Row(
              children: [
                AnimatedRing(
                  value: included > 0 ? used / included : 0,
                  size: 76,
                  stroke: 9,
                  colors: warm,
                  track: AppColors.warning.withValues(alpha: 0.18),
                  child: Text(
                    '$used/$included',
                    style: AppText.display(size: 15),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$used of $included guest '
                        '${included == 1 ? 'pass' : 'passes'} used',
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        remaining > 0
                            ? '$remaining left on the current membership.'
                            : 'No passes left on the current membership.',
                        style: AppText.body(
                          size: 11.5,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            )
          else
            Text(
              member.currentMembership == null
                  ? 'No active plan.'
                  : "This plan doesn't include guest passes.",
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            ),
          if (active && _guestFormOpen && included <= 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                "This plan has no guest passes, so a guest visit can't be "
                'logged. Add guest passes to the plan first.',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: AppColors.warning,
                ),
              ),
            ),
          ],
          if (active && _guestFormOpen && included > 0) ...[
            const SizedBox(height: 14),
            AppLabeledField(
              label: 'Guest name (optional)',
              hintText: "Who's visiting?",
              controller: _guestNameController,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 10),
            AppButton(
              label: remaining > 0 ? 'Log guest visit' : 'No passes left',
              size: AppButtonSize.small,
              icon: Icons.add_rounded,
              loading: _loggingGuest,
              onPressed:
                  remaining > 0 && !_loggingGuest ? _logGuestInline : null,
            ),
          ],
          const SizedBox(height: 14),
          if (_guestVisits.isEmpty)
            Text(
              'No guest visits yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else
            for (final g in _guestVisits.take(5))
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: AppColors.warning.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(colors: warm),
                      ),
                      child: Text(
                        (g.guestName ?? 'G').isEmpty
                            ? 'G'
                            : (g.guestName ?? 'G')[0].toUpperCase(),
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        (g.guestName ?? '').isEmpty ? 'Guest' : g.guestName!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(size: 13, weight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      _formatDate(g.visitedAt.toLocal()),
                      style: AppText.body(size: 11, color: AppColors.inkFaint),
                    ),
                  ],
                ),
              ),
          if (_guestVisits.length > 5)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => _openSheet(
                  'Guest visits',
                  Icons.card_giftcard_rounded,
                  AppColors.warning,
                  [
                    for (final g in _guestVisits)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          (g.guestName ?? '').isEmpty ? 'Guest' : g.guestName!,
                        ),
                        trailing: Text(_formatDate(g.visitedAt.toLocal())),
                      ),
                  ],
                ),
                child: Text('View all ${_guestVisits.length}'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _paymentRow(MemberPayment p) {
    final ok = p.status == 'SUCCESS';
    final color = ok ? AppColors.success : AppColors.warning;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: Icon(
              ok ? Icons.check_rounded : Icons.schedule_rounded,
              size: 14,
              color: color,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _money(p.finalAmount),
                      style: AppText.body(size: 13.5, weight: FontWeight.w800),
                    ),
                    const SizedBox(width: 8),
                    AppPill(
                      label: _pretty(p.status),
                      tone: ok ? AppPillTone.success : AppPillTone.warning,
                    ),
                  ],
                ),
                Text(
                  '${_formatDate(p.paymentDate.toLocal())} · '
                  '${_pretty(p.method).toLowerCase()} · ${p.paymentNumber}',
                  style: AppText.body(size: 10.5, color: AppColors.inkFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentsCard(GymMember member) {
    final due = member.outstandingAmount;
    final shown = _payments.take(3).toList();
    return _panel(
      icon: Icons.credit_card_rounded,
      color: AppColors.success,
      title: 'Payments',
      badge: due > 0 ? '${_money(due)} pending' : 'Paid up',
      badgeColor: due > 0 ? AppColors.danger : AppColors.success,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (due > 0)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.3),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    size: 18,
                    color: AppColors.danger,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Balance pending',
                      style: AppText.body(size: 13, weight: FontWeight.w700),
                    ),
                  ),
                  Text(
                    _money(due),
                    style: AppText.display(size: 15, color: AppColors.danger),
                  ),
                ],
              ),
            ),
          if (shown.isEmpty)
            Text(
              'No payments recorded yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else
            for (var i = 0; i < shown.length; i++) ...[
              if (i > 0) Divider(height: 1, color: AppColors.line),
              _paymentRow(shown[i]),
            ],
          if (_payments.length > shown.length)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: _openPaymentsSheet,
                child: Text('View all ${_payments.length} payments'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCalendarCard() {
    final first = DateTime(_calMonth.year, _calMonth.month);
    final daysIn = DateTime(_calMonth.year, _calMonth.month + 1, 0).day;
    final lead = first.weekday - 1;
    final visited = <int>{
      for (final r in _monthRecords)
        if (r.checkInTime.toLocal().year == _calMonth.year &&
            r.checkInTime.toLocal().month == _calMonth.month)
          r.checkInTime.toLocal().day,
    };
    final now = DateTime.now();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    Widget arrow(IconData i, int delta) => GestureDetector(
          onTap: () => setState(
            () => _calMonth = DateTime(_calMonth.year, _calMonth.month + delta),
          ),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.surface2,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.line),
            ),
            child: Icon(i, size: 16),
          ),
        );
    return _panel(
      icon: Icons.calendar_month_rounded,
      color: _kIndigo,
      title: 'Visit calendar',
      badge: '${visited.length} days',
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              arrow(Icons.chevron_left_rounded, -1),
              Text(
                '${months[_calMonth.month - 1]} ${_calMonth.year}',
                style: AppText.body(size: 13, weight: FontWeight.w700),
              ),
              arrow(Icons.chevron_right_rounded, 1),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              for (final d in const ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
                Expanded(
                  child: Center(
                    child: Text(
                      d,
                      style: AppText.body(
                        size: 10,
                        weight: FontWeight.w700,
                        color: AppColors.inkFaint,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          GridView.count(
            crossAxisCount: 7,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 5,
            crossAxisSpacing: 5,
            childAspectRatio: 1.25,
            children: [
              for (var i = 0; i < lead; i++) const SizedBox.shrink(),
              for (var d = 1; d <= daysIn; d++)
                PopIn(
                  index: d,
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: visited.contains(d)
                          ? const LinearGradient(
                              colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                            )
                          : null,
                      color: visited.contains(d) ? null : AppColors.surface2,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: visited.contains(d)
                          ? [
                              BoxShadow(
                                color: _kIndigo.withValues(alpha: 0.35),
                                blurRadius: 8,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                      border: (_calMonth.year == now.year &&
                              _calMonth.month == now.month &&
                              d == now.day)
                          ? Border.all(color: _kIndigo, width: 2)
                          : null,
                    ),
                    child: Text(
                      '$d',
                      style: AppText.body(
                        size: 11,
                        weight: FontWeight.w700,
                        color:
                            visited.contains(d) ? Colors.white : AppColors.ink,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Membership tab ──────────────────────────────────────────────────────

  Widget _buildMembershipCard(
    GymMember member,
    CurrentMembershipSummary? membership,
  ) {
    return _panel(
      icon: Icons.badge_outlined,
      color: AppColors.memberB,
      title: 'Current membership',
      badge: membership?.status,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (membership == null)
            Text(
              'No active plan. Choose one to start a membership.',
              style: AppText.body(size: 12.5, color: AppColors.inkFaint),
            )
          else ...[
            _planBanner(membership),
            const SizedBox(height: 8),
            _kv('Plan', membership.planName),
            _kv(
              'Valid',
              '${_formatDate(membership.startDate)} → ${_formatDate(membership.endDate)}',
            ),
            _kv('Auto-renew', membership.autoRenew ? 'On' : 'Off'),
          ],
          const SizedBox(height: 12),
          AppButton(
            label: membership == null ? 'Choose a plan' : 'Renew',
            size: AppButtonSize.small,
            onPressed: () => context
                .push(AppRoutes.memberRenew, extra: member)
                .then((_) => _load()),
          ),
          if (membership != null) ...[
            const SizedBox(height: 10),
            _buildMembershipActions(member, membership),
          ],
        ],
      ),
    );
  }

  Widget _planBanner(CurrentMembershipSummary m) {
    final now = DateTime.now();
    final total = m.endDate.difference(m.startDate).inDays.clamp(1, 100000);
    final elapsed = now.difference(m.startDate).inDays.clamp(0, total);
    final left = m.endDate.difference(now).inDays.clamp(0, 100000);
    final ratio = elapsed / total;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4338CA), Color(0xFF7C3AED), Color(0xFFC026D3)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            m.planName.toUpperCase(),
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w700,
              color: Colors.white.withValues(alpha: 0.8),
            ).copyWith(letterSpacing: 1),
          ),
          const SizedBox(height: 3),
          Text(
            '${_formatDate(m.startDate)} → ${_formatDate(m.endDate)}',
            style: AppText.display(size: 19, color: Colors.white),
          ),
          const SizedBox(height: 10),
          GrowBar(
            ratio: ratio,
            height: 7,
            track: Colors.white.withValues(alpha: 0.25),
            colors: const [Colors.white, Colors.white],
          ),
          const SizedBox(height: 6),
          Text(
            '${(ratio * 100).round()}% elapsed · $left days left · '
            'auto-renew ${m.autoRenew ? 'on' : 'off'}',
            style: AppText.body(
              size: 11,
              weight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }

  // ── Profile tab ─────────────────────────────────────────────────────────

  static const _fieldIcons = <String, IconData>{
    'Email': Icons.alternate_email_rounded,
    'Phone': Icons.call_rounded,
    'Gender': Icons.wc_rounded,
    'Date of birth': Icons.cake_rounded,
    'Blood group': Icons.bloodtype_rounded,
    'Height / Weight': Icons.monitor_weight_rounded,
    'Occupation': Icons.work_rounded,
    'Member ID': Icons.badge_rounded,
    'Father name / Aadhaar': Icons.family_restroom_rounded,
    'Marital status': Icons.favorite_rounded,
    'Anniversary': Icons.celebration_rounded,
    'Goal': Icons.flag_rounded,
    'Registration fee': Icons.payments_rounded,
    'Body type': Icons.accessibility_new_rounded,
    'Food preference': Icons.restaurant_rounded,
    'Heard about us': Icons.campaign_rounded,
    'Referred by': Icons.group_add_rounded,
    'Address': Icons.home_rounded,
    'City': Icons.location_city_rounded,
    'State': Icons.map_rounded,
    'Country': Icons.public_rounded,
    'Postal code': Icons.markunread_mailbox_rounded,
    'Name': Icons.person_rounded,
    'Relation': Icons.diversity_1_rounded,
    'Notes': Icons.sticky_note_2_rounded,
    'Medical conditions': Icons.medical_services_rounded,
    'Allergies': Icons.warning_amber_rounded,
    'Fitness goals': Icons.emoji_events_rounded,
    'Other details': Icons.notes_rounded,
  };

  /// Shared chrome for the Profile tab: a tinted gradient header band (icon
  /// chip + title + optional Edit pill) above the card body.
  Widget _profileCard({
    required IconData icon,
    required Color color,
    required String title,
    String? subtitle,
    VoidCallback? onEdit,
    required Widget child,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: [
                  color.withValues(alpha: 0.22),
                  color.withValues(alpha: 0.03),
                ],
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        color,
                        Color.lerp(color, const Color(0xFFC026D3), 0.5)!,
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: 0.4),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Icon(icon, size: 18, color: Colors.white),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppText.display(size: 15)),
                      if (subtitle != null)
                        Text(
                          subtitle,
                          style: AppText.body(
                            size: 10.5,
                            weight: FontWeight.w600,
                            color: AppColors.inkFaint,
                          ),
                        ),
                    ],
                  ),
                ),
                if (onEdit != null)
                  GestureDetector(
                    onTap: onEdit,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(color: color.withValues(alpha: 0.4)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.edit_rounded, size: 12, color: color),
                          const SizedBox(width: 4),
                          Text(
                            'Edit',
                            style: AppText.body(
                              size: 11.5,
                              weight: FontWeight.w800,
                              color: color,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
            child: child,
          ),
        ],
      ),
    );
  }

  Widget _fieldTile(
    String label,
    String value,
    Color color, {
    bool full = false,
  }) {
    final empty = value == '—' || value.isEmpty;
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: color.withValues(alpha: empty ? 0.04 : 0.09),
        border: Border.all(color: color.withValues(alpha: empty ? 0.1 : 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(9),
              color: color.withValues(alpha: empty ? 0.1 : 0.2),
            ),
            child: Icon(
              _fieldIcons[label] ?? Icons.label_rounded,
              size: 15,
              color: empty ? color.withValues(alpha: 0.5) : color,
            ),
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 9,
                    weight: FontWeight.w700,
                    color: AppColors.inkFaint,
                  ).copyWith(letterSpacing: 0.5),
                ),
                const SizedBox(height: 2),
                Text(
                  empty ? 'Not set' : value,
                  maxLines: full ? 6 : 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 12.5,
                    weight: empty ? FontWeight.w600 : FontWeight.w800,
                    color: empty ? AppColors.inkFaint : AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard({
    required IconData icon,
    required Color color,
    required String title,
    required List<(String, String)> fields,
    VoidCallback? onEdit,
    bool single = false,
  }) {
    final filled = fields.where((f) => f.$2 != '—' && f.$2.isNotEmpty).length;
    return _profileCard(
      icon: icon,
      color: color,
      title: title,
      subtitle: '$filled of ${fields.length} filled',
      onEdit: onEdit,
      child: LayoutBuilder(
        builder: (context, c) {
          final w = single ? c.maxWidth : (c.maxWidth - 8) / 2;
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final f in fields)
                SizedBox(
                  width: (single || f.$1 == 'Address' || f.$1 == 'Referred by')
                      ? c.maxWidth
                      : w,
                  child: _fieldTile(f.$1, f.$2, color, full: single),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHealthCard(GymMember member) {
    const color = Color(0xFFFF5C7A);
    return _profileCard(
      icon: Icons.favorite_rounded,
      color: color,
      title: 'Health & screening',
      subtitle: 'Medical details and checklist',
      onEdit: () => context
          .push(AppRoutes.memberEditHealth, extra: member)
          .then((_) => _load()),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldTile(
            'Medical conditions',
            _orDash(member.medicalConditions),
            color,
            full: true,
          ),
          const SizedBox(height: 8),
          _fieldTile(
            'Allergies',
            _orDash(member.allergies),
            AppColors.warning,
            full: true,
          ),
          const SizedBox(height: 8),
          _fieldTile(
            'Fitness goals',
            _orDash(member.fitnessGoals),
            AppColors.success,
            full: true,
          ),
          if (member.healthFlags.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'SCREENING CHECKLIST',
              style: AppText.body(
                size: 10,
                weight: FontWeight.w700,
                color: AppColors.inkFaint,
              ).copyWith(letterSpacing: 0.8),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final e in member.healthFlags.entries)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: (e.value ? AppColors.warning : AppColors.success)
                          .withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          e.value
                              ? Icons.warning_amber_rounded
                              : Icons.check_circle_rounded,
                          size: 13,
                          color:
                              e.value ? AppColors.warning : AppColors.success,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          e.key,
                          style: AppText.body(
                            size: 11,
                            weight: FontWeight.w700,
                            color:
                                e.value ? AppColors.warning : AppColors.inkSoft,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            if ((member.healthScreeningOtherDetails ?? '').isNotEmpty) ...[
              const SizedBox(height: 10),
              _fieldTile(
                'Other details',
                member.healthScreeningOtherDetails!,
                color,
                full: true,
              ),
            ],
          ],
        ],
      ),
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
            if (i > 0) Divider(height: 1, color: AppColors.line),
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
              if (i > 0) Divider(height: 1, color: AppColors.line),
              _VisitRow(record: _recentVisits[i]),
            ],
        ],
      ),
    );
  }

  Future<void> _togglePicker({required bool workout}) async {
    final open = workout ? _pickingWorkout : _pickingDiet;
    setState(() {
      if (workout) {
        _pickingWorkout = !open;
        _pickedWorkout = null;
      } else {
        _pickingDiet = !open;
        _pickedDiet = null;
      }
    });
    if (open) return;
    try {
      if (workout) {
        final plans = await getIt<WorkoutPlanRepository>().listAssignable();
        if (!mounted) return;
        setState(
          () => _workoutOptions = [
            for (final p in plans) (p.id, '${p.name} · ${_pretty(p.level)}'),
          ],
        );
      } else {
        final plans = await getIt<DietPlanRepository>().listAssignable();
        if (!mounted) return;
        setState(
          () => _dietOptions = [
            for (final p in plans)
              (
                p.id,
                p.dailyCalories != null
                    ? '${p.name} · ${p.durationDays}d · ${p.dailyCalories} kcal'
                    : '${p.name} · ${p.durationDays}d',
              ),
          ],
        );
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _pickingWorkout = false;
        _pickingDiet = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message)),
      );
    }
  }

  Future<void> _assignPicked({required bool workout}) async {
    final planId = workout ? _pickedWorkout : _pickedDiet;
    final member = _member;
    if (planId == null || member == null) return;
    setState(() => _assigningPlan = true);
    try {
      if (workout) {
        await getIt<WorkoutPlanRepository>().assign(
          planId: planId,
          memberId: member.id,
          startDate: DateTime.now(),
        );
        await _loadWorkout();
      } else {
        await getIt<DietPlanRepository>().assign(
          planId: planId,
          memberId: member.id,
          startDate: DateTime.now(),
        );
        await _loadDiet();
      }
      if (!mounted) return;
      setState(() {
        _pickingWorkout = false;
        _pickingDiet = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            workout ? 'Workout plan assigned' : 'Diet plan assigned',
          ),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.detailedMessage)),
      );
    } finally {
      if (mounted) setState(() => _assigningPlan = false);
    }
  }

  Widget _inlinePicker({required bool workout}) {
    final options = workout ? _workoutOptions : _dietOptions;
    final picked = workout ? _pickedWorkout : _pickedDiet;
    if (options == null) {
      return const Padding(
        padding: EdgeInsets.only(bottom: 12),
        child: Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface2,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: options.isEmpty
          ? Text(
              workout
                  ? 'No active workout plans. Create one from Menu → Workout Plans.'
                  : 'No active diet plans. Create one from Menu → Diet Plans.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                OptionPickerField(
                  label: workout ? 'Workout plan' : 'Diet plan',
                  hintText: 'Select an active plan',
                  options: options,
                  value: picked,
                  onChanged: (v) => setState(() {
                    if (workout) {
                      _pickedWorkout = v;
                    } else {
                      _pickedDiet = v;
                    }
                  }),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: AppButton(
                        label: 'Assign',
                        size: AppButtonSize.small,
                        loading: _assigningPlan,
                        onPressed: picked == null || _assigningPlan
                            ? null
                            : () => _assignPicked(workout: workout),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: AppButton(
                        label: 'Cancel',
                        size: AppButtonSize.small,
                        variant: AppButtonVariant.ghost,
                        onPressed: () => _togglePicker(workout: workout),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }

  Widget _headerAction(String label, IconData icon, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(99),
          gradient: const LinearGradient(
            colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Colors.white),
            const SizedBox(width: 4),
            Text(
              label,
              style: AppText.body(
                size: 11.5,
                weight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _cardHeaderRow(Widget heading, Widget? action) => Row(
        children: [
          Expanded(child: heading),
          if (action != null) action,
        ],
      );

  Widget _exerciseChecklist(MemberWorkoutProgress workout) {
    final total = workout.totalExercises;
    final done = workout.completedCount;
    final days = [
      for (final d in WeekDay.values)
        if (workout.progress.any((e) => e.dayOfWeek == d)) d,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'CHECKLIST',
                style: AppText.body(
                  size: 10,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ).copyWith(letterSpacing: 0.8),
              ),
            ),
            Text(
              '$done of $total done',
              style: AppText.body(size: 11.5, weight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 6),
        _gradBar(
          total > 0 ? done / total : 0,
          const Color(0xFF8B5CF6),
        ),
        for (final day in days) ...[
          const SizedBox(height: 14),
          Text(
            day.label,
            style: AppText.body(
              size: 12,
              weight: FontWeight.w800,
              color: AppColors.staffPillFg,
            ),
          ),
          for (final entry in workout.progress.where(
            (e) => e.dayOfWeek == day,
          )) ...[
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
            Divider(height: 1, color: AppColors.line),
          ],
        ],
      ],
    );
  }

  Widget _buildWorkoutCard() {
    final workout = _workout;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _cardHeaderRow(
            _CardHeading(icon: Icons.fitness_center_rounded, title: 'Workout'),
            _headerAction(
              _pickingWorkout
                  ? 'Close'
                  : _workout == null
                      ? 'Assign'
                      : 'Change',
              _pickingWorkout
                  ? Icons.close_rounded
                  : _workout == null
                      ? Icons.add_rounded
                      : Icons.swap_horiz_rounded,
              () => _togglePicker(workout: true),
            ),
          ),
          const SizedBox(height: 12),
          if (_pickingWorkout) _inlinePicker(workout: true),
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
            if (workout.progress.isNotEmpty) ...[
              const SizedBox(height: 14),
              _exerciseChecklist(workout),
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
          _cardHeaderRow(
            _CardHeading(icon: Icons.restaurant_rounded, title: 'Diet'),
            _headerAction(
              _pickingDiet
                  ? 'Close'
                  : _diet == null
                      ? 'Assign'
                      : 'Change',
              _pickingDiet
                  ? Icons.close_rounded
                  : _diet == null
                      ? Icons.add_rounded
                      : Icons.swap_horiz_rounded,
              () => _togglePicker(workout: false),
            ),
          ),
          const SizedBox(height: 12),
          if (_pickingDiet) _inlinePicker(workout: false),
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
  Widget _measurementChecklist(BodyMeasurement m, BodyMeasurement? prev) {
    final rows = <(String, String, double?, double?)>[
      ('Weight', 'kg', m.weightKg, prev?.weightKg),
      ('Height', 'cm', m.heightCm, prev?.heightCm),
      ('Body fat', '%', m.bodyFatPercent, prev?.bodyFatPercent),
      ('Chest', 'cm', m.chestCm, prev?.chestCm),
      ('Waist', 'cm', m.waistCm, prev?.waistCm),
      ('Hips', 'cm', m.hipsCm, prev?.hipsCm),
      ('Biceps', 'cm', m.bicepsCm, prev?.bicepsCm),
      ('Thighs', 'cm', m.thighsCm, prev?.thighsCm),
    ];
    String fmt(double v) =>
        v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
    final recorded = rows.where((r) => r.$3 != null).length;
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 1, color: AppColors.line),
          Builder(
            builder: (context) {
              final (label, unit, value, before) = rows[i];
              final has = value != null;
              final delta = (has && before != null) ? value - before : null;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Row(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: (has ? AppColors.success : AppColors.inkFaint)
                            .withValues(alpha: 0.16),
                      ),
                      child: Icon(
                        has ? Icons.check_rounded : Icons.remove_rounded,
                        size: 14,
                        color: has ? AppColors.success : AppColors.inkFaint,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        label,
                        style: AppText.body(
                          size: 13,
                          weight: FontWeight.w700,
                          color: has ? AppColors.ink : AppColors.inkFaint,
                        ),
                      ),
                    ),
                    if (delta != null && delta != 0)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Text(
                          '${delta > 0 ? '▲' : '▼'} ${fmt(delta.abs())}',
                          style: AppText.body(
                            size: 11,
                            weight: FontWeight.w700,
                            color: AppColors.inkFaint,
                          ),
                        ),
                      ),
                    Text(
                      has ? '${fmt(value)} $unit' : 'Not recorded',
                      style: AppText.body(
                        size: 12.5,
                        weight: has ? FontWeight.w800 : FontWeight.w600,
                        color: has ? AppColors.ink : AppColors.inkFaint,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
        const SizedBox(height: 4),
        Align(
          alignment: Alignment.centerRight,
          child: Text(
            '$recorded of ${rows.length} recorded',
            style: AppText.body(size: 10.5, color: AppColors.inkFaint),
          ),
        ),
      ],
    );
  }

  List<double> get _weightTrend => _measurements.reversed
      .where((m) => m.weightKg != null)
      .map((m) => m.weightKg!)
      .toList();

  Widget _buildMeasurementsCard() {
    final latest = _measurements.isEmpty ? null : _measurements.first;
    final history = _measurements.length > 1
        ? _measurements.sublist(1)
        : const <BodyMeasurement>[];

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _cardHeaderRow(
            _CardHeading(
              icon: Icons.straighten_rounded,
              title: 'Body measurements',
            ),
            _headerAction(
              'Add',
              Icons.add_rounded,
              () => setState(() => _measurementFormOpen = true),
            ),
          ),
          const SizedBox(height: 12),
          if (_weightTrend.length >= 2) ...[
            DrawnSparkline(
              values: _weightTrend,
              colors: const [Color(0xFFFF5C7A), Color(0xFF8B5CF6)],
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                '${_weightTrend.first.toStringAsFixed(1)} kg → '
                '${_weightTrend.last.toStringAsFixed(1)} kg',
                textAlign: TextAlign.center,
                style: AppText.body(
                  size: 11,
                  weight: FontWeight.w700,
                  color: AppColors.inkFaint,
                ),
              ),
            ),
          ],
          if (latest == null)
            Text(
              'No measurements recorded yet.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Latest · ${_formatDate(latest.recordedAt)}'
                    '${latest.recordedBy != null ? ' · ${latest.recordedBy!.name}' : ''}',
                    style: AppText.body(size: 12, weight: FontWeight.w700),
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
            const SizedBox(height: 6),
            _measurementChecklist(
              latest,
              _measurements.length > 1 ? _measurements[1] : null,
            ),
          ],
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
                  boxShadow: [
                    BoxShadow(
                      color: _kIndigo.withValues(alpha: 0.45),
                      blurRadius: 28,
                      offset: const Offset(0, 12),
                    ),
                  ],
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
                          Icon(
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
    final status = member.portalStatus;

    final String description;
    switch (status) {
      case 'ACTIVE':
        description =
            '${member.name} already has portal access — send them a link '
            'to reset their password.';
      case 'PENDING_ACTIVATION':
        description = "${member.name} was invited but hasn't activated "
            'their account yet — resend the activation email if it never '
            'arrived.';
      case 'SUSPENDED':
        description = "${member.name}'s portal access is suspended.";
      default:
        description = "Let ${member.name} log in on their own to view "
            'attendance, workout/diet plans, invoices, and their QR code.'
            '${hasEmail ? '' : ' Add an email on file first.'}';
    }

    Widget? action;
    if (status == 'ACTIVE') {
      action = AppButton(
        label: 'Send reset password link',
        variant: AppButtonVariant.ghost,
        size: AppButtonSize.small,
        fullWidth: false,
        loading: _busy,
        onPressed: hasEmail ? _sendPortalPasswordReset : null,
      );
    } else if (status != 'SUSPENDED') {
      action = AppButton(
        label: status == 'PENDING_ACTIVATION'
            ? 'Resend activation email'
            : 'Enable portal access',
        variant: AppButtonVariant.ghost,
        size: AppButtonSize.small,
        fullWidth: false,
        loading: _busy,
        onPressed: hasEmail ? _sendPortalInvite : null,
      );
    }

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _CardHeading(
                  icon: Icons.smartphone_rounded,
                  title: 'Member portal',
                ),
              ),
              if (status == 'ACTIVE')
                const AppPill(label: 'Active', tone: AppPillTone.success)
              else if (status == 'PENDING_ACTIVATION')
                const AppPill(label: 'Invited', tone: AppPillTone.warning)
              else if (status == 'SUSPENDED')
                const AppPill(label: 'Suspended', tone: AppPillTone.danger),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: AppText.body(size: 12, color: AppColors.inkFaint),
          ),
          if (action != null) ...[
            const SizedBox(height: 10),
            action,
          ],
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
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(10),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF6366F1), Color(0xFFC026D3)],
            ),
          ),
          child: Icon(icon, size: 14, color: Colors.white),
        ),
        const SizedBox(width: 8),
        Text(title, style: AppText.display(size: 14.5)),
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

/// Compact icon + label tile for membership actions (Extend/Upgrade/Downgrade/Cancel).
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
    final status = entry.status;
    final color = switch (status) {
      ExerciseProgressStatus.completed => AppColors.success,
      ExerciseProgressStatus.skipped => AppColors.inkFaint,
      ExerciseProgressStatus.pending => AppColors.warning,
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.16),
              border: status == ExerciseProgressStatus.pending
                  ? Border.all(color: color, width: 1.5)
                  : null,
            ),
            child: Icon(
              switch (status) {
                ExerciseProgressStatus.completed => Icons.check_rounded,
                ExerciseProgressStatus.skipped => Icons.remove_rounded,
                ExerciseProgressStatus.pending => Icons.circle_outlined,
              },
              size: 14,
              color: color,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.exerciseName,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w700,
                    color: status == ExerciseProgressStatus.completed
                        ? AppColors.inkSoft
                        : AppColors.ink,
                  ),
                ),
                Text(
                  switch (status) {
                    ExerciseProgressStatus.completed => 'Completed',
                    ExerciseProgressStatus.skipped => 'Skipped',
                    ExerciseProgressStatus.pending => 'Pending',
                  },
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ],
            ),
          ),
          if (busy)
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else if (status != ExerciseProgressStatus.completed) ...[
            IconButton(
              tooltip: 'Mark done',
              visualDensity: VisualDensity.compact,
              onPressed: onDone,
              icon: Icon(Icons.check_circle_rounded, color: AppColors.success),
            ),
            if (status == ExerciseProgressStatus.pending)
              IconButton(
                tooltip: 'Skip',
                visualDensity: VisualDensity.compact,
                onPressed: onSkip,
                icon: Icon(
                  Icons.do_not_disturb_on_outlined,
                  color: AppColors.inkFaint,
                ),
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
              borderSide: BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.field),
              borderSide: BorderSide(color: AppColors.line),
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
