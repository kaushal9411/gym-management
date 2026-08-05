export interface GlobalSearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface GlobalSearchResultDto {
  members: GlobalSearchResultItem[];
  staff: GlobalSearchResultItem[];
  branches: GlobalSearchResultItem[];
}

export interface GlobalSearchQuery {
  q: string;
}
