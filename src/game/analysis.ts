import { BOND_RULES } from "./bonds";
import { evaluateCondition } from "./conditions";
import { getCardById, evaluateCardConditionForPlayer } from "./engine";
import { MARKER_CONFIGS } from "./markers";
import { MAX_ROUND_BONUS } from "./setup";
import type {
  CharacterCard,
  CompetitionGameState,
  Condition,
  GameState,
  MarkerCategory,
} from "./types";

export type AnalysisRiskTag =
  | "locked"
  | "strong"
  | "fair"
  | "longshot"
  | "volatile"
  | "endgame";

export type CardAnalysis = {
  cardId: string;
  currentMet: boolean;
  finalSuccessRate: number;
  scoreValue: number;
  expectedScore: number;
  riskTag: AnalysisRiskTag;
  riskLabel: string;
  volatilityNote: string;
  recommendationLabel: string;
  detailText: string;
  conflictNote?: string;
};

export type AnalysisReport = {
  items: CardAnalysis[];
  recommendedCardId: string | null;
  summary: string;
};

export type ConditionProbabilityOptions = {
  condition: Condition;
  currentMarkers: readonly MarkerCategory[];
  remainingMarkers: readonly MarkerCategory[];
  finalMarkerCount?: number;
  extraMarkers?: readonly MarkerCategory[];
};

const FINAL_MARKER_COUNT = 10;
const FAMILY_GLORY_ANALYSIS_SCORE = 8;
const markerIds = MARKER_CONFIGS.map((marker) => marker.id);
const probabilityCache = new Map<string, number>();

export function analyzePeaceCards(
  state: GameState,
  playerId: string,
  cardIds: readonly string[],
): AnalysisReport {
  const items = cardIds.map((cardId) => analyzePeaceCard(state, playerId, cardId));
  const recommendedCardId = chooseRecommendedPeaceCard(state, items);

  return {
    items: items.map((item) =>
      state.phase === "resolution" && item.cardId === recommendedCardId
        ? { ...item, recommendationLabel: "推荐计分" }
        : item,
    ),
    recommendedCardId,
    summary: buildReportSummary(items, recommendedCardId),
  };
}

export function analyzeCompetitionCards(
  state: CompetitionGameState,
  playerId: string,
  cardIds: readonly string[],
): AnalysisReport {
  const items = cardIds.map((cardId) =>
    analyzeCompetitionCard(state, playerId, cardId),
  );
  const recommendedCardId =
    items
      .filter((item) => item.recommendationLabel === "现在登记")
      .sort((left, right) => right.expectedScore - left.expectedScore)[0]
      ?.cardId ?? null;

  return {
    items,
    recommendedCardId,
    summary: buildReportSummary(items, recommendedCardId),
  };
}

export function analyzeCardProbability(
  options: ConditionProbabilityOptions,
): number {
  const finalMarkerCount = options.finalMarkerCount ?? FINAL_MARKER_COUNT;
  const extraMarkers = options.extraMarkers ?? [];
  const drawCount = Math.max(0, finalMarkerCount - options.currentMarkers.length);
  const cacheKey = [
    JSON.stringify(options.condition),
    markerCountKey(options.currentMarkers),
    markerCountKey(options.remainingMarkers),
    markerCountKey(extraMarkers),
    finalMarkerCount,
    drawCount,
    options.currentMarkers.at(-1) ?? "none",
  ].join("|");
  const cached = probabilityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (drawCount === 0) {
    const met = evaluateCondition(options.condition, [
      ...options.currentMarkers,
      ...extraMarkers,
    ]).met;
    const value = met ? 1 : 0;
    probabilityCache.set(cacheKey, value);
    return value;
  }

  if (drawCount > options.remainingMarkers.length) {
    probabilityCache.set(cacheKey, 0);
    return 0;
  }

  const currentCounts = countByMarker(options.currentMarkers);
  const remainingCounts = countByMarker(options.remainingMarkers);
  const totalWeight = combination(options.remainingMarkers.length, drawCount);
  let successWeight = 0;

  enumerateDrawCounts(remainingCounts, drawCount, (drawCounts) => {
    const sampleWeight = markerIds.reduce(
      (weight, marker) =>
        weight * combination(remainingCounts[marker], drawCounts[marker]),
      1,
    );

    if (sampleWeight === 0) {
      return;
    }

    const finalCounts = addCounts(currentCounts, drawCounts);
    if (extraMarkers.length > 0) {
      const markers = markersFromCounts(finalCounts, null, extraMarkers);
      if (evaluateCondition(options.condition, markers).met) {
        successWeight += sampleWeight;
      }
      return;
    }

    for (const marker of markerIds) {
      const lastCount = drawCounts[marker];
      if (lastCount === 0) {
        continue;
      }

      const lastWeight = sampleWeight * (lastCount / drawCount);
      const markers = markersFromCounts(finalCounts, marker, []);
      if (evaluateCondition(options.condition, markers).met) {
        successWeight += lastWeight;
      }
    }
  });

  const probability = totalWeight > 0 ? successWeight / totalWeight : 0;
  probabilityCache.set(cacheKey, probability);
  return probability;
}

