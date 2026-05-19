# 战斗吧！Bocchetti！

《战斗吧！Bocchetti！》是一款基于剧情标记和人物目标卡的网页桌游灰盒版本。玩家每轮抽取剧情标记、取舍手牌、下注剧情，并尝试让手中的人物达成条件得分。

游玩地址：

https://vickywhite1748-hue.github.io/bocchetti-battle-game/

## 当前版本

- 支持 2-4 人单机对局。
- 支持 AI 自动参与。
- 支持人物目标卡、剧情标记、剧情下注、玩家技能和人物羁绊。
- 当前仍是规则灰盒版本，后续会继续接入正式立绘和更完整的视觉表现。

## 本地运行

```bash
npm install
npm run dev
```

## 构建检查

```bash
npm test
npm run build
```

## 操作说明

1. 选择对局人数和玩家角色。
2. 每轮抽取剧情标记。
3. 根据当前标记趋势弃掉不合适的人物卡。
4. 第二次弃牌阶段可以进行剧情下注。
5. 最终保留 2 张人物卡，并选择 1 张满足条件的人物计分。
6. 若手牌中两张人物形成羁绊，卡面会显示羁绊名称；真正加分仍需结算时满足条件。

## 部署

当前公开试玩版发布在 `gh-pages` 分支。发布前先构建：

```bash
set VITE_BASE_PATH=/bocchetti-battle-game/
npm run build
```

然后将 `dist/` 内容推送到 `gh-pages` 分支，并在仓库 Pages 设置中选择 `gh-pages` 分支根目录作为发布来源。
