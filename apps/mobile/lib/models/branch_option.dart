/// Minimal `{id, name}` projection — backs branch filter dropdowns
/// (`GET /branches/assignable`, the same lightweight endpoint every other
/// branch-picker in the backend's own admin UI uses).
class BranchOption {
  const BranchOption({required this.id, required this.name});

  final String id;
  final String name;

  factory BranchOption.fromJson(Map<String, dynamic> json) =>
      BranchOption(id: json['id'] as String, name: json['name'] as String);
}
