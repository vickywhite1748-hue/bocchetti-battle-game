import type { PlayerRoleId } from "./types";

export const DRAW_STEPS = [4, 3, 2, 1] as const;
export const DISCARD_COUNTS = [1, 1, 1] as const;
export const INITIAL_HAND_SIZE = 5;
export const FINAL_HAND_SIZE = 2;
export const MAX_SCORING_CARDS_PER_PLAYER = 1;
export const MAX_ROUND_BONUS = 2;

export const VICTORY_SCORE_BY_PLAYER_COUNT: Record<2 | 3 | 4, number> = {
  2: 16,
  3: 17,
  4: 18,
};

export const DEFAULT_HUMAN_ROLE: PlayerRoleId = "ghostwriter";
