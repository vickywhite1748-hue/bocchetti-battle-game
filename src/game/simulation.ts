import { CHARACTER_CARDS } from "./characters";
import { createGame, getWinners } from "./engine";
import { runGameWithAiOnly } from "./ai";
import { PLAYER_ROLES } from "./roles";
import type { PlayerRoleId } from "./types";

export type SimulationOptions = {
  games: number;
  playerCount: 2 | 3 | 4;
  seed?: number;
};

export type SimulationReport = {
  games: number;
  playerCount: 2 | 3 | 4;
  averageRounds: number;
  averageScores: number[];
  roleWins: Record<PlayerRoleId, number>;
  cardScores: Record<string, number>;
  cardSuccessRates: Record<string, number>;
  wagerBonuses: number;
  bondBonuses: number;
  roleBonuses: number;
};

const AI_ROLES: PlayerRoleId[] = [
  "ghostwriter",
  "stage_manager",
  "casino_backer",
  "bartender",
];

export function runSimulation(options: SimulationOptions): SimulationReport {
  const roleWins = Object.fromEntries(
    PLAYER_ROLES.map((role) => [role.id, 0]),
  ) as Record<PlayerRoleId, number>;
  const cardScores = Object.fromEntries(
    CHARACTER_CARDS.map((card) => [card.id, 0]),
  ) as Record<string, number>;
  const cardAppearances = Object.fromEntries(
    CHARACTER_CARDS.map((card) => [card.id, 0]),
  ) as Record<string, number>;
  const scoreTotals = Array.from({ length: options.playerCount }, () => 0);

  let totalRounds = 0;
  let wagerBonuses = 0;
  let bondBonuses = 0;
  let roleBonuses = 0;

  for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
    const random = createSeededRandom((options.seed ?? 1) + gameIndex);
    const initial = createGame({
      playerCount: options.playerCount,
      humanRoleId: AI_ROLES[gameIndex % AI_ROLES.length],
      random,
    });
    const aiState = {
      ...initial,
      seats: initial.seats.map((seat, seatIndex) => ({
        ...seat,
        kind: "ai" as const,
        roleId: AI_ROLES[(gameIndex + seatIndex) % AI_ROLES.length]!,
      })),
    };
    const finished = runGameWithAiOnly(aiState, random, 600);

    totalRounds += finished.roundResults.length;
    finished.seats.forEach((seat, index) => {
      scoreTotals[index] = (scoreTotals[index] ?? 0) + seat.score;
    });

    for (const winner of getWinners(finished)) {
      roleWins[winner.roleId] = (roleWins[winner.roleId] ?? 0) + 1;
    }

    for (const result of finished.roundResults) {
      for (const score of result.scores) {
        if (score.cardId) {
          cardScores[score.cardId] = (cardScores[score.cardId] ?? 0) + 1;
        }

        if (score.bonusSources.includes("wager")) {
          wagerBonuses += 1;
        }
        if (score.bonusSources.includes("bond")) {
          bondBonuses += 1;
        }
        if (score.bonusSources.includes("casino_backer")) {
          roleBonuses += 1;
        }
      }
    }

    for (const card of CHARACTER_CARDS) {
      cardAppearances[card.id] =
        (cardAppearances[card.id] ?? 0) + finished.roundResults.length;
    }
  }

  const cardSuccessRates = Object.fromEntries(
    CHARACTER_CARDS.map((card) => [
      card.id,
      roundTo(
        (cardScores[card.id] ?? 0) / Math.max(1, cardAppearances[card.id] ?? 0),
        4,
      ),
    ]),
  ) as Record<string, number>;

  return {
    games: options.games,
    playerCount: options.playerCount,
    averageRounds: roundTo(totalRounds / options.games, 2),
    averageScores: scoreTotals.map((score) => roundTo(score / options.games, 2)),
    roleWins,
    cardScores,
    cardSuccessRates,
    wagerBonuses,
    bondBonuses,
    roleBonuses,
  };
}

function createSeededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
