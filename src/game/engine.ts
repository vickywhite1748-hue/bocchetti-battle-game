import { BOND_RULES } from "./bonds";
import { CHARACTER_CARDS } from "./characters";
import { evaluateCondition } from "./conditions";
import { createMarkerBag } from "./markers";
import { defaultRandom, shuffle, type RandomSource } from "./random";
import {
  DRAW_STEPS,
  FINAL_HAND_SIZE,
  INITIAL_HAND_SIZE,
  MAX_ROUND_BONUS,
  VICTORY_SCORE_BY_PLAYER_COUNT,
} from "./setup";
import type {
  CharacterCard,
  BonusSource,
  GameState,
  MarkerCategory,
  PlayerRoleId,
  PlayerRoundState,
  PlayerSeat,
  RoundPhase,
  RoundResult,
  ScoringBreakdown,
} from "./types";

export type CreateGameOptions = {
  playerCount: 2 | 3 | 4;
  humanRoleId?: PlayerRoleId;
  random?: RandomSource;
};

const PHASE_AFTER_DRAW: Record<number, RoundPhase> = {
  0: "discard_1",
  1: "discard_2",
  2: "discard_3",
  3: "resolution",
};

const NEXT_DRAW_PHASE: Record<RoundPhase, RoundPhase> = {
  setup: "draw_1",
  discard_1: "draw_2",
  discard_2: "draw_3",
  discard_3: "draw_4",
  draw_1: "draw_1",
  draw_2: "draw_2",
  draw_3: "draw_3",
  draw_4: "draw_4",
  resolution: "resolution",
  game_over: "game_over",
};

export function createGame(options: CreateGameOptions): GameState {
  const random = options.random ?? defaultRandom;
  const seats = createSeats(options.playerCount, options.humanRoleId);
  const state: GameState = {
    seats,
    round: 0,
    phase: "setup",
    victoryScore: VICTORY_SCORE_BY_PLAYER_COUNT[options.playerCount],
    markerBag: [],
    drawnMarkers: [],
    characterDeck: shuffle(
      CHARACTER_CARDS.map((card) => card.id),
      random,
    ),
    discardPile: [],
    playerRounds: {},
    roundResults: [],
    log: [`创建 ${options.playerCount} 人对局。`],
  };

  return startRound(state, random);
}

export function startRound(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  const deck = ensureDeckHasCards(
    state.characterDeck,
    state.discardPile,
    state.seats.length * INITIAL_HAND_SIZE,
    random,
  );
  const playerRounds: Record<string, PlayerRoundState> = {};
  let nextDeck = deck.characterDeck;

  for (const seat of state.seats) {
    const hand = nextDeck.slice(0, INITIAL_HAND_SIZE);
    nextDeck = nextDeck.slice(INITIAL_HAND_SIZE);
    playerRounds[seat.id] = createPlayerRoundState(hand);
  }

  return {
    ...state,
    round: state.round + 1,
    phase: "draw_1",
    markerBag: shuffle(createMarkerBag(), random),
    drawnMarkers: [],
    characterDeck: nextDeck,
    discardPile: deck.discardPile,
    playerRounds,
    log: [...state.log, `第 ${state.round + 1} 轮开始。`],
  };
}

export function drawCurrentStep(state: GameState): GameState {
  const drawIndex = getDrawIndex(state.phase);
  const drawCount = DRAW_STEPS[drawIndex];

  if (drawCount === undefined) {
    throw new Error(`当前阶段不能抽取积点：${state.phase}`);
  }

  if (state.markerBag.length < drawCount) {
    throw new Error("积点袋数量不足。");
  }

  const drawn = state.markerBag.slice(0, drawCount);
  const markerBag = state.markerBag.slice(drawCount);
  const nextPhase = PHASE_AFTER_DRAW[drawIndex];

  if (nextPhase === undefined) {
    throw new Error(`缺少抽取后的阶段配置：${drawIndex}`);
  }

  return {
    ...state,
    phase: nextPhase,
    markerBag,
    drawnMarkers: [...state.drawnMarkers, ...drawn],
    log: [...state.log, `抽出 ${drawn.length} 枚积点。`],
  };
}

