/// Mirrors `GET /settings/branding` (design frame "11b. Branding").
class GymBranding {
  const GymBranding({
    required this.logoUrl,
    required this.primaryColor,
    required this.secondaryColor,
    required this.theme,
    required this.welcomeMessage,
  });

  final String? logoUrl;
  final String? primaryColor;
  final String? secondaryColor;
  final String theme;
  final String? welcomeMessage;

  factory GymBranding.fromJson(Map<String, dynamic> json) => GymBranding(
        logoUrl: json['logoUrl'] as String?,
        primaryColor: json['primaryColor'] as String?,
        secondaryColor: json['secondaryColor'] as String?,
        theme: json['theme'] as String? ?? 'SYSTEM',
        welcomeMessage: json['welcomeMessage'] as String?,
      );
}

/// Mirrors `GET /settings/invoice` (design frame "11c. Invoice settings").
class GymInvoiceSettings {
  const GymInvoiceSettings({
    required this.invoicePrefix,
    required this.invoiceFooter,
    required this.taxPercentage,
    required this.defaultPaymentTermsDays,
  });

  final String invoicePrefix;
  final String? invoiceFooter;
  final double taxPercentage;
  final int defaultPaymentTermsDays;

  factory GymInvoiceSettings.fromJson(Map<String, dynamic> json) =>
      GymInvoiceSettings(
        invoicePrefix: json['invoicePrefix'] as String? ?? '',
        invoiceFooter: json['invoiceFooter'] as String?,
        taxPercentage: (json['taxPercentage'] as num?)?.toDouble() ?? 0,
        defaultPaymentTermsDays: json['defaultPaymentTermsDays'] as int? ?? 0,
      );
}

/// Mirrors `GET /settings/security` (design frame "11d. Security policy").
/// The API models the whole policy as one array of roles that must use 2FA —
/// there is no session-timeout setting, so the design's "Session timeout"
/// field has nothing to write to.
class GymSecuritySettings {
  const GymSecuritySettings({required this.mfaRequiredRoles});

  final List<String> mfaRequiredRoles;

  bool requires(String role) => mfaRequiredRoles.contains(role);

  factory GymSecuritySettings.fromJson(Map<String, dynamic> json) =>
      GymSecuritySettings(
        mfaRequiredRoles: ((json['mfaRequiredRoles'] as List?) ?? const [])
            .map((r) => r as String)
            .toList(),
      );
}