export function getAnalysisScoreValue(card: CharacterCard): number {
  return card.score === "family_glory" ? FAMILY_GLORY_ANALYSIS_SCORE : card.score;
}

function analyzePeaceCard(
  state: GameState,
  playerId: string,
  cardId: string,
): CardAnalysis {
  const card = getCardById(cardId);
  const extraMarkers =
    state.playerRounds[playerId]?.stageManagedCardId === cardId
      ? (["stage"] as const)
      : [];
  const currentMet = evaluateCardConditionForPlayer(state, playerId, cardId).met;
  const finalSuccessRate = analyzeCardProbability({
    condition: card.condition,
    currentMarkers: state.drawnMarkers,
    remainingMarkers: state.markerBag,
    extraMarkers,
  });
  const scoreValue = getAnalysisScoreValue(card);
  const bonus =
    card.score === "family_glory"
      ? { score: 0, reasons: [] }
      : estimateKnownPeaceBonus(state, playerId, cardId);
  const expectedScore = roundTo(finalSuccessRate * (scoreValue + bonus.score), 2);
  const riskTag = getRiskTag(card.condition, currentMet, finalSuccessRate);

  return {
    cardId,
    currentMet,
    finalSuccessRate: roundTo(finalSuccessRate, 4),
    scoreValue,
    expectedScore,
    riskTag,
    riskLabel: getRiskLabel(riskTag),
    volatilityNote: getVolatilityNote(card.condition, currentMet),
    recommendationLabel: getPeaceRecommendation(
      state.phase,
      currentMet,
      finalSuccessRate,
      expectedScore,
    ),
    detailText: buildPeaceDetail(card, bonus),
  };
}

function analyzeCompetitionCard(
  state: CompetitionGameState,
  playerId: string,
  cardId: string,
): CardAnalysis {
  const card = getCardById(cardId);
  const currentMarkers = state.playerMarkers[playerId] ?? [];
  const remainingMarkers = state.markerBags[playerId] ?? [];
  const currentMet = evaluateCondition(card.condition, currentMarkers).met;
  const finalSuccessRate = analyzeCardProbability({
    condition: card.condition,
    currentMarkers,
    remainingMarkers,
  });
  const scoreValue = getAnalysisScoreValue(card);
  const expectedScore = roundTo(finalSuccessRate * scoreValue, 2);
  const riskTag = getRiskTag(card.condition, currentMet, finalSuccessRate);

  return {
    cardId,
    currentMet,
    finalSuccessRate: roundTo(finalSuccessRate, 4),
    scoreValue,
    expectedScore,
    riskTag,
    riskLabel: getRiskLabel(riskTag),
    volatilityNote: getVolatilityNote(card.condition, currentMet),
    recommendationLabel: getCompetitionRecommendation(
      state.turn,
      currentMet,
      finalSuccessRate,
      expectedScore,
    ),
    detailText: `${scoreValue} 分牌，按当前积点计算期望 ${roundTo(
      expectedScore,
      1,
    )}。`,
    conflictNote: getCompetitionConflictNote(scoreValue, finalSuccessRate),
  };
}

function chooseRecommendedPeaceCard(
  state: GameState,
  items: readonly CardAnalysis[],
): string | null {
  if (state.phase !== "resolution") {
    return null;
  }

  return (
    items
      .filter((item) => item.currentMet)
      .sort((left, right) => right.expectedScore - left.expectedScore)[0]?.cardId ??
    null
  );
}