export function discardCards(
  state: GameState,
  playerId: string,
  cardIds: string[],
): GameState {
  const playerRound = getPlayerRound(state, playerId);
  if (playerRound.ghostwriterDiscardPending) {
    throw new Error("请先完成代笔人的技能弃置。");
  }
  const required = getRequiredDiscardCount(state, playerId);

  if (cardIds.length !== required) {
    throw new Error(`当前阶段必须弃置 ${required} 张角色拍立得。`);
  }

  for (const cardId of cardIds) {
    if (!playerRound.hand.includes(cardId)) {
      throw new Error(`观众没有这张角色拍立得：${cardId}`);
    }
  }

  const nextRound: PlayerRoundState = {
    ...playerRound,
    hand: playerRound.hand.filter((cardId) => !cardIds.includes(cardId)),
    discardedThisRound: [...playerRound.discardedThisRound, ...cardIds],
    wageredCardId:
      playerRound.wageredCardId && cardIds.includes(playerRound.wageredCardId)
        ? null
        : playerRound.wageredCardId,
    deferredDiscardCount: getNextDeferredDiscardCount(
      state.phase,
      playerRound,
      cardIds.length,
    ),
  };

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: nextRound,
    },
    discardPile: [...state.discardPile, ...cardIds],
    log: [...state.log, `${getSeatName(state, playerId)} 弃置 ${cardIds.length} 张角色拍立得。`],
  };
}

export function placeWager(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState {
  if (state.phase !== "discard_2") {
    throw new Error("只能在第二次抽取积点后的弃置阶段签署拍立得。");
  }

  const playerRound = getPlayerRound(state, playerId);
  if (!playerRound.hand.includes(cardId)) {
    throw new Error(`观众没有这张角色拍立得：${cardId}`);
  }

  if (playerRound.wageredCardId) {
    throw new Error("本轮已经签署拍立得。");
  }

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        wageredCardId: cardId,
      },
    },
    log: [...state.log, `${getSeatName(state, playerId)} 签署了 1 张角色拍立得。`],
  };
}

export function cancelWager(state: GameState, playerId: string): GameState {
  if (state.phase !== "discard_2") {
    throw new Error("只能在第二次抽取积点后的弃置阶段取消签署。");
  }

  const playerRound = getPlayerRound(state, playerId);
  if (!playerRound.wageredCardId) {
    throw new Error("本轮还没有签署拍立得。");
  }

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        wageredCardId: null,
      },
    },
    log: [...state.log, `${getSeatName(state, playerId)} 取消了签署拍立得。`],
  };
}

export function useGhostwriterAbility(
  state: GameState,
  playerId: string,
  random: RandomSource = defaultRandom,
): GameState {
  const seat = getSeat(state, playerId);
  if (seat.roleId !== "ghostwriter") {
    throw new Error("只有代笔人可以使用该技能。");
  }
  assertCanUseRoleAbility(state, playerId);
  if (state.phase !== "discard_1" && state.phase !== "discard_2") {
    throw new Error("代笔人只能在前两次弃置阶段使用。");
  }

  const deck = ensureDeckHasCards(state.characterDeck, state.discardPile, 1, random);
  const drawnCard = deck.characterDeck[0];
  if (!drawnCard) {
    throw new Error("角色拍立得牌堆为空。");
  }

  const playerRound = getPlayerRound(state, playerId);
  return {
    ...state,
    characterDeck: deck.characterDeck.slice(1),
    discardPile: deck.discardPile,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        hand: [...playerRound.hand, drawnCard],
        usedRoleAbility: true,
        ghostwriterDiscardPending: true,
      },
    },
    log: [...state.log, `${seat.name} 使用代笔人技能抽了 1 张角色拍立得。`],
  };
}

export function discardGhostwriterCard(
  state: GameState,
  playerId: string,
  discardCardId: string,
): GameState {
  const seat = getSeat(state, playerId);
  if (seat.roleId !== "ghostwriter") {
    throw new Error("只有代笔人可以进行该弃置。");
  }
  assertDiscardPhase(state.phase);

  const playerRound = getPlayerRound(state, playerId);
  if (!playerRound.ghostwriterDiscardPending) {
    throw new Error("当前没有待处理的代笔人弃置。");
  }
  if (!playerRound.hand.includes(discardCardId)) {
    throw new Error(`观众没有这张角色拍立得：${discardCardId}`);
  }

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        hand: playerRound.hand.filter((cardId) => cardId !== discardCardId),
        discardedThisRound: [
          ...playerRound.discardedThisRound,
          discardCardId,
        ],
        wageredCardId:
          playerRound.wageredCardId === discardCardId
            ? null
            : playerRound.wageredCardId,
        ghostwriterDiscardPending: false,
      },
    },
    discardPile: [...state.discardPile, discardCardId],
    log: [...state.log, `${seat.name} 完成了代笔人弃置。`],
  };
}

