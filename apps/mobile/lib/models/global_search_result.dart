enum SearchCategory { member, staff, branch }

/// One row of a `GET /search` category — `id` is what every detail route
/// (`memberDetail`/`staffDetail`/`branchDetail`) takes as its `extra`
/// directly, so a result can be tapped straight through without an extra
/// fetch. The backend's own `url` field (`/members/{id}`) is web-routing
/// shaped and unused here.
class SearchResultItem {
  const SearchResultItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.category,
  });

  final String id;
  final String title;
  final String subtitle;
  final SearchCategory category;

  factory SearchResultItem.fromJson(
    Map<String, dynamic> json,
    SearchCategory category,
  ) =>
      SearchResultItem(
        id: json['id'] as String,
        title: json['title'] as String,
        subtitle: json['subtitle'] as String,
        category: category,
      );
}

/// Mirrors `GlobalSearchResultDto`. Deliberately scoped to Members/Staff/
/// Branches server-side — every other list (Payments, Workout Plans…)
/// already has its own in-page search, so this isn't a catch-all index.
class GlobalSearchResult {
  const GlobalSearchResult({
    required this.members,
    required this.staff,
    required this.branches,
  });

  final List<SearchResultItem> members;
  final List<SearchResultItem> staff;
  final List<SearchResultItem> branches;

  bool get isEmpty => members.isEmpty && staff.isEmpty && branches.isEmpty;

  factory GlobalSearchResult.fromJson(Map<String, dynamic> json) =>
      GlobalSearchResult(
        members: (json['members'] as List)
            .map(
              (e) => SearchResultItem.fromJson(
                e as Map<String, dynamic>,
                SearchCategory.member,
              ),
            )
            .toList(),
        staff: (json['staff'] as List)
            .map(
              (e) => SearchResultItem.fromJson(
                e as Map<String, dynamic>,
                SearchCategory.staff,
              ),
            )
            .toList(),
        branches: (json['branches'] as List)
            .map(
              (e) => SearchResultItem.fromJson(
                e as Map<String, dynamic>,
                SearchCategory.branch,
              ),
            )
            .toList(),
      );
}
