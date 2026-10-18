import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/routing/app_routes.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radii.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/app_currency.dart';
import '../../../models/branch_option.dart';
import '../../../models/gym_member.dart';
import '../../../models/membership_plan.dart';
import '../../../models/staff_member.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/finance_repository.dart';
import '../../../repositories/member_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../repositories/staff_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/member_edit_scaffold.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../../shared/widgets/user_avatar.dart';
import 'widgets/member_detail_anim.dart';

const _indigo = Color(0xFF6366F1);
const _violet = Color(0xFF8B5CF6);
const _teal = Color(0xFF14B8A6);
const _amber = Color(0xFFF59E0B);
const _rose = Color(0xFFFF5C7A);
const _green = Color(0xFF10B981);

const _genders = [
  ('MALE', 'Male'),
  ('FEMALE', 'Female'),
  ('OTHER', 'Other'),
  ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];
const _goals = [
  ('WEIGHT_LOSS', 'Weight loss'),
  ('WEIGHT_GAIN', 'Weight gain'),
  ('MUSCLE_BUILDING', 'Muscle building'),
  ('GENERAL_FITNESS', 'General fitness'),
  ('ENDURANCE', 'Endurance'),
  ('REHABILITATION', 'Rehabilitation'),
  ('OTHER', 'Other'),
];
const _bodyTypes = [
  ('ECTOMORPH', 'Ectomorph'),
  ('MESOMORPH', 'Mesomorph'),
  ('ENDOMORPH', 'Endomorph'),
  ('AVERAGE', 'Average'),
  ('UNKNOWN', 'Unknown'),
];
const _foods = [
  ('VEGETARIAN', 'Vegetarian'),
  ('NON_VEGETARIAN', 'Non-vegetarian'),
  ('VEGAN', 'Vegan'),
  ('EGGETARIAN', 'Eggetarian'),
  ('UNKNOWN', 'Unknown'),
];
const _maritals = [
  ('SINGLE', 'Single'),
  ('MARRIED', 'Married'),
  ('DIVORCED', 'Divorced'),
  ('WIDOWED', 'Widowed'),
  ('PREFER_NOT_TO_SAY', 'Prefer not to say'),
];
const _bloodGroups = [
  ('A_POSITIVE', 'A+'),
  ('A_NEGATIVE', 'A−'),
  ('B_POSITIVE', 'B+'),
  ('B_NEGATIVE', 'B−'),
  ('AB_POSITIVE', 'AB+'),
  ('AB_NEGATIVE', 'AB−'),
  ('O_POSITIVE', 'O+'),
  ('O_NEGATIVE', 'O−'),
  ('UNKNOWN', 'Unknown'),
];
const _awarenessOptions = [
  ('SOCIAL_MEDIA', 'Social media'),
  ('FRIEND_REFERRAL', 'Friend referral'),
  ('WALK_IN', 'Walk-in'),
  ('ADVERTISEMENT', 'Advertisement'),
  ('ONLINE_SEARCH', 'Online search'),
  ('OTHER', 'Other'),
];
const _healthQuestions = [
  (
    'healthHeartCondition',
    'Do you suffer from a heart condition or have you ever had heart disease or a heart attack?',
  ),
  (
    'healthPainDuringActivity',
    'Do you experience any pain while exercising or doing physical activity?',
  ),
  (
    'healthDizzinessOrBalance',
    'Have you ever felt faint, dizzy, short of breath or lost your balance during physical activity?',
  ),
  ('healthDiabetesOrBp', 'Do you have diabetes or high blood pressure?'),
  ('healthAsthma', 'Do you suffer from asthma?'),
  (
    'healthBoneOrJointProblem',
    'Do you have a bone or joint problem that exercise could aggravate?',
  ),
  (
    'healthOtherCondition',
    'Any other medical condition, injury or medication that could affect exercise?',
  ),
];
const _methods = [
  ('CASH', 'Cash', Icons.payments_rounded, _green),
  ('UPI', 'UPI', Icons.smartphone_rounded, _indigo),
  ('CREDIT_CARD', 'Credit card', Icons.credit_card_rounded, _violet),
  ('DEBIT_CARD', 'Debit card', Icons.credit_card_outlined, _teal),
  ('BANK_TRANSFER', 'Bank transfer', Icons.account_balance_rounded, _amber),
  ('CHEQUE', 'Cheque', Icons.description_rounded, _rose),
  ('ONLINE_GATEWAY', 'Online gateway', Icons.public_rounded, _indigo),
];

/// "+ Add member" — a 3-step wizard mirroring web's `/members/new`:
/// 1 Personal info (identity, about, branch & trainer, address, body &
/// goals, family, membership program), 2 Health screening, 3 Payment
/// summary. Same sequence of real requests as web: `POST /members`, then
/// `PUT /:id/membership` (if a plan was chosen), then `POST /payments` (if an
/// amount was received). Failures after the member exists land on the member's
/// page instead of losing the rest.
class MemberFormScreen extends StatefulWidget {
  const MemberFormScreen({super.key});

