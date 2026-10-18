import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../team/presentation/widgets/team_ui.dart';

/// Announcement bodies are small HTML documents: web's editor
/// (`rich-text-editor.tsx`, `document.execCommand`) produces bold / italic /
/// underline, bullet lists, links and line breaks, and the web list renders
/// them with `dangerouslySetInnerHTML`. There is no HTML or rich-text package
/// in this app, so this file implements exactly that subset:
///
/// * [parseAnnouncementHtml] — a forgiving tokenizer (tags, entities; unknown
///   tags are dropped but their text kept; `<script>` / `<style>` contents are
///   discarded — nothing is ever executed, only text is drawn);
/// * [AnnouncementBody] — renders the parsed runs (links open in the browser
///   for http(s) / mailto / tel only);
/// * [AnnouncementMarkup] — the editing syntax (`**bold**`, `*italic*`,
///   `++underline++`, `[text](url)`, `- bullet`) and its conversion to and
///   from HTML, so what staff type on the phone is what web shows and the
///   reverse;
/// * [AnnouncementEditor] — the text field with a formatting toolbar.

/// One piece of parsed announcement content.
sealed class BodyNode {
  const BodyNode();
}

class TextRun extends BodyNode {
  const TextRun(
    this.text, {
    this.bold = false,
    this.italic = false,
    this.underline = false,
    this.href,
  });

  final String text;
  final bool bold;
  final bool italic;
  final bool underline;
  final String? href;
}

class LineBreak extends BodyNode {
  const LineBreak();
}

class BulletStart extends BodyNode {
  const BulletStart();
}

const _entities = {
  'amp': '&',
  'lt': '<',
  'gt': '>',
  'quot': '"',
  'apos': "'",
  'nbsp': ' ',
};

String _decode(String s) => s.replaceAllMapped(
      RegExp(r'&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);'),
      (m) {
        final e = m.group(1)!;
        if (e.startsWith('#x')) {
          final c = int.tryParse(e.substring(2), radix: 16);
          return c == null ? m.group(0)! : String.fromCharCode(c);
        }
        if (e.startsWith('#')) {
          final c = int.tryParse(e.substring(1));
          return c == null ? m.group(0)! : String.fromCharCode(c);
        }
        return _entities[e.toLowerCase()] ?? m.group(0)!;
      },
    );

String _escape(String s) =>
    s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

bool _safeUrl(String url) {
  final u = url.trim().toLowerCase();
  return u.startsWith('http://') ||
      u.startsWith('https://') ||
      u.startsWith('mailto:') ||
      u.startsWith('tel:');
}

/// Parses announcement HTML into styled runs and line breaks. Never throws;
/// text without any tags comes back as a single run.
List<BodyNode> parseAnnouncementHtml(String html) {
  final nodes = <BodyNode>[];
  var bold = 0;
  var italic = 0;
  var underline = 0;
  final hrefs = <String?>[];
  var skipUntil = '';

  void text(String t) {
    if (t.isEmpty) return;
    nodes.add(
      TextRun(
        _decode(t),
        bold: bold > 0,
        italic: italic > 0,
        underline: underline > 0,
        href: hrefs.isEmpty ? null : hrefs.last,
      ),
    );
  }

  void newline() {
    if (nodes.isNotEmpty && nodes.last is! LineBreak) {
      nodes.add(const LineBreak());
    }
  }

  final tag = RegExp(r'<(/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>');
  var pos = 0;
  for (final m in tag.allMatches(html)) {
    if (skipUntil.isEmpty) text(html.substring(pos, m.start));
    pos = m.end;
    final closing = m.group(1) == '/';
    final name = m.group(2)!.toLowerCase();
    final attrs = m.group(3) ?? '';
    if (skipUntil.isNotEmpty) {
      if (closing && name == skipUntil) skipUntil = '';
      continue;
    }
    switch (name) {
      case 'script' || 'style':
        if (!closing) skipUntil = name;
      case 'b' || 'strong':
        bold += closing ? (bold > 0 ? -1 : 0) : 1;
      case 'i' || 'em':
        italic += closing ? (italic > 0 ? -1 : 0) : 1;
      case 'u':
        underline += closing ? (underline > 0 ? -1 : 0) : 1;
      case 'a':
        if (closing) {
          if (hrefs.isNotEmpty) hrefs.removeLast();
        } else {
          final h = RegExp('href\\s*=\\s*["\']([^"\']*)["\']')
              .firstMatch(attrs)
              ?.group(1);
          hrefs.add(
            h != null && _safeUrl(_decode(h)) ? _decode(h).trim() : null,
          );
        }
      case 'br':
        nodes.add(const LineBreak());
      case 'p' || 'div' || 'ul' || 'ol' || 'h1' || 'h2' || 'h3':
        newline();
      case 'li':
        if (closing) {
          newline();
        } else {
          newline();
          nodes.add(const BulletStart());
        }
      default:
        break;
    }
  }
  if (skipUntil.isEmpty) text(html.substring(pos));

  // Trim leading / trailing breaks and collapse runs of more than two.
  while (nodes.isNotEmpty && nodes.first is LineBreak) {
    nodes.removeAt(0);
  }
  while (nodes.isNotEmpty && nodes.last is LineBreak) {
    nodes.removeLast();
  }
  final out = <BodyNode>[];
  var breaks = 0;
  for (final n in nodes) {
    if (n is LineBreak) {
      breaks++;
      if (breaks > 2) continue;
    } else {
      breaks = 0;
    }
    out.add(n);
  }
  return out;
}

