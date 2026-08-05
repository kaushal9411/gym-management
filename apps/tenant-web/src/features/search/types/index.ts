export interface GlobalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface GlobalSearchResult {
  members: GlobalSearchResultItem[];
  staff: GlobalSearchResultItem[];
  branches: GlobalSearchResultItem[];
}
