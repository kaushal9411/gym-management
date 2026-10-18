import 'package:flutter_test/flutter_test.dart';
import 'package:gym_saas_mobile/features/support/presentation/support_ui.dart';
import 'package:gym_saas_mobile/models/support_ticket.dart';

void main() {
  group('SupportTicket', () {
    test('parses the creator e-mail and replies', () {
      final t = SupportTicket.fromJson({
        'id': 't1',
        'subject': 'Printer down',
        'description': 'The front desk printer is offline',
        'status': 'OPEN',
        'priority': 'URGENT',
        'createdByName': null,
        'createdByEmail': 'desk@gym.test',
        'createdAt': '2026-10-01T08:00:00.000Z',
        'closedAt': null,
        'notes': [
          {
            'id': 'n1',
            'note': 'Looking into it',
            'authorAdmin': {'name': 'Sam'},
            'createdAt': '2026-10-01T09:00:00.000Z',
          },
        ],
      });
      expect(t.priority, TicketPriority.urgent);
      expect(t.createdByEmail, 'desk@gym.test');
      expect(t.notes.single.authorName, 'Sam');
    });

    test('e-mail is optional', () {
      final t = SupportTicket.fromJson({
        'id': 't1',
        'subject': 'Hi there',
        'description': 'A long enough description',
        'status': 'CLOSED',
        'priority': 'LOW',
        'createdAt': '2026-10-01T08:00:00.000Z',
        'closedAt': '2026-10-02T08:00:00.000Z',
      });
      expect(t.createdByEmail, isNull);
      expect(t.closedAt, isNotNull);
    });
  });

  group('FaqItem', () {
    test('reads title + content.answer', () {
      final f = FaqItem.tryParse({
        'id': 'f1',
        'title': 'How do I reset my password?',
        'content': {'answer': '  Use Forgot password.  '},
      });
      expect(f!.question, 'How do I reset my password?');
      expect(f.answer, 'Use Forgot password.');
    });

    test('drops pages without an answer', () {
      expect(
        FaqItem.tryParse({'id': 'f', 'title': 'Q', 'content': <String, dynamic>{}}),
        isNull,
      );
      expect(
        FaqItem.tryParse({
          'id': 'f',
          'title': 'Q',
          'content': {'answer': '  '},
        }),
        isNull,
      );
    });
  });

  group('helpers', () {
    test('supportInitials', () {
      expect(supportInitials('Asha Rao'), 'AR');
      expect(supportInitials('desk@gym.test'), 'DG');
      expect(supportInitials('Sam'), 'S');
      expect(supportInitials(null), '?');
    });

    test('supportAgo', () {
      final now = DateTime(2026, 10, 18, 12);
      expect(supportAgo(now, now), 'just now');
      expect(
        supportAgo(now.subtract(const Duration(minutes: 5)), now),
        '5m ago',
      );
      expect(supportAgo(now.subtract(const Duration(hours: 3)), now), '3h ago');
      expect(supportAgo(now.subtract(const Duration(days: 2)), now), '2d ago');
    });

    test('status and priority metadata cover every API value', () {
      for (final s in kTicketStatuses) {
        expect(ticketStatusLabel(s), isNot(s));
      }
      for (final p in kTicketPriorities) {
        expect(ticketPriorityHint(p), isNotEmpty);
        expect(TicketPriorityX.fromApi(p.apiValue), p);
      }
    });
  });
}
