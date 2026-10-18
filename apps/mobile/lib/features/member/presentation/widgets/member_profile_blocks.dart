import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/network/api_exception.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/member_profile_form.dart';
import '../../../../models/member_self_profile.dart';
import '../../../../repositories/member_portal_repository.dart';
import '../../../../shared/widgets/app_labeled_field.dart';
import '../../../../shared/widgets/motion.dart';
import 'member_profile_fields.dart';

/// Springs a child in: scale 0.8 → 1 with an elastic overshoot plus a fade,
/// delayed by [index] so a column of blocks pops in one after another. With
/// reduced-motion it just shows the child.
class BounceIn extends StatefulWidget {
  const BounceIn({required this.child, this.index = 0, super.key});

  final Widget child;
  final int index;

  @override
  State<BounceIn> createState() => _BounceInState();
}

class _BounceInState extends State<BounceIn>
    with SingleTickerProviderStateMixin {
  static const _anim = 900;

  // The stagger delay lives inside the controller's timeline (no Timer), so
  // nothing is left pending when the widget goes away.
  late final int _delay = 70 * math.min(widget.index, 8);
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: Duration(milliseconds: _anim + _delay),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (_, child) {
        final elapsed = _c.value * (_anim + _delay);
        final t = ((elapsed - _delay) / _anim).clamp(0.0, 1.0);
        final bounce = Curves.elasticOut.transform(t);
        final fade = Curves.easeOut.transform((t * 2).clamp(0.0, 1.0));
        return Opacity(
          opacity: fade,
          child: Transform.translate(
            offset: Offset(0, 24 * (1 - bounce)),
            child: Transform.scale(scale: 0.8 + 0.2 * bounce, child: child),
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// Squishes a child on press and springs it back (a tactile bounce).
class PressBounce extends StatefulWidget {
  const PressBounce({required this.child, this.onTap, super.key});

  final Widget child;
  final VoidCallback? onTap;

  @override
  State<PressBounce> createState() => _PressBounceState();
}

class _PressBounceState extends State<PressBounce> {
  bool _down = false;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.93 : 1,
          duration: Duration(milliseconds: _down ? 90 : 420),
          curve: _down ? Curves.easeOut : Curves.elasticOut,
          child: widget.child,
        ),
      );
}

/// A saturated gradient tile (icon, big value, label, hint) that bounces in
/// and squishes when pressed.
class ProfileColorTile extends StatelessWidget {
  const ProfileColorTile({
    required this.label,
    required this.value,
    required this.hint,
    required this.icon,
    required this.colors,
    this.index = 0,
    this.onTap,
    super.key,
  });

  final String label;
  final String value;
  final String hint;
  final IconData icon;
  final List<Color> colors;
  final int index;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => BounceIn(
        index: index,
        child: PressBounce(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors,
              ),
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: colors.last.withValues(alpha: 0.35),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 18, color: Colors.white),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body(
                          size: 11.5,
                          weight: FontWeight.w800,
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                      ),
                    ),
                  ],
                ),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    maxLines: 1,
                    style: AppText.display(size: 19, color: Colors.white),
                  ),
                ),
                Text(
                  hint,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.82),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
}

/// One read-only row inside a [ProfileBlock].
class ProfileRowData {
  const ProfileRowData(this.icon, this.label, this.value);

  final IconData icon;
  final String label;
  final String value;
}

/// Builders a block's edit form uses, wired to that block's controllers and
/// the server's validation errors.
class ProfileBlockForm {
  ProfileBlockForm(this._ctrl, this._errors);

  final Map<String, TextEditingController> _ctrl;
  final Map<String, String> _errors;

  Widget text(
    String key,
    String label, {
    TextInputType? keyboardType,
    TextCapitalization caps = TextCapitalization.none,
    List<TextInputFormatter>? formatters,
    int maxLines = 1,
    int? minLines,
    String? hint,
    IconData? icon,
    Color? iconColor,
    bool obscure = false,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: AppLabeledField(
          label: label,
          controller: _ctrl[key]!,
          keyboardType: keyboardType,
          textCapitalization: caps,
          inputFormatters: formatters,
          errorText: _errors[key],
          maxLines: maxLines,
          minLines: minLines,
          hintText: hint,
          icon: icon,
          iconColor: iconColor,
          obscureText: obscure,
        ),
      );

  Widget select(String key, String label, List<ProfileOption> options) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: ProfileSelectField(
          label: label,
          controller: _ctrl[key]!,
          options: options,
          errorText: _errors[key],
        ),
      );

