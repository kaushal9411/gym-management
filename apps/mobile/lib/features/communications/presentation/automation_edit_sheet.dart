import 'package:flutter/material.dart';

import '../../../core/di/service_locator.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/comm_failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../models/comm_automation.dart';
import '../../../models/comm_channel.dart';
import '../../../repositories/communications_repository.dart';
import '../../../shared/widgets/app_state_views.dart';
import '../../team/presentation/widgets/team_ui.dart'
    show TeamGradientButton, TeamOutlineButton, TeamSheetScaffold;
import '../comm_access.dart';
import '../comm_constants.dart';
import '../comm_logic.dart';
import 'send/send_ui.dart';
import 'widgets/comm_widgets.dart';

/// Edit sheet of one automation rule (design frame 6): timing chips
/// ("7 days before", "3 days", "1 day", "+ Add"), channel chips, **Send test to
/// me** and **Save**.
///
/// Pops the saved [AutomationRule] (from the PUT response) or null. Rules with
/// a fixed timing (on the day / when something happens) show it as text.
/// Validation before Save mirrors the API: at least one timing, at most
/// `maxCount`, each within `min..max`, at least one channel while the rule is
/// on. Server field errors (`offsets`, `channels`) show under their group.
/// Read-only viewers (no `notifications:manage`) see the same sheet with
/// locked chips and no buttons. Selected channels the gym cannot send on right
/// now get a warning (saving is still allowed, per the API). The test sends
/// the SAVED rule to the staff member's own contact (never IN_APP), with the
/// masked destination in the result.
class AutomationEditSheet extends StatefulWidget {
  const AutomationEditSheet({
    super.key,
    required this.rule,
    required this.access,
  });

  final AutomationRule rule;
  final CommAccess access;

  @override
  State<AutomationEditSheet> createState() => _AutomationEditSheetState();
}

class _AutomationEditSheetState extends State<AutomationEditSheet> {
  late Set<int> _offsets;
  late final List<int> _extra; // user-added timings, kept as chips
  late Set<CommChannel> _channels;
  bool _saving = false;
  bool _testing = false;
  String? _banner;
  String? _offsetsError;
  String? _channelsError;
  List<TestSendResult>? _results;

  AutomationRule get _rule => widget.rule;
  bool get _canEdit => widget.access.canManage;

  @override
  void initState() {
    super.initState();
    _offsets = {..._rule.offsets};
    _extra = [];
    _channels = {..._rule.channels};
  }

  /// Default timings + saved ones + ones added in this sheet, in rule order.
  List<int> get _chipValues => _rule.timing.sortedOffsets({
        ..._rule.timing.defaultOffsets,
        ..._rule.offsets,
        ..._extra,
        ..._offsets,
      });

  bool get _dirty =>
      !(_offsets.length == _rule.offsets.length &&
          _offsets.containsAll(_rule.offsets)) ||
      !(_channels.length == _rule.channels.length &&
          _channels.containsAll(_rule.channels));

  List<CommChannel> get _orderedChannels => [
        for (final c in CommChannel.values)
          if (_channels.contains(c)) c,
      ];

  void _toggleOffset(int n) {
    setState(() {
      _offsetsError = null;
      if (!_offsets.remove(n)) {
        if (_offsets.length >= _rule.timing.maxCount) {
          _offsetsError = 'At most ${_rule.timing.maxCount} '
              '${_rule.timing.maxCount == 1 ? 'timing' : 'timings'} '
              'for this reminder.';
          return;
        }
        _offsets.add(n);
      }
    });
  }

  Future<void> _addOffset() async {
    final t = _rule.timing;
    final n = await showDialog<int>(
      context: context,
      builder: (_) => _AddTimingDialog(timing: t, existing: _chipValues),
    );
    if (n == null || !mounted) return;
    setState(() {
      _extra.add(n);
      _toggleOffsetNoReport(n);
    });
  }

