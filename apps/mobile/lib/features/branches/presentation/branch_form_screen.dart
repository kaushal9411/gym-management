import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/branch.dart';
import '../../../repositories/branch_repository.dart';
import '../../../shared/widgets/app_labeled_field.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../../shared/widgets/option_picker_field.dart';
import '../../manager/presentation/widgets/member_detail_anim.dart';
import '../../team/presentation/widgets/team_ui.dart';
import 'branch_ui.dart';
import 'widgets/branch_holidays_editor.dart';
import 'widgets/branch_hours_editor.dart';

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
final _codeRe = RegExp(r'^[A-Za-z0-9-]+$');

/// Add / edit a branch (`POST /branches`, `PATCH /branches/:id`) with every
/// field web's branch form has: name, branch code (edit only — it is
/// auto-generated on create), email, phone, WhatsApp, timezone, the address
/// (2 lines, city, state, country, postal code, latitude / longitude), weekly
/// operating hours, holidays, capacity, maximum members / staff, Allow
/// check-in and notes.
///
/// **Add** is a 4-step wizard (Basics -> Location -> Schedule -> Capacity,
/// with a live completeness ring on the last step); **Edit** is one page of
/// the same sections under a gradient banner. Edit sends only the keys that
/// changed (`updateBranchSchema` treats an absent key as "leave alone").
///
/// API limits worth knowing: email, latitude / longitude, capacity and the
/// two maximums cannot be cleared once set (the validators accept a value or
/// nothing, not null / empty) — clearing one is flagged inline instead of
/// silently ignored. Plain text fields can be emptied. `operatingHours` is
/// only sent when the user touched the hours, so a branch without hours isn't
/// stamped with the 06:00 - 22:00 default by accident.
///
/// On a successful **create** the screen pops with the new branch id so the
/// list can open it; on edit it pops with null.
class BranchFormScreen extends StatefulWidget {
  const BranchFormScreen({super.key, this.existing});

  final Branch? existing;

  @override
  State<BranchFormScreen> createState() => _BranchFormScreenState();
}

class _BranchFormScreenState extends State<BranchFormScreen> {
  static const _stepNames = ['Basics', 'Location', 'Schedule', 'Capacity'];
  static const _stepIcons = [
    Icons.storefront_rounded,
    Icons.place_rounded,
    Icons.schedule_rounded,
    Icons.speed_rounded,
  ];

  Branch? get _b => widget.existing;
  bool get _isEdit => _b != null;

  late final _name = TextEditingController(text: _b?.name ?? '');
  late final _code = TextEditingController(text: _b?.branchCode ?? '');
  late final _email = TextEditingController(text: _b?.email ?? '');
  late final _phone = TextEditingController(text: _b?.phone ?? '');
  late final _whatsapp = TextEditingController(text: _b?.whatsappNumber ?? '');
  late final _addr1 = TextEditingController(text: _b?.addressLine1 ?? '');
  late final _addr2 = TextEditingController(text: _b?.addressLine2 ?? '');
  late final _city = TextEditingController(text: _b?.city ?? '');
  late final _state = TextEditingController(text: _b?.state ?? '');
  late final _country = TextEditingController(text: _b?.country ?? '');
  late final _postal = TextEditingController(text: _b?.postalCode ?? '');
  late final _lat = TextEditingController(
    text: _b?.latitude == null ? '' : '${_b!.latitude}',
  );
  late final _lng = TextEditingController(
    text: _b?.longitude == null ? '' : '${_b!.longitude}',
  );
  late final _capacity = TextEditingController(
    text: _b?.capacity == null ? '' : '${_b!.capacity}',
  );
  late final _maxMembers = TextEditingController(
    text: _b?.maxMembers == null ? '' : '${_b!.maxMembers}',
  );
  late final _maxStaff = TextEditingController(
    text: _b?.maxStaff == null ? '' : '${_b!.maxStaff}',
  );
  late final _notes = TextEditingController(text: _b?.notes ?? '');

