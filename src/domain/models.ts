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
  releasedYear: number | null;
  provider?: "rawg";
  externalId?: string;
  releasedAt?: string | null;
  coverUrl?: string | null;
  description?: string;
  developers?: string[];
  publishers?: string[];
  tags?: string[];
  requirements?: { platform: string; minimum: string; recommended: string }[];
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
  tag?: string;
  order: "title" | "year" | "rating";
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
export interface CatalogTerm {
  id: string;
  name: string;
}
export interface CatalogTaxonomy {
  genres: CatalogTerm[];
  platforms: CatalogTerm[];
  tags: CatalogTerm[];
}
export interface CatalogProvider {
  readonly mode: "curated-offline" | "live";
  taxonomy?(signal?: AbortSignal): Promise<CatalogTaxonomy>;
  screenshots?(id: string, signal?: AbortSignal): Promise<string[]>;
  search(query: CatalogQuery, signal?: AbortSignal): Promise<Page<Game>>;
  get(id: string, signal?: AbortSignal): Promise<Game | null>;
}
export interface ReviewInput {
  rating: number;
  title: string;
  bodyPublic: string;
  bodySpoiler: string;
}
export interface PublicProfile {
  id: string;
  username: string;
  bio: string;
  avatar_key: "hive" | "orbit" | "spark";
  reputation_score: number;
  created_at: string;
}
export interface UserSettings {
  user_id: string;
  theme_mode: ThemeMode;
  library_visibility: "private" | "public";
  platforms: string[];
  genres: string[];
  interests: string;
  onboarding_complete: boolean;
}
