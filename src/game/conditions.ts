import { MARKER_CONFIGS } from "./markers";
import type {
  Condition,
  ConditionEvaluation,
  MarkerCategory,
} from "./types";

export function countMarkers(
  markers: readonly MarkerCategory[],
): Record<MarkerCategory, number> {
  const counts = Object.fromEntries(
    MARKER_CONFIGS.map((marker) => [marker.id, 0]),
  ) as Record<MarkerCategory, number>;

  for (const marker of markers) {
    counts[marker] += 1;
  }

  return counts;
}

export function evaluateCondition(
  condition: Condition,
  drawnMarkers: readonly MarkerCategory[],
): ConditionEvaluation {
  const counts = countMarkers(drawnMarkers);
  const result = evaluate(condition, drawnMarkers, counts);

  return {
    met: result.met,
    reason: result.reason,
  };
}

function evaluate(
  condition: Condition,
  drawnMarkers: readonly MarkerCategory[],
  counts: Record<MarkerCategory, number>,
): ConditionEvaluation {
  switch (condition.type) {
    case "minCount": {
      const actual = counts[condition.marker];
      return {
        met: actual >= condition.count,
        reason: `${condition.marker} ${actual}/${condition.count}`,
      };
    }
    case "maxCount": {
      const actual = counts[condition.marker];
      return {
        met: actual <= condition.count,
        reason: `${condition.marker} ${actual}<=${condition.count}`,
      };
    }
    case "allOf": {
      const results = condition.conditions.map((child) =>
        evaluate(child, drawnMarkers, counts),
      );
      return {
        met: results.every((result) => result.met),
        reason: results.map((result) => result.reason).join("; "),
      };
    }
    case "anyOf": {
      const results = condition.conditions.map((child) =>
        evaluate(child, drawnMarkers, counts),
      );
      return {
        met: results.some((result) => result.met),
        reason: results.map((result) => result.reason).join(" 或 "),
      };
    }
    case "lastIs": {
      const lastMarker = drawnMarkers.at(-1);
      return {
        met: lastMarker === condition.marker,
        reason: `last ${lastMarker ?? "none"}=${condition.marker}`,
      };
    }
    default: {
      const exhaustive: never = condition;
      return exhaustive;
    }
  }
}
