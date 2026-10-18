import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch_option.dart';
import '../../../models/membership_plan.dart';
import '../../../repositories/branch_repository.dart';
import '../../../repositories/membership_plan_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'plan_ui.dart';

final _codeRe = RegExp(r'^[A-Za-z0-9-]+$');
final _moneyFilter =
    FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}'));

const _durationPresets = [
  ('1:MONTHS', '1 month'),
  ('3:MONTHS', '3 months'),
  ('6:MONTHS', '6 months'),
  ('1:YEARS', '1 year'),
];

/// Add / edit a membership plan (`POST /membership-plans`,
/// `PATCH /membership-plans/:id`) with every field web's plan form has: name,
/// plan code, category, display order, description, notes, duration (value +
/// type), price, registration fee, tax %, discount %, PT sessions, group
/// classes, guest passes, diet consultation, locker, freeze (+ day limit) and
/// branch access (all branches, or a chosen set — web's form can only toggle
/// "all branches", the API also takes `accessBranchIds`).
///
/// **Add** is a 4-step wizard (Basics -> Pricing -> Features & access ->
/// Review, with a live price breakdown and a completeness ring); **Edit** is
/// one page of the same sections under a gradient banner. On wide screens the
/// live price summary sits beside the form instead of inside the steps.
///
/// Edit sends **only the keys that changed** (`updateMembershipPlanSchema`
/// treats an absent key as "leave alone" and rejects an empty body).
/// Description / category / notes / freeze limit can be cleared (nullable on
/// PATCH); the plan code can't (blank = unchanged). Create also offers a
/// "start as active" switch (the schema's `isActive`; web always creates
/// active). On a successful **create** the screen pops with the new plan id so
/// the list can open it; on edit it pops with null.
class MembershipPlanFormScreen extends StatefulWidget {
  const MembershipPlanFormScreen({super.key, this.plan});

  final MembershipPlan? plan;

  bool get isEdit => plan != null;

  @override
  State<MembershipPlanFormScreen> createState() =>
      _MembershipPlanFormScreenState();
}

class _MembershipPlanFormScreenState extends State<MembershipPlanFormScreen> {
  static const _stepNames = ['Basics', 'Pricing', 'Features', 'Review'];
  static const _stepIcons = [
    Icons.badge_rounded,
    Icons.sell_rounded,
    Icons.checklist_rounded,
    Icons.rocket_launch_rounded,
  ];

  MembershipPlan? get _p => widget.plan;
  bool get _isEdit => _p != null;

  static String _money(double v) =>
      v == 0 ? '' : (v == v.roundToDouble() ? v.toStringAsFixed(0) : '$v');

  late final _name = TextEditingController(text: _p?.name ?? '');
  late final _code = TextEditingController(text: _p?.planCode ?? '');
  late final _category = TextEditingController(text: _p?.category ?? '');
  late final _order = TextEditingController(text: '${_p?.displayOrder ?? 0}');
  late final _description = TextEditingController(text: _p?.description ?? '');
  late final _notes = TextEditingController(text: _p?.notes ?? '');
  late final _duration =
      TextEditingController(text: '${_p?.durationValue ?? 1}');
  late final _price = TextEditingController(
    text: _p == null ? '' : _money(_p!.price),
  );
  late final _joining = TextEditingController(
    text: _p == null ? '' : _money(_p!.joiningFee),
  );
  late final _tax = TextEditingController(
    text: _p == null ? '' : _money(_p!.taxPercentage),
  );
  late final _discount = TextEditingController(
    text: _p == null ? '' : _money(_p!.discountPercentage),
  );
  late final _pt =
      TextEditingController(text: '${_p?.ptSessionsIncluded ?? 0}');
  late final _group =
      TextEditingController(text: '${_p?.groupClassesIncluded ?? 0}');
  late final _guest = TextEditingController(text: '${_p?.guestPasses ?? 0}');
  late final _freezeLimit = TextEditingController(
    text: _p?.freezeDaysLimit?.toString() ?? '',
  );

  late MembershipDurationType _durationType =
      _p?.durationType ?? MembershipDurationType.months;
  late bool _allBranches = _p?.gymAccessAllBranches ?? true;
  late final Set<String> _branchIds = {...?_p?.accessBranchIds};
  late bool _diet = _p?.dietConsultationIncluded ?? false;
  late bool _locker = _p?.lockerAccess ?? false;
  late bool _freeze = _p?.freezeAllowed ?? true;
  bool _startActive = true;

