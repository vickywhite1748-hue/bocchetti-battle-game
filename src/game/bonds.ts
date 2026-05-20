import type { BondRule } from "./types";

export const BOND_RULES: BondRule[] = [
  {
    id: "richard-oscar",
    name: "舞台搭档",
    characterIds: ["richard-drunk-door", "oscar-duet"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Richard 的失控和 Oscar 的节拍互相托住，让一场醉意变成可以继续演下去的舞台事故。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "botti-sonny",
    name: "被守护的家族",
    characterIds: ["botti-rising-star", "sonny-legalization"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Botti 的星光离不开 Sonnyboy 的体面身份；一个站到台前，一个把家族压力包装成可以被看见的未来。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "chichi-sonny",
    name: "兄弟的裂缝",
    characterIds: ["chichi-hidden-heir", "sonny-legalization"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Chichi 的不甘和 Sonnyboy 的体面身份彼此拉扯，家族继承权越清晰，兄弟之间的裂缝越深。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "rich-girl-poor-boy",
    name: "桥上的传说",
    characterIds: ["rich-girl-runaway", "poor-boy-kitchen"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "富家女的逃离和穷小子的等待合在一起，才会让桥上的约定从流言变成传说。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-richard",
    name: "写下醉梦",
    characterIds: ["stevie-manuscript", "richard-drunk-door"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Stevie 需要 Richard 的混乱当素材，Richard 也需要 Stevie 把失控写成故事。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "casino-hosts",
    name: "赌场主理人",
    characterIds: ["xiaohong-casino-host", "xiaolv-casino-host"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Mighele 负责把热闹撑住，Paulo 负责把场面接稳；两个人同场时，赌场才真正有了主理人。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "parents-love",
    name: "父母爱情",
    characterIds: ["luciano-first-godfather", "natalia-fire"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "第一代教父的旧秩序和双枪夫人的火焰站在一起，家族故事才有了最早的爱情底色。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "luciano-heir",
    name: "教父与继承人",
    characterIds: ["luciano-first-godfather", "sonny-legalization"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Luciano 留下旧秩序，Sonnyboy 把它包装成新的身份；这条羁绊代表家族权力从教父传到继承人。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "bridge-lovers",
    name: "桥上的情侣",
    characterIds: ["rich-girl-runaway", "poor-boy-bridge"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "富家女的逃离和穷小子的桥上约定同时成立，爱情线从冲动私奔走到真正的约定。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "florence-sonny",
    name: "选择的另一面",
    characterIds: ["florence-pizza-muse", "sonny-legalization"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Florence 的披萨灵感和 Sonnyboy 的体面身份撞在一起，让家族故事短暂拥有了烟火气。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-florence",
    name: "回伦敦吧",
    characterIds: ["stevie-manuscript", "florence-angel-sister"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "Stevie 把不能说出口的喜欢写进剧本，Florence 像天使姐姐一样停在他不敢靠近的位置。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "father-blocks-the-way",
    name: "父亲拦路",
    characterIds: ["unknown-rich-father", "poor-boy-kitchen"],
    conditionText: "两张拍立得留到结算，计分拍立得满足条件。",
    storyText:
      "父亲把门槛守得很死，穷小子只能从厨房里的披萨开始靠近这段爱情。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
];
