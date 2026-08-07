/// Mirrors apps/api members module's list/detail item shape (confirmed
/// live against GET /members and GET /members/:id).
class MemberSummary {
  final String id;
  final String memberId;
  final String name;
  final String? profilePhotoUrl;
  final String status;
  final String? branchName;
  final String? currentPlanName;
  final DateTime? membershipEndDate;

  const MemberSummary({
    required this.id,
    required this.memberId,
    required this.name,
    this.profilePhotoUrl,
    required this.status,
    this.branchName,
    this.currentPlanName,
    this.membershipEndDate,
  });

  factory MemberSummary.fromJson(Map<String, dynamic> json) {
    final membership = json['currentMembership'] as Map<String, dynamic>?;
    final branch = json['branch'] as Map<String, dynamic>?;
    return MemberSummary(
      id: json['id'] as String,
      memberId: json['memberId'] as String,
      name: json['name'] as String? ?? '',
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      branchName: branch?['name'] as String?,
      currentPlanName: membership?['planName'] as String?,
      membershipEndDate: membership?['endDate'] != null
          ? DateTime.tryParse(membership!['endDate'] as String)
          : null,
    );
  }

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}

class MemberListPage {
  final List<MemberSummary> items;
  final int total;
  final int page;
  final int totalPages;

  const MemberListPage({
    required this.items,
    required this.total,
    required this.page,
    required this.totalPages,
  });

  factory MemberListPage.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List)
        .map((e) => MemberSummary.fromJson(e as Map<String, dynamic>))
        .toList();
    return MemberListPage(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class MemberDetail {
  final String id;
  final String memberId;
  final String name;
  final String? profilePhotoUrl;
  final String status;
  final String? email;
  final String? phone;
  final String? branchName;
  final String? trainerName;
  final String? currentPlanName;
  final DateTime? membershipStartDate;
  final DateTime? membershipEndDate;
  final bool canCheckIn;

  const MemberDetail({
    required this.id,
    required this.memberId,
    required this.name,
    this.profilePhotoUrl,
    required this.status,
    this.email,
    this.phone,
    this.branchName,
    this.trainerName,
    this.currentPlanName,
    this.membershipStartDate,
    this.membershipEndDate,
    required this.canCheckIn,
  });

  factory MemberDetail.fromJson(Map<String, dynamic> json) {
    final membership = json['currentMembership'] as Map<String, dynamic>?;
    final branch = json['branch'] as Map<String, dynamic>?;
    final trainer = json['trainer'] as Map<String, dynamic>?;
    return MemberDetail(
      id: json['id'] as String,
      memberId: json['memberId'] as String,
      name: json['name'] as String? ?? '',
      profilePhotoUrl: json['profilePhotoUrl'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      branchName: branch?['name'] as String?,
      trainerName: trainer?['name'] as String?,
      currentPlanName: membership?['planName'] as String?,
      membershipStartDate: membership?['startDate'] != null
          ? DateTime.tryParse(membership!['startDate'] as String)
          : null,
      membershipEndDate: membership?['endDate'] != null
          ? DateTime.tryParse(membership!['endDate'] as String)
          : null,
      canCheckIn: json['canCheckIn'] as bool? ?? false,
    );
  }
}