  Widget date(String key, String label, {bool future = false}) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: ProfileDateField(
          label: label,
          controller: _ctrl[key]!,
          errorText: _errors[key],
          lastDate: future ? DateTime(2100) : DateTime.now(),
        ),
      );

  /// Extra controller for non-profile input (the current password).
  TextEditingController? controller(String key) => _ctrl[key];
}

/// A colourful profile block: gradient header (icon, title, Edit pill), the
/// read-only [rows] — or, after tapping Edit, the block's own form right in
/// place with Cancel / Save. Saving sends only this block's changed keys
/// (`PATCH /portal/profile`) and hands the server's profile to [onSaved].
/// An e-mail change (a block whose keys include `email`) asks for the current
/// password first, like the full editor.
class ProfileBlock extends StatefulWidget {
  const ProfileBlock({
    required this.title,
    required this.icon,
    required this.colors,
    required this.keys,
    required this.profile,
    required this.rows,
    required this.buildForm,
    required this.onSaved,
    this.emptyText = 'Nothing added yet — tap Edit to add it.',
    this.index = 0,
    super.key,
  });

  final String title;
  final IconData icon;
  final List<Color> colors;

  /// The `PATCH /portal/profile` keys this block owns.
  final List<String> keys;
  final MemberSelfProfile profile;
  final List<ProfileRowData> rows;
  final List<Widget> Function(ProfileBlockForm form) buildForm;
  final Future<void> Function(MemberSelfProfile updated) onSaved;
  final String emptyText;
  final int index;

  @override
  State<ProfileBlock> createState() => ProfileBlockState();
}

class ProfileBlockState extends State<ProfileBlock> {
  final Map<String, TextEditingController> _ctrl = {};
  Map<String, String> _initial = {};
  Map<String, String> _errors = {};
  String? _alert;
  bool _editing = false;
  bool _saving = false;

  bool get editing => _editing;

  bool get _hasEmail => widget.keys.contains('email');

  @override
  void dispose() {
    _disposeControllers();
    super.dispose();
  }

