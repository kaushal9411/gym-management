import 'payments_analytics.dart' show jsonMoney;

/// Minimal projection of `MemberListItemDto` — just enough to pick a payer
/// on the Record Payment screen. The full Members module (list/detail/
/// renew/freeze/etc.) is its own future chunk; this is a narrow bridge,
/// not a preview of that module.
///
/// The optional fields (contact, plan, dues) feed the Record payment
/// screen's member snapshot and its "notify by email / SMS" switches (a link
/// can only be sent to a contact the member actually has).
class MemberSummary {
  const MemberSummary({
    required this.id,
    required this.memberId,
    required this.name,
    this.email,
    this.phone,
    this.planName,
    this.planEndDate,
    this.outstandingAmount = 0,
  });

  final String id;
  final String memberId;
  final String name;
  final String? email;
  final String? phone;
  final String? planName;
  final DateTime? planEndDate;
  final double outstandingAmount;

  bool get hasEmail => (email ?? '').trim().isNotEmpty;
  bool get hasPhone => (phone ?? '').trim().isNotEmpty;

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

  factory MemberSummary.fromJson(Map<String, dynamic> json) {
    final membership = json['currentMembership'];
    return MemberSummary(
      id: json['id'] as String,
      memberId: json['memberId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      planName: membership is Map<String, dynamic>
          ? membership['planName'] as String?
          : null,
      planEndDate: membership is Map<String, dynamic>
          ? DateTime.tryParse(membership['endDate']?.toString() ?? '')
          : null,
      outstandingAmount: jsonMoney(json['outstandingAmount']),
    );
  }
}