/// Plain-text length of an HTML body (web's `plainLength`, used to decide
/// whether a card needs a "Read more").
int announcementPlainLength(String html) => parseAnnouncementHtml(html)
    .whereType<TextRun>()
    .fold<int>(0, (s, r) => s + r.text.length);

/// The editing syntax and its HTML conversion.
class AnnouncementMarkup {
  AnnouncementMarkup._();

  /// Editing text -> the HTML web stores and renders: each `- ` line becomes
  /// an `<li>` (consecutive ones share a `<ul>`), other lines are joined with
  /// `<br>`; text is HTML-escaped first, then the inline markers become tags.
  static String toHtml(String text) {
    final lines = text.replaceAll('\r\n', '\n').split('\n');
    final parts = <String>[];
    final bullets = <String>[];
    void flush() {
      if (bullets.isEmpty) return;
      parts.add('<ul>${bullets.map((b) => '<li>$b</li>').join()}</ul>');
      bullets.clear();
    }

    var lastWasText = false;
    for (final raw in lines) {
      final bullet = raw.startsWith('- ');
      final html = _inline(_escape(bullet ? raw.substring(2) : raw));
      if (bullet) {
        bullets.add(html);
        lastWasText = false;
      } else {
        flush();
        if (lastWasText) parts.add('<br>');
        parts.add(html);
        lastWasText = true;
      }
    }
    flush();
    return parts.join().trim();
  }

  static String _inline(String s) {
    var t = s;
    t = t.replaceAllMapped(
      RegExp(r'\[([^\]]+)\]\(([^)\s]+)\)'),
      (m) {
        final url = m.group(2)!.replaceAll('"', '%22');
        return _safeUrl(url) ? '<a href="$url">${m.group(1)}</a>' : m.group(0)!;
      },
    );
    t = t.replaceAllMapped(
      RegExp(r'\*\*(.+?)\*\*'),
      (m) => '<b>${m.group(1)}</b>',
    );
    t = t.replaceAllMapped(
      RegExp(r'\+\+(.+?)\+\+'),
      (m) => '<u>${m.group(1)}</u>',
    );
    t = t.replaceAllMapped(RegExp(r'\*(.+?)\*'), (m) => '<i>${m.group(1)}</i>');
    return t;
  }

  /// HTML -> editing text (for editing an existing announcement). Supports
  /// the same subset; anything else degrades to its plain text.
  static String fromHtml(String html) {
    final b = StringBuffer();
    for (final n in parseAnnouncementHtml(html)) {
      switch (n) {
        case LineBreak():
          b.write('\n');
        case BulletStart():
          b.write('- ');
        case TextRun():
          var t = n.text;
          if (t.trim().isEmpty && t.contains('\n')) continue;
          if (n.href != null) t = '[$t](${n.href})';
          if (n.underline) t = '++$t++';
          if (n.italic) t = '*$t*';
          if (n.bold) t = '**$t**';
          b.write(t);
      }
    }
    return b.toString();
  }

  static bool isBlank(String text) => text.trim().isEmpty;
}

