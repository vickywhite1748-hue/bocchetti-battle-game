import { describe, expect, it } from "vitest";
import {
  BOND_RULES,
  CHARACTER_CARDS,
  DRAW_STEPS,
  FINAL_HAND_SIZE,
  INITIAL_HAND_SIZE,
  MARKER_CONFIGS,
  MAX_ROUND_BONUS,
  PLAYER_ROLES,
  TOTAL_MARKER_COUNT,
  VICTORY_SCORE_BY_PLAYER_COUNT,
} from "./index";

describe("V1 data model", () => {
  it("defines the planned marker pool", () => {
    expect(MARKER_CONFIGS).toHaveLength(6);
    expect(TOTAL_MARKER_COUNT).toBe(18);
    expect(MARKER_CONFIGS.map((marker) => marker.count)).toEqual([
      3, 3, 3, 3, 3, 3,
    ]);
  });

  it("defines the planned round constants", () => {
    expect(DRAW_STEPS).toEqual([4, 3, 2, 1]);
    expect(INITIAL_HAND_SIZE).toBe(5);
    expect(FINAL_HAND_SIZE).toBe(2);
    expect(MAX_ROUND_BONUS).toBe(2);
    expect(VICTORY_SCORE_BY_PLAYER_COUNT).toEqual({ 2: 16, 3: 17, 4: 18 });
  });

  it("defines four player roles", () => {
    expect(PLAYER_ROLES.map((role) => role.id)).toEqual([
      "ghostwriter",
      "stage_manager",
      "casino_backer",
      "bartender",
    ]);
  });

  it("defines thirty character target cards with unique ids", () => {
    expect(CHARACTER_CARDS).toHaveLength(30);
    const ids = CHARACTER_CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps character tier counts aligned with the V1 balance plan", () => {
    const counts = CHARACTER_CARDS.reduce(
      (acc, card) => {
        acc[card.tier] += 1;
        return acc;
      },
      { stable: 0, story: 0, fate: 0 },
    );

    expect(counts).toEqual({ stable: 12, story: 12, fate: 6 });
  });

  it("keeps repeated character names readable", () => {
    const nameCounts = CHARACTER_CARDS.reduce<Record<string, number>>(
      (acc, card) => {
        acc[card.name] = (acc[card.name] ?? 0) + 1;
        return acc;
      },
      {},
    );

    expect(Math.max(...Object.values(nameCounts))).toBeLessThanOrEqual(2);
  });

  it("defines one-round bond rules against existing character ids", () => {
    const characterIds = new Set(CHARACTER_CARDS.map((card) => card.id));
    expect(BOND_RULES).toHaveLength(12);

    for (const bond of BOND_RULES) {
      expect(characterIds.has(bond.characterIds[0])).toBe(true);
      expect(characterIds.has(bond.characterIds[1])).toBe(true);
      expect(bond.bonus).toBeLessThanOrEqual(MAX_ROUND_BONUS);
    }
  });
});
