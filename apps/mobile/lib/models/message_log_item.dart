import 'paginated_result.dart';

/// Mirrors `MessageLogItem` (`GET /notifications/message-log`, perm
/// `notifications:view`): one Email / SMS / WhatsApp send attempt for the
/// gym, with its delivery status and full content.
class MessageLogItem {
  const MessageLogItem({
    required this.id,
    required this.channel,
    required this.recipient,
    required this.subject,
    required this.content,
    required this.status,
    required this.providerRef,
    required this.errorMessage,
    required this.createdAt,
  });

  final String id;

  /// `EMAIL` | `SMS` | `WHATSAPP`.
  final String channel;
  final String recipient;

  /// Email only.
  final String? subject;
  final String content;

  /// `SENT` | `FAILED` | `SKIPPED_DISABLED` | `SKIPPED_QUOTA`.
  final String status;
  final String? providerRef;

  /// Why a FAILED / SKIPPED send did not go out.
  final String? errorMessage;
  final DateTime createdAt;

  factory MessageLogItem.fromJson(Map<String, dynamic> j) => MessageLogItem(
        id: j['id'] as String,
        channel: j['channel'] as String? ?? '',
        recipient: j['recipient'] as String? ?? '',
        subject: j['subject'] as String?,
        content: j['content'] as String? ?? '',
        status: j['status'] as String? ?? '',
        providerRef: j['providerRef'] as String?,
        errorMessage: j['errorMessage'] as String?,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );

  static PaginatedResult<MessageLogItem> page(Map<String, dynamic> data) =>
      PaginatedResult.fromJson(data, MessageLogItem.fromJson);
}
