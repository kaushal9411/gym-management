/// Mirrors `ResolvedTenant` (`apps/api/.../tenants/interfaces/tenant.interface.ts`)
/// as returned by `GET /public/tenants/resolve?slug=`. Only the fields the
/// pre-login "Find your gym" / login screens actually use are modeled.
class TenantBranding {
  const TenantBranding({
    required this.slug,
    required this.name,
    required this.status,
    required this.maintenanceMode,
    required this.primaryColor,
    this.logoUrl,
    this.featureFlags = const [],
  });

  final String slug;
  final String name;
  final String status;
  final bool maintenanceMode;
  final String primaryColor;
  final String? logoUrl;

  /// Enabled module keys for this tenant's plan (`ResolvedTenant.
  /// featureFlags` — mirrors `tenant.featureFlags` on the web app, which
  /// `useFilteredNav` gates the sidebar on). Menu screens gate their tiles
  /// the same way, so a tile a plan doesn't include doesn't dead-end at a
  /// 403 when tapped.
  final List<String> featureFlags;

  /// First two letters of each of the first two words — "Kaushal Fitness
  /// Studio" -> "KF" — used by [BrandMark.initials] when there's no logo.
  String get initials {
    final words =
        name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '?';
    if (words.length == 1) {
      return words.first
          .substring(0, words.first.length.clamp(0, 2))
          .toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  factory TenantBranding.fromJson(Map<String, dynamic> json) {
    final branding = json['branding'] as Map<String, dynamic>? ?? const {};
    return TenantBranding(
      slug: json['slug'] as String? ?? '',
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? 'TRIAL',
      maintenanceMode: json['maintenanceMode'] as bool? ?? false,
      primaryColor: branding['primaryColor'] as String? ?? '',
      logoUrl: branding['logoUrl'] as String?,
      featureFlags: (json['featureFlags'] as List?)?.cast<String>() ?? const [],
    );
  }
}
