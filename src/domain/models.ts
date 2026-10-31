export type Role = "user" | "critic" | "moderator" | "admin";
export type ThemeMode = "system" | "light" | "dark";
export type LibraryState = "wishlist" | "playing" | "completed" | "backlog";
export interface Identity {
  id: string;
  role: Role;
  criticVerified: boolean;
  status: "active" | "suspended";
}
export interface ExternalRating {
  value: number;
  scale: number;
  source: string;
  sample: number | null;
}
export interface Game {
  id: string;
  title: string;
  summary: string;
  releasedYear: number;
  genres: string[];
  platforms: string[];
  sourceUrl: string;
  sourceLabel: string;
  externalRating: ExternalRating | null;
}
export interface CatalogQuery {
  text: string;
  genre: string;
  platform: string;
  year: string;
  order: "title" | "year";
  page: number;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };
export interface CatalogProvider {
  readonly mode: "curated-offline" | "live";
  search(query: CatalogQuery, signal?: AbortSignal): Promise<Page<Game>>;
  get(id: string, signal?: AbortSignal): Promise<Game | null>;
}
export interface ReviewInput {
  rating: number;
  title: string;
  bodyPublic: string;
  bodySpoiler: string;
}
