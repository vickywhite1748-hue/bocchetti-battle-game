import { describe, expect, it } from "vitest";
import {
  advanceCompetitionAfterActions,
  createCompetitionGame,
  getCompetitionCardScore,
  passCompetitionTurn,
  registerCompetitionCard,
  resolveCompetitionRound,
  startCompetitionRound,
} from "./competition";
import type { CompetitionGameState, MarkerCategory } from "./types";

const stableRandom = () => 0;

describe("competition mode", () => {
  it("opens player count plus one public polaroids", () => {
    const state = createCompetitionGame({ playerCount: 3, random: stableRandom });

    expect(state.market).toHaveLength(4);
    expect(state.turn).toBe(1);
    expect(Object.values(state.playerMarkers).map((markers) => markers.length)).toEqual([
      4,
      4,
      4,
    ]);
  });

  it("allows at most one secret registration per player per mini-round", () => {
    const state = createCompetitionGame({ playerCount: 2, random: stableRandom });
    const registered = registerCompetitionCard(state, "player-1", state.market[0]!);

    expect(registered.registrations["player-1"]).toEqual({
      cardId: state.market[0],
      turn: 1,
    });
    expect(() =>
      registerCompetitionCard(registered, "player-1", state.market[1]!),
    ).toThrow("本小局已经秘密登记");
  });

  it("draws 4, 3, 2, and 1 markers across four turns", () => {
    let state = createCompetitionGame({ playerCount: 2, random: stableRandom });

    state = passCompetitionTurn(state, "player-1");
    state = passCompetitionTurn(state, "player-2");
    state = advanceCompetitionAfterActions(state);
    expect(state.turn).toBe(2);
    expect(state.playerMarkers["player-1"]).toHaveLength(7);

    state = passCompetitionTurn(state, "player-1");
    state = passCompetitionTurn(state, "player-2");
    state = advanceCompetitionAfterActions(state);
    expect(state.turn).toBe(3);
    expect(state.playerMarkers["player-1"]).toHaveLength(9);

    state = passCompetitionTurn(state, "player-1");
    state = passCompetitionTurn(state, "player-2");
    state = advanceCompetitionAfterActions(state);
    expect(state.turn).toBe(4);
    expect(state.playerMarkers["player-1"]).toHaveLength(10);
  });

  it("keeps turn order after all players have registered", () => {
    let state = createCompetitionGame({ playerCount: 2, random: stableRandom });
    state = registerCompetitionCard(state, "player-1", state.market[0]!);
    state = registerCompetitionCard(state, "player-2", state.market[1]!);
    state = advanceCompetitionAfterActions(state);

    expect(state.phase).toBe("register");
    expect(state.turn).toBe(2);
    expect(state.playerMarkers["player-1"]).toHaveLength(7);

    state = advanceCompetitionAfterActions(state);
    expect(state.phase).toBe("register");
    expect(state.turn).toBe(3);
    expect(state.playerMarkers["player-1"]).toHaveLength(9);

    state = advanceCompetitionAfterActions(state);
    expect(state.phase).toBe("register");
    expect(state.turn).toBe(4);
    expect(state.playerMarkers["player-1"]).toHaveLength(10);

    state = advanceCompetitionAfterActions(state);
    expect(state.phase).toBe("round_result");
  });

  it("resolves duplicate registrations by registration turn before priority", () => {
    const base = createCompetitionStateForScoring({
      markers: {
        "player-1": ["family", "family", "stage"],
        "player-2": ["family", "family", "stage"],
      },
      market: ["botti-rising-star", "luciano-first-godfather", "luaco-soldier"],
    });
    const state: CompetitionGameState = {
      ...base,
      registrations: {
        ...base.registrations,
        "player-1": { cardId: "botti-rising-star", turn: 2 },
        "player-2": { cardId: "botti-rising-star", turn: 1 },
      },
    };

    const resolved = resolveCompetitionRound(state);
    const playerOne = resolved.roundResults[0]!.playerResults.find(
      (result) => result.playerId === "player-1",
    )!;
    const playerTwo = resolved.roundResults[0]!.playerResults.find(
      (result) => result.playerId === "player-2",
    )!;

    expect(playerOne.success).toBe(false);
    expect(playerOne.reason).toBe("登记冲突中失去优先权。");
    expect(playerTwo.success).toBe(true);
  });

  it("scores family glory as 8 points without direct victory", () => {
    const base = createCompetitionStateForScoring({
      targetScore: 15,
      markers: {
        "player-1": ["family", "family", "gang", "gang", "stage", "gang"],
        "player-2": [],
      },
      market: ["sonny-family-price", "botti-rising-star", "luaco-soldier"],
    });
    const state: CompetitionGameState = {
      ...base,
      playerMarkers: {
        ...base.playerMarkers,
        "player-1": ["family", "family", "gang", "gang", "stage", "gang"],
      },
      registrations: {
        ...base.registrations,
        "player-1": { cardId: "sonny-family-price", turn: 1 },
      },
    };

    const resolved = resolveCompetitionRound(state);
    const score = resolved.roundResults[0]!.playerResults[0]!;

    expect(getCompetitionCardScore("sonny-family-price")).toBe(8);
    expect(score.totalScore).toBe(8);
    expect(resolved.phase).toBe("round_result");
  });

  it("triggers cross-mini-round bonds once per player and keeps achievements mode-local", () => {
    let state = createCompetitionStateForScoring({
      markers: {
        "player-1": ["stage", "stage", "love"],
        "player-2": [],
      },
      market: ["botti-rising-star", "oscar-duet", "luaco-soldier"],
    });
    state = {
      ...state,
      registrations: {
        ...state.registrations,
        "player-1": { cardId: "oscar-duet", turn: 1 },
      },
    };
    const first = resolveCompetitionRound(state);
    const secondRound = startCompetitionRound(first, stableRandom);
    const second: CompetitionGameState = {
      ...secondRound,
      market: ["richard-drunk-door", "botti-rising-star", "luaco-soldier"],
      playerMarkers: {
        ...secondRound.playerMarkers,
        "player-1": ["stage", "bar", "bar"],
      },
      registrations: {
        ...secondRound.registrations,
        "player-1": { cardId: "richard-drunk-door", turn: 1 },
      },
    };

    const resolved = resolveCompetitionRound(second);
    const playerOne = resolved.roundResults.at(-1)!.playerResults.find(
      (result) => result.playerId === "player-1",
    )!;

    expect(first.unlockedBondIds["player-1"]).toEqual([]);
    expect(playerOne.bonusScore).toBe(1);
    expect(playerOne.bondIds).toEqual(["richard-oscar"]);
    expect(resolved.unlockedBondIds["player-1"]).toEqual(["richard-oscar"]);
  });
});

function createCompetitionStateForScoring(input: {
  markers: Record<string, MarkerCategory[]>;
  market: string[];
  targetScore?: number;
}): CompetitionGameState {
  const base = createCompetitionGame({
    playerCount: 2,
    targetScore: input.targetScore,
    random: stableRandom,
  });

  return {
    ...base,
    turn: 4,
    phase: "register",
    market: input.market,
    playerMarkers: {
      ...base.playerMarkers,
      ...input.markers,
    },
    registrations: {
      "player-1": null,
      "player-2": null,
    },
    turnActions: {
      "player-1": true,
      "player-2": true,
    },
    priorityOrder: ["player-1", "player-2"],
  };
}