  late String? _timezone = _b?.timezone;
  late bool _allowCheckIn = _b?.allowCheckIn ?? true;
  late Map<String, DayHours> _hours =
      normalizeHours(_b?.operatingHours ?? const {});
  bool _hoursTouched = false;
  late List<BranchHoliday> _holidays = sortedHolidays(_b?.holidays ?? const []);

  int _step = 0;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final c in [
      _name,
      _code,
      _email,
      _phone,
      _whatsapp,
      _addr1,
      _addr2,
      _city,
      _state,
      _country,
      _postal,
      _lat,
      _lng,
      _capacity,
      _maxMembers,
      _maxStaff,
      _notes,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  // ── validation + payload ──────────────────────────────────────────────────

  String _t(TextEditingController c) => c.text.trim();

  int? _intOf(TextEditingController c) => int.tryParse(_t(c));

  /// First problem on [step], or null.
  String? _validateStep(int step) {
    switch (step) {
      case 0:
        if (_t(_name).isEmpty) return 'Branch name is required.';
        if (_isEdit && _t(_code).isNotEmpty) {
          if (_t(_code).length > 40 || !_codeRe.hasMatch(_t(_code))) {
            return 'Branch code may only contain letters, numbers and '
                'hyphens (max 40).';
          }
        }
        final email = _t(_email);
        if (email.isNotEmpty && !_emailRe.hasMatch(email)) {
          return 'Enter a valid email address.';
        }
        if (_isEdit && email.isEmpty && (_b!.email ?? '').isNotEmpty) {
          return "Email can't be removed once set - enter a new address or "
              'restore the old one.';
        }
      case 1:
        for (final (label, c, min, max, had) in [
          ('Latitude', _lat, -90.0, 90.0, _b?.latitude != null),
          ('Longitude', _lng, -180.0, 180.0, _b?.longitude != null),
        ]) {
          final text = _t(c);
          if (text.isEmpty) {
            if (_isEdit && had) {
              return "$label can't be removed once set - enter a new value.";
            }
            continue;
          }
          final v = double.tryParse(text);
          if (v == null || v < min || v > max) {
            return '$label must be a number between '
                '${min.toInt()} and ${max.toInt()}.';
          }
        }
      case 2:
        if (_hoursTouched) {
          final bad = branchWeekdays
              .where((d) => openMinutes(_hours[d]!) == 0 && !_hours[d]!.closed);
          if (bad.isNotEmpty) {
            return 'Closing time must be after opening time '
                '(${bad.map((d) => kDayShort[d]).join(', ')}).';
          }
        }
      case 3:
        for (final (label, c, had) in [
          ('Capacity', _capacity, _b?.capacity != null),
          ('Maximum members', _maxMembers, _b?.maxMembers != null),
          ('Maximum staff', _maxStaff, _b?.maxStaff != null),
        ]) {
          final text = _t(c);
          if (text.isEmpty) {
            if (_isEdit && had) {
              return "$label can't be removed once set - enter a new value "
                  '(0 means none).';
            }
            continue;
          }
          final v = int.tryParse(text);
          if (v == null || v < 0 || v > 1000000) {
            return '$label must be a whole number between 0 and 1,000,000.';
          }
        }
        if (_t(_notes).length > 2000) {
          return 'Notes are limited to 2000 characters.';
        }
    }
    return null;
  }

  Map<String, dynamic> _createBody() {
    final body = <String, dynamic>{'name': _t(_name)};
    void put(String key, TextEditingController c) {
      if (_t(c).isNotEmpty) body[key] = _t(c);
    }

    put('email', _email);
    put('phone', _phone);
    put('whatsappNumber', _whatsapp);
    put('addressLine1', _addr1);
    put('addressLine2', _addr2);
    put('city', _city);
    put('state', _state);
    put('country', _country);
    put('postalCode', _postal);
    put('notes', _notes);
    if (_timezone != null) body['timezone'] = _timezone;
    final lat = double.tryParse(_t(_lat));
    final lng = double.tryParse(_t(_lng));
    if (lat != null) body['latitude'] = lat;
    if (lng != null) body['longitude'] = lng;
    final cap = _intOf(_capacity);
    final maxM = _intOf(_maxMembers);
    final maxS = _intOf(_maxStaff);
    if (cap != null) body['capacity'] = cap;
    if (maxM != null) body['maxMembers'] = maxM;
    if (maxS != null) body['maxStaff'] = maxS;
    body['allowCheckIn'] = _allowCheckIn;
    if (_hoursTouched) {
      body['operatingHours'] = {
        for (final d in branchWeekdays) d: _hours[d]!.toJson(),
      };
    }
    if (_holidays.isNotEmpty) {
      body['holidays'] = _holidays.map((h) => h.toJson()).toList();
    }
    return body;
  }

  Map<String, dynamic> _editBody() {
    final b = _b!;
    final body = <String, dynamic>{};
    void text(String key, TextEditingController c, String? old) {
      final now = _t(c);
      if (now != (old ?? '')) body[key] = now;
    }

    text('name', _name, b.name);
    if (_t(_code).isNotEmpty && _t(_code) != b.branchCode) {
      body['branchCode'] = _t(_code);
    }
    if (_t(_email).isNotEmpty && _t(_email) != (b.email ?? '')) {
      body['email'] = _t(_email);
    }
    text('phone', _phone, b.phone);
    text('whatsappNumber', _whatsapp, b.whatsappNumber);
    text('addressLine1', _addr1, b.addressLine1);
    text('addressLine2', _addr2, b.addressLine2);
    text('city', _city, b.city);
    text('state', _state, b.state);
    text('country', _country, b.country);
    text('postalCode', _postal, b.postalCode);
    text('notes', _notes, b.notes);
    if (_timezone != null && _timezone != b.timezone) {
      body['timezone'] = _timezone;
    }
    final lat = double.tryParse(_t(_lat));
    final lng = double.tryParse(_t(_lng));
    if (lat != null && lat != b.latitude) body['latitude'] = lat;
    if (lng != null && lng != b.longitude) body['longitude'] = lng;
    final cap = _intOf(_capacity);
    final maxM = _intOf(_maxMembers);
    final maxS = _intOf(_maxStaff);
    if (cap != null && cap != b.capacity) body['capacity'] = cap;
    if (maxM != null && maxM != b.maxMembers) body['maxMembers'] = maxM;
    if (maxS != null && maxS != b.maxStaff) body['maxStaff'] = maxS;
    if (_allowCheckIn != b.allowCheckIn) body['allowCheckIn'] = _allowCheckIn;
    if (_hoursTouched) {
      final before = normalizeHours(b.operatingHours);
      final changed = branchWeekdays.any((d) => before[d] != _hours[d]) ||
          b.operatingHours.length < branchWeekdays.length;
      if (changed) {
        body['operatingHours'] = {
          for (final d in branchWeekdays) d: _hours[d]!.toJson(),
        };
      }
    }
    final beforeH = sortedHolidays(b.holidays);
    final sameH = beforeH.length == _holidays.length &&
        [for (var i = 0; i < beforeH.length; i++) beforeH[i] == _holidays[i]]
            .every((e) => e);
    if (!sameH) body['holidays'] = _holidays.map((h) => h.toJson()).toList();
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
    for (var s = 0; s < _stepNames.length; s++) {
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
      final repo = getIt<BranchRepository>();
      final saved =
          _isEdit ? await repo.update(_b!.id, body) : await repo.create(body);
      if (!mounted) return;
      teamSnack(
        context,
        _isEdit ? 'Branch updated.' : '${saved.name} created.',
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
            'Branches list - the change may already have been applied.',
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
    int maxLength = 200,
    TextCapitalization caps = TextCapitalization.none,
    bool readOnly = false,
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
      readOnly: readOnly,
      onChanged: onChanged,
      inputFormatters: [
        LengthLimitingTextInputFormatter(maxLength),
        ...?formatters,
      ],
    );
  }

  Widget _number(
    String label,
    TextEditingController c,
    IconData icon,
    Color color,
    String hint,
  ) {
    return AppLabeledField(
      label: label,
      hintText: hint,
      icon: icon,
      iconColor: color,
      controller: c,
      keyboardType: TextInputType.number,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(7),
      ],
    );
  }

  Widget _coordinate(
    String label,
    TextEditingController c,
    String hint,
  ) {
    return AppLabeledField(
      label: label,
      hintText: hint,
      icon: Icons.my_location_rounded,
      iconColor: TeamColors.sky,
      controller: c,
      keyboardType: const TextInputType.numberWithOptions(
        decimal: true,
        signed: true,
      ),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^-?\d*\.?\d{0,8}')),
      ],
    );
  }

