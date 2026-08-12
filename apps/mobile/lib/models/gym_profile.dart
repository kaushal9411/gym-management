/// Mirrors `GymProfileDto` (`GET/PATCH /settings/profile` +
/// `PATCH /settings/profile/contact`). `businessHours` is modeled per-day
/// server-side (open/close/closed for each weekday), which the design's
/// single "Operating hours" field can't represent without flattening real
/// per-day values — so it stays web-only; social links likewise.
class GymProfile {
  const GymProfile({
    required this.gymName,
    required this.legalBusinessName,
    required this.email,
    required this.phone,
    required this.website,
    required this.addressLine,
    required this.city,
    required this.state,
    required this.country,
    required this.postalCode,
  });

  final String gymName;
  final String? legalBusinessName;
  final String? email;
  final String? phone;
  final String? website;
  final String? addressLine;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;

  factory GymProfile.fromJson(Map<String, dynamic> json) => GymProfile(
        gymName: json['gymName'] as String,
        legalBusinessName: json['legalBusinessName'] as String?,
        email: json['email'] as String?,
        phone: json['phone'] as String?,
        website: json['website'] as String?,
        addressLine: json['addressLine'] as String?,
        city: json['city'] as String?,
        state: json['state'] as String?,
        country: json['country'] as String?,
        postalCode: json['postalCode'] as String?,
      );
}
