import { BOND_RULES } from "./bonds";
import { CHARACTER_CARDS } from "./characters";
import { evaluateCondition } from "./conditions";
import { getCardById } from "./engine";
import { createMarkerBag } from "./markers";
import { defaultRandom, shuffle, type RandomSource } from "./random";
import type {
  CompetitionGameState,
  CompetitionPlayerResult,
  CompetitionRegistration,
  MarkerCategory,
  PlayerRoleId,
  PlayerSeat,
} from "./types";

export type CreateCompetitionGameOptions = {
  playerCount: 2 | 3 | 4;
  targetScore?: number;
  random?: RandomSource;
};

const COMPETITION_DRAW_STEPS = [4, 3, 2, 1] as const;
const COMPETITION_DEFAULT_TARGET_SCORE = 15;
const COMPETITION_FAMILY_GLORY_SCORE = 8;

export function createCompetitionGame(
  options: CreateCompetitionGameOptions,
): CompetitionGameState {
  const random = options.random ?? defaultRandom;
  const seats = createCompetitionSeats(options.playerCount);
  const emptyBySeat = Object.fromEntries(seats.map((seat) => [seat.id, []]));
  const state: CompetitionGameState = {
    seats,
    targetScore: options.targetScore ?? COMPETITION_DEFAULT_TARGET_SCORE,
    round: 0,
    turn: 0,
    phase: "round_result",
    markerBags: {},
    playerMarkers: {},
    market: [],
    characterDeck: shuffle(
      CHARACTER_CARDS.map((card) => card.id),
      random,
    ),
    discardPile: [],
    registrations: Object.fromEntries(seats.map((seat) => [seat.id, null])),
    turnActions: Object.fromEntries(seats.map((seat) => [seat.id, false])),
    archives: emptyBySeat,
    unlockedBondIds: Object.fromEntries(seats.map((seat) => [seat.id, []])),
    roundResults: [],
    priorityOrder: seats.map((seat) => seat.id),
    log: [`创建 ${options.playerCount} 人竞争模式。`],
  };

  return startCompetitionRound(state, random);
}

export function startCompetitionRound(
  state: CompetitionGameState,
  random: RandomSource = defaultRandom,
): CompetitionGameState {
  if (state.phase === "game_over") {
    throw new Error("对局已经结束。");
  }

  const marketSize = state.seats.length + 1;
  const deck = ensureCompetitionDeckHasCards(
    state.characterDeck,
    state.discardPile,
    marketSize,
    random,
  );
  const market = deck.characterDeck.slice(0, marketSize);
  const markerBags = Object.fromEntries(
    state.seats.map((seat) => [seat.id, shuffle(createMarkerBag(), random)]),
  ) as Record<string, MarkerCategory[]>;
  const drawn = drawCompetitionMarkers(markerBags, {}, 0);
  const priorityOrder = shuffle(
    state.seats.map((seat) => seat.id),
    random,
  );

  return {
    ...state,
    round: state.round + 1,
    turn: 1,
    phase: "register",
    markerBags: drawn.markerBags,
    playerMarkers: drawn.playerMarkers,
    market,
    characterDeck: deck.characterDeck.slice(marketSize),
    discardPile: deck.discardPile,
    registrations: Object.fromEntries(state.seats.map((seat) => [seat.id, null])),
    turnActions: Object.fromEntries(state.seats.map((seat) => [seat.id, false])),
    priorityOrder,
    log: [
      ...state.log,
      `竞争模式第 ${state.round + 1} 小局开始，场面翻开 ${marketSize} 张拍立得。`,
    ],
  };
}

export function registerCompetitionCard(
  state: CompetitionGameState,
  playerId: string,
  cardId: string,
): CompetitionGameState {
  assertCompetitionRegisterPhase(state);
  assertCompetitionSeat(state, playerId);

  if (!state.market.includes(cardId)) {
    throw new Error("只能登记场面上的角色拍立得。");
  }

  if (state.registrations[playerId]) {
    throw new Error("本小局已经秘密登记，不能更换。");
  }

  return {
    ...state,
    registrations: {
      ...state.registrations,
      [playerId]: { cardId, turn: state.turn },
    },
    turnActions: {
      ...state.turnActions,
      [playerId]: true,
    },
    log: [...state.log, `${getCompetitionSeatName(state, playerId)} 完成秘密登记。`],
  };
}

export function passCompetitionTurn(
  state: CompetitionGameState,
  playerId: string,
): CompetitionGameState {
  assertCompetitionRegisterPhase(state);
  assertCompetitionSeat(state, playerId);

  if (state.registrations[playerId]) {
    throw new Error("已经秘密登记的观众不能再跳过登记。");
  }

  return {
    ...state,
    turnActions: {
      ...state.turnActions,
      [playerId]: true,
    },
    log: [...state.log, `${getCompetitionSeatName(state, playerId)} 暂不登记。`],
  };
}

