import type { BondRule } from "./types";

const conditionText = "两张拍立得留到结算，计分拍立得满足条件。";

export const BOND_RULES: BondRule[] = [
  {
    id: "richard-oscar",
    name: "舞台搭档",
    characterIds: ["richard-drunk-door", "oscar-duet"],
    conditionText,
    storyText:
      "Richard的踢踏舞和Oscar的歌声相映生辉，让一场醉意变成精彩的舞台。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "botti-sonny",
    name: "被守护的妹妹",
    characterIds: ["botti-rising-star", "sonny-legalization"],
    conditionText,
    storyText:
      "Botti的星光离不开Sonnyboy的配合；一个站在舞台的中央，一个把家族压力包装成可以被看见的未来。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "chichi-sonny",
    name: "兄弟的裂缝",
    characterIds: ["chichi-hidden-heir", "sonny-legalization"],
    conditionText,
    storyText:
      "Chichi的不甘和Sonnyboy的身世彼此拉扯，家族继承权越清晰，兄弟之间的裂缝越深。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "rich-girl-poor-boy",
    name: "桥上的传说",
    characterIds: ["rich-girl-runaway", "poor-boy-kitchen"],
    conditionText,
    storyText:
      "富家女的离开和穷小子的等待合在一起，让桥上的约定变成了传说。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-richard",
    name: "写下醉梦",
    characterIds: ["stevie-manuscript", "richard-drunk-door"],
    conditionText,
    storyText: "Stevie把Richard的眼睛当成了素材，Richard却还没认清自己是谁。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "casino-hosts",
    name: "赌场主理人",
    characterIds: ["xiaohong-casino-host", "xiaolv-casino-host"],
    conditionText,
    storyText:
      "Mighele负责主持赌局，Paulo负责发放筹码；两个人同场时，赌场才真正有了主理人。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "parents-love",
    name: "父母爱情",
    characterIds: ["luciano-first-godfather", "natalia-fire"],
    conditionText,
    storyText:
      "第一代教父的秩序和双枪夫人的火焰站在一起，家族故事才有了最早的爱情底色。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "luciano-heir",
    name: "教父的继承人",
    characterIds: ["luciano-first-godfather", "sonny-legalization"],
    conditionText,
    storyText:
      "Luciano留下旧规则，把Sonnyboy包装成新的身份，家族权力的传承或许是既定命运。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "florence-sonny",
    name: "选择的另一面",
    characterIds: ["florence-pizza-muse", "sonny-legalization"],
    conditionText,
    storyText:
      "Florence的温柔和Sonnyboy的退隐撞在一起，让家族故事短暂拥有了烟火气。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "stevie-florence",
    name: "回伦敦吧",
    characterIds: ["stevie-manuscript", "florence-angel-sister"],
    conditionText,
    storyText:
      "Stevie把不能说出口的喜欢写进剧本，Florence停在了他不敢靠近的位置。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "father-blocks-the-way",
    name: "父亲拦路",
    characterIds: ["unknown-rich-father", "poor-boy-kitchen"],
    conditionText,
    storyText:
      "父亲把门槛守得很死，穷小子只能从厨房里的披萨开始靠近这段爱情。",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
  {
    id: "chichi-botti",
    name: "讨厌的哥哥",
    characterIds: ["chichi-hidden-heir", "botti-gold-secret"],
    conditionText,
    storyText: "chichi哥哥总是欺负我！真是大笨蛋！",
    bonus: 1,
    scoringMode: "addToScoredCharacter",
  },
];
