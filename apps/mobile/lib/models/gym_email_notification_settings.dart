/// `GET/PATCH /settings/email` — the sender identity of the gym's outbound
/// emails (web: Business settings > Email settings).
class GymEmailSettings {
  const GymEmailSettings({this.emailFromName, this.emailFromAddress});

  final String? emailFromName;
  final String? emailFromAddress;

  factory GymEmailSettings.fromJson(Map<String, dynamic> j) => GymEmailSettings(
        emailFromName: j['emailFromName'] as String?,
        emailFromAddress: j['emailFromAddress'] as String?,
      );
}

/// `GET/PATCH /settings/notifications` — tenant-wide channel defaults (web:
/// Business settings > Notification preferences). Each channel is still capped
/// by the plan's platform quota. `smsProviderConfig` is kept as received and
/// sent back unchanged, like web's whole-object save.
class GymNotificationSettings {
  const GymNotificationSettings({
    required this.email,
    required this.push,
    required this.sms,
    required this.whatsapp,
    this.smsProviderConfig,
  });

  final bool email;
  final bool push;
  final bool sms;
  final bool whatsapp;
  final Map<String, dynamic>? smsProviderConfig;

  GymNotificationSettings copyWith({
    bool? email,
    bool? push,
    bool? sms,
    bool? whatsapp,
  }) =>
      GymNotificationSettings(
        email: email ?? this.email,
        push: push ?? this.push,
        sms: sms ?? this.sms,
        whatsapp: whatsapp ?? this.whatsapp,
        smsProviderConfig: smsProviderConfig,
      );

  factory GymNotificationSettings.fromJson(Map<String, dynamic> j) =>
      GymNotificationSettings(
        email: j['emailNotificationsEnabled'] == true,
        push: j['pushNotificationsEnabled'] == true,
        sms: j['smsNotificationsEnabled'] == true,
        whatsapp: j['whatsappNotificationsEnabled'] == true,
        smsProviderConfig: j['smsProviderConfig'] as Map<String, dynamic>?,
      );

  Map<String, dynamic> toJson() => {
        'emailNotificationsEnabled': email,
        'pushNotificationsEnabled': push,
        'smsNotificationsEnabled': sms,
        'whatsappNotificationsEnabled': whatsapp,
        'smsProviderConfig': smsProviderConfig,
      };

  @override
  bool operator ==(Object other) =>
      other is GymNotificationSettings &&
      other.email == email &&
      other.push == push &&
      other.sms == sms &&
      other.whatsapp == whatsapp;

  @override
  int get hashCode => Object.hash(email, push, sms, whatsapp);
}
