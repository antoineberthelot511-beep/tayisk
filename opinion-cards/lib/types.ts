export type Lang = "fr" | "en" | "es";

export const SUPPORTED_LANGS: Lang[] = ["fr", "en", "es"];

export type StatementStatus = "pending" | "approved" | "rejected";

export type VoteChoice = "agree" | "disagree";

export type Statement = {
  id: string;
  text: string;
  text_language: Lang;
  translations: Partial<Record<Lang, string>>;
  image_url: string | null;
  image_keyword: string | null;
  created_by: string | null;
  status: StatementStatus;
  votes_agree: number;
  votes_disagree: number;
  created_at: string;
};

/** Ce que le client reçoit : pas de moderation_result ni d'auteur. */
export type FeedStatement = Pick<
  Statement,
  | "id"
  | "text"
  | "text_language"
  | "translations"
  | "image_url"
  | "votes_agree"
  | "votes_disagree"
>;

export type VoteResult = {
  votes_agree: number;
  votes_disagree: number;
  /** Pourcentage d'accord, arrondi. */
  agree_pct: number;
  /** true si le vote de l'utilisateur rejoint l'opinion majoritaire. */
  is_majority: boolean;
  /** Le vote existait deja pour ce device. */
  already_voted: boolean;
};