function buildReportSummary(
  items: readonly CardAnalysis[],
  recommendedCardId: string | null,
): string {
  if (recommendedCardId) {
    const card = getCardById(recommendedCardId);
    return `当前推荐：${card.name}《${card.versionTitle}》。`;
  }

  const strongCount = items.filter(
    (item) => item.riskTag === "locked" || item.riskTag === "strong",
  ).length;
  if (strongCount > 0) {
    return `当前有 ${strongCount} 张较稳的拍立得。`;
  }

  return "当前没有明显稳牌，优先保留高期望或能形成羁绊的路线。";
}

function estimateKnownPeaceBonus(
  state: GameState,
  playerId: string,
  cardId: string,
): { score: number; reasons: string[] } {
  const playerRound = state.playerRounds[playerId];
  const seat = state.seats.find((item) => item.id === playerId);
  if (!playerRound || !seat) {
    return { score: 0, reasons: [] };
  }

  const card = getCardById(cardId);
  const reasons: string[] = [];
  let score = 0;

  if (playerRound.wageredCardId === cardId) {
    score += 1;
    reasons.push("签署 +1");
  }

  if (
    seat.roleId === "casino_backer" &&
    playerRound.casinoBackerDeclared &&
    card.tags.includes("gamble") &&
    card.score !== "family_glory" &&
    card.score >= 4 &&
    playerRound.wageredCardId !== cardId
  ) {
    score += 1;
    reasons.push("赌场投资人 +1");
  }

  const activeBond = BOND_RULES.find((bond) => {
    if (!bond.characterIds.includes(cardId)) {
      return false;
    }
    if (!bond.characterIds.every((bondCardId) => playerRound.hand.includes(bondCardId))) {
      return false;
    }
    return bond.characterIds.some(
      (bondCardId) =>
        evaluateCardConditionForPlayer(state, playerId, bondCardId).met,
    );
  });

  if (activeBond) {
    score += activeBond.bonus;
    reasons.push(`羁绊 ${activeBond.name} +${activeBond.bonus}`);
  }

  return {
    score: Math.min(score, MAX_ROUND_BONUS),
    reasons:
      score > MAX_ROUND_BONUS
        ? [...reasons, `奖励上限 ${MAX_ROUND_BONUS}`]
        : reasons,
  };
}

function buildPeaceDetail(
  card: CharacterCard,
  bonus: { score: number; reasons: string[] },
): string {
  const scoreLabel =
    card.score === "family_glory" ? "家族荣光按 8 分估值" : `基础 ${card.score} 分`;
  return bonus.reasons.length > 0
    ? `${scoreLabel}；${bonus.reasons.join(" / ")}。`
    : `${scoreLabel}。`;
}

function getPeaceRecommendation(
  phase: GameState["phase"],
  currentMet: boolean,
  finalSuccessRate: number,
  expectedScore: number,
): string {
  if (phase === "resolution") {
    return currentMet ? "可计分" : "不可计分";
  }

  if (currentMet && finalSuccessRate >= 0.72) {
    return "建议保留";
  }

  if (finalSuccessRate >= 0.5 || expectedScore >= 2.2) {
    return "建议保留";
  }

  if (finalSuccessRate >= 0.25 || expectedScore >= 1.2) {
    return "高风险追逐";
  }

  return "可弃";
}

function getCompetitionRecommendation(
  turn: number,
  currentMet: boolean,
  finalSuccessRate: number,
  expectedScore: number,
): string {
  if (currentMet && finalSuccessRate >= 0.62) {
    return "现在登记";
  }

  if (currentMet && turn >= 4) {
    return "现在登记";
  }

  if (turn < 4 && (finalSuccessRate >= 0.35 || expectedScore >= 1.7)) {
    return "等待更多积点";
  }

  if (currentMet) {
    return "高风险登记";
  }

  return "不建议追";
}

function getCompetitionConflictNote(
  scoreValue: number,
  finalSuccessRate: number,
): string {
  if (scoreValue >= 4 && finalSuccessRate >= 0.5) {
    return "冲突风险高：这类高分稳牌也容易吸引其他观众。";
  }

  if (scoreValue >= 4 || finalSuccessRate >= 0.65) {
    return "冲突风险中：登记越晚越可能被同牌抢先。";
  }

  return "冲突风险低：更像补位选择。";
}