export function useStageManagerAbility(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState {
  const seat = getSeat(state, playerId);
  if (seat.roleId !== "stage_manager") {
    throw new Error("只有舞台监督可以使用该技能。");
  }
  if (state.phase !== "discard_1") {
    throw new Error("舞台监督只能在第一次弃置阶段排演。");
  }
  assertCanUseRoleAbility(state, playerId);

  const playerRound = getPlayerRound(state, playerId);
  if (!playerRound.hand.includes(cardId)) {
    throw new Error(`观众没有这张角色拍立得：${cardId}`);
  }
  const card = getCardById(cardId);

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        stageManagedCardId: cardId,
        usedRoleAbility: true,
      },
    },
    log: [...state.log, `${seat.name} 排演了 ${card.name}《${card.versionTitle}》。`],
  };
}

export function useCasinoBackerAbility(
  state: GameState,
  playerId: string,
): GameState {
  const seat = getSeat(state, playerId);
  if (seat.roleId !== "casino_backer") {
    throw new Error("只有赌场投资人可以使用该技能。");
  }
  if (state.phase !== "discard_2") {
    throw new Error("赌场投资人只能在第二次抽取积点后押赌局。");
  }
  assertCanUseRoleAbility(state, playerId);

  const playerRound = getPlayerRound(state, playerId);
  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        casinoBackerDeclared: true,
        usedRoleAbility: true,
      },
    },
    log: [...state.log, `${seat.name} 声明押赌局。`],
  };
}

export function useBartenderAbility(
  state: GameState,
  playerId: string,
): GameState {
  const seat = getSeat(state, playerId);
  if (seat.roleId !== "bartender") {
    throw new Error("只有阿波罗尼亚吧台人可以使用该技能。");
  }
  assertCanUseRoleAbility(state, playerId);
  assertDiscardPhase(state.phase);

  if (state.phase === "discard_3") {
    throw new Error("V1 中吧台人必须在前两次弃置阶段使用。");
  }

  const playerRound = getPlayerRound(state, playerId);
  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        usedRoleAbility: true,
        deferredDiscardCount: playerRound.deferredDiscardCount + 1,
        currentDiscardReduction: playerRound.currentDiscardReduction + 1,
      },
    },
    log: [...state.log, `${seat.name} 延迟了 1 张弃置。`],
  };
}

export function advanceAfterDiscards(state: GameState): GameState {
  if (!allPlayersAtExpectedHandSize(state)) {
    throw new Error("仍有观众未完成当前弃置。");
  }

  const nextPhase = NEXT_DRAW_PHASE[state.phase];
  if (nextPhase === state.phase) {
    throw new Error(`当前阶段不能推进：${state.phase}`);
  }

  return {
    ...state,
    phase: nextPhase,
    playerRounds: Object.fromEntries(
      Object.entries(state.playerRounds).map(([playerId, playerRound]) => [
        playerId,
        {
          ...playerRound,
          currentDiscardReduction: 0,
        },
      ]),
    ),
  };
}

export function selectScoringCard(
  state: GameState,
  playerId: string,
  cardId: string,
): GameState {
  if (state.phase !== "resolution") {
    throw new Error("只能在结算阶段选择计分拍立得。");
  }

  const playerRound = getPlayerRound(state, playerId);
  if (!playerRound.hand.includes(cardId)) {
    throw new Error(`观众没有这张角色拍立得：${cardId}`);
  }

  return {
    ...state,
    playerRounds: {
      ...state.playerRounds,
      [playerId]: {
        ...playerRound,
        selectedScoringCardId: cardId,
      },
    },
  };
}

