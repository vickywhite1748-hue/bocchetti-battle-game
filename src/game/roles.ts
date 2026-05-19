import type { PlayerRole } from "./types";

export const PLAYER_ROLES: PlayerRole[] = [
  {
    id: "ghostwriter",
    name: "代笔人",
    shortName: "换牌稳定",
    timing: "弃置前，每轮一次。",
    abilityText: "抽 1 张角色拍立得，然后立刻弃置 1 张角色拍立得。",
    strategyText: "提高拍立得质量，降低卡手概率，适合新手和稳健打法。",
  },
  {
    id: "stage_manager",
    name: "舞台监督",
    shortName: "排演改戏",
    timing: "第一次弃置阶段，每轮一次。",
    abilityText: "选择 1 张角色拍立得排演；本轮结算该拍立得视为额外拥有 1 个舞台积点。",
    strategyText: "能把差 1 个舞台积点的拍立得救回来，也能提前锁定舞台线羁绊。",
  },
  {
    id: "casino_backer",
    name: "赌场投资人",
    shortName: "赌局爆发",
    timing: "第二次抽取积点后，每轮一次。",
    abilityText: "声明押赌局；若最终计分人物成功且带赌局标签，额外 +1。",
    strategyText: "鼓励追逐赌局相关人物，但奖励受单轮加分上限约束。",
  },
  {
    id: "bartender",
    name: "阿波罗尼亚吧台人",
    shortName: "延迟决策",
    timing: "弃置阶段，每轮一次。",
    abilityText: "本次少弃置 1 张角色拍立得，下次弃置阶段补弃 1 张。",
    strategyText: "保留更多可能性，适合等待后续积点再决定方向。",
  },
];
