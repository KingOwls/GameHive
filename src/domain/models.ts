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
export const criterionLabels = {
  gameplay: "Jugabilidad",
  narrative: "Narrativa",
  art: "Arte",
  sound: "Sonido",
  performance: "Rendimiento",
  accessibility: "Accesibilidad",
  content: "Contenido",
  value: "Valor",
} as const;
export type CriterionKey = keyof typeof criterionLabels;
export interface CriticalQuestion {
  id: string;
  question_key: string;
  version: number;
  genre: string;
  prompt: string;
  provenance: string;
}
export interface CriticalInput {
  criteria: Record<CriterionKey, { score: number; explanation: string }>;
  platform: string;
  hoursPlayed: number;
  completed: boolean;
  copyProvided: boolean;
  scoreReason: string;
  answers: { questionId: string; answer: string }[];
}
export interface CriticalDetails {
  criteria: CriticalInput["criteria"];
  platform: string;
  hours_played: number;
  completed: boolean;
  copy_provided: boolean;
  score_reason: string;
  answers: {
    question_id: string;
    answer: string;
    question: CriticalQuestion;
  }[];
}
export interface CriticalOptions {
  questions: CriticalQuestion[];
  platforms: string[];
}
export interface ReviewInput {
  critical?: CriticalInput;
  rating: number;
  title: string;
  bodyPublic: string;
  bodySpoiler: string;
  pros?: string[];
  cons?: string[];
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

export interface ManualGame {
  id: string;
  title: string;
  synopsis: string;
  platforms: string[];
  genres: string[];
  released_at: string | null;
  source_url: string;
  source_label: string;
  created_at: string;
}
export interface ManualGameInput {
  title: string;
  synopsis: string;
  platforms: string[];
  genres: string[];
  releasedAt: string | null;
  sourceUrl: string;
  sourceLabel: string;
  reason: string;
}

export interface Review {
  helpful_count?: number;
  unhelpful_count?: number;
  kind?: "user" | "critic";
  critic_verified?: boolean;
  critical?: CriticalDetails | null;
  id: string;
  author_id: string;
  game_id: string | null;
  manual_game_id: string | null;
  rating: number;
  title: string;
  body_public: string;
  body_spoiler: string;
  pros: string[];
  cons: string[];
  status: "published" | "withdrawn" | "hidden";
  version: number;
  created_at: string;
  updated_at: string;
}
export interface PublicReview extends Review {
  profiles: Pick<PublicProfile, "username" | "avatar_key">;
}
export type ReviewAction =
  "create" | "update" | "convert" | "withdraw" | "republish";

export interface ReviewVote {
  reviewId: string;
  value: 1 | -1 | null;
  helpfulCount: number | null;
  unhelpfulCount: number | null;
}
