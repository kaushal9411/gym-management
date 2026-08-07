class Tenant {
  final String id;
  final String slug;
  final String name;
  final String status;
  final String? primaryColorHex;

  const Tenant({
    required this.id,
    required this.slug,
    required this.name,
    required this.status,
    this.primaryColorHex,
  });

  factory Tenant.fromJson(Map<String, dynamic> json) {
    final branding = json['branding'] as Map<String, dynamic>?;
    return Tenant(
      id: json['id'] as String,
      slug: json['slug'] as String,
      name: json['name'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      primaryColorHex: branding?['primaryColor'] as String?,
    );
  }
}