  void _toggleOffsetNoReport(int n) {
    _offsetsError = null;
    if (_offsets.length >= _rule.timing.maxCount) {
      _offsetsError = 'At most ${_rule.timing.maxCount} '
          '${_rule.timing.maxCount == 1 ? 'timing' : 'timings'}. Turn one off '
          'first.';
      return;
    }
    _offsets.add(n);
  }

  String? _validate() {
    _offsetsError = null;
    _channelsError = null;
    if (_rule.timing.editable && _offsets.isEmpty) {
      _offsetsError = 'Choose when to send (at least one timing).';
    }
    if (_rule.enabled && _channels.isEmpty) {
      _channelsError = 'Choose at least one channel — this reminder is on.';
    }
    return _offsetsError ?? _channelsError;
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _banner = null);
    if (_validate() != null) {
      setState(() {});
      return;
    }
    setState(() => _saving = true);
    AutomationRule? saved;
    try {
      saved = await getIt<CommunicationsRepository>().updateAutomation(
        _rule.key,
        enabled: _rule.enabled,
        channels: _orderedChannels,
        offsets: _rule.timing.editable ? (_offsets.toList()..sort()) : null,
      );
    } on ApiException catch (e) {
      final f = CommFailure.from(e, permission: 'notifications:manage');
      if (mounted) {
        setState(() {
          _offsetsError = f.fieldMessages['offsets'];
          _channelsError = f.fieldMessages['channels'];
          _banner = (_offsetsError == null && _channelsError == null)
              ? f.message
              : null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _banner = 'Something went wrong. Please try again.');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
    if (saved != null && mounted) Navigator.of(context).pop(saved);
  }

  List<CommChannel> get _testChannels => [
        for (final c in _rule.channels)
          if (c.canTestSend) c,
      ];

  Future<void> _test() async {
    if (_testing) return;
    setState(() {
      _testing = true;
      _banner = null;
      _results = null;
    });
    try {
      final r = await getIt<CommunicationsRepository>().testAutomation(
        _rule.key,
        channels: _testChannels,
      );
      if (mounted) setState(() => _results = r);
    } on ApiException catch (e) {
      final f = CommFailure.from(e, permission: 'notifications:manage');
      if (mounted) setState(() => _banner = f.message);
    } catch (_) {
      if (mounted) {
        setState(() => _banner = 'Could not send the test. Try again.');
      }
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _rule.timing;
    final chips = _chipValues;
    final unavailable = [
      for (final u in _rule.unavailable)
        if (_channels.contains(u.channel)) u,
    ];
    return TeamSheetScaffold(
      icon: Icons.settings_suggest_outlined,
      title: _rule.label,
      subtitle: _rule.description,
      color: kCommBrand,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_banner != null) ...[
            FormAlert(message: _banner!),
            const SizedBox(height: 12),
          ],
          if (!_canEdit) ...[
            const CommNotice(
              text: CommAccess.manageReason,
              tone: CommTone.neutral,
              icon: Icons.lock_outline_rounded,
            ),
            const SizedBox(height: 12),
          ],
          _group(
            'Send',
            t.editable
                ? Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (var i = 0; i < chips.length; i++)
                        CommChip(
                          label: t.chipLabel(chips[i], short: i > 0),
                          selected: _offsets.contains(chips[i]),
                          onTap:
                              _canEdit ? () => _toggleOffset(chips[i]) : null,
                        ),
                      if (_canEdit && _offsets.length < t.maxCount)
                        CommChip(
                          label: '+ Add',
                          selected: false,
                          onTap: _addOffset,
                        ),
                    ],
                  )
                : Text(
                    '${t.chipLabel(0)}. This timing is fixed.',
                    style: AppText.body(
                      size: 13,
                      weight: FontWeight.w700,
                      color: AppColors.inkSoft,
                    ),
                  ),
            error: _offsetsError,
          ),
          _group(
            'Channels',
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final c in _rule.allowedChannels)
                  CommChip(
                    label: c.label,
                    selected: _channels.contains(c),
                    color: c.color,
                    onTap: _canEdit
                        ? () => setState(() {
                              _channelsError = null;
                              if (!_channels.remove(c)) _channels.add(c);
                            })
                        : null,
                  ),
              ],
            ),
            error: _channelsError,
          ),
          if (unavailable.isNotEmpty) ...[
            CommNotice(
              text: '${unavailable.map(_unavailableText).join('; ')}. '
                  'Nothing will be sent on '
                  '${unavailable.length == 1 ? 'it' : 'them'} until that '
                  'changes. You can still save.',
              icon: Icons.warning_amber_rounded,
            ),
            const SizedBox(height: 12),
          ],
          Text(
            _rule.isTransactional
                ? 'About a member\'s own membership, payments or bookings, so '
                    'it is sent even if they opted out of promotions.'
                : 'Members who opted out of promotions on a channel do not '
                    'get it there.',
            style: AppText.body(
              size: 12,
              weight: FontWeight.w600,
              color: AppColors.inkFaint,
            ),
          ),
          if (_results != null) ...[
            const SizedBox(height: 12),
            for (final r in _results!)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: CommNotice(
                  text: '${r.channel?.label ?? ''}: ${r.message}',
                  tone: r.ok ? CommTone.ok : CommTone.warn,
                  icon: r.ok
                      ? Icons.check_circle_outline_rounded
                      : Icons.info_outline_rounded,
                ),
              ),
          ],
          if (_canEdit) ...[
            const SizedBox(height: 16),
            if (_dirty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  'The test uses the saved version. Save first to test your '
                  'changes.',
                  style: AppText.body(
                    size: 11.5,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaint,
                  ),
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: TeamOutlineButton(
                    label: _testing
                        ? 'Sending…'
                        : _testChannels.isEmpty
                            ? 'No test channel'
                            : 'Send test to me',
                    onTap: _testing || _saving || _testChannels.isEmpty
                        ? null
                        : _test,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TeamGradientButton(
                    label: 'Save',
                    gradient: kCommGradient,
                    loading: _saving,
                    onTap: _saving ? null : _save,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _unavailableText(UnavailableChannel u) =>
      '${u.channel.label} is ${disabledReasonText(u.reason)}';

  Widget _group(String label, Widget child, {String? error}) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                label.toUpperCase(),
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w800,
                  color: AppColors.inkFaint,
                ).copyWith(letterSpacing: 0.6),
              ),
            ),
            child,
            if (error != null) InlineError(error),
          ],
        ),
      );
}