export function resolveRound(state: GameState): GameState {
  if (state.phase !== "resolution") {
    throw new Error("只能在结算阶段结算回合。");
  }

  const scores = state.seats.map((seat) => scorePlayer(state, seat.id));
  const updatedSeats = state.seats.map((seat) => {
    const score = scores.find((item) => item.playerId === seat.id);
    if (!score) {
      throw new Error(`缺少观众结算：${seat.id}`);
    }
    return {
      ...seat,
      score: seat.score + score.totalScore,
      familyGlory: seat.familyGlory || score.bonusSources.includes("family_glory"),
    };
  });
  const result: RoundResult = {
    round: state.round,
    scores,
  };
  const hasWinner = updatedSeats.some(
    (seat) => seat.familyGlory || seat.score >= state.victoryScore,
  );
  const returnedFinalHands = state.seats.flatMap(
    (seat) => state.playerRounds[seat.id]?.hand ?? [],
  );

  return {
    ...state,
    seats: updatedSeats,
    phase: hasWinner ? "game_over" : "setup",
    discardPile: [...state.discardPile, ...returnedFinalHands],
    roundResults: [...state.roundResults, result],
    log: [...state.log, `第 ${state.round} 轮结算完成。`],
  };
}

export function getCardById(cardId: string): CharacterCard {
  const card = CHARACTER_CARDS.find((item) => item.id === cardId);
  if (!card) {
    throw new Error(`未知角色拍立得：${cardId}`);
  }
  return card;
}

export function getWinners(state: GameState): PlayerSeat[] {
  if (state.phase !== "game_over") {
    return [];
  }

  const gloryWinners = state.seats.filter((seat) => seat.familyGlory);
  if (gloryWinners.length > 0) {
    return gloryWinners;
  }

  const maxScore = Math.max(...state.seats.map((seat) => seat.score));
  return state.seats.filter((seat) => seat.score === maxScore);
}

export function getRequiredDiscardCountForPlayer(
  state: GameState,
  playerId: string,
): number {
  return getRequiredDiscardCount(state, playerId);
}

export function estimateCardValue(
  state: GameState,
  playerId: string,
  cardId: string,
): number {
  const card = getCardById(cardId);
  const evaluation = evaluateCardConditionForPlayer(state, playerId, cardId);
  const estimateScore = getCardEstimateScoreValue(card);

  if (evaluation.met) {
    return estimateScore + getPotentialBonusEstimate(state, playerId, cardId);
  }

  if (state.drawnMarkers.length >= 10) {
    return 0;
  }

  return estimateScore * 0.45 + getPotentialBonusEstimate(state, playerId, cardId);
}

export function evaluateCardConditionForPlayer(
  state: GameState,
  playerId: string,
  cardId: string,
) {
  const card = getCardById(cardId);
  return evaluateCondition(card.condition, getEffectiveMarkersForCard(state, playerId, cardId));
}

function createSeats(
  playerCount: 2 | 3 | 4,
  humanRoleId: PlayerRoleId = "ghostwriter",
): PlayerSeat[] {
  const aiRoles: PlayerRoleId[] = [
    "stage_manager",
    "casino_backer",
    "bartender",
  ];

  return Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    kind: index === 0 ? "human" : "ai",
    name: index === 0 ? "观众" : `AI ${index}`,
    roleId: index === 0 ? humanRoleId : aiRoles[(index - 1) % aiRoles.length]!,
    score: 0,
    familyGlory: false,
  }));
}

function createPlayerRoundState(hand: string[]): PlayerRoundState {
  return {
    hand,
    discardedThisRound: [],
    selectedScoringCardId: null,
    wageredCardId: null,
    casinoBackerDeclared: false,
    usedRoleAbility: false,
    stageManagedCardId: null,
    ghostwriterDiscardPending: false,
    deferredDiscardCount: 0,
    currentDiscardReduction: 0,
  };
}

function getDrawIndex(phase: RoundPhase): number {
  switch (phase) {
    case "draw_1":
      return 0;
    case "draw_2":
      return 1;
    case "draw_3":
      return 2;
    case "draw_4":
      return 3;
    default:
      return -1;
  }
}

function getRequiredDiscardCount(state: GameState, playerId: string): number {
  const phase = state.phase;
  const playerRound = getPlayerRound(state, playerId);
  const baseCount = getBaseDiscardCount(phase);
  const required =
    baseCount +
    playerRound.deferredDiscardCount -
    playerRound.currentDiscardReduction * 2;

  return Math.max(0, required);
}

function getBaseDiscardCount(phase: RoundPhase): number {
  switch (phase) {
    case "discard_1":
    case "discard_2":
    case "discard_3":
      return 1;
    default:
      throw new Error(`当前阶段不能弃置：${phase}`);
  }
}

