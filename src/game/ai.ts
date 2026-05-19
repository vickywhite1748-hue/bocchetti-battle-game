import {
  advanceAfterDiscards,
  discardCards,
  discardGhostwriterCard,
  drawCurrentStep,
  estimateCardValue,
  getRequiredDiscardCountForPlayer,
  placeWager,
  resolveRound,
  selectScoringCard,
  startRound,
  useBartenderAbility,
  useCasinoBackerAbility,
  useGhostwriterAbility,
  useStageManagerAbility,
} from "./engine";
import { getCardById } from "./engine";
import { defaultRandom, type RandomSource } from "./random";
import type { GameState, PlayerSeat } from "./types";

export function runAiForCurrentDecision(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  if (isDiscardPhase(state.phase)) {
    return runAiDiscardPhase(state, random);
  }

  if (state.phase === "resolution") {
    return runAiResolution(state);
  }

  return state;
}

export function advanceAutomaticPhase(
  state: GameState,
  random: RandomSource = defaultRandom,
): GameState {
  switch (state.phase) {
    case "setup":
      return startRound(state, random);
    case "draw_1":
    case "draw_2":
    case "draw_3":
    case "draw_4":
      return drawCurrentStep(state);
    case "discard_1":
    case "discard_2":
    case "discard_3": {
      const acted = runAiDiscardPhase(state, random);
      return canAdvanceAfterDiscards(acted) ? advanceAfterDiscards(acted) : acted;
    }
    case "resolution":
      return resolveRound(runAiResolution(state));
    case "game_over":
      return state;
    default: {
      const exhaustive: never = state.phase;
      return exhaustive;
    }
  }
}

export function runGameWithAiOnly(
  initialState: GameState,
  random: RandomSource = defaultRandom,
  maxSteps = 500,
): GameState {
  let state = initialState;

  for (let step = 0; step < maxSteps && state.phase !== "game_over"; step += 1) {
    if (state.phase === "resolution") {
      state = resolveRound(runAiResolution(state));
      continue;
    }

    if (isDiscardPhase(state.phase)) {
      state = runAiDiscardPhase(state, random);
      if (canAdvanceAfterDiscards(state)) {
        state = advanceAfterDiscards(state);
      }
      continue;
    }

    state = advanceAutomaticPhase(state, random);
  }

  return state;
}

function runAiDiscardPhase(
  state: GameState,
  random: RandomSource,
): GameState {
  return state.seats
    .filter((seat) => seat.kind === "ai")
    .reduce((nextState, seat) => runAiDiscardTurn(nextState, seat, random), state);
}

function runAiDiscardTurn(
  state: GameState,
  seat: PlayerSeat,
  random: RandomSource,
): GameState {
  if (isSeatAtExpectedHandSize(state, seat.id)) {
    return state;
  }

  let nextState = maybeUseAiAbility(state, seat, random);
  if (isSeatAtExpectedHandSize(nextState, seat.id)) {
    return nextState;
  }

  nextState = maybePlaceAiWager(nextState, seat);

  const required = getRequiredDiscardCountForPlayer(nextState, seat.id);
  if (required === 0) {
    return nextState;
  }

  const hand = nextState.playerRounds[seat.id]?.hand ?? [];
  if (hand.length < required) {
    throw new Error(
      `${seat.name} 拍立得不足，无法弃置 ${required} 张。round=${nextState.round}, phase=${nextState.phase}, hand=${hand.length}, deck=${nextState.characterDeck.length}, discard=${nextState.discardPile.length}`,
    );
  }

  const discards = chooseWorstCards(nextState, seat.id, required, hand);

  return discardCards(nextState, seat.id, discards);
}

