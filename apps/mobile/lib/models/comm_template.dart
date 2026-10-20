import 'payments_analytics.dart' show jsonList;

/// An active Notification-settings template offered as campaign starter text
/// (`GET /communications/templates`). Already converted to the campaign
/// placeholders by the API, so [title] / [body] can go straight into the
/// message fields.
class CommSyncedTemplate {
  const CommSyncedTemplate({
    required this.type,
    required this.label,
    required this.title,
    required this.body,
  });

  final String type;
  final String label;
  final String title;
  final String body;

  static List<CommSyncedTemplate> listFromJson(Map<String, dynamic> data) {
    return [
      for (final m in jsonList(data['items']))
        CommSyncedTemplate(
          type: '${m['type'] ?? ''}',
          label: '${m['label'] ?? ''}',
          title: '${m['title'] ?? ''}',
          body: '${m['body'] ?? ''}',
        ),
    ];
  }
}
