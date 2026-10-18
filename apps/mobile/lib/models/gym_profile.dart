import 'business_hours.dart';

/// `SocialLinks` (`GET /settings/profile`'s `socialLinks`,
/// `PATCH /settings/profile/social-links`) — all five optional.
class SocialLinks {
  const SocialLinks({
    this.facebook,
    this.instagram,
    this.twitter,
    this.youtube,
    this.linkedin,
  });

  final String? facebook;
  final String? instagram;
  final String? twitter;
  final String? youtube;
  final String? linkedin;

  factory SocialLinks.fromJson(Map<String, dynamic> json) => SocialLinks(
        facebook: json['facebook'] as String?,
        instagram: json['instagram'] as String?,
        twitter: json['twitter'] as String?,
        youtube: json['youtube'] as String?,
        linkedin: json['linkedin'] as String?,
      );
}

/// Mirrors `GymProfileDto` (`GET/PATCH /settings/profile` +
/// `PATCH /settings/profile/contact`, `/business-hours`, `/social-links`) —
/// every field web's Gym Profile page edits, including the per-weekday
/// [businessHours].
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
    this.socialLinks,
    this.registrationNumber,
    this.gstVatNumber,
    this.businessType,
    this.description,
    this.alternatePhone,
    this.latitude,
    this.longitude,
    this.businessHours = const BusinessHours(),
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
  final SocialLinks? socialLinks;
  final String? registrationNumber;
  final String? gstVatNumber;
  final String? businessType;
  final String? description;
  final String? alternatePhone;
  final double? latitude;
  final double? longitude;
  final BusinessHours businessHours;

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
        socialLinks: json['socialLinks'] == null
            ? null
            : SocialLinks.fromJson(json['socialLinks'] as Map<String, dynamic>),
        registrationNumber: json['registrationNumber'] as String?,
        gstVatNumber: json['gstVatNumber'] as String?,
        businessType: json['businessType'] as String?,
        description: json['description'] as String?,
        alternatePhone: json['alternatePhone'] as String?,
        latitude: _coord(json['latitude']),
        longitude: _coord(json['longitude']),
        businessHours: BusinessHours.fromJson(json['businessHours']),
      );

  /// Coordinates may arrive as numbers or as decimal strings.
  static double? _coord(Object? v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v);
    return null;
  }
}
