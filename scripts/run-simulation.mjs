import { runSimulation } from "../src/game/simulation.ts";

const games = Number(process.argv[2] ?? 500);
const playerCount = Number(process.argv[3] ?? 4);

if (![2, 3, 4].includes(playerCount)) {
  throw new Error("playerCount must be 2, 3, or 4.");
}

const report = runSimulation({
  games,
  playerCount,
  seed: 20260519,
});

console.log(JSON.stringify(report, null, 2));