  @override
  State<MemberFormScreen> createState() => _MemberFormScreenState();
}

class _MemberFormScreenState extends State<MemberFormScreen> {
  int _step = 0;
  bool _loading = false;
  bool _loadingOptions = true;
  bool _showErrors = false;
  String? _error;

  final _first = TextEditingController();
  final _last = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _memberId = TextEditingController();
  final _occupation = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _country = TextEditingController(text: 'India');
  final _postal = TextEditingController();
  final _height = TextEditingController();
  final _weight = TextEditingController();
  final _father = TextEditingController();
  final _regFee = TextEditingController();
  final _targetWeight = TextEditingController();
  final _otherDetails = TextEditingController();
  final _amount = TextEditingController();
  final _discount = TextEditingController();

  String? _gender;
  String? _goal;
  String? _bodyType;
  String? _food;
  String? _marital;
  String? _blood;
  String? _awarenessSource;
  String? _referredId;
  String? _referredLabel;
  DateTime? _dob;
  DateTime? _anniversary;
  DateTime _joining = DateTime.now();
  DateTime _planStart = DateTime.now();
  String? _branchId;
  String? _trainerId;
  String? _planId;
  String _method = 'CASH';
  final Map<String, bool> _health = {
    for (final q in _healthQuestions) q.$1: false,
  };

  List<BranchOption> _branches = [];
  List<MembershipPlan> _plans = [];
  List<StaffMember> _trainers = [];

  @override
  void initState() {
    super.initState();
    _regFee.addListener(_refresh);
    _discount.addListener(_refresh);
    _amount.addListener(_refresh);
    _loadOptions();
  }

