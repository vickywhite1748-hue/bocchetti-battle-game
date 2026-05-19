import { describe, expect, it } from "vitest";
import {
  createGame,
  drawCurrentStep,
  runAiForCurrentDecision,
  runGameWithAiOnly,
} from "./index";

const stableRandom = () => 0;

describe("AI decisions", () => {
  it("AI players discard during discard phases", () => {
    let state = createGame({ playerCount: 3, random: stableRandom });
    state = drawCurrentStep(state);

    const acted = runAiForCurrentDecision(state, stableRandom);

    expect(acted.playerRounds["player-1"]?.hand).toHaveLength(5);
    expect(acted.playerRounds["player-2"]?.hand).toHaveLength(4);
    expect(acted.playerRounds["player-3"]?.hand.length).toBeLessThanOrEqual(5);
  });

  it("can run an AI-only game to completion", () => {
    const state = createGame({ playerCount: 4, random: stableRandom });
    const aiOnly = {
      ...state,
      seats: state.seats.map((seat) => ({ ...seat, kind: "ai" as const })),
    };
    const finished = runGameWithAiOnly(aiOnly, stableRandom, 500);

    expect(finished.phase).toBe("game_over");
    expect(finished.roundResults.length).toBeGreaterThan(0);
    expect(finished.seats.some((seat) => seat.score >= finished.victoryScore)).toBe(
      true,
    );
  });

  it("AI can use configured role abilities without blocking progression", () => {
    let state = createGame({ playerCount: 4, random: stableRandom });
    state = {
      ...state,
      seats: state.seats.map((seat) => ({ ...seat, kind: "ai" as const })),
    };
    state = drawCurrentStep(state);
    const acted = runAiForCurrentDecision(state, stableRandom);

    expect(acted.seats.slice(1).every((seat) => acted.playerRounds[seat.id])).toBe(
      true,
    );
  });
});
