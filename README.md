# 战斗吧！Bocchetti！开发库

这是《战斗吧！Bocchetti！》的私有开发仓库，用于同步当前 V1 规则灰盒、角色拍立得数据、羁绊规则、平衡测试脚本和开发文档。

公开给观众访问的版本会同步到独立公开仓库：`bocchetti-battle-game`。

公开游玩地址：

https://vickywhite1748-hue.github.io/bocchetti-battle-game/

## 当前版本

当前版本：`v1.2.0`。

后续版本号沿用 `v主版本.次版本.修订版本` 形式；`package.json` 中按 npm 规范写为不带 `v` 前缀的语义版本号。

## 更新记录

### v1.2.0

- Michele & Paulo 拆为 Mighele《草帽小红》和 Paulo《草帽小绿》。
- 新增羁绊“赌场主理人”和“父母爱情”。
- 新增“家族荣光”胜利牌。
- 新增“羁绊成就”，未解锁剧情显示为 `？？？`。
- 达成羁绊时显示 2 秒解锁提示。
- 特殊规则页只保留羁绊玩法说明。
- 新增 `A = B` 型拍立得条件。
- 调整多张拍立得条件与分值，`Gambino《赌场陷阱》` 改为 5 分命运牌。
- 新增页面内“更新记录”入口，同版本关闭后不再自动提示。

## 本地开发

```bash
npm install
npm run dev
```

默认开发地址为 Vite 输出的本地地址，通常是 `http://localhost:5173/`。

## 常用命令

```bash
npm test
npm run build
npm run sim -- 500 4
```

- `npm test`：运行数据、引擎和 AI 测试。
- `npm run build`：检查 TypeScript 并生成生产构建。
- `npm run sim -- 500 4`：运行 500 局 4 人模拟，用于观察平均轮数、角色胜场和卡牌成功率。

## 关键文件

- `src/game/characters.ts`：角色拍立得数据。
- `src/game/bonds.ts`：人物羁绊规则。
- `src/game/markers.ts`：积点池。
- `src/game/roles.ts`：观众角色技能。
- `src/game/engine.ts`：核心规则引擎。
- `src/App.tsx`：当前单机灰盒页面。
- `人物卡清单.md`：方便手动校对的角色拍立得和羁绊清单。
- `一台好戏剧情抽签游戏开发文档.md`：完整开发记录、平衡记录和版本计划。

## 同步注意事项

- 私有库保留完整策划文档和人物清单。
- 公开库只同步观众游玩所需内容，避免把开发笔记和未公开资料直接暴露。
- 修改角色拍立得、羁绊或积点池后，应同时更新 `人物卡清单.md` 和开发文档。
- 每次推送前至少运行 `npm test` 和 `npm run build`。