export function runCompetitionAiForTurn(
  state: CompetitionGameState,
): CompetitionGameState {
  let nextState = state;

  for (const seat of state.seats) {
    if (seat.kind !== "ai") {
      continue;
    }

    if (nextState.registrations[seat.id] || nextState.turnActions[seat.id]) {
      continue;
    }

    const choice = chooseCompetitionAiCard(nextState, seat.id);
    nextState = choice
      ? registerCompetitionCard(nextState, seat.id, choice)
      : passCompetitionTurn(nextState, seat.id);
  }

  return nextState;
}

export function advanceCompetitionAfterActions(
  state: CompetitionGameState,
): CompetitionGameState {
  assertCompetitionRegisterPhase(state);
  const turnComplete = state.seats.every(
    (seat) => state.registrations[seat.id] || state.turnActions[seat.id],
  );

  if (!turnComplete) {
    return state;
  }

  if (state.turn >= COMPETITION_DRAW_STEPS.length) {
    return resolveCompetitionRound(state);
  }

  const drawn = drawCompetitionMarkers(
    state.markerBags,
    state.playerMarkers,
    state.turn,
  );

  return {
    ...state,
    turn: state.turn + 1,
    markerBags: drawn.markerBags,
    playerMarkers: drawn.playerMarkers,
    turnActions: Object.fromEntries(
      state.seats.map((seat) => [seat.id, Boolean(state.registrations[seat.id])]),
    ),
    log: [...state.log, `进入第 ${state.turn + 1} 回合。`],
  };
}

export function resolveCompetitionRound(
  state: CompetitionGameState,
): CompetitionGameState {
  assertCompetitionRegisterPhase(state);

  const registrationByCard = groupRegistrationsByCard(state.registrations);
  const winnersByCard = new Map<string, string>();

  for (const [cardId, registrations] of registrationByCard) {
    const winner = registrations
      .filter((registration) =>
        evaluateCompetitionCardCondition(state, registration.playerId, cardId).met,
      )
      .sort(
        (left, right) =>
          left.registration.turn - right.registration.turn ||
          state.priorityOrder.indexOf(left.playerId) -
            state.priorityOrder.indexOf(right.playerId),
      )[0];

    if (winner) {
      winnersByCard.set(cardId, winner.playerId);
    }
  }

  const nextArchives = cloneStringRecord(state.archives);
  const nextUnlockedBondIds = cloneStringRecord(state.unlockedBondIds);
  const playerResults: CompetitionPlayerResult[] = state.seats.map((seat) => {
    const registration = state.registrations[seat.id];

    if (!registration) {
      return createCompetitionResult(seat.id, null, null, false, 0, 0, "本小局没有登记拍立得。", []);
    }

    const card = getCardById(registration.cardId);
    const evaluation = evaluateCompetitionCardCondition(state, seat.id, card.id);

    if (!evaluation.met) {
      return createCompetitionResult(
        seat.id,
        card.id,
        registration.turn,
        false,
        0,
        0,
        evaluation.reason,
        [],
      );
    }

    if (winnersByCard.get(card.id) !== seat.id) {
      return createCompetitionResult(
        seat.id,
        card.id,
        registration.turn,
        false,
        0,
        0,
        "登记冲突中失去优先权。",
        [],
      );
    }

    const baseScore = getCompetitionCardScore(card.id);
    const triggeredBonds = getCompetitionTriggeredBonds(
      card.id,
      nextArchives[seat.id] ?? [],
      nextUnlockedBondIds[seat.id] ?? [],
    );
    const bonusScore = triggeredBonds.length;
    nextArchives[seat.id] = [...(nextArchives[seat.id] ?? []), card.id];
    nextUnlockedBondIds[seat.id] = [
      ...(nextUnlockedBondIds[seat.id] ?? []),
      ...triggeredBonds,
    ];

    return createCompetitionResult(
      seat.id,
      card.id,
      registration.turn,
      true,
      baseScore,
      bonusScore,
      bonusScore > 0
        ? `达成条件，并触发 ${bonusScore} 条跨小局羁绊。`
        : "达成条件。",
      triggeredBonds,
    );
  });

  const updatedSeats = state.seats.map((seat) => {
    const result = playerResults.find((item) => item.playerId === seat.id);
    return {
      ...seat,
      score: seat.score + (result?.totalScore ?? 0),
    };
  });
  const hasWinner = updatedSeats.some((seat) => seat.score >= state.targetScore);

  return {
    ...state,
    seats: updatedSeats,
    phase: hasWinner ? "game_over" : "round_result",
    archives: nextArchives,
    unlockedBondIds: nextUnlockedBondIds,
    roundResults: [
      ...state.roundResults,
      {
        round: state.round,
        market: state.market,
        priorityOrder: state.priorityOrder,
        playerResults,
      },
    ],
    discardPile: [...state.discardPile, ...state.market],
    market: [],
    log: [...state.log, `第 ${state.round} 小局结算完成。`],
  };
}

export function getCompetitionWinners(state: CompetitionGameState): PlayerSeat[] {
  const maxScore = Math.max(...state.seats.map((seat) => seat.score));
  return state.seats.filter((seat) => seat.score === maxScore);
}

