import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/announcements/presentation/announcement_rich_text.dart';

String plain(String html) => parseAnnouncementHtml(html)
    .map(
      (n) => switch (n) {
        TextRun() => n.text,
        LineBreak() => '\n',
        BulletStart() => '• ',
      },
    )
    .join();

void main() {
  group('parseAnnouncementHtml', () {
    test('plain text stays one run', () {
      final n = parseAnnouncementHtml('Pool closed on Friday');
      expect(n, hasLength(1));
      expect((n.single as TextRun).text, 'Pool closed on Friday');
    });

    test('keeps web editor styling: bold, italic, underline, link', () {
      final n = parseAnnouncementHtml(
        '<b>Big</b> <i>news</i> <u>today</u> <a href="https://x.test">here</a>',
      );
      final runs = n.whereType<TextRun>().toList();
      expect(runs.first.bold, isTrue);
      expect(runs[2].italic, isTrue);
      expect(runs[4].underline, isTrue);
      expect(runs.last.href, 'https://x.test');
    });

    test('lists become bullets on their own lines', () {
      expect(
        plain('Hours:<ul><li>Mon 6am</li><li>Tue 6am</li></ul>'),
        'Hours:\n• Mon 6am\n• Tue 6am',
      );
    });

    test('decodes entities and drops script contents', () {
      expect(plain('Tom &amp; Jerry &lt;3 &nbsp;ok'), 'Tom & Jerry <3  ok');
      expect(plain('Hi<script>alert(1)</script>there'), 'Hithere');
    });

    test('a javascript: link is not kept', () {
      final n = parseAnnouncementHtml('<a href="javascript:alert(1)">x</a>');
      expect((n.single as TextRun).href, isNull);
    });

    test('br and paragraphs break lines; empty paragraphs add no gap', () {
      expect(plain('a<br>b<p>c</p><p></p><p></p><p>d</p>'), 'a\nb\nc\nd');
      expect(plain('a<br><br><br><br>b'), 'a\n\nb');
    });

    test('unclosed / unknown tags never throw', () {
      expect(plain('<b>bold <span class="x">text'), 'bold text');
    });
  });

  group('AnnouncementMarkup', () {
    test('toHtml: inline markers, escaping and line breaks', () {
      expect(
        AnnouncementMarkup.toHtml('**Open** *late* ++today++ <3 & more'),
        '<b>Open</b> <i>late</i> <u>today</u> &lt;3 &amp; more',
      );
      expect(AnnouncementMarkup.toHtml('one\ntwo'), 'one<br>two');
    });

    test('toHtml: consecutive bullets share one list', () {
      expect(
        AnnouncementMarkup.toHtml('Hours\n- Mon\n- Tue\nThanks'),
        'Hours<ul><li>Mon</li><li>Tue</li></ul>Thanks',
      );
    });

    test('toHtml: only safe links become anchors', () {
      expect(
        AnnouncementMarkup.toHtml('[site](https://x.test)'),
        '<a href="https://x.test">site</a>',
      );
      expect(
        AnnouncementMarkup.toHtml('[bad](javascript:alert(1))'),
        '[bad](javascript:alert(1))',
      );
    });

    test('round trip: what is typed is what web would render', () {
      const typed =
          'Hello **team**\n- Mon *6am*\n- Tue ++7am++\nSee [map](https://m.test)';
      final html = AnnouncementMarkup.toHtml(typed);
      expect(AnnouncementMarkup.fromHtml(html), typed);
    });

    test('fromHtml: web-authored HTML becomes editable text', () {
      expect(
        AnnouncementMarkup.fromHtml(
            '<b>Notice</b><br>Gym closed <i>Sunday</i>',),
        '**Notice**\nGym closed *Sunday*',
      );
    });

    test('blank check and plain length ignore tags', () {
      expect(AnnouncementMarkup.isBlank('  \n '), isTrue);
      expect(announcementPlainLength('<b>abc</b><br>de'), 5);
    });
  });
}
