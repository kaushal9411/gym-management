/// `GET /ai/settings` — this gym's own AI provider override ("bring your own
/// key"). The key itself is never returned, only whether one is saved and a
/// masked form of it.
class TenantAiSettings {
  const TenantAiSettings({
    this.provider,
    this.model,
    this.baseUrl,
    this.temperature,
    this.maxTokens,
    this.hasApiKey = false,
    this.apiKeyMasked,
    this.usingPlatformDefault = true,
  });

  final String? provider;
  final String? model;
  final String? baseUrl;
  final double? temperature;
  final int? maxTokens;
  final bool hasApiKey;
  final String? apiKeyMasked;
  final bool usingPlatformDefault;

  factory TenantAiSettings.fromJson(Map<String, dynamic> j) => TenantAiSettings(
        provider: j['provider'] as String?,
        model: j['model'] as String?,
        baseUrl: j['baseUrl'] as String?,
        temperature: (j['temperature'] as num?)?.toDouble(),
        maxTokens: (j['maxTokens'] as num?)?.toInt(),
        hasApiKey: j['hasApiKey'] == true,
        apiKeyMasked: j['apiKeyMasked'] as String?,
        usingPlatformDefault: j['usingPlatformDefault'] != false,
      );
}