/// Renders announcement HTML. Plain text and web-authored rich text both work.
class AnnouncementBody extends StatefulWidget {
  const AnnouncementBody({
    super.key,
    required this.html,
    this.style,
    this.maxLines,
  });

  final String html;
  final TextStyle? style;
  final int? maxLines;

  @override
  State<AnnouncementBody> createState() => _AnnouncementBodyState();
}

class _AnnouncementBodyState extends State<AnnouncementBody> {
  final List<TapGestureRecognizer> _recognizers = [];

  void _disposeRecognizers() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _disposeRecognizers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _disposeRecognizers();
    final base = widget.style ??
        AppText.body(
          size: 13,
          color: AppColors.inkSoft,
          weight: FontWeight.w500,
        );
    final spans = <InlineSpan>[];
    for (final n in parseAnnouncementHtml(widget.html)) {
      switch (n) {
        case LineBreak():
          spans.add(const TextSpan(text: '\n'));
        case BulletStart():
          spans.add(const TextSpan(text: '•  '));
        case TextRun():
          final link = n.href;
          TapGestureRecognizer? tap;
          if (link != null) {
            tap = TapGestureRecognizer()
              ..onTap = () => launchUrl(
                    Uri.parse(link),
                    mode: LaunchMode.externalApplication,
                  );
            _recognizers.add(tap);
          }
          spans.add(
            TextSpan(
              text: n.text,
              recognizer: tap,
              style: base.copyWith(
                fontWeight: n.bold ? FontWeight.w800 : null,
                fontStyle: n.italic ? FontStyle.italic : null,
                decoration: (n.underline || link != null)
                    ? TextDecoration.underline
                    : null,
                color: link != null ? TeamColors.indigo : null,
              ),
            ),
          );
      }
    }
    return Text.rich(
      TextSpan(children: spans, style: base),
      maxLines: widget.maxLines,
      overflow:
          widget.maxLines == null ? TextOverflow.clip : TextOverflow.ellipsis,
    );
  }
}

/// A `TextEditingController` that draws the editing syntax: markers dimmed,
/// bold / italic / underlined / link text styled, `- ` bullets tinted — so the
/// formatting is visible while typing.
class AnnouncementTextController extends TextEditingController {
  AnnouncementTextController({super.text});

  static final _token = RegExp(
    r'\*\*(.+?)\*\*|\+\+(.+?)\+\+|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)|^- ',
    multiLine: true,
  );

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final base = style ?? const TextStyle();
    final dim = base.copyWith(color: AppColors.inkFaint);
    final spans = <InlineSpan>[];
    var last = 0;
    for (final m in _token.allMatches(text)) {
      if (m.start > last) {
        spans.add(TextSpan(text: text.substring(last, m.start)));
      }
      final full = m.group(0)!;
      if (full == '- ') {
        spans.add(
          TextSpan(
            text: full,
            style: base.copyWith(
              color: TeamColors.indigo,
              fontWeight: FontWeight.w900,
            ),
          ),
        );
      } else if (m.group(1) != null) {
        spans
          ..add(TextSpan(text: '**', style: dim))
          ..add(
            TextSpan(
              text: m.group(1),
              style: base.copyWith(fontWeight: FontWeight.w800),
            ),
          )
          ..add(TextSpan(text: '**', style: dim));
      } else if (m.group(2) != null) {
        spans
          ..add(TextSpan(text: '++', style: dim))
          ..add(
            TextSpan(
              text: m.group(2),
              style: base.copyWith(decoration: TextDecoration.underline),
            ),
          )
          ..add(TextSpan(text: '++', style: dim));
      } else if (m.group(3) != null) {
        spans
          ..add(TextSpan(text: '*', style: dim))
          ..add(
            TextSpan(
              text: m.group(3),
              style: base.copyWith(fontStyle: FontStyle.italic),
            ),
          )
          ..add(TextSpan(text: '*', style: dim));
      } else {
        spans
          ..add(TextSpan(text: '[', style: dim))
          ..add(
            TextSpan(
              text: m.group(4),
              style: base.copyWith(
                color: TeamColors.indigo,
                decoration: TextDecoration.underline,
              ),
            ),
          )
          ..add(TextSpan(text: '](${m.group(5)})', style: dim));
      }
      last = m.end;
    }
    if (last < text.length) spans.add(TextSpan(text: text.substring(last)));
    return TextSpan(style: base, children: spans);
  }
}