  void _refresh() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    for (final c in [
      _first,
      _last,
      _email,
      _phone,
      _memberId,
      _occupation,
      _address,
      _city,
      _state,
      _country,
      _postal,
      _height,
      _weight,
      _father,
      _regFee,
      _targetWeight,
      _otherDetails,
      _amount,
      _discount,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOptions() async {
    try {
      final branchesFuture = getIt<BranchRepository>().assignable();
      final plansFuture = getIt<MembershipPlanRepository>().list(limit: 50);
      final trainersFuture = getIt<StaffRepository>().list(
        limit: 100,
        role: StaffRole.trainer,
        status: 'ACTIVE',
      );
      final branches = await branchesFuture;
      final plans = await plansFuture;
      final trainers = await trainersFuture;
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _branchId = branches.isNotEmpty ? branches.first.id : null;
        _plans = plans.items.where((p) => p.isActive).toList();
        _trainers = trainers.items;
        _loadingOptions = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingOptions = false;
      });
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  String _iso(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String? _orNull(String v) => v.trim().isEmpty ? null : v.trim();

  double _num(TextEditingController c) =>
      double.tryParse(c.text.trim().replaceAll(',', '.')) ?? 0;

  String _money(double v) => '${AppCurrency.symbol}${v.toStringAsFixed(2)}';

  MembershipPlan? get _plan {
    for (final p in _plans) {
      if (p.id == _planId) return p;
    }
    return null;
  }

  double get _totalDue {
    final p = _plan;
    return (p?.finalPrice ?? 0) +
        (p?.joiningFee ?? 0) +
        _num(_regFee) -
        _num(_discount);
  }

  int? get _age {
    final d = _dob;
    if (d == null) return null;
    final now = DateTime.now();
    var age = now.year - d.year;
    if (now.month < d.month || (now.month == d.month && now.day < d.day)) {
      age--;
    }
    return age >= 0 ? age : null;
  }

  Future<DateTime?> _pickDate({
    required DateTime initial,
    required DateTime first,
    required DateTime last,
  }) {
    return showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: first,
      lastDate: last,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
  }

  // ── navigation ──────────────────────────────────────────────────────────

  void _next() {
    setState(() => _error = null);
    if (_step == 0) {
      final problem = _first.text.trim().isEmpty || _last.text.trim().isEmpty
          ? "Enter the member's full name."
          : _phone.text.trim().isEmpty && _email.text.trim().isEmpty
              ? 'Enter a phone number or email address.'
              : _branchId == null
                  ? 'Select a branch.'
                  : null;
      if (problem != null) {
        setState(() {
          _showErrors = true;
          _error = problem;
        });
        return;
      }
    }
    if (_step == 1 && _planId != null && _amount.text.trim().isEmpty) {
      _amount.text = _totalDue.clamp(0, double.infinity).toStringAsFixed(2);
    }
    setState(() => _step = (_step + 1).clamp(0, 2));
  }

  void _back() {
    setState(() {
      _error = null;
      _step = (_step - 1).clamp(0, 2);
    });
  }

  // ── submit ──────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    final plan = _plan;
    final typed = _num(_amount);
    final total = _totalDue;
    if (typed > total + 0.005) {
      setState(() {
        _error =
            'Payment received cannot exceed the total due of ${_money(total)}.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = getIt<MemberRepository>();
    GymMember member;
    try {
      member = await repo.create(
        firstName: _first.text.trim(),
        lastName: _last.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
        memberId: _memberId.text.trim(),
        branchId: _branchId!,
        trainerId: _trainerId,
        extra: {
          'gender': _gender,
          'dateOfBirth': _dob == null ? null : _iso(_dob!),
          'bloodGroup': _blood,
          'height': _orNull(_height.text) == null ? null : _num(_height),
          'weight': _orNull(_weight.text) == null ? null : _num(_weight),
          'occupation': _orNull(_occupation.text),
          'addressLine': _orNull(_address.text),
          'city': _orNull(_city.text),
          'state': _orNull(_state.text),
          'country': _orNull(_country.text),
          'postalCode': _orNull(_postal.text),
          'joiningDate': _iso(_joining),
          'fatherNameOrAadhaar': _orNull(_father.text),
          'maritalStatus': _marital,
          'anniversary': _anniversary == null ? null : _iso(_anniversary!),
          'goal': _goal,
          'registrationFee':
              _orNull(_regFee.text) == null ? null : _num(_regFee),
          'bodyType': _bodyType,
          'foodPreference': _food,
          ..._health,
          'awarenessSource': _awarenessSource,
          'healthScreeningOtherDetails': _orNull(_otherDetails.text),
          'referredByMemberId': _referredId,
        },
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.detailedMessage;
        _loading = false;
        _step = 0;
      });
      return;
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not create the member: $e';
        _loading = false;
        _step = 0;
      });
      return;
    }

    String? membershipId;
    if (plan != null) {
      try {
        final updated = await repo.assignMembership(
          member.id,
          plan.id,
          startDate: _planStart,
          targetWeight:
              _orNull(_targetWeight.text) == null ? null : _num(_targetWeight),
        );
        membershipId = updated.membershipHistory.isNotEmpty
            ? updated.membershipHistory.first.id
            : null;
      } on ApiException catch (e) {
        _finish(
          member,
          'Member created, but plan assignment failed: ${e.message}. '
          "Finish it from the member's page.",
        );
        return;
      } catch (e) {
        _finish(member, 'Member created, but plan assignment failed: $e');
        return;
      }
    }

    if (typed > 0) {
      final base = (plan?.price ?? 0) + (plan?.joiningFee ?? 0) + _num(_regFee);
      final full = plan != null && typed >= total - 0.005;
      try {
        await getIt<FinanceRepository>().recordPayment(
          memberId: member.id,
          membershipId: membershipId,
          amount: full ? base : typed,
          discount:
              full ? (plan.discountAmount + _num(_discount)) : _num(_discount),
          tax: full ? plan.taxAmount : null,
          method: _method,
          status: 'SUCCESS',
        );
      } on ApiException catch (e) {
        _finish(
          member,
          'Member created, but payment recording failed: ${e.message}. '
          "Record it from the member's page.",
        );
        return;
      } catch (e) {
        _finish(member, 'Member created, but payment recording failed: $e');
        return;
      }
    }
    _finish(member, '${member.name} created');
  }

  void _finish(GymMember member, String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
    setState(() => _loading = false);
    context.pushReplacement(AppRoutes.memberDetail, extra: member.id);
  }

  // ── build ───────────────────────────────────────────────────────────────

  static const _stepNames = ['Personal info', 'Health', 'Payment'];
  static const _stepIcons = [
    Icons.person_rounded,
    Icons.favorite_rounded,
    Icons.account_balance_wallet_rounded,
  ];

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
        title: const Text('New member'),
      ),
      bottomNavigationBar: _loadingOptions ? null : _bottomBar(),
      body: _loadingOptions
          ? const AppLoadingView()
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                _hero(top),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
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
                          0 => _stepPersonal(),
                          1 => _stepHealth(),
                          _ => _stepPayment(),
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
    final name = '${_first.text.trim()} ${_last.text.trim()}'.trim();
    return Container(
      padding: EdgeInsets.fromLTRB(18, top + 2, 18, 20),
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
            name.isEmpty ? 'Add a new member' : name,
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
                      margin: const EdgeInsets.only(
                        left: 6,
                        right: 6,
                        bottom: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(
                          alpha: i <= _step ? 0.95 : 0.3,
                        ),
                        borderRadius: BorderRadius.circular(9),
                      ),
                    ),
                  ),
                GestureDetector(
                  onTap: () => setState(() {
                    if (i == 0 || _first.text.trim().isNotEmpty) _step = i;
                  }),
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
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        children: [
          if (_step > 0) ...[
            Expanded(
              flex: 2,
              child: GestureDetector(
                onTap: _loading ? null : _back,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    color: AppColors.surface2,
                    border: Border.all(color: AppColors.line),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.arrow_back_rounded,
                        size: 17,
                        color: AppColors.ink,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Back',
                        style: AppText.body(size: 14, weight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            flex: 3,
            child: GestureDetector(
              onTap: _loading ? null : (_step < 2 ? _next : _submit),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    colors: _step < 2
                        ? const [_indigo, _violet, Color(0xFFC026D3)]
                        : const [Color(0xFF059669), Color(0xFF14B8A6)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color:
                          (_step < 2 ? _violet : _green).withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: _loading
                    ? const Center(
                        heightFactor: 1,
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.max,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _step < 2 ? 'Next' : 'Create member',
                            style: AppText.body(
                              size: 15,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Icon(
                            _step < 2
                                ? Icons.arrow_forward_rounded
                                : Icons.check_rounded,
                            size: 18,
                            color: Colors.white,
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Step 1: personal info ──────────────────────────────────────────────

  List<Widget> _gap(List<Widget> sections) => [
        for (var i = 0; i < sections.length; i++) ...[
          if (i > 0) const SizedBox(height: 14),
          sections[i],
        ],
      ];

  String? _err(TextEditingController c) =>
      _showErrors && c.text.trim().isEmpty ? 'Required' : null;

  List<Widget> _stepPersonal() {
    final numFmt = FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,1}'));
    return _gap([
      FormSection(
        icon: Icons.person_rounded,
        color: _indigo,
        title: 'Identity',
        subtitle: 'Name and contact',
        children: [
          Row(
            children: [
              Expanded(
                child: AppLabeledField(
                  label: 'First name *',
                  hintText: 'e.g. Karan',
                  icon: Icons.person_outline_rounded,
                  iconColor: _indigo,
                  controller: _first,
                  errorText: _err(_first),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => _refresh(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppLabeledField(
                  label: 'Last name *',
                  hintText: 'e.g. Reddy',
                  icon: Icons.person_outline_rounded,
                  iconColor: _indigo,
                  controller: _last,
                  errorText: _err(_last),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => _refresh(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Phone *',
            hintText: 'e.g. 9876543210',
            icon: Icons.call_rounded,
            iconColor: _teal,
            controller: _phone,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Email',
            hintText: 'member@example.com',
            icon: Icons.alternate_email_rounded,
            iconColor: _teal,
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Member ID (optional)',
            hintText: 'Auto-generated if left blank',
            icon: Icons.badge_rounded,
            iconColor: _indigo,
            controller: _memberId,
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.next,
          ),
        ],
      ),
      FormSection(
        icon: Icons.cake_rounded,
        color: _violet,
        title: 'About',
        subtitle: 'Gender, birthday and work',
        children: [
          _ChipGroup(
            label: 'Gender',
            icon: Icons.wc_rounded,
            color: _violet,
            options: _genders,
            value: _gender,
            onChanged: (v) => setState(() => _gender = v),
          ),
          const SizedBox(height: 14),
          _DateField(
            label: _age == null
                ? 'Date of birth'
                : 'Date of birth · $_age years old',
            icon: Icons.cake_rounded,
            iconColor: _violet,
            value: _dob,
            onTap: () async {
              final now = DateTime.now();
              final d = await _pickDate(
                initial: _dob ?? DateTime(now.year - 25, now.month, now.day),
                first: DateTime(1900),
                last: now,
              );
              if (d != null) setState(() => _dob = d);
            },
          ),
          const SizedBox(height: 14),
          _DateField(
            label: 'Date of joining *',
            icon: Icons.event_available_rounded,
            iconColor: _green,
            value: _joining,
            onTap: () async {
              final d = await _pickDate(
                initial: _joining,
                first: DateTime.now().subtract(const Duration(days: 365 * 5)),
                last: DateTime.now().add(const Duration(days: 365)),
              );
              if (d != null) setState(() => _joining = d);
            },
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Occupation',
            hintText: 'e.g. Software engineer',
            icon: Icons.work_rounded,
            iconColor: _amber,
            controller: _occupation,
            textCapitalization: TextCapitalization.words,
          ),
        ],
      ),
      FormSection(
        icon: Icons.storefront_rounded,
        color: _teal,
        title: 'Branch & trainer',
        subtitle: 'Where they train and with whom',
        children: [
          _ChipGroup(
            label: 'Branch *',
            icon: Icons.location_on_rounded,
            color: _teal,
            options: [for (final b in _branches) (b.id, b.name)],
            value: _branchId,
            allowClear: false,
            onChanged: (v) => setState(() => _branchId = v),
          ),
          if (_trainers.isNotEmpty) ...[
            const SizedBox(height: 14),
            _ChipGroup(
              label: 'Trainer (optional)',
              icon: Icons.sports_gymnastics_rounded,
              color: _teal,
              options: [for (final t in _trainers) (t.id, t.name)],
              value: _trainerId,
              onChanged: (v) => setState(() => _trainerId = v),
            ),
          ],
        ],
      ),
      FormSection(
        icon: Icons.home_rounded,
        color: _amber,
        title: 'Address',
        subtitle: 'Where this member lives',
        children: [
          AppLabeledField(
            label: 'Address line',
            hintText: 'Street, building, area',
            icon: Icons.home_rounded,
            iconColor: _amber,
            controller: _address,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppLabeledField(
                  label: 'City',
                  hintText: 'e.g. Mumbai',
                  icon: Icons.location_city_rounded,
                  iconColor: _amber,
                  controller: _city,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppLabeledField(
                  label: 'State',
                  hintText: 'e.g. Maharashtra',
                  icon: Icons.map_rounded,
                  iconColor: _amber,
                  controller: _state,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: AppLabeledField(
                  label: 'Country',
                  icon: Icons.public_rounded,
                  iconColor: _amber,
                  controller: _country,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppLabeledField(
                  label: 'Postal code',
                  hintText: 'e.g. 400001',
                  icon: Icons.markunread_mailbox_rounded,
                  iconColor: _amber,
                  controller: _postal,
                  keyboardType: TextInputType.number,
                ),
              ),
            ],
          ),
        ],
      ),
      FormSection(
        icon: Icons.monitor_weight_rounded,
        color: _rose,
        title: 'Body & goals',
        subtitle: 'Measurements, goal and lifestyle',
        children: [
          Row(
            children: [
              Expanded(
                child: AppLabeledField(
                  label: 'Height (cm)',
                  hintText: 'e.g. 175',
                  icon: Icons.height_rounded,
                  iconColor: _rose,
                  controller: _height,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [numFmt],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: AppLabeledField(
                  label: 'Weight (kg)',
                  hintText: 'e.g. 70',
                  icon: Icons.monitor_weight_rounded,
                  iconColor: _rose,
                  controller: _weight,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [numFmt],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _ChipGroup(
            label: 'Goal',
            icon: Icons.flag_rounded,
            color: _rose,
            options: _goals,
            value: _goal,
            onChanged: (v) => setState(() => _goal = v),
          ),
          const SizedBox(height: 14),
          _ChipGroup(
            label: 'Body type',
            icon: Icons.accessibility_new_rounded,
            color: _rose,
            options: _bodyTypes,
            value: _bodyType,
            onChanged: (v) => setState(() => _bodyType = v),
          ),
          const SizedBox(height: 14),
          _ChipGroup(
            label: 'Food preference',
            icon: Icons.restaurant_rounded,
            color: _rose,
            options: _foods,
            value: _food,
            onChanged: (v) => setState(() => _food = v),
          ),
        ],
      ),
      FormSection(
        icon: Icons.family_restroom_rounded,
        color: _violet,
        title: 'Family & occasions',
        subtitle: 'Optional personal details',
        children: [
          AppLabeledField(
            label: "Father's name / Aadhaar no.",
            hintText: 'e.g. Rajesh Sharma',
            icon: Icons.family_restroom_rounded,
            iconColor: _violet,
            controller: _father,
          ),
          const SizedBox(height: 14),
          _ChipGroup(
            label: 'Marital status',
            icon: Icons.favorite_rounded,
            color: _violet,
            options: _maritals,
            value: _marital,
            onChanged: (v) => setState(() => _marital = v),
          ),
          const SizedBox(height: 14),
          _DateField(
            label: 'Anniversary',
            icon: Icons.celebration_rounded,
            iconColor: _amber,
            value: _anniversary,
            onTap: () async {
              final d = await _pickDate(
                initial: _anniversary ?? DateTime.now(),
                first: DateTime(1950),
                last: DateTime(DateTime.now().year + 1),
              );
              if (d != null) setState(() => _anniversary = d);
            },
          ),
        ],
      ),
      _programSection(),
    ]);
  }

  Widget _programSection() {
    return FormSection(
      icon: Icons.card_membership_rounded,
      color: _green,
      title: 'Membership program',
      subtitle: 'Optional — pick a plan now or later',
      children: [
        _PlanTile(
          title: 'No plan yet',
          subtitle: 'Assign one later from the member page',
          price: null,
          selected: _planId == null,
          onTap: () => setState(() => _planId = null),
        ),
        for (final p in _plans) ...[
          const SizedBox(height: 8),
          _PlanTile(
            title: p.name,
            subtitle: '${p.durationLabel} · ${p.perksSummary}',
            price: _money(p.finalPrice),
            selected: _planId == p.id,
            onTap: () => setState(() {
              _planId = p.id;
              _amount.clear();
            }),
          ),
        ],
        if (_planId != null) ...[
          const SizedBox(height: 14),
          _DateField(
            label: 'Plan start date',
            icon: Icons.event_rounded,
            iconColor: _green,
            value: _planStart,
            onTap: () async {
              final d = await _pickDate(
                initial: _planStart,
                first: DateTime.now().subtract(const Duration(days: 30)),
                last: DateTime.now().add(const Duration(days: 365)),
              );
              if (d != null) setState(() => _planStart = d);
            },
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Target weight (kg)',
            hintText: 'e.g. 70',
            icon: Icons.track_changes_rounded,
            iconColor: _green,
            controller: _targetWeight,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ],
        const SizedBox(height: 14),
        AppLabeledField(
          label: 'Registration fee',
          hintText: 'e.g. 500',
          icon: Icons.payments_rounded,
          iconColor: _amber,
          controller: _regFee,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
        ),
      ],
    );
  }

  // ── Step 2: health ─────────────────────────────────────────────────────

  List<Widget> _stepHealth() {
    return _gap([
      FormSection(
        icon: Icons.favorite_rounded,
        color: _rose,
        title: 'Health screening',
        subtitle: 'Answer honestly — it keeps training safe',
        children: [
          for (var i = 0; i < _healthQuestions.length; i++) ...[
            if (i > 0) Divider(height: 22, color: AppColors.line),
            _YesNoRow(
              question: _healthQuestions[i].$2,
              value: _health[_healthQuestions[i].$1] ?? false,
              onChanged: (v) =>
                  setState(() => _health[_healthQuestions[i].$1] = v),
            ),
          ],
        ],
      ),
      FormSection(
        icon: Icons.assignment_ind_rounded,
        color: _teal,
        title: 'More details',
        subtitle: 'Blood group, how they found us, referral',
        children: [
          OptionPickerField(
            label: 'Blood group',
            icon: Icons.bloodtype_rounded,
            iconColor: _rose,
            options: _bloodGroups,
            value: _blood,
            onChanged: (v) => setState(() => _blood = v),
          ),
          const SizedBox(height: 14),
          OptionPickerField(
            label: 'How did you get to know about the gym?',
            icon: Icons.campaign_rounded,
            iconColor: _amber,
            options: _awarenessOptions,
            value: _awarenessSource,
            onChanged: (v) => setState(() => _awarenessSource = v),
          ),
          const SizedBox(height: 14),
          Text(
            'Reference (referred by an existing member)',
            style: AppText.eyebrow(),
          ),
          const SizedBox(height: 6),
          _referredId == null
              ? GestureDetector(
                  onTap: _pickReferrer,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface2,
                      borderRadius: BorderRadius.circular(AppRadii.field),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.group_add_rounded,
                          size: 18,
                          color: _violet,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Search a member who referred this person…',
                            style: AppText.body(
                              size: 13.5,
                              weight: FontWeight.w600,
                              color: AppColors.inkFaint,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: _violet.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(AppRadii.field),
                    border: Border.all(color: _violet.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.verified_user_rounded,
                        size: 18,
                        color: _violet,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          _referredLabel ?? '',
                          style:
                              AppText.body(size: 13, weight: FontWeight.w700),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => setState(() {
                          _referredId = null;
                          _referredLabel = null;
                        }),
                        child: Icon(
                          Icons.close_rounded,
                          size: 18,
                          color: AppColors.inkFaint,
                        ),
                      ),
                    ],
                  ),
                ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Other details',
            hintText: 'Anything else staff should know',
            icon: Icons.notes_rounded,
            iconColor: _teal,
            controller: _otherDetails,
            minLines: 3,
            maxLines: 6,
          ),
        ],
      ),
    ]);
  }

  Future<void> _pickReferrer() async {
    final picked = await showModalBottomSheet<GymMember>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface2,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(AppRadii.card)),
      ),
      builder: (_) => const _ReferrerSheet(),
    );
    if (picked == null) return;
    setState(() {
      _referredId = picked.id;
      _referredLabel = '${picked.name} (${picked.memberId})';
    });
  }

  // ── Step 3: payment ────────────────────────────────────────────────────

  List<Widget> _stepPayment() {
    final plan = _plan;
    final total = _totalDue;
    final exceeds = _num(_amount) > total + 0.005;
    final balance = (total - _num(_amount)).clamp(0, double.infinity);
    return _gap([
      _summaryCard(plan, total),
      FormSection(
        icon: Icons.account_balance_wallet_rounded,
        color: _green,
        title: 'Payment received',
        subtitle: 'Record what the member pays today',
        children: [
          AppLabeledField(
            label: 'Amount received',
            hintText: '0',
            icon: Icons.currency_rupee_rounded,
            iconColor: _green,
            controller: _amount,
            errorText: exceeds
                ? 'Cannot exceed the total due of ${_money(total)}.'
                : null,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (total > 0)
                _QuickChip(
                  label: 'Full ${_money(total)}',
                  onTap: () => _amount.text = total.toStringAsFixed(2),
                ),
              if (total > 0)
                _QuickChip(
                  label: 'Half',
                  onTap: () => _amount.text = (total / 2).toStringAsFixed(2),
                ),
              _QuickChip(label: 'Pay later', onTap: () => _amount.text = '0'),
            ],
          ),
          const SizedBox(height: 14),
          AppLabeledField(
            label: 'Discount allowed',
            hintText: '0',
            icon: Icons.local_offer_rounded,
            iconColor: _amber,
            controller: _discount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
          const SizedBox(height: 14),
          Text('Transaction mode', style: AppText.eyebrow()),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 3.1,
            children: [
              for (final m in _methods)
                GestureDetector(
                  onTap: () => setState(() => _method = m.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(14),
                      color: _method == m.$1
                          ? m.$4.withValues(alpha: 0.14)
                          : AppColors.surface2,
                      border: Border.all(
                        color: _method == m.$1 ? m.$4 : AppColors.line,
                        width: _method == m.$1 ? 1.6 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(m.$3, size: 17, color: m.$4),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            m.$2,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (_method == m.$1)
                          Icon(
                            Icons.check_circle_rounded,
                            size: 16,
                            color: m.$4,
                          ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (_num(_amount) > 0 || total > 0) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: (balance > 0 ? _amber : _green).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Icon(
                    balance > 0
                        ? Icons.hourglass_bottom_rounded
                        : Icons.verified_rounded,
                    size: 18,
                    color: balance > 0 ? _amber : _green,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      balance > 0
                          ? 'Balance due after this payment: ${_money(balance.toDouble())}'
                          : 'Fully paid',
                      style: AppText.body(size: 12.5, weight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    ]);
  }

  Widget _summaryCard(MembershipPlan? plan, double total) {
    String? branch;
    for (final b in _branches) {
      if (b.id == _branchId) branch = b.name;
    }
    final rows = <(String, double, bool)>[
      if (plan != null)
        ('${plan.name} · ${plan.durationLabel}', plan.price, false),
      if (plan != null && plan.discountAmount > 0)
        (
          'Plan discount (${plan.discountPercentage.toStringAsFixed(0)}%)',
          plan.discountAmount,
          true,
        ),
      if (plan != null && plan.taxAmount > 0)
        (
          'Tax (${plan.taxPercentage.toStringAsFixed(0)}%)',
          plan.taxAmount,
          false,
        ),
      if (plan != null && plan.joiningFee > 0)
        ('Joining fee', plan.joiningFee, false),
      if (_num(_regFee) > 0) ('Registration fee', _num(_regFee), false),
      if (_num(_discount) > 0) ('Discount allowed', _num(_discount), true),
    ];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
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
            'SUMMARY',
            style: AppText.body(
              size: 10.5,
              weight: FontWeight.w800,
              color: Colors.white.withValues(alpha: 0.75),
            ).copyWith(letterSpacing: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            '${_first.text.trim()} ${_last.text.trim()}'.trim(),
            style: AppText.display(size: 20, color: Colors.white),
          ),
          Text(
            [if (branch != null) branch, plan?.name ?? 'No plan selected']
                .join(' · '),
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: Colors.white.withValues(alpha: 0.85),
            ),
          ),
          if (rows.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        r.$1,
                        style: AppText.body(
                          size: 12.5,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                      ),
                    ),
                    Text(
                      r.$3 ? '− ${_money(r.$2)}' : _money(r.$2),
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
          ],
          const Divider(height: 22, color: Colors.white30),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Total due',
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
              CountUp(
                value: total.clamp(0, double.infinity),
                prefix: AppCurrency.symbol,
                style: AppText.display(size: 26, color: Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── small widgets ──────────────────────────────────────────────────────────

class _ChipGroup extends StatelessWidget {
  const _ChipGroup({
    required this.label,
    required this.icon,
    required this.color,
    required this.options,
    required this.value,
    required this.onChanged,
    this.allowClear = true,
  });

  final String label;
  final IconData icon;
  final Color color;
  final List<(String, String)> options;
  final String? value;
  final ValueChanged<String?> onChanged;
  final bool allowClear;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 6),
            Text(label, style: AppText.eyebrow()),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final o in options)
              GestureDetector(
                onTap: () =>
                    onChanged(o.$1 == value && allowClear ? null : o.$1),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    color: o.$1 == value
                        ? color.withValues(alpha: 0.18)
                        : AppColors.surface2,
                    border: Border.all(
                      color: o.$1 == value ? color : AppColors.line,
                      width: o.$1 == value ? 1.5 : 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (o.$1 == value) ...[
                        Icon(Icons.check_rounded, size: 14, color: color),
                        const SizedBox(width: 4),
                      ],
                      Text(
                        o.$2,
                        style: AppText.body(
                          size: 12,
                          weight: FontWeight.w700,
                          color: o.$1 == value ? color : AppColors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile({
    required this.title,
    required this.subtitle,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String? price;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: selected
              ? LinearGradient(
                  colors: [
                    _green.withValues(alpha: 0.2),
                    _teal.withValues(alpha: 0.06),
                  ],
                )
              : null,
          color: selected ? null : AppColors.surface2,
          border: Border.all(
            color: selected ? _green : AppColors.line,
            width: selected ? 1.6 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? _green : Colors.transparent,
                border: Border.all(
                  color: selected ? _green : AppColors.inkFaint,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? const Icon(
                      Icons.check_rounded,
                      size: 14,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppText.body(size: 13.5, weight: FontWeight.w800),
                  ),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(size: 11, color: AppColors.inkFaint),
                  ),
                ],
              ),
            ),
            if (price != null)
              Text(price!, style: AppText.display(size: 15, color: _green)),
          ],
        ),
      ),
    );
  }
}

class _YesNoRow extends StatelessWidget {
  const _YesNoRow({
    required this.question,
    required this.value,
    required this.onChanged,
  });

  final String question;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget seg(String label, bool v, Color c) => Expanded(
          child: GestureDetector(
            onTap: () => onChanged(v),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              padding: const EdgeInsets.symmetric(vertical: 9),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color:
                    value == v ? c.withValues(alpha: 0.18) : AppColors.surface2,
                border: Border.all(
                  color: value == v ? c : AppColors.line,
                  width: value == v ? 1.5 : 1,
                ),
              ),
              child: Text(
                label,
                style: AppText.body(
                  size: 12.5,
                  weight: FontWeight.w800,
                  color: value == v ? c : AppColors.inkSoft,
                ),
              ),
            ),
          ),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(question, style: AppText.body(size: 13, weight: FontWeight.w600)),
        const SizedBox(height: 8),
        Row(
          children: [
            seg('No', false, _green),
            const SizedBox(width: 8),
            seg('Yes', true, _rose),
          ],
        ),
      ],
    );
  }
}

class _QuickChip extends StatelessWidget {
  const _QuickChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: _green.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: _green.withValues(alpha: 0.35)),
        ),
        child: Text(
          label,
          style: AppText.body(size: 12, weight: FontWeight.w700, color: _green),
        ),
      ),
    );
  }
}

/// Read-only date field with a persistent controller (the text follows
/// [value]); tapping runs [onTap], which should call setState.
class _DateField extends StatefulWidget {
  const _DateField({
    required this.label,
    required this.icon,
    required this.iconColor,
    required this.value,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color iconColor;
  final DateTime? value;
  final Future<void> Function() onTap;

  @override
  State<_DateField> createState() => _DateFieldState();
}

class _DateFieldState extends State<_DateField> {
  late final TextEditingController _c = TextEditingController(text: _fmt());

  String _fmt() {
    final d = widget.value;
    if (d == null) return '';
    return '${d.day.toString().padLeft(2, '0')}/'
        '${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  void didUpdateWidget(_DateField old) {
    super.didUpdateWidget(old);
    _c.text = _fmt();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppLabeledField(
      label: widget.label,
      hintText: 'Select date',
      icon: widget.icon,
      iconColor: widget.iconColor,
      controller: _c,
      readOnly: true,
      onTap: widget.onTap,
      suffixIcon: Icon(
        Icons.calendar_month_rounded,
        size: 18,
        color: AppColors.inkFaint,
      ),
    );
  }
}

/// Search-as-you-type picker for "referred by an existing member".
class _ReferrerSheet extends StatefulWidget {
  const _ReferrerSheet();

  @override
  State<_ReferrerSheet> createState() => _ReferrerSheetState();
}

class _ReferrerSheetState extends State<_ReferrerSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<GymMember> _results = [];
  bool _busy = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      setState(() => _busy = true);
      try {
        final res = await getIt<MemberRepository>().list(
          search: q.trim(),
          limit: 10,
        );
        if (mounted) setState(() => _results = res.items);
      } on ApiException {
        if (mounted) setState(() => _results = []);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.75,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 10),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(9),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
              child: AppLabeledField(
                label: 'Search member',
                hintText: 'Name, member ID or phone',
                icon: Icons.search_rounded,
                iconColor: _violet,
                controller: _controller,
                autofocus: true,
                onChanged: _onChanged,
              ),
            ),
            if (_busy)
              const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
                children: [
                  for (final m in _results)
                    ListTile(
                      leading: UserAvatar(
                        avatarUrl: m.profilePhotoUrl,
                        name: m.name,
                        size: 40,
                      ),
                      title: Text(m.name),
                      subtitle: Text(m.memberId),
                      onTap: () => Navigator.of(context).pop(m),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
