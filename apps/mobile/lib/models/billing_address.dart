/// Mirrors the `BillingAddress` row (`GET/PUT /billing/address`) — the
/// tenant's tax/invoice address for its own FitCloud subscription. `null`
/// from the repository means none has been set yet, a real state (most
/// tenants provisioned outside onboarding have none).
class BillingAddress {
  const BillingAddress({
    required this.legalName,
    required this.line1,
    required this.line2,
    required this.city,
    required this.state,
    required this.postalCode,
    required this.country,
    required this.taxId,
  });

  final String? legalName;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String postalCode;
  final String country;
  final String? taxId;

  factory BillingAddress.fromJson(Map<String, dynamic> json) =>
      BillingAddress(
        legalName: json['legalName'] as String?,
        line1: json['line1'] as String,
        line2: json['line2'] as String?,
        city: json['city'] as String,
        state: json['state'] as String,
        postalCode: json['postalCode'] as String,
        country: json['country'] as String,
        taxId: json['taxId'] as String?,
      );
}