/// Asks for one more timing (a whole number within the rule's range).
class _AddTimingDialog extends StatefulWidget {
  const _AddTimingDialog({required this.timing, required this.existing});

  final AutomationTiming timing;
  final List<int> existing;

  @override
  State<_AddTimingDialog> createState() => _AddTimingDialogState();
}

class _AddTimingDialogState extends State<_AddTimingDialog> {
  final _c = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _submit() {
    final t = widget.timing;
    final n = int.tryParse(_c.text.trim());
    if (n == null) {
      setState(() => _error = 'Enter a whole number.');
    } else if (n < t.min || n > t.max) {
      setState(() => _error = 'Use a number from ${t.min} to ${t.max}.');
    } else if (widget.existing.contains(n)) {
      setState(() => _error = 'That timing is already there.');
    } else {
      Navigator.of(context).pop(n);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.timing;
    return AlertDialog(
      backgroundColor: AppColors.surface2,
      title: Text('Add a timing', style: AppText.display(size: 18)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            t.unit == TimingUnit.hoursBefore
                ? 'Hours before (${t.min}-${t.max}).'
                : 'Days (${t.min}-${t.max}).',
            style: AppText.body(size: 13, color: AppColors.inkSoft),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _c,
            autofocus: true,
            keyboardType: TextInputType.number,
            onSubmitted: (_) => _submit(),
            decoration:
                commFieldDecoration(hint: '${t.max}', error: _error != null),
          ),
          if (_error != null) InlineError(_error!),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(onPressed: _submit, child: const Text('Add')),
      ],
    );
  }
}
