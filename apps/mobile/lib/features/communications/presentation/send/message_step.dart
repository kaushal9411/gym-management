import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../bloc/communications/send_flow_cubit.dart';
import '../../../../bloc/communications/send_flow_state.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../models/comm_request.dart';
import '../../../team/presentation/widgets/team_ui.dart' show confirmTeam;
import '../../comm_constants.dart';
import '../../comm_logic.dart';
import '../widgets/comm_widgets.dart';
import 'send_ui.dart';

/// Step 2 — "What do you want to say?" (design frame 3).
///
/// Template chips (Expiring / Overdue / New class / Custom) fill the text —
/// `templateKey` is only a label, the text is always what is in the fields —
/// then **Title** (max 200) and **Message** (max 2000) with live counters,
/// tap-to-insert placeholder chips for the seven allowed placeholders, and a
/// preview bubble with sample values. Anything else in `{{braces}}` is flagged
/// inline as soon as it is typed, and the same rules gate Next. Switching to a
/// template over hand-typed text asks before replacing it.
class MessageStep extends StatefulWidget {
  const MessageStep({super.key, required this.gymName});

  final String gymName;

  @override
  State<MessageStep> createState() => _MessageStepState();
}

class _MessageStepState extends State<MessageStep> {
  late final TextEditingController _title;
  late final TextEditingController _body;
  final _titleFocus = FocusNode();
  final _bodyFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    final s = context.read<SendFlowCubit>().state;
    _title = TextEditingController(text: s.title);
    _body = TextEditingController(text: s.body);
    if (s.title.trim().isEmpty && s.body.trim().isEmpty) _prefill();
  }

  /// A fresh flow opens on the first template (Expiring) so Title and Message
  /// are never blank; typing over it flips the chip to Custom.
  void _prefill() {
    final t = CommTemplate.values.firstWhere(
      (x) => kCommTemplateTexts.containsKey(x),
    );
    final preset = kCommTemplateTexts[t]!;
    _title.text = preset.title;
    _body.text = preset.body;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _cubit.setTexts(title: preset.title, body: preset.body, template: t);
    });
  }

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _titleFocus.dispose();
    _bodyFocus.dispose();
    super.dispose();
  }

  SendFlowCubit get _cubit => context.read<SendFlowCubit>();

  /// Typing after a template turns the label back to Custom once the text
  /// no longer matches the preset.
  void _typed() {
    final s = _cubit.state;
    var template = s.template;
    final preset = kCommTemplateTexts[template];
    if (preset != null &&
        (_title.text != preset.title || _body.text != preset.body)) {
      template = CommTemplate.custom;
    }
    _cubit.setTexts(title: _title.text, body: _body.text, template: template);
  }

  Future<void> _applyTemplate(CommTemplate t) async {
    final s = _cubit.state;
    if (t == s.template) return;
    if (t == CommTemplate.custom) {
      _cubit.setTexts(template: CommTemplate.custom);
      return;
    }
    final preset = kCommTemplateTexts[t]!;
    final current = kCommTemplateTexts[s.template];
    final hasText =
        _title.text.trim().isNotEmpty || _body.text.trim().isNotEmpty;
    final untouched = current != null &&
        _title.text == current.title &&
        _body.text == current.body;
    if (hasText && !untouched) {
      final ok = await confirmTeam(
        context,
        title: 'Replace your text?',
        message: 'The "${t.label}" template will replace the title and '
            'message you have typed.',
        confirmLabel: 'Replace',
      );
      if (!ok || !mounted) return;
    }
    _title.text = preset.title;
    _body.text = preset.body;
    _cubit.setTexts(title: preset.title, body: preset.body, template: t);
  }

  void _insert(String name) {
    final field = _titleFocus.hasFocus ? _title : _body;
    final focus = _titleFocus.hasFocus ? _titleFocus : _bodyFocus;
    final token = '{{$name}}';
    final sel = field.selection;
    final text = field.text;
    final start = sel.isValid ? sel.start : text.length;
    final end = sel.isValid ? sel.end : text.length;
    final next = text.replaceRange(start, end, token);
    field.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + token.length),
    );
    focus.requestFocus();
    HapticFeedback.selectionClick();
    _typed();
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SendFlowCubit, SendFlowState>(
      builder: (context, s) {
        final attempted = s.attempted.contains(kStepMessage);
        final errors = _cubit.errorsFor(kStepMessage);
        final titleText = _title.text.trim();
        final bodyText = _body.text.trim();
        // "Required" only after a Next attempt; format problems straight away.
        final titleError =
            titleText.isEmpty && !attempted ? null : errors['title'];
        final bodyError =
            bodyText.isEmpty && !attempted ? null : errors['body'];
        final vars = {
          ...kCommSampleVars,
          'gymName': widget.gymName.isEmpty ? 'Your Gym' : widget.gymName,
          if (s.preview != null && s.preview!.sample.isNotEmpty) ...{
            'firstName': _firstName(s.preview!.sample.first.name),
            'memberCode': s.preview!.sample.first.memberId,
          },
        };
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const StepHeading(title: 'What do you want to say?'),
            Wrap(
              children: [
                CommChip(
                  label: CommTemplate.custom.label,
                  selected: s.template == CommTemplate.custom,
                  onTap: () => _applyTemplate(CommTemplate.custom),
                ),
              ],
            ),
            for (final g in CommTemplateGroup.values) ...[
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 6),
                child: Text(
                  g.label.toUpperCase(),
                  style: AppText.eyebrow(color: AppColors.inkFaint),
                ),
              ),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final t
                      in CommTemplate.values.where((x) => x.group == g))
                    CommChip(
                      label: t.label,
                      selected: s.template == t,
                      onTap: () => _applyTemplate(t),
                    ),
                ],
              ),
            ],
            const SizedBox(height: 6),
            Text(
              'Offer templates are starting text. Add your real discount, '
              'dates and terms before sending.',
              style: AppText.body(size: 12, color: AppColors.inkFaint),
            ),
            const SizedBox(height: 14),
            FieldLabel(
              'Title',
              trailing: '${_title.text.length}/$kCommTitleMax',
            ),
            TextField(
              controller: _title,
              focusNode: _titleFocus,
              onChanged: (_) => _typed(),
              minLines: 1,
              maxLines: 3,
              textInputAction: TextInputAction.next,
              textCapitalization: TextCapitalization.sentences,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: commFieldDecoration(
                hint: 'Hi {{firstName}}, a note from {{gymName}}',
                error: titleError != null,
              ),
            ),
            if (titleError != null) InlineError(titleError),
            const SizedBox(height: 12),
            FieldLabel(
              'Message',
              trailing: '${_body.text.length}/$kCommBodyMax',
            ),
            TextField(
              controller: _body,
              focusNode: _bodyFocus,
              onChanged: (_) => _typed(),
              minLines: 4,
              maxLines: 9,
              keyboardType: TextInputType.multiline,
              textCapitalization: TextCapitalization.sentences,
              style: AppText.body(size: 14, weight: FontWeight.w600),
              decoration: commFieldDecoration(
                hint: 'Write the message members will read',
                error: bodyError != null,
              ),
            ),
            if (bodyError != null) InlineError(bodyError),
            const SizedBox(height: 10),
            Semantics(
              label: 'Placeholders. Tap one to add it to the text.',
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final p in kCommPlaceholders)
                    _PlaceholderChip(name: p, onTap: () => _insert(p)),
                ],
              ),
            ),
            CommSectionLabel('Preview'),
            _Bubble(
              sender: widget.gymName.isEmpty ? 'Your gym' : widget.gymName,
              title: titleText.isEmpty
                  ? 'Your title appears here'
                  : renderPlaceholders(titleText, vars),
              body: bodyText.isEmpty
                  ? 'Your message appears here'
                  : renderPlaceholders(bodyText, vars),
              muted: titleText.isEmpty || bodyText.isEmpty,
            ),
            Padding(
              padding: const EdgeInsets.only(top: 6, left: 2),
              child: Text(
                'Shown with sample values. Each member sees their own.',
                style: AppText.body(
                  size: 11.5,
                  weight: FontWeight.w600,
                  color: AppColors.inkFaint,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  static String _firstName(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    return parts.isEmpty || parts.first.isEmpty ? 'Aarav' : parts.first;
  }
}

class _PlaceholderChip extends StatelessWidget {
  const _PlaceholderChip({required this.name, required this.onTap});

  final String name;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return CommPress(
      onTap: onTap,
      semanticLabel: 'Insert $name',
      scale: 0.92,
      child: Container(
        constraints: const BoxConstraints(minHeight: 32),
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: kCommBrand.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          '{{$name}}',
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            color: kCommBrand,
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({
    required this.sender,
    required this.title,
    required this.body,
    required this.muted,
  });

  final String sender;
  final String title;
  final String body;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final color = muted ? AppColors.inkFaint : AppColors.ink;
    return CommCard(
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  sender.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body(
                    size: 10.5,
                    weight: FontWeight.w800,
                    color: AppColors.inkFaint,
                  ).copyWith(letterSpacing: 0.4),
                ),
              ),
              Text(
                'NOW',
                style: AppText.body(
                  size: 10.5,
                  weight: FontWeight.w800,
                  color: AppColors.inkFaint,
                ).copyWith(letterSpacing: 0.4),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style:
                AppText.body(size: 14, weight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 2),
          Text(
            body,
            style: AppText.body(
              size: 12.5,
              weight: FontWeight.w600,
              color: muted ? AppColors.inkFaint : AppColors.inkSoft,
            ),
          ),
        ],
      ),
    );
  }
}
