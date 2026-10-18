import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/branch_option.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../../shared/widgets/user_avatar.dart';
import '../../team/presentation/widgets/staff_branch_picker.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'staff_edit_employment_screen.dart'
    show
        staffEmploymentTypes,
        staffSalaryTypes,
        staffWeekdays,
        staffWorkStatuses;
import 'staff_edit_personal_screen.dart' show staffGenderOptions;
import 'team_screen.dart' show roleColor, roleIcon;
import 'widgets/member_detail_anim.dart';

/// Add staff (`POST /staff`) — mirrors web's `/staff/new` (account details,
/// role, branch access with a primary, employment information) as a
/// three-step wizard, plus the optional personal / emergency fields
/// `createStaffSchema` also accepts:
///
/// 1. **Account & role** — name, email, phone, employee ID, role cards.
/// 2. **Branches & employment** — branch access (one primary), employment
///    type, work status, salary, shift, weekly off, joining date.
/// 3. **Personal & review** — optional gender / DOB / address / emergency
///    contact / notes, then a live summary with a "ready to create" ring.
///
/// Creating the account emails them an activation link to set their own
/// password. Validation matches web: full name, valid email, a role and a
/// primary branch.
class StaffFormScreen extends StatefulWidget {
  const StaffFormScreen({super.key});

  @override
  State<StaffFormScreen> createState() => _StaffFormScreenState();
}

class _StaffFormScreenState extends State<StaffFormScreen> {
  static const _stepNames = ['Account', 'Work', 'Review'];
  static const _stepIcons = [
    Icons.person_rounded,
    Icons.work_rounded,
    Icons.fact_check_rounded,
  ];

  final _first = TextEditingController();
  final _last = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _employeeId = TextEditingController();
  final _salary = TextEditingController();
  final _shift = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _stateField = TextEditingController();
  final _country = TextEditingController();
  final _postal = TextEditingController();
  final _emName = TextEditingController();
  final _emPhone = TextEditingController();
  final _emRelation = TextEditingController();
  final _notes = TextEditingController();

  StaffRole _role = StaffRole.trainer;
  List<BranchOption> _branches = const [];
  Set<String> _branchIds = {};
  String? _primary;
  String _employmentType = 'FULL_TIME';
  String _salaryType = 'MONTHLY';
  String _workStatus = 'WORKING';
  final Set<String> _off = {};
  DateTime _joined = DateTime.now();
  String? _gender;
  DateTime? _dob;