/// Web's rich-text editor on the phone: a toolbar (bold, italic, underline,
/// bullet list, link) above a multiline field using [AnnouncementTextController].
class AnnouncementEditor extends StatelessWidget {
  const AnnouncementEditor({
    super.key,
    required this.controller,
    this.onChanged,
    this.enabled = true,
    this.hint = 'Write your announcement…',
  });

  final AnnouncementTextController controller;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  final String hint;

  /// Wraps the selection in [open] / [close]; with no selection the markers
  /// are inserted and the cursor sits between them.
  void _wrap(String open, String close) {
    final sel = controller.selection;
    final t = controller.text;
    final start = sel.isValid ? sel.start : t.length;
    final end = sel.isValid ? sel.end : t.length;
    final inner = t.substring(start, end);
    controller.value = TextEditingValue(
      text: t.replaceRange(start, end, '$open$inner$close'),
      selection: inner.isEmpty
          ? TextSelection.collapsed(offset: start + open.length)
          : TextSelection(
              baseOffset: start + open.length,
              extentOffset: start + open.length + inner.length,
            ),
    );
    onChanged?.call(controller.text);
  }

  /// Turns each selected line (or the current line) into a `- ` bullet.
  void _bullets() {
    final sel = controller.selection;
    final t = controller.text;
    final a = sel.isValid ? sel.start : t.length;
    final b = sel.isValid ? sel.end : t.length;
    final from = t.lastIndexOf('\n', a == 0 ? 0 : a - 1) + 1;
    var to = t.indexOf('\n', b);
    if (to == -1) to = t.length;
    final block = t.substring(from, to);
    final lines = block.split('\n');
    final allBullets = lines.every((l) => l.startsWith('- '));
    final next = [
      for (final l in lines)
        allBullets ? l.substring(2) : (l.startsWith('- ') ? l : '- $l'),
    ].join('\n');
    controller.value = TextEditingValue(
      text: t.replaceRange(from, to, next),
      selection: TextSelection.collapsed(offset: from + next.length),
    );
    onChanged?.call(controller.text);
  }

  Future<void> _link(BuildContext context) async {
    final url = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface2,
        title: const Text('Add a link'),
        content: TextField(
          controller: url,
          autofocus: true,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(hintText: 'https://…'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    final value = url.text.trim();
    url.dispose();
    if (ok != true || value.isEmpty) return;
    if (!_safeUrl(value)) return;
    final sel = controller.selection;
    final t = controller.text;
    final start = sel.isValid ? sel.start : t.length;
    final end = sel.isValid ? sel.end : t.length;
    final label = start == end ? value : t.substring(start, end);
    final md = '[$label]($value)';
    controller.value = TextEditingValue(
      text: t.replaceRange(start, end, md),
      selection: TextSelection.collapsed(offset: start + md.length),
    );
    onChanged?.call(controller.text);
  }

  @override
  Widget build(BuildContext context) {
    Widget tool(IconData icon, String label, VoidCallback onTap) => Tooltip(
          message: label,
          child: IconButton(
            visualDensity: VisualDensity.compact,
            onPressed: enabled ? onTap : null,
            icon: Icon(icon, size: 20, color: AppColors.inkSoft),
          ),
        );
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: AppColors.surface3,
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                tool(
                  Icons.format_bold_rounded,
                  'Bold',
                  () => _wrap('**', '**'),
                ),
                tool(
                  Icons.format_italic_rounded,
                  'Italic',
                  () => _wrap('*', '*'),
                ),
                tool(
                  Icons.format_underlined_rounded,
                  'Underline',
                  () => _wrap('++', '++'),
                ),
                tool(
                  Icons.format_list_bulleted_rounded,
                  'Bullet list',
                  _bullets,
                ),
                tool(Icons.link_rounded, 'Link', () => _link(context)),
              ],
            ),
          ),
          TextField(
            controller: controller,
            enabled: enabled,
            minLines: 5,
            maxLines: 12,
            onChanged: onChanged,
            textCapitalization: TextCapitalization.sentences,
            style: AppText.body(size: 14, weight: FontWeight.w500),
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: AppText.body(size: 14, color: AppColors.inkFaint),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(14),
            ),
          ),
        ],
      ),
    );
  }
}