  void _disposeControllers() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    _ctrl.clear();
  }

  /// Opens the block's form (also used when a completeness chip is tapped).
  void startEditing() {
    if (_editing) return;
    final all = widget.profile.toFormValues();
    _initial = {for (final k in widget.keys) k: all[k] ?? ''};
    _disposeControllers();
    for (final k in widget.keys) {
      _ctrl[k] = TextEditingController(text: _initial[k]);
    }
    if (_hasEmail) _ctrl['currentPassword'] = TextEditingController();
    for (final c in _ctrl.values) {
      c.addListener(() {
        if (mounted) setState(() {});
      });
    }
    setState(() {
      _editing = true;
      _errors = {};
      _alert = null;
    });
  }

  void _cancel() {
    setState(() {
      _editing = false;
      _errors = {};
      _alert = null;
    });
  }

  Map<String, String> get _current =>
      {for (final k in widget.keys) k: _ctrl[k]?.text ?? ''};

  bool get _dirty => changedProfileFields(_initial, _current).isNotEmpty;

  bool get _emailChanging => _hasEmail && emailChanged(_initial, _current);

  Future<void> _save() async {
    if (_saving) return;
    final changed = changedProfileFields(_initial, _current);
    if (changed.isEmpty) {
      _cancel();
      return;
    }
    final password = _ctrl['currentPassword']?.text;
    final errors = validateProfileValues(
      _current,
      currentPassword: password,
      emailIsChanging: _emailChanging,
    );
    if (errors.isNotEmpty) {
      setState(() {
        _errors = errors;
        _alert = 'Please fix the highlighted fields.';
      });
      return;
    }
    final body = <String, Object?>{...changed};
    if (_emailChanging) body['currentPassword'] = password;
    setState(() {
      _saving = true;
      _errors = {};
      _alert = null;
    });
    try {
      final updated = await getIt<MemberPortalRepository>().updateProfile(body);
      if (!mounted) return;
      await widget.onSaved(updated);
      if (!mounted) return;
      setState(() => _editing = false);
    } on ApiException catch (e) {
      if (!mounted) return;
      final map = <String, String>{};
      for (final f in e.fieldErrors) {
        final key = f.field;
        if (key != null && _ctrl.containsKey(key)) map[key] = f.message;
      }
      setState(() {
        _errors = map;
        _alert = map.isEmpty ? e.message : 'Please fix the highlighted fields.';
      });
    } catch (e) {
      if (mounted) setState(() => _alert = 'Could not save ($e)');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c1 = widget.colors.first;
    final c2 = widget.colors.last;
    final form = ProfileBlockForm(_ctrl, _errors);
    return BounceIn(
      index: widget.index,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: _editing ? c2 : c2.withValues(alpha: 0.35),
            width: _editing ? 2 : 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: c2.withValues(alpha: _editing ? 0.35 : 0.18),
              blurRadius: _editing ? 22 : 14,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [c1, c2]),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(widget.icon, size: 19, color: Colors.white),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.title,
                      style: AppText.display(size: 16, color: Colors.white),
                    ),
                  ),
                  PressBounce(
                    onTap: _saving ? null : (_editing ? _cancel : startEditing),
                    child: Container(
                      key: ValueKey('block-edit-${widget.keys.first}'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.24),
                        borderRadius: BorderRadius.circular(99),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            _editing
                                ? Icons.close_rounded
                                : Icons.edit_outlined,
                            size: 14,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _editing ? 'Cancel' : 'Edit',
                            style: AppText.body(
                              size: 12,
                              weight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            AnimatedSize(
              duration: reduceMotion(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 380),
              curve: Curves.easeOutBack,
              alignment: Alignment.topCenter,
              child: _editing ? _editBody(form, c2) : _viewBody(c2),
            ),
          ],
        ),
      ),
    );
  }

  Widget _viewBody(Color accent) {
    if (widget.rows.isEmpty) {
      return Container(
        color: accent.withValues(alpha: 0.06),
        padding: const EdgeInsets.all(16),
        child: Text(
          widget.emptyText,
          style: AppText.body(
            size: 12.5,
            weight: FontWeight.w600,
            color: AppColors.inkFaint,
          ),
        ),
      );
    }
    return Container(
      color: accent.withValues(alpha: 0.06),
      child: Column(
        children: [
          for (var i = 0; i < widget.rows.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(widget.rows[i].icon, size: 16, color: accent),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.rows[i].value,
                          style: AppText.body(
                            size: 13.5,
                            weight: FontWeight.w800,
                          ),
                        ),
                        Text(
                          widget.rows[i].label,
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
            ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _editBody(ProfileBlockForm form, Color accent) {
    return TweenAnimationBuilder<double>(
      key: const ValueKey('editing'),
      tween: Tween(begin: 0.94, end: 1),
      duration: reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 700),
      curve: Curves.elasticOut,
      builder: (_, v, child) => Transform.scale(scale: v, child: child),
      child: Container(
        color: accent.withValues(alpha: 0.06),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_alert != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _alert!,
                  style: AppText.body(
                    size: 12.5,
                    weight: FontWeight.w700,
                    color: AppColors.danger,
                  ),
                ),
              ),
            ...widget.buildForm(form),
            if (_emailChanging) ...[
              Text(
                'Changing your email needs your current password, so only '
                'you can do it.',
                style: AppText.body(
                  size: 12,
                  weight: FontWeight.w600,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(height: 8),
              form.text(
                'currentPassword',
                'Current password',
                obscure: true,
              ),
            ],
            const SizedBox(height: 2),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : _cancel,
                    child: const Text('Cancel'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: PressBounce(
                    onTap: _dirty && !_saving ? _save : null,
                    child: Opacity(
                      opacity: _dirty || _saving ? 1 : 0.45,
                      child: Container(
                        key: ValueKey('block-save-${widget.keys.first}'),
                        height: 46,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: widget.colors),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: _saving
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                'Save',
                                style: AppText.body(
                                  size: 14,
                                  weight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