function getExpectedHandSize(phase: RoundPhase): number {
  switch (phase) {
    case "discard_1":
      return 4;
    case "discard_2":
      return 3;
    case "discard_3":
      return FINAL_HAND_SIZE;
    default:
      throw new Error(`当前阶段不需要检查弃置：${phase}`);
  }
}

function allPlayersAtExpectedHandSize(state: GameState): boolean {
  const expected = getExpectedHandSize(state.phase);
  return state.seats.every(
    (seat) =>
      !getPlayerRound(state, seat.id).ghostwriterDiscardPending &&
      getPlayerRound(state, seat.id).hand.length ===
      expected + getPlayerRound(state, seat.id).deferredDiscardCount,
  );
}

function getPlayerRound(
  state: GameState,
  playerId: string,
): PlayerRoundState {
  const playerRound = state.playerRounds[playerId];
  if (!playerRound) {
    throw new Error(`缺少观众回合状态：${playerId}`);
  }
  return playerRound;
}

function getSeatName(state: GameState, playerId: string): string {
  return state.seats.find((seat) => seat.id === playerId)?.name ?? playerId;
}

function getSeat(state: GameState, playerId: string): PlayerSeat {
  const seat = state.seats.find((item) => item.id === playerId);
  if (!seat) {
    throw new Error(`未知观众：${playerId}`);
  }
  return seat;
}

function scorePlayer(state: GameState, playerId: string): ScoringBreakdown {
  const playerRound = getPlayerRound(state, playerId);
  const candidates = playerRound.selectedScoringCardId
    ? [playerRound.selectedScoringCardId]
    : playerRound.hand;

  const scored = candidates
    .map((cardId) => {
      const card = getCardById(cardId);
      const evaluation = evaluateCardConditionForPlayer(state, playerId, cardId);
      return {
        card,
        evaluation,
      };
    })
    .filter((item) => item.evaluation.met)
    .sort(
      (left, right) =>
        getAutomaticScoringValue(state, playerId, right.card, playerRound.hand) -
          getAutomaticScoringValue(state, playerId, left.card, playerRound.hand) ||
        getCardScoreValue(right.card) - getCardScoreValue(left.card),
    )[0];

  if (!scored) {
    return {
      playerId,
      cardId: null,
      baseScore: 0,
      bonusScore: 0,
      totalScore: 0,
      success: false,
      reason: "没有满足条件的角色拍立得。",
      bonusReasons: [],
      bonusSources: [],
      bondIds: [],
    };
  }

  const bonusReasons: string[] = [];
  const bonusSources: BonusSource[] = [];
  let bonusScore = 0;

  if (scored.card.score === "family_glory") {
    return {
      playerId,
      cardId: scored.card.id,
      baseScore: 0,
      bonusScore: 0,
      totalScore: 0,
      success: true,
      reason: scored.evaluation.reason,
      bonusReasons: ["家族荣光"],
      bonusSources: ["family_glory"],
      bondIds: [],
    };
  }

  if (playerRound.wageredCardId === scored.card.id) {
    bonusScore += 1;
    bonusReasons.push("签署拍立得 +1");
    bonusSources.push("wager");
  }

  const seat = getSeat(state, playerId);
  if (
    seat.roleId === "casino_backer" &&
    playerRound.casinoBackerDeclared &&
    scored.card.tags.includes("gamble") &&
    getCardScoreValue(scored.card) >= 4 &&
    playerRound.wageredCardId !== scored.card.id
  ) {
    bonusScore += 1;
    bonusReasons.push("赌场投资人 +1");
    bonusSources.push("casino_backer");
  }

  const activeBond = getActiveBond(state, playerId, scored.card.id, playerRound.hand);
  if (activeBond) {
    bonusScore += activeBond.bonus;
    bonusReasons.push(`人物羁绊：${activeBond.name} +${activeBond.bonus}`);
    bonusSources.push("bond");
  }

  const cappedBonus = Math.min(bonusScore, MAX_ROUND_BONUS);

  return {
    playerId,
    cardId: scored.card.id,
    baseScore: scored.card.score,
    bonusScore: cappedBonus,
    totalScore: scored.card.score + cappedBonus,
    success: true,
    reason: scored.evaluation.reason,
    bonusReasons:
      cappedBonus < bonusScore
        ? [...bonusReasons, `奖励上限 ${MAX_ROUND_BONUS}`]
        : bonusReasons,
    bonusSources:
      cappedBonus < bonusScore ? [...bonusSources, "cap"] : bonusSources,
    bondIds: activeBond ? [activeBond.id] : [],
  };
}

