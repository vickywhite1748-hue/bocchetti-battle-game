import { describe, expect, it } from "vitest";
import {
  CHARACTER_CARDS,
  advanceAfterDiscards,
  cancelWager,
  createGame,
  discardCards,
  discardGhostwriterCard,
  drawCurrentStep,
  evaluateCardConditionForPlayer,
  evaluateCondition,
  getWinners,
  placeWager,
  resolveRound,
  selectScoringCard,
  useBartenderAbility,
  useCasinoBackerAbility,
  useGhostwriterAbility,
  useStageManagerAbility,
} from "./index";
import type { GameState, MarkerCategory } from "./types";

const stableRandom = () => 0;

describe("core engine", () => {
  it("creates a new round with seats, marker bag, and player hands", () => {
    const state = createGame({ playerCount: 4, random: stableRandom });

    expect(state.phase).toBe("draw_1");
    expect(state.round).toBe(1);
    expect(state.seats).toHaveLength(4);
    expect(state.markerBag).toHaveLength(18);
    expect(state.drawnMarkers).toHaveLength(0);

    for (const seat of state.seats) {
      expect(state.playerRounds[seat.id]?.hand).toHaveLength(5);
    }
  });

  it("draws markers through the planned 4/3/2/1 cadence", () => {
    let state = createGame({ playerCount: 2, random: stableRandom });

    state = drawCurrentStep(state);
    expect(state.phase).toBe("discard_1");
    expect(state.drawnMarkers).toHaveLength(4);

    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    expect(state.phase).toBe("draw_2");

    state = drawCurrentStep(state);
    expect(state.phase).toBe("discard_2");
    expect(state.drawnMarkers).toHaveLength(7);

    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);
    expect(state.phase).toBe("discard_3");
    expect(state.drawnMarkers).toHaveLength(9);

    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);
    expect(state.phase).toBe("resolution");
    expect(state.drawnMarkers).toHaveLength(10);
  });

  it("evaluates structured conditions against drawn markers", () => {
    const card = CHARACTER_CARDS.find((item) => item.id === "botti-rising-star");
    expect(card).toBeDefined();

    const passed = evaluateCondition(card!.condition, [
      "family",
      "family",
      "love",
    ]);
    const failed = evaluateCondition(card!.condition, ["family", "gang"]);

    expect(passed.met).toBe(true);
    expect(failed.met).toBe(false);
  });

  it("evaluates equal marker count conditions", () => {
    const card = CHARACTER_CARDS.find(
      (item) => item.id === "xiaohong-casino-host",
    );
    expect(card).toBeDefined();

    const passed = evaluateCondition(card!.condition, ["gamble", "stage"]);
    const failedAtZero = evaluateCondition(card!.condition, ["family", "love"]);
    const failedUnbalanced = evaluateCondition(card!.condition, [
      "gamble",
      "gamble",
      "stage",
    ]);

    expect(passed.met).toBe(true);
    expect(failedAtZero.met).toBe(false);
    expect(failedUnbalanced.met).toBe(false);
  });

  it("resolves a round and scores the best successful remaining card", () => {
    const state = createStateAtResolution(["family", "family", "love", "stage"]);
    const playerId = state.seats[0]!.id;
    const scoringCard = state.playerRounds[playerId]!.hand[0]!;
    const selected = selectScoringCard(state, playerId, scoringCard);
    const resolved = resolveRound(selected);

    expect(resolved.roundResults).toHaveLength(1);
    expect(resolved.seats[0]!.score).toBeGreaterThan(0);
    expect(resolved.phase).toBe("setup");
  });

  it("ends the game when a player reaches the victory score", () => {
    const state = createStateAtResolution(["family", "family", "love", "stage"]);
    const playerId = state.seats[0]!.id;
    const scoringCard = state.playerRounds[playerId]!.hand[0]!;
    const nearWin: GameState = {
      ...state,
      seats: state.seats.map((seat, index) =>
        index === 0 ? { ...seat, score: state.victoryScore - 1 } : seat,
      ),
    };
    const selected = selectScoringCard(nearWin, playerId, scoringCard);
    const resolved = resolveRound(selected);

    expect(resolved.phase).toBe("game_over");
    expect(getWinners(resolved).map((seat) => seat.id)).toContain(playerId);
  });

  it("ends the game immediately when a family glory card scores", () => {
    const state = createStateAtResolution([
      "family",
      "family",
      "gang",
      "gang",
      "stage",
      "gang",
    ]);
    const playerId = state.seats[0]!.id;
    const gloryState: GameState = {
      ...state,
      seats: state.seats.map((seat) => ({ ...seat, score: 0 })),
      playerRounds: {
        ...state.playerRounds,
        [playerId]: {
          ...state.playerRounds[playerId]!,
          hand: ["sonny-family-price", "botti-rising-star"],
        },
      },
    };

    const selected = selectScoringCard(gloryState, playerId, "sonny-family-price");
    const resolved = resolveRound(selected);
    const score = resolved.roundResults[0]!.scores[0]!;

    expect(resolved.phase).toBe("game_over");
    expect(resolved.seats[0]!.familyGlory).toBe(true);
    expect(getWinners(resolved).map((seat) => seat.id)).toEqual([playerId]);
    expect(score.bonusReasons).toContain("家族荣光");
  });

  it("adds wager bonus when the wagered scoring card succeeds", () => {
    const state = createStateAtResolution(["family", "family", "love", "stage"]);
    const playerId = state.seats[0]!.id;
    const cardId = "botti-rising-star";
    const wagered: GameState = {
      ...state,
      playerRounds: {
        ...state.playerRounds,
        [playerId]: {
          ...state.playerRounds[playerId]!,
          wageredCardId: cardId,
        },
      },
    };
    const selected = selectScoringCard(wagered, playerId, cardId);
    const resolved = resolveRound(selected);
    const score = resolved.roundResults[0]!.scores[0]!;

    expect(score.cardId).toBe(cardId);
    expect(score.bonusScore).toBe(1);
    expect(score.bonusReasons).toContain("签署拍立得 +1");
  });

  it("prioritizes a wagered card when automatic scoring cards tie", () => {
    const state = createStateAtResolution(["family", "family", "love", "stage"]);
    const playerId = state.seats[0]!.id;
    const wagered: GameState = {
      ...state,
      playerRounds: {
        ...state.playerRounds,
        [playerId]: {
          ...state.playerRounds[playerId]!,
          hand: ["botti-rising-star", "oscar-duet"],
          wageredCardId: "oscar-duet",
        },
      },
    };

    const resolved = resolveRound(wagered);
    const score = resolved.roundResults[0]!.scores[0]!;

    expect(score.cardId).toBe("oscar-duet");
    expect(score.bonusReasons).toContain("签署拍立得 +1");
  });

  it("combines wager and bond bonuses without a cap reason at the limit", () => {
    const base = createStateAtResolution(["family", "family", "gang", "stage"]);
    const playerId = base.seats[0]!.id;
    const casinoState: GameState = {
      ...base,
      playerRounds: {
        ...base.playerRounds,
        [playerId]: {
          ...base.playerRounds[playerId]!,
          hand: ["chichi-hidden-heir", "sonny-legalization"],
          wageredCardId: "chichi-hidden-heir",
        },
      },
    };
    const selected = selectScoringCard(
      casinoState,
      playerId,
      "chichi-hidden-heir",
    );
    const resolved = resolveRound(selected);
    const score = resolved.roundResults[0]!.scores[0]!;

    expect(score.baseScore).toBe(4);
    expect(score.bonusScore).toBe(2);
    expect(score.totalScore).toBe(6);
    expect(score.bonusReasons).toContain("签署拍立得 +1");
    expect(score.bonusReasons).toContain("人物羁绊：兄弟的裂缝 +1");
    expect(score.bonusReasons).not.toContain("奖励上限 2");
  });

  it("adds bond bonus when only the scoring bonded card succeeds", () => {
    const base = createStateAtResolution(["stage", "bar", "bar"]);
    const playerId = base.seats[0]!.id;
    const bondState: GameState = {
      ...base,
      playerRounds: {
        ...base.playerRounds,
        [playerId]: {
          ...base.playerRounds[playerId]!,
          hand: ["richard-drunk-door", "oscar-duet"],
        },
      },
    };

    const selected = selectScoringCard(bondState, playerId, "richard-drunk-door");
    const resolved = resolveRound(selected);
    const score = resolved.roundResults[0]!.scores[0]!;

    expect(score.cardId).toBe("richard-drunk-door");
    expect(score.bonusReasons).toContain("人物羁绊：舞台搭档 +1");
    expect(score.bondIds).toEqual(["richard-oscar"]);
  });

  it("places a wager only in the second discard phase", () => {
    let state = createGame({ playerCount: 2, random: stableRandom });
    state = drawCurrentStep(state);

    expect(() =>
      placeWager(
        state,
        state.seats[0]!.id,
        state.playerRounds[state.seats[0]!.id]!.hand[0]!,
      ),
    ).toThrow();

    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    const cardId = state.playerRounds[playerId]!.hand[0]!;
    const wagered = placeWager(state, playerId, cardId);

    expect(wagered.playerRounds[playerId]!.wageredCardId).toBe(cardId);
  });

  it("cancels a wager in the second discard phase", () => {
    let state = createGame({ playerCount: 2, random: stableRandom });
    state = drawCurrentStep(state);
    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    const cardId = state.playerRounds[playerId]!.hand[0]!;
    const wagered = placeWager(state, playerId, cardId);
    const canceled = cancelWager(wagered, playerId);

    expect(canceled.playerRounds[playerId]!.wageredCardId).toBeNull();
  });

  it("uses ghostwriter ability to draw before choosing a skill discard", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "ghostwriter",
      random: stableRandom,
    });
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    const beforeHand = state.playerRounds[playerId]!.hand;
    const discardId = beforeHand[0]!;
    const used = useGhostwriterAbility(state, playerId, stableRandom);

    expect(used.playerRounds[playerId]!.hand).toHaveLength(beforeHand.length + 1);
    expect(used.playerRounds[playerId]!.usedRoleAbility).toBe(true);
    expect(used.playerRounds[playerId]!.ghostwriterDiscardPending).toBe(true);

    expect(() => discardCards(used, playerId, [discardId])).toThrow();

    const discarded = discardGhostwriterCard(used, playerId, discardId);

    expect(discarded.playerRounds[playerId]!.hand).toHaveLength(beforeHand.length);
    expect(discarded.playerRounds[playerId]!.hand).not.toContain(discardId);
    expect(discarded.playerRounds[playerId]!.ghostwriterDiscardPending).toBe(false);
  });

  it("allows ghostwriter skill discard in the second discard phase", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "ghostwriter",
      random: stableRandom,
    });
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    state = discardCards(state, playerId, [
      state.playerRounds[playerId]!.hand[0]!,
    ]);
    state = discardCards(state, state.seats[1]!.id, [
      state.playerRounds[state.seats[1]!.id]!.hand[0]!,
    ]);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);

    const used = useGhostwriterAbility(state, playerId, stableRandom);
    const discardId = used.playerRounds[playerId]!.hand.at(-1)!;
    const discarded = discardGhostwriterCard(used, playerId, discardId);

    expect(discarded.phase).toBe("discard_2");
    expect(discarded.playerRounds[playerId]!.ghostwriterDiscardPending).toBe(false);
  });

  it("uses stage manager ability to rehearse one card with an extra stage marker", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "stage_manager",
      random: stableRandom,
    });
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    const targetCardId = state.playerRounds[playerId]!.hand[0]!;
    const used = useStageManagerAbility(state, playerId, targetCardId);

    expect(used.playerRounds[playerId]!.stageManagedCardId).toBe(targetCardId);
    expect(used.playerRounds[playerId]!.usedRoleAbility).toBe(true);
  });

  it("stage manager rehearsal can satisfy a card missing one stage marker", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "stage_manager",
      random: stableRandom,
    });
    const playerId = state.seats[0]!.id;
    const targetCardId = "stevie-manuscript";
    state = {
      ...state,
      phase: "discard_1",
      drawnMarkers: ["stage", "family"],
      playerRounds: {
        ...state.playerRounds,
        [playerId]: {
          ...state.playerRounds[playerId]!,
          hand: [targetCardId],
        },
      },
    };

    expect(evaluateCardConditionForPlayer(state, playerId, targetCardId).met).toBe(
      false,
    );
    const used = useStageManagerAbility(state, playerId, targetCardId);
    expect(evaluateCardConditionForPlayer(used, playerId, targetCardId).met).toBe(
      true,
    );
  });

  it("uses casino backer ability only in the second discard phase", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "casino_backer",
      random: stableRandom,
    });
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    expect(() => useCasinoBackerAbility(state, playerId)).toThrow();

    state = discardOneForEveryPlayer(state);
    state = advanceAfterDiscards(state);
    state = drawCurrentStep(state);

    const used = useCasinoBackerAbility(state, playerId);
    expect(used.playerRounds[playerId]!.casinoBackerDeclared).toBe(true);
    expect(used.playerRounds[playerId]!.usedRoleAbility).toBe(true);
  });

  it("uses bartender ability to defer one discard into the next discard phase", () => {
    let state = createGame({
      playerCount: 2,
      humanRoleId: "bartender",
      random: stableRandom,
    });
    state = drawCurrentStep(state);

    const playerId = state.seats[0]!.id;
    state = useBartenderAbility(state, playerId);
    state = discardCards(state, playerId, []);
    state = discardCards(state, state.seats[1]!.id, [
      state.playerRounds[state.seats[1]!.id]!.hand[0]!,
    ]);
    state = advanceAfterDiscards(state);
    expect(state.phase).toBe("draw_2");
    expect(state.playerRounds[playerId]!.hand).toHaveLength(5);
    expect(state.playerRounds[playerId]!.deferredDiscardCount).toBe(1);

    state = drawCurrentStep(state);
    state = discardCards(state, playerId, [
      state.playerRounds[playerId]!.hand[0]!,
      state.playerRounds[playerId]!.hand[1]!,
    ]);

    expect(state.playerRounds[playerId]!.hand).toHaveLength(3);
    expect(state.playerRounds[playerId]!.deferredDiscardCount).toBe(0);
  });
});

function discardOneForEveryPlayer(state: GameState): GameState {
  return state.seats.reduce((nextState, seat) => {
    const hand = nextState.playerRounds[seat.id]!.hand;
    return discardCards(nextState, seat.id, [hand[0]!]);
  }, state);
}

function createStateAtResolution(markers: MarkerCategory[]): GameState {
  const base = createGame({ playerCount: 2, random: stableRandom });
  const firstCard = "botti-rising-star";

  return {
    ...base,
    phase: "resolution",
    drawnMarkers: markers,
    playerRounds: Object.fromEntries(
      base.seats.map((seat) => [
        seat.id,
        {
          ...base.playerRounds[seat.id]!,
          hand: [firstCard, "mc-warmup"],
          discardedThisRound: [],
        },
      ]),
    ),
  };
}
