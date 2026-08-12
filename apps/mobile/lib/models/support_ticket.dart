enum TicketPriority { low, medium, high, urgent }

extension TicketPriorityX on TicketPriority {
  String get apiValue => switch (this) {
        TicketPriority.low => 'LOW',
        TicketPriority.medium => 'MEDIUM',
        TicketPriority.high => 'HIGH',
        TicketPriority.urgent => 'URGENT',
      };

  String get label => switch (this) {
        TicketPriority.low => 'Low',
        TicketPriority.medium => 'Medium',
        TicketPriority.high => 'High',
        TicketPriority.urgent => 'Urgent',
      };

  static TicketPriority fromApi(String v) => switch (v) {
        'LOW' => TicketPriority.low,
        'HIGH' => TicketPriority.high,
        'URGENT' => TicketPriority.urgent,
        _ => TicketPriority.medium,
      };
}

class TicketNote {
  const TicketNote({
    required this.id,
    required this.note,
    required this.authorName,
    required this.createdAt,
  });

  final String id;
  final String note;
  final String? authorName;
  final DateTime createdAt;

  factory TicketNote.fromJson(Map<String, dynamic> json) => TicketNote(
        id: json['id'] as String,
        note: json['note'] as String,
        authorName:
            (json['authorAdmin'] as Map<String, dynamic>?)?['name'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

/// Mirrors the tenant-facing `SupportTicket` shape (`/support/tickets`) —
/// distinct from the staff-side `admin-support` manage/assign/close plane.
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.subject,
    required this.description,
    required this.status,
    required this.priority,
    required this.createdByName,
    required this.createdAt,
    required this.closedAt,
    this.notes = const [],
  });

  final String id;
  final String subject;
  final String description;
  final String status;
  final TicketPriority priority;
  final String? createdByName;
  final DateTime createdAt;
  final DateTime? closedAt;
  final List<TicketNote> notes;

  factory SupportTicket.fromJson(Map<String, dynamic> json) => SupportTicket(
        id: json['id'] as String,
        subject: json['subject'] as String,
        description: json['description'] as String,
        status: json['status'] as String,
        priority: TicketPriorityX.fromApi(json['priority'] as String),
        createdByName: json['createdByName'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
        closedAt: json['closedAt'] == null
            ? null
            : DateTime.parse(json['closedAt'] as String),
        notes: json['notes'] == null
            ? const []
            : (json['notes'] as List)
                .map((e) => TicketNote.fromJson(e as Map<String, dynamic>))
                .toList(),
      );
}