  // ── sections ──────────────────────────────────────────────────────────────

  Widget _basics() => TeamFormSection(
        icon: Icons.storefront_rounded,
        color: TeamColors.indigo,
        title: 'Branch information',
        subtitle: 'Name and how people reach the branch',
        children: [
          _text(
            'Branch name',
            _name,
            icon: Icons.storefront_rounded,
            color: TeamColors.indigo,
            hint: 'e.g. Bandra Branch',
            maxLength: 120,
            caps: TextCapitalization.words,
            onChanged: (_) => setState(() {}),
          ),
          _text(
            'Branch code',
            _code,
            icon: Icons.tag_rounded,
            color: TeamColors.violet,
            hint: _isEdit ? 'e.g. BR-0002' : 'Auto-generated',
            maxLength: 40,
            caps: TextCapitalization.characters,
            readOnly: !_isEdit,
          ),
          _text(
            'Email',
            _email,
            icon: Icons.mail_rounded,
            color: TeamColors.rose,
            hint: 'branch@yourgym.com',
            keyboard: TextInputType.emailAddress,
            maxLength: 255,
          ),
          _text(
            'Phone',
            _phone,
            icon: Icons.call_rounded,
            color: TeamColors.green,
            hint: '+91 98765 43210',
            keyboard: TextInputType.phone,
            maxLength: 30,
          ),
          _text(
            'WhatsApp number',
            _whatsapp,
            icon: Icons.chat_rounded,
            color: TeamColors.teal,
            hint: 'Same as phone, or a different line',
            keyboard: TextInputType.phone,
            maxLength: 30,
          ),
          OptionPickerField(
            label: 'Timezone',
            icon: Icons.public_rounded,
            iconColor: TeamColors.amber,
            hintText: _isEdit ? 'Select a timezone' : 'Gym default',
            options: timezoneOptions(_timezone),
            value: _timezone,
            onChanged: (v) => setState(() => _timezone = v),
          ),
        ],
      );