  int _step = 0;
  bool _loadingOptions = true;
  bool _loading = false;
  String? _error;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    for (final c in [_first, _last, _email]) {
      c.addListener(_rebuild);
    }
    _loadBranches();
  }

  void _rebuild() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final c in [
      _first,
      _last,
      _email,
      _phone,
      _employeeId,
      _salary,
      _shift,
      _address,
      _city,
      _stateField,
      _country,
      _postal,
      _emName,
      _emPhone,
      _emRelation,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadBranches() async {
    setState(() {
      _loadingOptions = true;
      _loadError = null;
    });
    try {
      final options = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() {
        _branches = options;
        // One branch -> pre-select it (nothing else to choose).
        if (options.length == 1) {
          _branchIds = {options.first.id};
          _primary = options.first.id;
        }
        _loadingOptions = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _loadError = e.message;
          _loadingOptions = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadError = '$e';
          _loadingOptions = false;
        });
      }
    }
  }

  bool get _emailOk => RegExp(r'^\S+@\S+\.\S+$').hasMatch(_email.text.trim());
  String get _fullName => '${_first.text.trim()} ${_last.text.trim()}'.trim();

  String? _validate(int step) {
    if (step >= 0) {
      if (_first.text.trim().isEmpty || _last.text.trim().isEmpty) {
        return 'Enter first and last name';
      }
      if (!_emailOk) return 'Enter a valid email address';
      final id = _employeeId.text.trim();
      if (id.isNotEmpty && !RegExp(r'^[A-Za-z0-9-]+$').hasMatch(id)) {
        return 'Employee ID can only contain letters, numbers and hyphens';
      }
    }
    if (step >= 1) {
      if (_primary == null || _branchIds.isEmpty) {
        return 'Assign at least one branch and mark one as primary';
      }
      final amt = _salary.text.trim();
      if (amt.isNotEmpty && double.tryParse(amt) == null) {
        return 'Enter a valid salary amount';
      }
    }
    return null;
  }

  void _next() {
    final err = _validate(_step);
    if (err != null) {
      setState(() => _error = err);
      return;
    }
    setState(() {
      _error = null;
      _step++;
    });
  }

  void _back() => setState(() {
        _error = null;
        _step--;
      });

  Future<void> _submit() async {
    final err = _validate(1);
    if (err != null) {
      setState(() {
        _error = err;
        _step = _first.text.trim().isEmpty || !_emailOk ? 0 : 1;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    String put(TextEditingController c) => c.text.trim();
    final extra = <String, dynamic>{
      if (put(_phone).isNotEmpty) 'phone': put(_phone),
      if (put(_employeeId).isNotEmpty) 'employeeId': put(_employeeId),
      'branchIds': _branchIds.toList(),
      if (_gender != null) 'gender': _gender,
      if (_dob != null) 'dateOfBirth': isoDate(_dob!),
      'joiningDate': isoDate(_joined),
      if (put(_address).isNotEmpty) 'addressLine': put(_address),
      if (put(_city).isNotEmpty) 'city': put(_city),
      if (put(_stateField).isNotEmpty) 'state': put(_stateField),
      if (put(_country).isNotEmpty) 'country': put(_country),
      if (put(_postal).isNotEmpty) 'postalCode': put(_postal),
      if (put(_notes).isNotEmpty) 'notes': put(_notes),
      if (put(_emName).isNotEmpty) 'emergencyContactName': put(_emName),
      if (put(_emPhone).isNotEmpty) 'emergencyContactPhone': put(_emPhone),
      if (put(_emRelation).isNotEmpty)
        'emergencyContactRelation': put(_emRelation),
      'employmentType': _employmentType,
      'salaryType': _salaryType,
      if (double.tryParse(put(_salary)) != null)
        'salaryAmount': double.parse(put(_salary)),
      if (put(_shift).isNotEmpty) 'shift': put(_shift),
      if (encodeWeeklyOff(_off) != null) 'weeklyOff': encodeWeeklyOff(_off),
      'workStatus': _workStatus,
    };
    try {
      final created = await getIt<StaffRepository>().create(
        firstName: _first.text.trim(),
        lastName: _last.text.trim(),
        email: _email.text.trim(),
        role: _role,
        primaryBranchId: _primary!,
        extra: extra,
      );
      if (!mounted) return;
      teamSnack(context, '${created.name} created — activation email sent');
      setState(() => _loading = false);
      context.pushReplacement(AppRoutes.staffDetail, extra: created.id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.detailedMessage;
        _loading = false;
      });
    } catch (e) {
      // A parse failure after a successful POST must not leave the spinner
      // running — the account may well exist, so say so.
      if (!mounted) return;
      setState(() {
        _error = 'Something went wrong while finishing ($e). Check the '
            'Team list — the staff member may already have been created.';
        _loading = false;
      });
    }
  }

  // ── build ─────────────────────────────────────────────────────────────────

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
        title: const Text('Add staff'),
      ),
      bottomNavigationBar:
          _loadingOptions || _loadError != null ? null : _bottomBar(),
      body: _loadingOptions
          ? const AppLoadingView()
          : _loadError != null
              ? AppErrorView(message: _loadError!, onRetry: _loadBranches)
              : ListView(
                  padding: const EdgeInsets.only(bottom: 24),
                  children: [
                    _hero(top),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        16 + teamSideInset(context),
                        16,
                        16 + teamSideInset(context),
                        0,
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 280),
                        transitionBuilder: (child, anim) => FadeTransition(
                          opacity: anim,
                          child: SlideTransition(
                            position: Tween(
                              begin: const Offset(0.06, 0),
                              end: Offset.zero,
                            ).animate(anim),
                            child: child,
                          ),
                        ),
                        child: Column(
                          key: ValueKey(_step),
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_error != null) ...[
                              FormAlert(message: _error!),
                              const SizedBox(height: 14),
                            ],
                            ...switch (_step) {
                              0 => _stepAccount(),
                              1 => _stepWork(),
                              _ => _stepReview(),
                            },
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _hero(double top) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        18 + teamSideInset(context),
        top + 2,
        18 + teamSideInset(context),
        20,
      ),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF312E81), Color(0xFF7C3AED), Color(0xFFC026D3)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _fullName.isEmpty ? 'Add a staff member' : _fullName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.display(size: 24, color: Colors.white),
          ),
          const SizedBox(height: 2),
          Text(
            'Step ${_step + 1} of 3 · ${_stepNames[_step]}',
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0)
                  Expanded(
                    child: Container(
                      height: 3,
                      margin:
                          const EdgeInsets.only(left: 6, right: 6, bottom: 16),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(
                          alpha: i <= _step ? 0.95 : 0.3,
                        ),
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                  ),
                GestureDetector(
                  onTap: () {
                    // Jump back freely; jump forward only if earlier steps pass.
                    if (i <= _step) {
                      setState(() => _step = i);
                    } else {
                      final err = _validate(i - 1);
                      setState(() {
                        _error = err;
                        if (err == null) _step = i;
                      });
                    }
                  },
                  child: Column(
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 250),
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i <= _step
                              ? Colors.white
                              : Colors.white.withValues(alpha: 0.18),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.5),
                          ),
                        ),
                        child: Icon(
                          i < _step ? Icons.check_rounded : _stepIcons[i],
                          size: 19,
                          color: i <= _step
                              ? const Color(0xFF7C3AED)
                              : Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _stepNames[i],
                        style: AppText.body(
                          size: 10.5,
                          weight: FontWeight.w700,
                          color: Colors.white.withValues(
                            alpha: i == _step ? 1 : 0.7,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _bottomBar() {
    return TeamBottomBar(
      child: Row(
        children: [
          if (_step > 0) ...[
            Expanded(
              flex: 2,
              child: TeamOutlineButton(
                label: 'Back',
                icon: Icons.arrow_back_rounded,
                onTap: _loading ? null : _back,
              ),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            flex: 3,
            child: TeamGradientButton(
              label: _step < 2 ? 'Next' : 'Create staff member',
              icon:
                  _step < 2 ? Icons.arrow_forward_rounded : Icons.check_rounded,
              loading: _loading,
              gradient: _step < 2 ? TeamColors.cta : TeamColors.ctaGreen,
              onTap: _step < 2 ? _next : _submit,
            ),
          ),
        ],
      ),
    );
  }

  // ── steps ─────────────────────────────────────────────────────────────────

  List<Widget> _stepAccount() => [
        TeamFormSection(
          icon: Icons.person_rounded,
          color: TeamColors.indigo,
          title: 'Account details',
          subtitle: 'They get an activation email to set their own password',
          children: [
            AppLabeledField(
              label: 'First name',
              hintText: 'e.g. Arjun',
              icon: Icons.person_rounded,
              iconColor: TeamColors.indigo,
              controller: _first,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Last name',
              hintText: 'e.g. Mehta',
              icon: Icons.person_outline_rounded,
              iconColor: TeamColors.indigo,
              controller: _last,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Email',
              hintText: 'staff@gym.com',
              icon: Icons.mail_rounded,
              iconColor: TeamColors.sky,
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Phone (optional)',
              hintText: 'e.g. 9876543210',
              icon: Icons.call_rounded,
              iconColor: TeamColors.green,
              controller: _phone,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
            ),
            AppLabeledField(
              label: 'Employee ID (optional)',
              hintText: 'Auto-generated if left blank',
              icon: Icons.numbers_rounded,
              iconColor: TeamColors.violet,
              controller: _employeeId,
              textInputAction: TextInputAction.done,
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.shield_rounded,
          color: TeamColors.violet,
          title: 'Role',
          subtitle: 'Pick one',
          children: [
            for (final r in StaffRole.values)
              TeamChoiceCard(
                title: r.label,
                description: r.description,
                icon: roleIcon(r),
                color: roleColor(r),
                selected: _role == r,
                onTap: () => setState(() => _role = r),
              ),
          ],
        ),
      ];

  List<Widget> _stepWork() => [
        TeamFormSection(
          icon: Icons.account_tree_rounded,
          color: TeamColors.teal,
          title: 'Branch access',
          subtitle: 'Assign at least one, mark one primary',
          children: [
            StaffBranchPicker(
              options: _branches,
              branchIds: _branchIds,
              primaryId: _primary,
              onChanged: (ids, primary) => setState(() {
                _branchIds = ids;
                _primary = primary;
              }),
            ),
          ],
        ),
        const SizedBox(height: 14),
        TeamFormSection(
          icon: Icons.work_rounded,
          color: TeamColors.violet,
          title: 'Employment information',
          children: [
            TeamChipGroup(
              label: 'Employment type',
              icon: Icons.assignment_ind_rounded,
              color: TeamColors.violet,
              options: staffEmploymentTypes,
              selected: {_employmentType},
              onToggle: (v) => setState(() => _employmentType = v),
            ),
            TeamChipGroup(
              label: 'Work status',
              icon: Icons.schedule_rounded,
              color: TeamColors.teal,
              options: staffWorkStatuses,
              selected: {_workStatus},
              onToggle: (v) => setState(() => _workStatus = v),
            ),
            TeamChipGroup(
              label: 'Salary type',
              icon: Icons.payments_rounded,
              color: TeamColors.green,
              options: staffSalaryTypes,
              selected: {_salaryType},
              onToggle: (v) => setState(() => _salaryType = v),
            ),
            AppLabeledField(
              label: 'Salary amount (${AppCurrency.symbol})',
              hintText: 'e.g. 25000',
              icon: Icons.currency_rupee_rounded,
              iconColor: TeamColors.green,
              controller: _salary,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
              ],
            ),
            AppLabeledField(
              label: 'Shift',
              hintText: 'e.g. Morning (6am-2pm)',
              icon: Icons.wb_twilight_rounded,
              iconColor: TeamColors.amber,
              controller: _shift,
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.weekend_rounded,
                      size: 14,
                      color: TeamColors.amber,
                    ),
                    const SizedBox(width: 6),
                    Text('Weekly off', style: AppText.eyebrow()),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final d in staffWeekdays)
                      GestureDetector(
                        onTap: () => setState(() {
                          _off.contains(d) ? _off.remove(d) : _off.add(d);
                        }),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 160),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            gradient: _off.contains(d) ? TeamColors.cta : null,
                            color: _off.contains(d) ? null : AppColors.surface3,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            d,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w800,
                              color: _off.contains(d)
                                  ? Colors.white
                                  : AppColors.inkSoft,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
            TeamDateField(
              label: 'Joining date',
              icon: Icons.event_rounded,
              iconColor: TeamColors.sky,
              value: _joined,
              clearable: false,
              onChanged: (d) {
                if (d != null) setState(() => _joined = d);
              },
            ),
          ],
        ),
      ];

  List<Widget> _stepReview() {
    final checks = [
      (
        'Full name',
        _first.text.trim().isNotEmpty && _last.text.trim().isNotEmpty
      ),
      ('Valid email', _emailOk),
      ('Role selected', true),
      ('Primary branch confirmed', _primary != null),
    ];
    final percent = checks.where((c) => c.$2).length / checks.length;
    BranchOption? primary;
    for (final b in _branches) {
      if (b.id == _primary) primary = b;
    }
    return [
      FadeUp(
        index: 0,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF4338CA), Color(0xFF7C3AED), Color(0xFFC026D3)],
            ),
            boxShadow: [
              BoxShadow(
                color: TeamColors.violet.withValues(alpha: 0.35),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                ),
                child: UserAvatar(
                  avatarUrl: null,
                  name: _fullName.isEmpty ? '?' : _fullName,
                  size: 64,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _fullName.isEmpty ? 'New staff member' : _fullName,
                style: AppText.display(size: 21, color: Colors.white),
              ),
              Text(
                _email.text.trim().isEmpty
                    ? 'Start typing a name and email'
                    : _email.text.trim(),
                style: AppText.body(
                  size: 12.5,
                  color: Colors.white.withValues(alpha: 0.88),
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                alignment: WrapAlignment.center,
                children: [
                  TeamHeroPill(_role.label, icon: roleIcon(_role)),
                  if (primary != null)
                    TeamHeroPill(primary.name, icon: Icons.star_rounded),
                  TeamHeroPill(
                    staffEmploymentTypes
                        .firstWhere((e) => e.$1 == _employmentType)
                        .$2,
                    icon: Icons.work_rounded,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 14),
      TeamSectionCard(
        icon: Icons.checklist_rounded,
        color: TeamColors.green,
        title: 'Ready to create',
        child: Row(
          children: [
            AnimatedRing(
              value: percent,
              size: 78,
              stroke: 9,
              colors: const [TeamColors.green, TeamColors.teal],
              track: TeamColors.green.withValues(alpha: 0.16),
              child: Text(
                '${(percent * 100).round()}%',
                style: AppText.display(size: 16),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                children: [
                  for (final c in checks) TeamCheckRow(label: c.$1, ok: c.$2),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      TeamFormSection(
        icon: Icons.person_search_rounded,
        color: TeamColors.fuchsia,
        title: 'Personal details',
        subtitle: 'Optional — can be filled in later from their profile',
        children: [
          OptionPickerField(
            label: 'Gender',
            options: staffGenderOptions,
            value: _gender,
            icon: Icons.wc_rounded,
            iconColor: TeamColors.fuchsia,
            onChanged: (v) => setState(() => _gender = v),
          ),
          TeamDateField(
            label: 'Date of birth',
            icon: Icons.cake_rounded,
            iconColor: TeamColors.rose,
            value: _dob,
            lastDate: DateTime.now(),
            onChanged: (d) => setState(() => _dob = d),
          ),
          AppLabeledField(
            label: 'Address',
            icon: Icons.place_rounded,
            iconColor: TeamColors.teal,
            controller: _address,
            textCapitalization: TextCapitalization.sentences,
          ),
          AppLabeledField(
            label: 'City',
            icon: Icons.location_city_rounded,
            iconColor: TeamColors.teal,
            controller: _city,
            textCapitalization: TextCapitalization.words,
          ),
          AppLabeledField(
            label: 'State',
            icon: Icons.map_rounded,
            iconColor: TeamColors.teal,
            controller: _stateField,
            textCapitalization: TextCapitalization.words,
          ),
          AppLabeledField(
            label: 'Country',
            icon: Icons.public_rounded,
            iconColor: TeamColors.teal,
            controller: _country,
            textCapitalization: TextCapitalization.words,
          ),
          AppLabeledField(
            label: 'Postal code',
            icon: Icons.markunread_mailbox_rounded,
            iconColor: TeamColors.teal,
            controller: _postal,
          ),
        ],
      ),
      const SizedBox(height: 14),
      TeamFormSection(
        icon: Icons.emergency_rounded,
        color: TeamColors.rose,
        title: 'Emergency contact & notes',
        subtitle: 'Optional',
        children: [
          AppLabeledField(
            label: 'Emergency contact name',
            icon: Icons.person_outline_rounded,
            iconColor: TeamColors.rose,
            controller: _emName,
            textCapitalization: TextCapitalization.words,
          ),
          AppLabeledField(
            label: 'Emergency contact phone',
            icon: Icons.call_rounded,
            iconColor: TeamColors.rose,
            controller: _emPhone,
            keyboardType: TextInputType.phone,
          ),
          AppLabeledField(
            label: 'Relation',
            icon: Icons.family_restroom_rounded,
            iconColor: TeamColors.rose,
            controller: _emRelation,
            hintText: 'e.g. Spouse',
            textCapitalization: TextCapitalization.words,
          ),
          AppLabeledField(
            label: 'Notes',
            icon: Icons.notes_rounded,
            iconColor: TeamColors.amber,
            controller: _notes,
            minLines: 3,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
          ),
        ],
      ),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: TeamColors.sky.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: TeamColors.sky.withValues(alpha: 0.25)),
        ),
        child: Column(
          children: [
            for (final (i, t) in [
              'The account is created right away',
              'An activation email is sent to them',
              'They set their own password to sign in',
            ].indexed)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: TeamColors.sky.withValues(alpha: 0.2),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${i + 1}',
                        style: AppText.body(
                          size: 11,
                          weight: FontWeight.w800,
                          color: TeamColors.sky,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        t,
                        style: AppText.body(
                          size: 12.5,
                          weight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ];
  }
}
