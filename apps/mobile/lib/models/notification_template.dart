/// Mirrors `EffectiveTemplateDto` (`GET /notifications/templates` —
/// tenant override merged with the system default, `isCustomized` marks
/// which).
class NotificationTemplate {
  const NotificationTemplate({
    required this.type,
    required this.label,
    required this.description,
    required this.channels,
    required this.titleTemplate,
    required this.bodyTemplate,
    required this.isActive,
    required this.isCustomized,
  });

  final String type;
  final String label;
  final String description;
  final List<String> channels;
  final String titleTemplate;
  final String bodyTemplate;
  final bool isActive;
  final bool isCustomized;

  factory NotificationTemplate.fromJson(Map<String, dynamic> json) =>
      NotificationTemplate(
        type: json['type'] as String,
        label: json['label'] as String,
        description: json['description'] as String,
        channels: (json['channels'] as List).cast<String>(),
        titleTemplate: json['titleTemplate'] as String,
        bodyTemplate: json['bodyTemplate'] as String,
        isActive: json['isActive'] as bool,
        isCustomized: json['isCustomized'] as bool,
      );
}