export function evaluateCompetitionCardCondition(
  state: CompetitionGameState,
  playerId: string,
  cardId: string,
) {
  return evaluateCondition(getCardById(cardId).condition, state.playerMarkers[playerId] ?? []);
}

export function getCompetitionCardScore(cardId: string): number {
  const card = getCardById(cardId);
  return card.score === "family_glory" ? COMPETITION_FAMILY_GLORY_SCORE : card.score;
}

function drawCompetitionMarkers(
  markerBags: Record<string, MarkerCategory[]>,
  currentMarkers: Record<string, MarkerCategory[]>,
  drawIndex: number,
) {
  const drawCount = COMPETITION_DRAW_STEPS[drawIndex];

  if (drawCount === undefined) {
    throw new Error(`未知竞争模式抽取回合：${drawIndex}`);
  }

  const nextBags: Record<string, MarkerCategory[]> = {};
  const nextMarkers: Record<string, MarkerCategory[]> = {};

  for (const [playerId, bag] of Object.entries(markerBags)) {
    if (bag.length < drawCount) {
      throw new Error("积点袋数量不足。");
    }

    nextBags[playerId] = bag.slice(drawCount);
    nextMarkers[playerId] = [
      ...(currentMarkers[playerId] ?? []),
      ...bag.slice(0, drawCount),
    ];
  }

  return {
    markerBags: nextBags,
    playerMarkers: nextMarkers,
  };
}

function createCompetitionSeats(playerCount: 2 | 3 | 4): PlayerSeat[] {
  const aiRoles: PlayerRoleId[] = ["stage_manager", "casino_backer", "bartender"];
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    kind: index === 0 ? "human" : "ai",
    name: index === 0 ? "你" : `AI ${index}`,
    roleId: index === 0 ? "ghostwriter" : aiRoles[(index - 1) % aiRoles.length]!,
    score: 0,
    familyGlory: false,
  }));
}

function ensureCompetitionDeckHasCards(
  characterDeck: string[],
  discardPile: string[],
  needed: number,
  random: RandomSource,
) {
  if (characterDeck.length >= needed) {
    return { characterDeck, discardPile };
  }

  const refilledDeck = [...characterDeck, ...shuffle(discardPile, random)];
  if (refilledDeck.length < needed) {
    throw new Error("角色拍立得牌堆数量不足。");
  }

  return {
    characterDeck: refilledDeck,
    discardPile: [],
  };
}

function chooseCompetitionAiCard(
  state: CompetitionGameState,
  playerId: string,
): string | null {
  const viableCards = state.market
    .map((cardId) => ({
      cardId,
      met: evaluateCompetitionCardCondition(state, playerId, cardId).met,
      score: getCompetitionCardScore(cardId),
    }))
    .filter((item) => item.met)
    .sort((left, right) => right.score - left.score);

  if (viableCards[0]) {
    return viableCards[0].cardId;
  }

  if (state.turn < COMPETITION_DRAW_STEPS.length) {
    return null;
  }

  return [...state.market].sort(
    (left, right) => getCompetitionCardScore(right) - getCompetitionCardScore(left),
  )[0] ?? null;
}

function groupRegistrationsByCard(
  registrations: Record<string, CompetitionRegistration | null>,
) {
  const grouped = new Map<
    string,
    Array<{ playerId: string; registration: CompetitionRegistration }>
  >();

  for (const [playerId, registration] of Object.entries(registrations)) {
    if (!registration) {
      continue;
    }

    grouped.set(registration.cardId, [
      ...(grouped.get(registration.cardId) ?? []),
      { playerId, registration },
    ]);
  }

  return grouped;
}

function getCompetitionTriggeredBonds(
  newCardId: string,
  archive: string[],
  unlockedBondIds: string[],
) {
  return BOND_RULES.filter(
    (bond) =>
      !unlockedBondIds.includes(bond.id) &&
      bond.characterIds.includes(newCardId) &&
      bond.characterIds.some((cardId) => archive.includes(cardId)),
  ).map((bond) => bond.id);
}

function createCompetitionResult(
  playerId: string,
  cardId: string | null,
  registrationTurn: number | null,
  success: boolean,
  baseScore: number,
  bonusScore: number,
  reason: string,
  bondIds: string[],
): CompetitionPlayerResult {
  return {
    playerId,
    cardId,
    registrationTurn,
    success,
    baseScore,
    bonusScore,
    totalScore: baseScore + bonusScore,
    reason,
    bondIds,
  };
}

function cloneStringRecord(record: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, [...value]]),
  );
}

function assertCompetitionRegisterPhase(state: CompetitionGameState): void {
  if (state.phase !== "register") {
    throw new Error("当前不是竞争模式登记阶段。");
  }
}

function assertCompetitionSeat(state: CompetitionGameState, playerId: string): void {
  if (!state.seats.some((seat) => seat.id === playerId)) {
    throw new Error(`未知观众：${playerId}`);
  }
}

function getCompetitionSeatName(state: CompetitionGameState, playerId: string): string {
  return state.seats.find((seat) => seat.id === playerId)?.name ?? playerId;
}
