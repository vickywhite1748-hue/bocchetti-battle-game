export type MarkerCategory =
  | "family"
  | "gang"
  | "stage"
  | "love"
  | "bar"
  | "gamble";

export type ShowId = "Apollonia" | "SantaLucia";

export type CharacterTag =
  | MarkerCategory
  | "stable"
  | "story"
  | "fate"
  | "bocchetti"
  | "performer"
  | "outsider";

export type Condition =
  | { type: "minCount"; marker: MarkerCategory; count: number }
  | { type: "maxCount"; marker: MarkerCategory; count: number }
  | { type: "equalCount"; marker: MarkerCategory; otherMarker: MarkerCategory }
  | { type: "allOf"; conditions: Condition[] }
  | { type: "anyOf"; conditions: Condition[] }
  | { type: "lastIs"; marker: MarkerCategory };

export type CharacterCard = {
  id: string;
  name: string;
  versionTitle: string;
  sourceShow: ShowId;
  score: number | "family_glory";
  tier: "stable" | "story" | "fate";
  tags: CharacterTag[];
  condition: Condition;
  bondKeys?: string[];
  portraitKey: string;
  successText: string;
  failureText: string;
};

export type PlayerRoleId =
  | "ghostwriter"
  | "stage_manager"
  | "casino_backer"
  | "bartender";

export type PlayerRole = {
  id: PlayerRoleId;
  name: string;
  shortName: string;
  timing: string;
  abilityText: string;
  strategyText: string;
};

export type BondRule = {
  id: string;
  name: string;
  characterIds: [string, string];
  conditionText: string;
  storyText: string;
  bonus: 1;
  scoringMode: "addToScoredCharacter";
};

export type PlayerKind = "human" | "ai";

export type PlayerSeat = {
  id: string;
  kind: PlayerKind;
  name: string;
  roleId: PlayerRoleId;
  score: number;
  familyGlory: boolean;
};

export type PlayerRoundState = {
  hand: string[];
  discardedThisRound: string[];
  selectedScoringCardId: string | null;
  wageredCardId: string | null;
  casinoBackerDeclared: boolean;
  usedRoleAbility: boolean;
  stageManagedCardId: string | null;
  ghostwriterDiscardPending: boolean;
  deferredDiscardCount: number;
  currentDiscardReduction: number;
};

export type RoundPhase =
  | "setup"
  | "draw_1"
  | "discard_1"
  | "draw_2"
  | "discard_2"
  | "draw_3"
  | "discard_3"
  | "draw_4"
  | "resolution"
  | "game_over";

export type GameState = {
  seats: PlayerSeat[];
  round: number;
  phase: RoundPhase;
  victoryScore: number;
  markerBag: MarkerCategory[];
  drawnMarkers: MarkerCategory[];
  characterDeck: string[];
  discardPile: string[];
  playerRounds: Record<string, PlayerRoundState>;
  roundResults: RoundResult[];
  log: string[];
};

export type ConditionEvaluation = {
  met: boolean;
  reason: string;
};

export type BonusSource = "wager" | "casino_backer" | "bond" | "cap" | "family_glory";

export type ScoringBreakdown = {
  playerId: string;
  cardId: string | null;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  success: boolean;
  reason: string;
  bonusReasons: string[];
  bonusSources: BonusSource[];
  bondIds: string[];
};

export type RoundResult = {
  round: number;
  scores: ScoringBreakdown[];
};

export type CompetitionPhase = "register" | "round_result" | "game_over";

export type CompetitionRegistration = {
  cardId: string;
  turn: number;
};

export type CompetitionPlayerResult = {
  playerId: string;
  cardId: string | null;
  registrationTurn: number | null;
  success: boolean;
  baseScore: number;
  bonusScore: number;
  totalScore: number;
  reason: string;
  bondIds: string[];
};

export type CompetitionRoundResult = {
  round: number;
  market: string[];
  priorityOrder: string[];
  playerResults: CompetitionPlayerResult[];
};

export type CompetitionGameState = {
  seats: PlayerSeat[];
  targetScore: number;
  round: number;
  turn: number;
  phase: CompetitionPhase;
  markerBags: Record<string, MarkerCategory[]>;
  playerMarkers: Record<string, MarkerCategory[]>;
  market: string[];
  characterDeck: string[];
  discardPile: string[];
  registrations: Record<string, CompetitionRegistration | null>;
  turnActions: Record<string, boolean>;
  archives: Record<string, string[]>;
  unlockedBondIds: Record<string, string[]>;
  roundResults: CompetitionRoundResult[];
  priorityOrder: string[];
  log: string[];
};