function maybeUseAiAbility(
  state: GameState,
  seat: PlayerSeat,
  random: RandomSource,
): GameState {
  const playerRound = state.playerRounds[seat.id];
  if (!playerRound || playerRound.usedRoleAbility) {
    return state;
  }

  switch (seat.roleId) {
    case "ghostwriter": {
      if (state.phase !== "discard_1" && state.phase !== "discard_2") {
        return state;
      }
      const drawn = useGhostwriterAbility(state, seat.id, random);
      const updatedHand = drawn.playerRounds[seat.id]?.hand ?? [];
      const discard = chooseWorstCards(drawn, seat.id, 1, updatedHand)[0];
      return discard ? discardGhostwriterCard(drawn, seat.id, discard) : drawn;
    }
    case "stage_manager": {
      if (state.phase !== "discard_1") {
        return state;
      }
      const bestTarget = chooseStageManagerTarget(state, seat.id, playerRound.hand);
      return bestTarget ? useStageManagerAbility(state, seat.id, bestTarget) : state;
    }
    case "casino_backer": {
      if (state.phase !== "discard_2") {
        return state;
      }
      const hasGambleCard = playerRound.hand.some((cardId) =>
        getCardById(cardId).tags.includes("gamble"),
      );
      const bestGambleValue = Math.max(
        ...playerRound.hand
          .filter((cardId) => getCardById(cardId).tags.includes("gamble"))
          .map((cardId) => estimateCardValue(state, seat.id, cardId)),
        0,
      );
      return hasGambleCard && bestGambleValue >= 4
        ? useCasinoBackerAbility(state, seat.id)
        : state;
    }
    case "bartender": {
      if (state.phase !== "discard_1" && state.phase !== "discard_2") {
        return state;
      }
      const viableCards = playerRound.hand.filter(
        (cardId) => estimateCardValue(state, seat.id, cardId) > 1.4,
      );
      return viableCards.length >= 3 ? useBartenderAbility(state, seat.id) : state;
    }
    default:
      return state;
  }
}

function chooseStageManagerTarget(
  state: GameState,
  playerId: string,
  hand: readonly string[],
): string | null {
  return (
    [...hand]
      .map((cardId) => {
        const currentValue = estimateCardValue(state, playerId, cardId);
        const boostedState = {
          ...state,
          playerRounds: {
            ...state.playerRounds,
            [playerId]: {
              ...state.playerRounds[playerId]!,
              stageManagedCardId: cardId,
            },
          },
        };
        return {
          cardId,
          gain: estimateCardValue(boostedState, playerId, cardId) - currentValue,
          value: estimateCardValue(boostedState, playerId, cardId),
        };
      })
      .filter((item) => item.gain > 0)
      .sort((left, right) => right.gain - left.gain || right.value - left.value)[0]
      ?.cardId ?? null
  );
}

function maybePlaceAiWager(state: GameState, seat: PlayerSeat): GameState {
  if (state.phase !== "discard_2") {
    return state;
  }

  const playerRound = state.playerRounds[seat.id];
  if (!playerRound || playerRound.wageredCardId) {
    return state;
  }

  const best = chooseBestCard(state, seat.id, playerRound.hand);
  if (!best || estimateCardValue(state, seat.id, best) < 4) {
    return state;
  }

  return placeWager(state, seat.id, best);
}

function runAiResolution(state: GameState): GameState {
  return state.seats
    .filter((seat) => seat.kind === "ai")
    .reduce((nextState, seat) => {
      const playerRound = nextState.playerRounds[seat.id];
      if (!playerRound || playerRound.selectedScoringCardId) {
        return nextState;
      }

      const best = chooseBestCard(nextState, seat.id, playerRound.hand);
      return best ? selectScoringCard(nextState, seat.id, best) : nextState;
    }, state);
}

function chooseWorstCards(
  state: GameState,
  playerId: string,
  count: number,
  hand: readonly string[],
): string[] {
  if (count <= 0) {
    return [];
  }

  return [...hand]
    .sort(
      (left, right) =>
        estimateCardValue(state, playerId, left) -
        estimateCardValue(state, playerId, right),
    )
    .slice(0, count);
}

function chooseBestCard(
  state: GameState,
  playerId: string,
  hand: readonly string[],
): string | null {
  return (
    [...hand].sort(
      (left, right) =>
        estimateCardValue(state, playerId, right) -
        estimateCardValue(state, playerId, left),
    )[0] ?? null
  );
}

function canAdvanceAfterDiscards(state: GameState): boolean {
  if (!isDiscardPhase(state.phase)) {
    return false;
  }

  return state.seats.every((seat) => isSeatAtExpectedHandSize(state, seat.id));
}

function isDiscardPhase(phase: GameState["phase"]): boolean {
  return phase === "discard_1" || phase === "discard_2" || phase === "discard_3";
}

function getExpectedHandSizeForPhase(phase: GameState["phase"]): number {
  switch (phase) {
    case "discard_1":
      return 4;
    case "discard_2":
      return 3;
    case "discard_3":
      return 2;
    default:
      throw new Error(`当前阶段不需要检查弃置：${phase}`);
  }
}

function isSeatAtExpectedHandSize(state: GameState, playerId: string): boolean {
  if (!isDiscardPhase(state.phase)) {
    return false;
  }

  const playerRound = state.playerRounds[playerId];
  return Boolean(
    playerRound &&
      playerRound.hand.length ===
        getExpectedHandSizeForPhase(state.phase) + playerRound.deferredDiscardCount,
  );
}
