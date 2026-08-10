/// Minimal projection of `MemberListItemDto` — just enough to pick a payer
/// on the Record Payment screen. The full Members module (list/detail/
/// renew/freeze/etc.) is its own future chunk; this is a narrow bridge,
/// not a preview of that module.
class MemberSummary {
  const MemberSummary({
    required this.id,
    required this.memberId,
    required this.name,
  });

  final String id;
  final String memberId;
  final String name;

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

  factory MemberSummary.fromJson(Map<String, dynamic> json) => MemberSummary(
        id: json['id'] as String,
        memberId: json['memberId'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );
}
