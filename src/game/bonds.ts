import type { BondRule } from "./types";

export const BOND_RULES: BondRule[] = [
  {
    id: "richard-oscar",
    name: "舞台搭档",
    characterIds: ["richard-drunk-door", "oscar-duet"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "Richard 的失控和 Oscar 的节拍互相托住，让一场醉意变成可以继续演下去的舞台事故。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "botti-sonny",
    name: "被守护的家族",
    characterIds: ["botti-rising-star", "sonny-legalization"],
    conditionText: "Botti 满足，且本轮出现过家族标记。",
    storyText:
      "Botti 的星光离不开 Sonnyboy 的体面身份；一个站到台前，一个把家族压力包装成可以被看见的未来。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "chichi-sonny",
    name: "兄弟的裂缝",
    characterIds: ["chichi-hidden-heir", "sonny-legalization"],
    conditionText: "两张人物本轮都满足条件；只能选一张计分。",
    storyText:
      "Chichi 的不甘和 Sonnyboy 的体面身份彼此拉扯，家族继承权越清晰，兄弟之间的裂缝越深。",
    bonus: 2,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "rich-girl-poor-boy",
    name: "桥上的传说",
    characterIds: ["rich-girl-runaway", "poor-boy-kitchen"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "富家女的逃离和穷小子的等待合在一起，才会让桥上的约定从流言变成传说。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-richard",
    name: "写下醉梦",
    characterIds: ["stevie-manuscript", "richard-drunk-door"],
    conditionText: "本轮舞台标记至少 2 个。",
    storyText:
      "Stevie 需要 Richard 的混乱当素材，Richard 也需要 Stevie 把失控写成故事。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "sonny-two-faces",
    name: "继承人的两面",
    characterIds: ["sonny-legalization", "sonny-family-price"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "Sonnyboy 一面走向上院和体面身份，一面仍被家族代价追上；两张牌同时成立时，说明继承人的两面都被翻开。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "luciano-heir",
    name: "教父与继承人",
    characterIds: ["luciano-first-godfather", "sonny-legalization"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "Luciano 留下旧秩序，Sonnyboy 把它包装成新的身份；这条羁绊代表家族权力从教父传到继承人。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "bridge-lovers",
    name: "桥上的情侣",
    characterIds: ["rich-girl-runaway", "poor-boy-bridge"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "富家女的逃离和穷小子的桥上约定同时成立，爱情线从冲动私奔走到真正的约定。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "returned-shadow",
    name: "归来的影子",
    characterIds: ["chichi-hidden-heir", "chichi-returned-truth"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "阴影里的继承人没有真正退场，而是变成归来的真相；Chichi 的影子从家族枪声延伸到舞台中央。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "florence-sonny",
    name: "选择的另一面",
    characterIds: ["florence-pizza-muse", "sonny-legalization"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "Florence 的披萨灵感和 Sonnyboy 的体面身份撞在一起，让家族故事短暂拥有了烟火气。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-florence",
    name: "回伦敦吧",
    characterIds: ["stevie-manuscript", "florence-angel-sister"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "Stevie 把不能说出口的喜欢写进剧本，Florence 像天使姐姐一样停在他不敢靠近的位置。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "father-blocks-the-way",
    name: "父亲拦路",
    characterIds: ["unknown-rich-father", "poor-boy-kitchen"],
    conditionText: "两张人物本轮都满足条件。",
    storyText:
      "父亲把门槛守得很死，穷小子只能从厨房里的披萨开始靠近这段爱情。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
];