  Widget _location() => TeamFormSection(
        icon: Icons.place_rounded,
        color: TeamColors.amber,
        title: 'Address',
        subtitle: 'Shown on the branch card and used for Directions',
        children: [
          _text(
            'Address line 1',
            _addr1,
            icon: Icons.home_work_rounded,
            color: TeamColors.amber,
            hint: 'Street, building',
            caps: TextCapitalization.words,
          ),
          _text(
            'Address line 2',
            _addr2,
            icon: Icons.signpost_rounded,
            color: TeamColors.amber,
            hint: 'Area, landmark',
            caps: TextCapitalization.words,
          ),
          _text(
            'City',
            _city,
            icon: Icons.location_city_rounded,
            color: TeamColors.indigo,
            maxLength: 100,
            caps: TextCapitalization.words,
          ),
          _text(
            'State',
            _state,
            icon: Icons.map_rounded,
            color: TeamColors.teal,
            maxLength: 100,
            caps: TextCapitalization.words,
          ),
          _text(
            'Country',
            _country,
            icon: Icons.flag_rounded,
            color: TeamColors.rose,
            maxLength: 100,
            caps: TextCapitalization.words,
          ),
          _text(
            'Postal code',
            _postal,
            icon: Icons.markunread_mailbox_rounded,
            color: TeamColors.violet,
            maxLength: 20,
            caps: TextCapitalization.characters,
          ),
          _coordinate('Latitude', _lat, '-90 to 90'),
          _coordinate('Longitude', _lng, '-180 to 180'),
        ],
      );

