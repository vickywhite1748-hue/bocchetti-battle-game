import { describe, expect, it } from "vitest";
import {
  analyzeCardProbability,
  analyzePeaceCards,
  createGame,
  getAnalysisScoreValue,
  getCardById,
  type Condition,
} from "./index";

describe("card analysis", () => {
  it("calculates exact final probability from the remaining marker bag", () => {
    const condition: Condition = { type: "minCount", marker: "family", count: 2 };

    const probability = analyzeCardProbability({
      condition,
      currentMarkers: ["family"],
      remainingMarkers: ["family", "gang"],
      finalMarkerCount: 2,
    });

    expect(probability).toBe(0.5);
  });

  it("accounts for last marker conditions without random simulation", () => {
    const condition: Condition = { type: "lastIs", marker: "gang" };

    const probability = analyzeCardProbability({
      condition,
      currentMarkers: ["family"],
      remainingMarkers: ["gang", "love"],
      finalMarkerCount: 2,
    });

    expect(probability).toBe(0.5);
  });

  it("flags equal-count cards as volatile and returns stable repeated values", () => {
    const state = createGame({ playerCount: 2, random: () => 0 });
    const report = analyzePeaceCards(state, "player-1", ["xiaohong-casino-host"]);
    const repeated = analyzePeaceCards(state, "player-1", ["xiaohong-casino-host"]);
    const item = report.items[0]!;

    expect(item.volatilityNote).toContain("平衡条件");
    expect(item.finalSuccessRate).toBe(repeated.items[0]!.finalSuccessRate);
  });

  it("uses an 8-point analysis value for family glory instead of the direct-victory sentinel", () => {
    const card = getCardById("sonny-family-price");

    expect(getAnalysisScoreValue(card)).toBe(8);
  });
});