function getRiskTag(
  condition: Condition,
  currentMet: boolean,
  finalSuccessRate: number,
): AnalysisRiskTag {
  if (hasConditionType(condition, "lastIs")) {
    return "endgame";
  }

  if (currentMet && hasVolatileCondition(condition) && finalSuccessRate < 0.82) {
    return "volatile";
  }

  if (currentMet && finalSuccessRate >= 0.98) {
    return "locked";
  }

  if (finalSuccessRate >= 0.65) {
    return "strong";
  }

  if (finalSuccessRate >= 0.35) {
    return "fair";
  }

  return "longshot";
}

function getRiskLabel(riskTag: AnalysisRiskTag): string {
  switch (riskTag) {
    case "locked":
      return "已锁定";
    case "strong":
      return "较稳";
    case "fair":
      return "中等";
    case "longshot":
      return "偏难";
    case "volatile":
      return "会波动";
    case "endgame":
      return "终局判定";
    default: {
      const exhaustive: never = riskTag;
      return exhaustive;
    }
  }
}

function getVolatilityNote(condition: Condition, currentMet: boolean): string {
  if (hasConditionType(condition, "lastIs")) {
    return "最后一枚积点会决定这张牌。";
  }

  if (hasConditionType(condition, "equalCount")) {
    return "平衡条件：后续抽取可能打破或补齐数量。";
  }

  if (hasConditionType(condition, "maxCount")) {
    return currentMet
      ? "上限条件：后续积点可能让它失效。"
      : "上限条件：需要补齐其他条件，同时避免超过上限。";
  }

  return currentMet
    ? "已满足后通常不会被后续积点破坏。"
    : "需要继续补齐指定积点。";
}

function hasVolatileCondition(condition: Condition): boolean {
  return (
    hasConditionType(condition, "maxCount") ||
    hasConditionType(condition, "equalCount")
  );
}

function hasConditionType(
  condition: Condition,
  type: Condition["type"],
): boolean {
  if (condition.type === type) {
    return true;
  }

  if (condition.type === "allOf" || condition.type === "anyOf") {
    return condition.conditions.some((child) => hasConditionType(child, type));
  }

  return false;
}

function enumerateDrawCounts(
  remainingCounts: Record<MarkerCategory, number>,
  drawCount: number,
  onCounts: (counts: Record<MarkerCategory, number>) => void,
): void {
  const nextCounts = emptyCounts();

  function visit(index: number, left: number): void {
    if (index === markerIds.length) {
      if (left === 0) {
        onCounts({ ...nextCounts });
      }
      return;
    }

    const marker = markerIds[index]!;
    const max = Math.min(remainingCounts[marker], left);
    for (let count = 0; count <= max; count += 1) {
      nextCounts[marker] = count;
      visit(index + 1, left - count);
    }
    nextCounts[marker] = 0;
  }

  visit(0, drawCount);
}

function markerCountKey(markers: readonly MarkerCategory[]): string {
  const counts = countByMarker(markers);
  return markerIds.map((marker) => `${marker}:${counts[marker]}`).join(",");
}

function countByMarker(
  markers: readonly MarkerCategory[],
): Record<MarkerCategory, number> {
  const counts = emptyCounts();
  for (const marker of markers) {
    counts[marker] += 1;
  }
  return counts;
}

function emptyCounts(): Record<MarkerCategory, number> {
  return Object.fromEntries(markerIds.map((marker) => [marker, 0])) as Record<
    MarkerCategory,
    number
  >;
}

function addCounts(
  left: Record<MarkerCategory, number>,
  right: Record<MarkerCategory, number>,
): Record<MarkerCategory, number> {
  const counts = emptyCounts();
  for (const marker of markerIds) {
    counts[marker] = left[marker] + right[marker];
  }
  return counts;
}

function markersFromCounts(
  counts: Record<MarkerCategory, number>,
  lastMarker: MarkerCategory | null,
  extraMarkers: readonly MarkerCategory[],
): MarkerCategory[] {
  const markers: MarkerCategory[] = [];
  for (const marker of markerIds) {
    const count = counts[marker] - (lastMarker === marker ? 1 : 0);
    for (let index = 0; index < count; index += 1) {
      markers.push(marker);
    }
  }

  if (lastMarker) {
    markers.push(lastMarker);
  }

  markers.push(...extraMarkers);
  return markers;
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) {
    return 0;
  }

  const effectiveK = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= effectiveK; index += 1) {
    result = (result * (n - effectiveK + index)) / index;
  }
  return result;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