  Widget _hoursSection() => TeamFormSection(
        icon: Icons.schedule_rounded,
        color: TeamColors.teal,
        title: 'Operating hours',
        subtitle: _isEdit
            ? 'Weekly opening times'
            : 'Optional - untouched hours are not saved',
        children: [
          BranchHoursEditor(
            hours: _hours,
            onChanged: (h) => setState(() {
              _hours = h;
              _hoursTouched = true;
              _error = null;
            }),
          ),
        ],
      );

  Widget _holidaysSection() => TeamFormSection(
        icon: Icons.beach_access_rounded,
        color: TeamColors.violet,
        title: 'Holidays',
        subtitle: 'One-off closures on top of the weekly hours',
        children: [
          BranchHolidaysEditor(
            holidays: _holidays,
            onChanged: (h) => setState(() => _holidays = h),
          ),
        ],
      );

  Widget _capacitySection() => TeamFormSection(
        icon: Icons.speed_rounded,
        color: TeamColors.green,
        title: 'Capacity & settings',
        subtitle: 'How many people the branch holds',
        children: [
          _number(
            'Capacity',
            _capacity,
            Icons.groups_rounded,
            TeamColors.green,
            'e.g. 150',
          ),
          _number(
            'Maximum members',
            _maxMembers,
            Icons.badge_rounded,
            TeamColors.indigo,
            'e.g. 500',
          ),
          _number(
            'Maximum staff',
            _maxStaff,
            Icons.engineering_rounded,
            TeamColors.violet,
            'e.g. 20',
          ),
          TeamToggleRow(
            title: 'Allow check-in',
            subtitle: 'Members can check in at this branch',
            icon: Icons.how_to_reg_rounded,
            color: TeamColors.teal,
            value: _allowCheckIn,
            onChanged: (v) => setState(() => _allowCheckIn = v),
          ),
          AppLabeledField(
            label: 'Notes',
            hintText: 'Anything staff should know about this branch',
            icon: Icons.sticky_note_2_rounded,
            iconColor: TeamColors.amber,
            controller: _notes,
            minLines: 3,
            maxLines: 6,
            textCapitalization: TextCapitalization.sentences,
            inputFormatters: [LengthLimitingTextInputFormatter(2000)],
          ),
        ],
      );

  /// Live "how complete is this profile" card (web's "Ready to create").
  Widget _readyCard() {
    final checks = [
      ('Branch name', _t(_name).isNotEmpty),
      ('City', _t(_city).isNotEmpty),
      ('Phone or email', _t(_phone).isNotEmpty || _t(_email).isNotEmpty),
      ('Operating hours', _hoursTouched),
      ('Capacity', _t(_capacity).isNotEmpty),
    ];
    final ok = checks.where((c) => c.$2).length;
    final ratio = ok / checks.length;
    return TeamSectionCard(
      icon: Icons.checklist_rounded,
      color: TeamColors.green,
      title: 'Ready to create',
      subtitle: 'Only the name is required - the rest can come later',
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
    );
  }

  // ── build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isEdit) {
      final b = _b!;
      return BranchEditScaffold(
        name: _t(_name).isEmpty ? b.name : _t(_name),
        subtitle:
            [b.branchCode, if (b.location.isNotEmpty) b.location].join(' · '),
        title: 'Branch',
        icon: Icons.edit_rounded,
        color: TeamColors.indigo,
        saving: _saving,
        onSave: _submit,
        error: _error,
        sections: [
          _basics(),
          _location(),
          _hoursSection(),
          _holidaysSection(),
          _capacitySection(),
        ],
      );
    }
    final top = MediaQuery.of(context).padding.top + kToolbarHeight;
    final last = _step == _stepNames.length - 1;
    return Scaffold(
      backgroundColor: AppColors.bg,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        title: const Text('New branch'),
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
                label: last ? 'Create branch' : 'Next',
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
                  ...switch (_step) {
                    0 => [_basics()],
                    1 => [_location()],
                    2 => [
                        _hoursSection(),
                        const SizedBox(height: 14),
                        _holidaysSection(),
                      ],
                    _ => [
                        _capacitySection(),
                        const SizedBox(height: 14),
                        _readyCard(),
                      ],
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
              const Floating(child: BranchGlyph(size: 46)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _t(_name).isEmpty ? 'Create a branch' : _t(_name),
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
