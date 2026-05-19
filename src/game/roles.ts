import type { PlayerRole } from "./types";

export const PLAYER_ROLES: PlayerRole[] = [
  {
    id: "ghostwriter",
    name: "代笔人",
    shortName: "换牌稳定",
    timing: "弃牌前，每轮一次。",
    abilityText: "抽 1 张人物卡，然后立刻弃 1 张人物卡。",
    strategyText: "提高手牌质量，降低卡手概率，适合新手和稳健打法。",
  },
  {
    id: "stage_manager",
    name: "舞台监督",
    shortName: "排演改戏",
    timing: "第一次弃牌阶段，每轮一次。",
    abilityText: "选择 1 张手牌排演；本轮结算该人物视为额外拥有 1 个舞台标记。",
    strategyText: "能把差 1 个舞台标记的人物救回来，也能提前锁定舞台线羁绊。",
  },
  {
    id: "casino_backer",
    name: "赌场投资人",
    shortName: "赌局爆发",
    timing: "第二次抽标记后，每轮一次。",
    abilityText: "声明押赌局；若最终计分人物成功且带赌局标签，额外 +1。",
    strategyText: "鼓励追逐赌局相关人物，但奖励受单轮加分上限约束。",
  },
  {
    id: "bartender",
    name: "阿波罗尼亚吧台人",
    shortName: "延迟决策",
    timing: "弃牌阶段，每轮一次。",
    abilityText: "本次少弃 1 张人物，下次弃牌阶段补弃 1 张。",
    strategyText: "保留更多可能性，适合等待后续标记再决定方向。",
  },
];
