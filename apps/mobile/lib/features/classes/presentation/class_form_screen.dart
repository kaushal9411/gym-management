import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../bloc/session/session_cubit.dart';
import '../../../bloc/session/session_state.dart';
import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/group_class.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/group_class_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/trainer_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'class_detail_screen.dart';
import 'class_ui.dart';
import 'widgets/class_form_fields.dart';

/// Create / edit a class (`POST /classes`, `PATCH /classes/:id`). One route
/// for both, as before: [classId] null -> the create page; otherwise the
/// class detail page ([ClassDetailScreen]) with the editable form, weekly
/// schedule and lifecycle actions (web's `/classes/[classId]`).
///
/// Reached from the Owner / Manager / Trainer catalog (`classes:view`) and
/// from the Receptionist's Classes tab "+". Create is not gated here, exactly
/// as before - the server enforces `classes:create`.
class ClassFormScreen extends StatelessWidget {
  const ClassFormScreen({super.key, this.classId});

  /// Null -> create.
  final String? classId;

  bool get isEdit => classId != null;

  @override
  Widget build(BuildContext context) {
    final id = classId;
    return id == null
        ? const ClassCreateScreen()
        : ClassDetailScreen(classId: id);
  }
}

/// Branches the form can pick from (`GET /branches/assignable`). When that
/// is not readable the class's own branch (if any) is still offered so the
/// form can be saved untouched.
Future<List<BranchOption>> loadClassBranchOptions({
  GroupClass? existing,
}) async {
  List<BranchOption> options = const [];
  try {
    options = await getIt<BranchRepository>().assignable();
  } catch (_) {
    // Fall through to the class's own branch below.
  }
  final own = existing?.branch;
  if (own != null && !options.any((b) => b.id == own.id)) {
    options = [...options, BranchOption(id: own.id, name: own.name)];
  }
  return options;
}

/// A Trainer creating a class is always the trainer on it (see
/// [TrainerPickerField]); null for every other role.
TrainerOption? selfTrainerOption(BuildContext context) {
  final session = context.read<SessionCubit>().state;
  if (session is SessionAuthenticatedStaff && session.user.isTrainer) {
    return TrainerOption(id: session.user.id, name: session.user.name);
  }
  return null;
}

/// New class (web's `/classes/new`): live summary hero, "Ready to create"
/// checklist, the class information card and a sticky Cancel / Create bar.
/// The weekly schedule is set right after creating, on the schedule page.
class ClassCreateScreen extends StatefulWidget {
  const ClassCreateScreen({super.key});

  @override
  State<ClassCreateScreen> createState() => _ClassCreateScreenState();
}

class _ClassCreateScreenState extends State<ClassCreateScreen> {
  final _data = ClassFormData();
  List<BranchOption> _branches = const [];
  bool _loading = true;
  bool _submitting = false;
  String? _loadError;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _data.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final options = await loadClassBranchOptions();
      if (!mounted) return;
      _data
        ..setBranch(options.isNotEmpty ? options.first.id : null)
        ..setTrainer(selfTrainerOption(context));
      setState(() {
        _branches = options;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = 'Could not load branches ($e)';
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final problem = _data.validate();
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final created = await getIt<GroupClassRepository>().create(
        name: _data.name.text.trim(),
        branchId: _data.branchId!,
        description: _data.description.text.trim(),
        trainerId: _data.trainer?.id,
        capacity: _data.capacityValue!,
        durationMinutes: _data.durationValue!,
        isActive: _data.isActive,
      );
      if (!mounted) return;
      teamSnack(context, '${created.name} created');
      // The weekly schedule is the next step (as on web's detail page).
      context.pushReplacement(AppRoutes.classSchedule, extra: created);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.detailedMessage);
    } catch (e) {
      if (mounted) setState(() => _error = 'Something went wrong ($e)');
    } finally {
      if (mounted) setState(() => _submitting = false);
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
        title: const Text('New class'),
      ),
      bottomNavigationBar: _loading || _loadError != null
          ? null
          : TeamBottomBar(
              child: Row(
                children: [
                  Expanded(
                    child: TeamOutlineButton(
                      label: 'Cancel',
                      onTap: _submitting ? null : () => context.pop(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: TeamGradientButton(
                      label: 'Create class',
                      icon: Icons.check_rounded,
                      loading: _submitting,
                      gradient: TeamColors.ctaGreen,
                      onTap: _submit,
                    ),
                  ),
                ],
              ),
            ),
      body: _loadError != null
          ? SafeArea(child: AppErrorView(message: _loadError!, onRetry: _load))
          : _loading
              ? const AppLoadingView()
              : SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ListenableBuilder(
                        listenable: _data,
                        builder: (context, _) => _hero(top),
                      ),
                      TeamCenter(
                        maxWidth: 820,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (_error != null) ...[
                                FormAlert(message: _error!),
                                const SizedBox(height: 14),
                              ],
                              ListenableBuilder(
                                listenable: _data,
                                builder: (context, _) => _readyCard(),
                              ),
                              const SizedBox(height: 14),
                              ClassInfoFields(
                                data: _data,
                                branches: _branches,
                              ),
                              const SizedBox(height: 14),
                              Text(
                                'The weekly recurring schedule is set right '
                                'after the class is created.',
                                style: AppText.body(
                                  size: 12,
                                  weight: FontWeight.w600,
                                  color: AppColors.inkFaint,
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

  Widget _hero(double top) {
    final name = _data.name.text.trim();
    final cap = _data.capacity.text.trim();
    final dur = _data.duration.text.trim();
    return ClassHeroShell(
      topInset: top,
      child: Column(
        children: [
          FadeUp(
            index: 0,
            child: SpinningRing(
              size: 92,
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
                    Icons.calendar_month_rounded,
                    size: 38,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          FadeUp(
            index: 1,
            child: Text(
              name.isEmpty ? 'New class' : name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: AppText.display(size: 25, color: Colors.white),
            ),
          ),
          const SizedBox(height: 4),
          FadeUp(
            index: 2,
            child: Text(
              cap.isNotEmpty && dur.isNotEmpty
                  ? '$cap seats · ${dur}m'
                  : 'Start typing a name and capacity',
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 12.5,
                weight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.88),
              ),
            ),
          ),
          const SizedBox(height: 10),
          const FadeUp(
            index: 3,
            child: TeamHeroPill('Programs', icon: Icons.calendar_month_rounded),
          ),
        ],
      ),
    );
  }

  Widget _readyCard() {
    final checks = [
      ('Class name', _data.name.text.trim().isNotEmpty),
      ('Branch', (_data.branchId ?? '').isNotEmpty),
      (
        'Capacity & duration',
        _data.capacity.text.trim().isNotEmpty &&
            _data.duration.text.trim().isNotEmpty,
      ),
    ];
    final pct = (_data.readiness * 100).round();
    return TeamSectionCard(
      icon: Icons.checklist_rounded,
      color: TeamColors.green,
      title: 'Ready to create',
      child: Row(
        children: [
          AnimatedRing(
            value: _data.readiness,
            size: 74,
            stroke: 8,
            colors: const [TeamColors.green, TeamColors.teal],
            track: TeamColors.green.withValues(alpha: 0.16),
            child: Text(
              '$pct%',
              key: const ValueKey('ready-percent'),
              style: AppText.display(size: 15),
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
    );
  }
}
