export type VoteType = "agree" | "disagree";
export type StatementStatus = "pending" | "approved" | "rejected";
export type SupportedLang = "fr" | "en" | "es";
export type Category = "societe" | "politique" | "culture" | "quotidien" | "travail" | "relations" | "autre";

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: "societe", label: "Société" },
  { value: "politique", label: "Politique" },
  { value: "culture", label: "Culture" },
  { value: "quotidien", label: "Quotidien" },
  { value: "travail", label: "Travail" },
  { value: "relations", label: "Relations" },
  { value: "autre", label: "Autre" },
];

export interface Statement {
  id: string;
  text: string;
  text_language: string;
  translations: Partial<Record<SupportedLang, string>>;
  image_url: string | null;
  image_keyword: string | null;
  image_storage_path?: string | null;
  category?: Category;
  controversy_score?: number;
  votes_agree: number;
  votes_disagree: number;
  created_at?: string;
}

export interface VoteResult {
  statement_id: string;
  vote: VoteType;
  agree_pct: number;
  disagree_pct: number;
  total_votes: number;
  in_majority: boolean;
}