function getAutomaticScoringValue(
  state: GameState,
  playerId: string,
  card: CharacterCard,
  finalHand: readonly string[],
): number {
  const playerRound = getPlayerRound(state, playerId);
  const seat = getSeat(state, playerId);
  let bonusScore = 0;

  if (playerRound.wageredCardId === card.id) {
    bonusScore += 1;
  }

  if (
    seat.roleId === "casino_backer" &&
    playerRound.casinoBackerDeclared &&
    card.tags.includes("gamble") &&
    getCardScoreValue(card) >= 4 &&
    playerRound.wageredCardId !== card.id
  ) {
    bonusScore += 1;
  }

  bonusScore += getActiveBond(state, playerId, card.id, finalHand)?.bonus ?? 0;

  return getCardScoreValue(card) + Math.min(bonusScore, MAX_ROUND_BONUS);
}

function getCardScoreValue(card: CharacterCard): number {
  return card.score === "family_glory" ? 99 : card.score;
}

function getCardEstimateScoreValue(card: CharacterCard): number {
  return card.score === "family_glory" ? 8 : card.score;
}

function getActiveBond(
  state: GameState,
  playerId: string,
  scoredCardId: string,
  finalHand: readonly string[],
): (typeof BOND_RULES)[number] | undefined {
  return BOND_RULES.find((bond) => {
    if (!bond.characterIds.includes(scoredCardId)) {
      return false;
    }

    if (!bond.characterIds.every((cardId) => finalHand.includes(cardId))) {
      return false;
    }

    return bond.characterIds.some((cardId) =>
      evaluateCardConditionForPlayer(state, playerId, cardId).met,
    );
  });
}

function getEffectiveMarkersForCard(
  state: GameState,
  playerId: string,
  cardId: string,
): MarkerCategory[] {
  const playerRound = getPlayerRound(state, playerId);
  return playerRound.stageManagedCardId === cardId
    ? [...state.drawnMarkers, "stage"]
    : state.drawnMarkers;
}

function getPotentialBonusEstimate(
  state: GameState,
  playerId: string,
  cardId: string,
): number {
  const seat = getSeat(state, playerId);
  const playerRound = getPlayerRound(state, playerId);
  let bonus = 0;

  if (playerRound.wageredCardId === cardId) {
    bonus += 1;
  }

  if (
    seat.roleId === "casino_backer" &&
    playerRound.casinoBackerDeclared &&
    getCardById(cardId).tags.includes("gamble")
  ) {
    bonus += 1;
  }

  const bondBonus = BOND_RULES.find(
    (bond) =>
      bond.characterIds.includes(cardId) &&
      bond.characterIds.some((bondCardId) =>
        playerRound.hand.includes(bondCardId),
      ),
  )?.bonus;

  return Math.min(MAX_ROUND_BONUS, bonus + (bondBonus ?? 0));
}

function getNextDeferredDiscardCount(
  phase: RoundPhase,
  playerRound: PlayerRoundState,
  discardedCount: number,
): number {
  const baseCount = getBaseDiscardCount(phase);
  const paidDeferred = Math.max(
    0,
    discardedCount - baseCount + playerRound.currentDiscardReduction,
  );

  return Math.max(0, playerRound.deferredDiscardCount - paidDeferred);
}

function assertCanUseRoleAbility(state: GameState, playerId: string): void {
  const playerRound = getPlayerRound(state, playerId);
  if (playerRound.usedRoleAbility) {
    throw new Error("本轮已经使用过观众技能。");
  }
}

function assertDiscardPhase(phase: RoundPhase): void {
  if (
    phase !== "discard_1" &&
    phase !== "discard_2" &&
    phase !== "discard_3"
  ) {
    throw new Error(`当前阶段不能使用该技能：${phase}`);
  }
}

function ensureDeckHasCards(
  characterDeck: string[],
  discardPile: string[],
  required: number,
  random: RandomSource,
): { characterDeck: string[]; discardPile: string[] } {
  if (characterDeck.length >= required) {
    return { characterDeck, discardPile };
  }

  const refilledDeck = [...characterDeck, ...shuffle(discardPile, random)];
  if (refilledDeck.length < required) {
    throw new Error("角色拍立得数量不足，无法发牌。");
  }

  return {
    characterDeck: refilledDeck,
    discardPile: [],
  };
}