  List<BranchOption> _branches = const [];
  bool _branchesLoaded = false;

  int _step = 0;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBranches();
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _code,
      _category,
      _order,
      _description,
      _notes,
      _duration,
      _price,
      _joining,
      _tax,
      _discount,
      _pt,
      _group,
      _guest,
      _freezeLimit,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Branch options for the access picker (`GET /branches/assignable`, needs
  /// `branches:view`). Without it the picker explains itself and an existing
  /// selection is preserved as-is.
  Future<void> _loadBranches() async {
    try {
      final b = await getIt<BranchRepository>().assignable();
      if (!mounted) return;
      setState(() {
        _branches = b;
        _branchesLoaded = true;
      });
    } catch (_) {
      if (mounted) setState(() => _branchesLoaded = false);
    }
  }

  // ── parsing + validation ──────────────────────────────────────────────────

  String _t(TextEditingController c) => c.text.trim();
  int? _intOf(TextEditingController c) => int.tryParse(_t(c));
  double? _numOf(TextEditingController c) => double.tryParse(_t(c));
  double _num0(TextEditingController c) => _numOf(c) ?? 0;

  PlanPriceBreakdown get _breakdown => PlanPriceBreakdown(
        basePrice: _num0(_price),
        discountPercentage: _num0(_discount).clamp(0, 100).toDouble(),
        taxPercentage: _num0(_tax).clamp(0, 100).toDouble(),
        joiningFee: _num0(_joining),
      );

  /// The plan as currently typed (for the review step's perk preview).
  MembershipPlan _draft() => MembershipPlan(
        id: _p?.id ?? 'draft',
        name: _t(_name),
        planCode: _t(_code),
        description: _t(_description).isEmpty ? null : _t(_description),
        category: _t(_category).isEmpty ? null : _t(_category),
        durationValue: _intOf(_duration) ?? 1,
        durationType: _durationType,
        price: _num0(_price),
        joiningFee: _num0(_joining),
        taxPercentage: _num0(_tax),
        discountPercentage: _num0(_discount),
        isActive: _isEdit ? _p!.isActive : _startActive,
        displayOrder: _intOf(_order) ?? 0,
        notes: _t(_notes).isEmpty ? null : _t(_notes),
        gymAccessAllBranches: _allBranches,
        accessBranchIds: _allBranches ? const [] : _branchIds.toList(),
        ptSessionsIncluded: _intOf(_pt) ?? 0,
        groupClassesIncluded: _intOf(_group) ?? 0,
        dietConsultationIncluded: _diet,
        lockerAccess: _locker,
        guestPasses: _intOf(_guest) ?? 0,
        freezeAllowed: _freeze,
        freezeDaysLimit: _freeze ? _intOf(_freezeLimit) : null,
        memberCount: _p?.memberCount ?? 0,
        deletedAt: null,
      );

  /// First problem on [step], or null. Mirrors the server's zod limits.
  String? _validateStep(int step) {
    switch (step) {
      case 0:
        if (_t(_name).isEmpty) return 'Plan name is required.';
        if (_t(_name).length > 120) {
          return 'Plan name is limited to 120 characters.';
        }
        final code = _t(_code);
        if (code.isNotEmpty && (code.length > 40 || !_codeRe.hasMatch(code))) {
          return 'Plan code may only contain letters, numbers and hyphens '
              '(max 40).';
        }
        if (_t(_category).length > 60) {
          return 'Category is limited to 60 characters.';
        }
        final order = _intOf(_order);
        if (_t(_order).isNotEmpty &&
            (order == null || order < 0 || order > 100000)) {
          return 'Display order must be a whole number from 0 to 100,000.';
        }
        if (_t(_description).length > 2000 || _t(_notes).length > 2000) {
          return 'Description and notes are limited to 2000 characters.';
        }
      case 1:
        final d = _intOf(_duration);
        if (d == null || d < 1 || d > 999) {
          return 'Duration must be a whole number from 1 to 999.';
        }
        final price = _numOf(_price);
        if (price == null) return 'Enter the plan price.';
        if (price < 0 || price > 999999.99) {
          return 'Price must be between 0 and 999,999.99.';
        }
        final fee = _numOf(_joining);
        if (_t(_joining).isNotEmpty &&
            (fee == null || fee < 0 || fee > 999999.99)) {
          return 'Registration fee must be between 0 and 999,999.99.';
        }
        for (final (label, c) in [('Tax', _tax), ('Discount', _discount)]) {
          final v = _numOf(c);
          if (_t(c).isNotEmpty && (v == null || v < 0 || v > 100)) {
            return '$label must be a percentage from 0 to 100.';
          }
        }
      case 2:
        for (final (label, c, max) in [
          ('PT sessions', _pt, 1000),
          ('Group classes', _group, 1000),
          ('Guest passes', _guest, 100),
        ]) {
          final v = _intOf(c);
          if (_t(c).isNotEmpty && (v == null || v < 0 || v > max)) {
            return '$label must be a whole number from 0 to $max.';
          }
        }
        if (_freeze && _t(_freezeLimit).isNotEmpty) {
          final v = _intOf(_freezeLimit);
          if (v == null || v < 0 || v > 3650) {
            return 'Freeze days limit must be a whole number from 0 to 3650.';
          }
        }
        if (!_allBranches && _branchIds.isEmpty) {
          return 'Pick at least one branch, or switch on "All branches".';
        }
    }
    return null;
  }

  Map<String, dynamic> _createBody() {
    final body = <String, dynamic>{
      'name': _t(_name),
      'durationValue': _intOf(_duration),
      'durationType': _durationType.apiValue,
      'price': _num0(_price),
      'joiningFee': _num0(_joining),
      'taxPercentage': _num0(_tax),
      'discountPercentage': _num0(_discount),
      'displayOrder': _intOf(_order) ?? 0,
      'isActive': _startActive,
      'gymAccessAllBranches': _allBranches,
      if (!_allBranches) 'accessBranchIds': _branchIds.toList(),
      'ptSessionsIncluded': _intOf(_pt) ?? 0,
      'groupClassesIncluded': _intOf(_group) ?? 0,
      'dietConsultationIncluded': _diet,
      'lockerAccess': _locker,
      'guestPasses': _intOf(_guest) ?? 0,
      'freezeAllowed': _freeze,
    };
    void put(String key, TextEditingController c) {
      if (_t(c).isNotEmpty) body[key] = _t(c);
    }

    put('planCode', _code);
    put('category', _category);
    put('description', _description);
    put('notes', _notes);
    final limit = _intOf(_freezeLimit);
    if (_freeze && limit != null) body['freezeDaysLimit'] = limit;
    return body;
  }

  Map<String, dynamic> _editBody() {
    final p = _p!;
    final body = <String, dynamic>{};
    bool differs(double a, double b) => (a - b).abs() > 0.0001;

    if (_t(_name) != p.name) body['name'] = _t(_name);
    // The code can't be cleared (PATCH: optional, not nullable) - blank keeps it.
    if (_t(_code).isNotEmpty && _t(_code) != p.planCode) {
      body['planCode'] = _t(_code);
    }
    void nullable(String key, TextEditingController c, String? old) {
      final now = _t(c);
      if (now != (old ?? '')) body[key] = now.isEmpty ? null : now;
    }

    nullable('description', _description, p.description);
    nullable('category', _category, p.category);
    nullable('notes', _notes, p.notes);

    final dur = _intOf(_duration);
    if (dur != null && dur != p.durationValue) body['durationValue'] = dur;
    if (_durationType != p.durationType) {
      body['durationType'] = _durationType.apiValue;
    }
    if (differs(_num0(_price), p.price)) body['price'] = _num0(_price);
    if (differs(_num0(_joining), p.joiningFee)) {
      body['joiningFee'] = _num0(_joining);
    }
    if (differs(_num0(_tax), p.taxPercentage)) {
      body['taxPercentage'] = _num0(_tax);
    }
    if (differs(_num0(_discount), p.discountPercentage)) {
      body['discountPercentage'] = _num0(_discount);
    }
    final order = _intOf(_order) ?? 0;
    if (order != p.displayOrder) body['displayOrder'] = order;

    if (_allBranches != p.gymAccessAllBranches) {
      body['gymAccessAllBranches'] = _allBranches;
    }
    if (!_allBranches) {
      final before = p.accessBranchIds.toSet();
      if (_allBranches != p.gymAccessAllBranches ||
          before.length != _branchIds.length ||
          !before.containsAll(_branchIds)) {
        body['accessBranchIds'] = _branchIds.toList();
      }
    }
    void count(String key, TextEditingController c, int old) {
      final v = _intOf(c) ?? 0;
      if (v != old) body[key] = v;
    }

    count('ptSessionsIncluded', _pt, p.ptSessionsIncluded);
    count('groupClassesIncluded', _group, p.groupClassesIncluded);
    count('guestPasses', _guest, p.guestPasses);
    if (_diet != p.dietConsultationIncluded) {
      body['dietConsultationIncluded'] = _diet;
    }
    if (_locker != p.lockerAccess) body['lockerAccess'] = _locker;
    if (_freeze != p.freezeAllowed) body['freezeAllowed'] = _freeze;
    // Null clears the cap ("no limit"); it is only meaningful while freezing
    // is allowed.
    final limit = _freeze ? _intOf(_freezeLimit) : null;
    if (limit != p.freezeDaysLimit) body['freezeDaysLimit'] = limit;
    return body;
  }

  // ── actions ───────────────────────────────────────────────────────────────

  void _next() {
    final err = _validateStep(_step);
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
    for (var s = 0; s < _stepNames.length - 1; s++) {
      final err = _validateStep(s);
      if (err != null) {
        setState(() {
          _error = err;
          if (!_isEdit) _step = s;
        });
        return;
      }
    }
    final Map<String, dynamic> body = _isEdit ? _editBody() : _createBody();
    if (_isEdit && body.isEmpty) {
      teamSnack(context, 'No changes to save.');
      context.pop();
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = getIt<MembershipPlanRepository>();
      final saved =
          _isEdit ? await repo.update(_p!.id, body) : await repo.create(body);
      if (!mounted) return;
      teamSnack(
        context,
        _isEdit ? 'Plan updated.' : '${saved.name} created.',
      );
      context.pop(_isEdit ? null : saved.id);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.detailedMessage);
    } catch (e) {
      // A parse failure after a successful save must not leave the spinner
      // running; say what happened.
      if (!mounted) return;
      setState(
        () => _error = 'Something went wrong while saving ($e). Check the '
            'plans list - the change may already have been applied.',
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  // ── fields ────────────────────────────────────────────────────────────────

  Widget _text(
    String label,
    TextEditingController c, {
    required IconData icon,
    required Color color,
    String? hint,
    TextInputType? keyboard,
    int maxLength = 120,
    TextCapitalization caps = TextCapitalization.none,
    ValueChanged<String>? onChanged,
    List<TextInputFormatter>? formatters,
  }) {
    return AppLabeledField(
      label: label,
      hintText: hint,
      icon: icon,
      iconColor: color,
      controller: c,
      keyboardType: keyboard,
      textCapitalization: caps,
      onChanged: onChanged,
      inputFormatters: [
        LengthLimitingTextInputFormatter(maxLength),
        ...?formatters,
      ],
    );
  }

  Widget _whole(
    String label,
    TextEditingController c,
    IconData icon,
    Color color, {
    String? hint,
    int maxLength = 7,
    ValueChanged<String>? onChanged,
  }) {
    return _text(
      label,
      c,
      icon: icon,
      color: color,
      hint: hint,
      keyboard: TextInputType.number,
      maxLength: maxLength,
      onChanged: onChanged,
      formatters: [FilteringTextInputFormatter.digitsOnly],
    );
  }

  Widget _decimal(
    String label,
    TextEditingController c,
    IconData icon,
    Color color, {
    String? hint,
  }) {
    return _text(
      label,
      c,
      icon: icon,
      color: color,
      hint: hint,
      keyboard: const TextInputType.numberWithOptions(decimal: true),
      maxLength: 10,
      onChanged: (_) => setState(() {}),
      formatters: [_moneyFilter],
    );
  }

  // ── sections ──────────────────────────────────────────────────────────────

  Widget _basics() => TeamFormSection(
        icon: Icons.badge_rounded,
        color: TeamColors.indigo,
        title: 'Plan information',
        subtitle: 'What members see when they pick a plan',
        children: [
          _text(
            'Plan name *',
            _name,
            icon: Icons.card_membership_rounded,
            color: TeamColors.indigo,
            hint: 'e.g. Quarterly Pro',
            caps: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
          ),
          _text(
            'Plan code',
            _code,
            icon: Icons.tag_rounded,
            color: TeamColors.violet,
            hint: _isEdit ? 'e.g. PLAN-0002' : 'Auto-generated if left blank',
            maxLength: 40,
            caps: TextCapitalization.characters,
          ),
          _text(
            'Category',
            _category,
            icon: Icons.sell_rounded,
            color: TeamColors.teal,
            hint: 'e.g. Premium',
            maxLength: 60,
            caps: TextCapitalization.words,
          ),
          _whole(
            'Display order',
            _order,
            Icons.format_list_numbered_rounded,
            TeamColors.amber,
            hint: 'Lower numbers come first',
            maxLength: 6,
          ),
          AppLabeledField(
            label: 'Description',
            hintText: 'A line or two about who this plan is for',
            icon: Icons.notes_rounded,
            iconColor: TeamColors.sky,
            controller: _description,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            inputFormatters: [LengthLimitingTextInputFormatter(2000)],
          ),
          AppLabeledField(
            label: 'Internal notes',
            hintText: 'Only staff see these',
            icon: Icons.sticky_note_2_rounded,
            iconColor: TeamColors.rose,
            controller: _notes,
            minLines: 2,
            maxLines: 5,
            textCapitalization: TextCapitalization.sentences,
            inputFormatters: [LengthLimitingTextInputFormatter(2000)],
          ),
        ],
      );

  Widget _pricing({required bool showSummary}) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TeamFormSection(
            icon: Icons.sell_rounded,
            color: TeamColors.amber,
            title: 'Duration & pricing',
            subtitle: 'Discount is applied first, then tax',
            children: [
              TeamChipGroup(
                label: 'Quick pick',
                icon: Icons.bolt_rounded,
                color: TeamColors.amber,
                options: _durationPresets,
                selected: {
                  '${_intOf(_duration)}:${_durationType.apiValue}',
                },
                onToggle: (v) {
                  final parts = v.split(':');
                  setState(() {
                    _duration.text = parts[0];
                    _durationType = MembershipDurationTypeX.fromApi(parts[1]);
                  });
                },
              ),
              _whole(
                'Duration *',
                _duration,
                Icons.timelapse_rounded,
                TeamColors.teal,
                hint: 'e.g. 3',
                maxLength: 3,
                onChanged: (_) => setState(() {}),
              ),
              OptionPickerField(
                label: 'Duration type',
                icon: Icons.calendar_view_week_rounded,
                iconColor: TeamColors.teal,
                options: [
                  for (final d in MembershipDurationType.values)
                    (d.apiValue, d.label),
                ],
                value: _durationType.apiValue,
                onChanged: (v) => setState(
                  () => _durationType = MembershipDurationTypeX.fromApi(v),
                ),
              ),
              _decimal(
                'Price *',
                _price,
                Icons.payments_rounded,
                TeamColors.green,
                hint: 'e.g. 4999',
              ),
              _decimal(
                'Registration fee',
                _joining,
                Icons.how_to_reg_rounded,
                TeamColors.rose,
                hint: 'One-off, optional',
              ),
              _decimal(
                'Discount %',
                _discount,
                Icons.local_offer_rounded,
                TeamColors.green,
                hint: '0 - 100',
              ),
              _decimal(
                'Tax %',
                _tax,
                Icons.account_balance_rounded,
                TeamColors.amber,
                hint: '0 - 100',
              ),
            ],
          ),
          if (showSummary) ...[
            const SizedBox(height: 14),
            _summary(),
          ],
        ],
      );

  Widget _summary() {
    final d = _draft();
    return PlanPriceCard(
      breakdown: _breakdown,
      name: d.name,
      durationLabel: d.durationLabel,
      perMonth: _breakdown.finalPrice <= 0
          ? null
          : (d.approxDays >= 30
              ? _breakdown.finalPrice / (d.approxDays / 30)
              : null),
    );
  }

  Widget _features() => TeamFormSection(
        icon: Icons.checklist_rounded,
        color: TeamColors.violet,
        title: 'Plan features',
        subtitle: 'What the plan includes',
        children: [
          _whole(
            'PT sessions included',
            _pt,
            Icons.sports_gymnastics_rounded,
            TeamColors.violet,
            hint: '0 = none',
            maxLength: 4,
            onChanged: (_) => setState(() {}),
          ),
          _whole(
            'Group classes included',
            _group,
            Icons.groups_rounded,
            TeamColors.teal,
            hint: '0 = none',
            maxLength: 4,
            onChanged: (_) => setState(() {}),
          ),
          _whole(
            'Guest passes',
            _guest,
            Icons.person_add_alt_1_rounded,
            TeamColors.rose,
            hint: '0 = none',
            maxLength: 3,
            onChanged: (_) => setState(() {}),
          ),
          TeamToggleRow(
            title: 'Diet consultation included',
            subtitle: 'A nutrition consult comes with the plan',
            icon: Icons.restaurant_rounded,
            color: TeamColors.green,
            value: _diet,
            onChanged: (v) => setState(() => _diet = v),
          ),
          TeamToggleRow(
            title: 'Locker access',
            subtitle: 'Members get a locker',
            icon: Icons.lock_rounded,
            color: TeamColors.amber,
            value: _locker,
            onChanged: (v) => setState(() => _locker = v),
          ),
          TeamToggleRow(
            title: 'Freeze allowed',
            subtitle: 'Members can pause the membership',
            icon: Icons.ac_unit_rounded,
            color: TeamColors.sky,
            value: _freeze,
            onChanged: (v) => setState(() => _freeze = v),
          ),
          if (_freeze)
            _whole(
              'Freeze days limit',
              _freezeLimit,
              Icons.event_busy_rounded,
              TeamColors.sky,
              hint: 'Blank = no cap',
              maxLength: 4,
              onChanged: (_) => setState(() {}),
            ),
        ],
      );

  /// Branch options plus any saved ids the (possibly failed) fetch didn't
  /// return, so an existing selection is never silently dropped.
  List<BranchOption> get _branchChoices {
    final known = {for (final b in _branches) b.id};
    return [
      ..._branches,
      for (final id in _branchIds)
        if (!known.contains(id))
          BranchOption(
            id: id,
            name: 'Branch ${id.substring(0, id.length < 8 ? id.length : 8)}',
          ),
    ];
  }

  Widget _access() => TeamFormSection(
        icon: Icons.storefront_rounded,
        color: TeamColors.teal,
        title: 'Branch access',
        subtitle: 'Where this plan can be used and sold',
        children: [
          TeamToggleRow(
            title: 'Gym access at all branches',
            subtitle: _allBranches
                ? 'Valid at every branch, including new ones'
                : 'Limited to the branches you tick below',
            icon: Icons.public_rounded,
            color: TeamColors.teal,
            value: _allBranches,
            onChanged: (v) => setState(() => _allBranches = v),
          ),
          if (!_allBranches)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!_branchesLoaded && _branchChoices.isEmpty)
                  Text(
                    "The branch list couldn't be loaded (it needs the "
                    'branches:view permission), so a branch-limited plan '
                    'cannot be edited here.',
                    style: AppText.body(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppColors.inkFaint,
                    ),
                  )
                else
                  for (final b in _branchChoices) ...[
                    TeamChoiceCard(
                      title: b.name,
                      icon: Icons.place_rounded,
                      color: TeamColors.teal,
                      multi: true,
                      selected: _branchIds.contains(b.id),
                      onTap: () => setState(() {
                        if (!_branchIds.add(b.id)) _branchIds.remove(b.id);
                      }),
                    ),
                    const SizedBox(height: 8),
                  ],
              ],
            ),
        ],
      );

  /// Review step: perk preview, active switch and the completeness ring.
  Widget _review() {
    final d = _draft();
    final checks = [
      ('Plan name', _t(_name).isNotEmpty),
      ('Duration', (_intOf(_duration) ?? 0) > 0),
      ('Price', _numOf(_price) != null),
      ('Category', _t(_category).isNotEmpty),
      ('Description', _t(_description).isNotEmpty),
      (
        'Something included',
        d.ptSessionsIncluded > 0 ||
            d.groupClassesIncluded > 0 ||
            d.dietConsultationIncluded ||
            d.lockerAccess ||
            d.guestPasses > 0,
      ),
    ];
    final ok = checks.where((c) => c.$2).length;
    final ratio = ok / checks.length;
    final names = {for (final b in _branchChoices) b.id: b.name};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TeamSectionCard(
          icon: Icons.checklist_rounded,
          color: TeamColors.green,
          title: 'Ready to create',
          subtitle: 'Only the name, duration and price are required',
          child: Row(
            children: [
              AnimatedRing(
                value: ratio,
                size: 84,
                stroke: 9,
                colors: const [TeamColors.green, TeamColors.teal],
                track: AppColors.surface3,
                child: Text(
                  '${(ratio * 100).round()}%',
                  style: AppText.display(size: 17, color: TeamColors.green),
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
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.fact_check_rounded,
          color: TeamColors.violet,
          title: "What's included",
          subtitle: planBranchAccess(d, names: names),
          child: Column(
            children: [
              for (final k in planPerks(d, branchNames: names))
                PlanPerkRow(perk: k),
            ],
          ),
        ),
        const SizedBox(height: 14),
        TeamSectionCard(
          icon: Icons.rocket_launch_rounded,
          color: TeamColors.indigo,
          title: 'Availability',
          child: TeamToggleRow(
            title: 'Start as active',
            subtitle: _startActive
                ? 'Can be assigned to members straight away'
                : 'Saved as an inactive draft until you activate it',
            icon: Icons.play_circle_rounded,
            color: TeamColors.green,
            value: _startActive,
            onChanged: (v) => setState(() => _startActive = v),
          ),
        ),
      ],
    );
  }

  // ── layout ────────────────────────────────────────────────────────────────

  bool get _wide => MediaQuery.sizeOf(context).width >= 900;

  /// [main] on the left; the live price summary on the right when wide.
  Widget _withSummary(Widget main) {
    if (!_wide) return main;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: main),
        const SizedBox(width: 16),
        SizedBox(width: 340, child: _summary()),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isEdit) return _editPage();
    return _wizardPage();
  }

  Widget _editPage() {
    final p = _p!;
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('Edit plan'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PlanBanner(
              top: top,
              name: _t(_name).isEmpty ? p.name : _t(_name),
              subtitle: '${p.planCode} · ${p.memberCount} '
                  '${p.memberCount == 1 ? 'member' : 'members'} on this plan',
              chip: 'Editing plan',
              chipIcon: Icons.edit_rounded,
            ),
            TeamCenter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null) ...[
                      FormAlert(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    _withSummary(
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _basics(),
                          const SizedBox(height: 14),
                          _pricing(showSummary: !_wide),
                          const SizedBox(height: 14),
                          _features(),
                          const SizedBox(height: 14),
                          _access(),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    TeamGradientButton(
                      label: 'Save changes',
                      icon: Icons.check_rounded,
                      loading: _saving,
                      onTap: _submit,
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

  Widget _wizardPage() {
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final last = _step == _stepNames.length - 1;
    final stepBody = switch (_step) {
      0 => _basics(),
      1 => _pricing(showSummary: !_wide),
      2 => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [_features(), const SizedBox(height: 14), _access()],
        ),
      _ => _review(),
    };
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New plan'),
      ),
      bottomNavigationBar: TeamBottomBar(
        child: Row(
          children: [
            if (_step > 0) ...[
              Expanded(
                flex: 2,
                child: TeamOutlineButton(
                  label: 'Back',
                  icon: Icons.arrow_back_rounded,
                  onTap: _saving ? null : _back,
                ),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              flex: 3,
              child: TeamGradientButton(
                label: last ? 'Create plan' : 'Next',
                icon: last ? Icons.check_rounded : Icons.arrow_forward_rounded,
                loading: _saving,
                gradient: last ? TeamColors.ctaGreen : TeamColors.cta,
                onTap: last ? _submit : _next,
              ),
            ),
          ],
        ),
      ),
      body: ListView(
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
                  _step == 3 && !_wide
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _summary(),
                            const SizedBox(height: 14),
                            stepBody,
                          ],
                        )
                      : _withSummary(stepBody),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hero(double top) {
    final n = _stepNames.length;
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
          Row(
            children: [
              const Floating(child: PlanGlyph(size: 46)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _t(_name).isEmpty ? 'Create a plan' : _t(_name),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.display(size: 24, color: Colors.white),
                    ),
                    Text(
                      'Step ${_step + 1} of $n · ${_stepNames[_step]}',
                      style: AppText.body(
                        size: 12.5,
                        weight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              for (var i = 0; i < n; i++) ...[
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
                    // Jump back freely; forward only if the steps before pass.
                    if (i <= _step) {
                      setState(() {
                        _error = null;
                        _step = i;
                      });
                      return;
                    }
                    String? err;
                    for (var s = _step; s < i && err == null; s++) {
                      err = _validateStep(s);
                    }
                    setState(() {
                      _error = err;
                      if (err == null) _step = i;
                    });
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
}
