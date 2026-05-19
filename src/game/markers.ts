import type { MarkerCategory } from "./types";

export type MarkerConfig = {
  id: MarkerCategory;
  label: string;
  count: number;
  description: string;
};

export const MARKER_CONFIGS: MarkerConfig[] = [
  {
    id: "family",
    label: "家族",
    count: 3,
    description: "血缘、继承、家族秘密、Bocchetti 家族。",
  },
  {
    id: "gang",
    label: "黑帮",
    count: 3,
    description: "威胁、清算、权力、枪、士兵。",
  },
  {
    id: "stage",
    label: "舞台",
    count: 3,
    description: "剧本、演出、打字机、报纸、叙述权。",
  },
  {
    id: "love",
    label: "爱情",
    count: 3,
    description: "黄玫瑰、手帕、围巾、旧梦、布鲁克林大桥。",
  },
  {
    id: "bar",
    label: "酒馆",
    count: 3,
    description: "Apollonia 酒吧、披萨炉、烤面杖、混乱日常。",
  },
  {
    id: "gamble",
    label: "赌局",
    count: 3,
    description: "Santa Lucia 赌场、轮盘、箱子、金条、债务。",
  },
];

export const TOTAL_MARKER_COUNT = MARKER_CONFIGS.reduce(
  (sum, marker) => sum + marker.count,
  0,
);

export function createMarkerBag(): MarkerCategory[] {
  return MARKER_CONFIGS.flatMap((marker) =>
    Array.from({ length: marker.count }, () => marker.id),
  );
}
