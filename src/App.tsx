import { useEffect, useMemo, useState } from "react";
import {
  BOND_RULES,
  MARKER_CONFIGS,
  PLAYER_ROLES,
  advanceCompetitionAfterActions,
  advanceAfterDiscards,
  analyzeCompetitionCards,
  analyzePeaceCards,
  cancelWager,
  createCompetitionGame,
  createGame,
  discardCards,
  discardGhostwriterCard,
  drawCurrentStep,
  evaluateCompetitionCardCondition,
  evaluateCardConditionForPlayer,
  getCardById,
  getCompetitionCardScore,
  getCompetitionWinners,
  getRequiredDiscardCountForPlayer,
  getWinners,
  passCompetitionTurn,
  placeWager,
  registerCompetitionCard,
  resolveRound,
  runCompetitionAiForTurn,
  runAiForCurrentDecision,
  selectScoringCard,
  startCompetitionRound,
  startRound,
  useBartenderAbility,
  useCasinoBackerAbility,
  useGhostwriterAbility,
  useStageManagerAbility,
} from "./game";
import type {
  AnalysisReport,
  CardAnalysis,
  CharacterCard,
  CompetitionGameState,
  Condition,
  GameState,
  MarkerCategory,
  PlayerRoleId,
  RoundPhase,
} from "./game";

const HUMAN_PLAYER_ID = "player-1";
const APP_VERSION = "v1.5.1";
const UPDATE_STORAGE_KEY = "bocchetti-battle-dismissed-version";
const UPDATE_LOGS = [
  {
    version: "v1.5.1",
    items: [
      "新增单机辅助分析，和平模式手牌和竞争模式公开拍立得会显示成功率、期望分、风险标签和建议。",
      "结算阶段不再允许选择未满足条件的拍立得作为计分牌，避免误结算 0 分。",
      "家族荣光在 AI 和辅助估值中按 8 分参考值处理，不再影响普通取舍判断。",
      "优化辅助界面：按钮横向排列，去除重复提示，拍立得条件中的积点标记与上方积点颜色保持一致。",
    ],
  },
  {
    version: "v1.5.0",
    items: [
      "新增游戏主页，和平模式和竞争模式分开进入。",
      "和平模式保留原有公共积点、弃置、签署、羁绊和目标分玩法。",
      "新增竞争模式单机原型：公共拍立得市场、秘密登记、4 回合小局和目标分。",
      "竞争模式采用跨小局羁绊，羁绊成就与和平模式独立计算。",
    ],
  },
  {
    version: "v1.4.0",
    items: [
      "新增阶段提示，当前该做什么会直接显示在对局页顶部。",
      "优化规则弹窗，把首局只需要知道的内容放到基本规则。",
      "补充积点、签署、羁绊、家族荣光和观众技能的解释。",
      "按钮不可操作时显示更明确的原因提示。",
      "所有羁绊奖励统一为 +1，羁绊成就显示未解锁 / 已解锁状态。",
    ],
  },
  {
    version: "v1.3.0",
    items: [
      "新增页面内“反馈”入口，启动页和对局页都可以打开。",
      "打开反馈时会自动复制版本、页面、阶段、轮数、角色、比分和积点等信息。",
      "反馈浮窗提供手动复制和显示自动信息的兜底操作。",
      "当前反馈表单使用腾讯问卷内嵌提交，并保留新窗口打开兜底。",
    ],
  },
  {
    version: "v1.2.0",
    items: [
      "Michele & Paulo 拆为 Mighele《草帽小红》和 Paulo《草帽小绿》。",
      "新增羁绊“赌场主理人”和“父母爱情”。",
      "新增“家族荣光”胜利牌。",
      "新增“羁绊成就”，未解锁剧情显示为？？？。",
      "新增 A = B 型拍立得条件。",
      "新增页面内“更新记录”入口，同版本关闭后不再自动提示。",
    ],
  },
];
const FEEDBACK_FORM_URL =
  "https://wj.qq.com/s2/26742671/39fc/";

const markerLabels: Record<MarkerCategory, string> = {
  family: "家族",
  gang: "黑帮",
  stage: "舞台",
  love: "爱情",
  bar: "酒馆",
  gamble: "赌局",
};

const phaseLabels: Record<RoundPhase, string> = {
  setup: "轮间",
  draw_1: "第一幕抽取积点",
  discard_1: "第一次弃置",
  draw_2: "第二幕抽取积点",
  discard_2: "第二次弃置",
  draw_3: "第三幕抽取积点",
  discard_3: "第三次弃置",
  draw_4: "终幕抽取积点",
  resolution: "本轮结算",
  game_over: "游戏结束",
};

export function App() {
  const [mode, setMode] = useState<"home" | "peace" | "competition">("home");
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [roleId, setRoleId] = useState<PlayerRoleId>("ghostwriter");
  const [game, setGame] = useState<GameState | null>(null);
  const [competitionPlayerCount, setCompetitionPlayerCount] = useState<2 | 3 | 4>(4);
  const [competitionTargetScore, setCompetitionTargetScore] = useState(15);
  const [competitionGame, setCompetitionGame] = useState<CompetitionGameState | null>(
    null,
  );
  const [selectedCompetitionCard, setSelectedCompetitionCard] = useState<string | null>(
    null,
  );
  const [rulesOpen, setRulesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [selectedScoringCard, setSelectedScoringCard] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [achievementMessage, setAchievementMessage] = useState<string | null>(
    null,
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackContext, setFeedbackContext] = useState("");
  const [feedbackFrameSrc, setFeedbackFrameSrc] = useState("");
  const [feedbackContextVisible, setFeedbackContextVisible] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [competitionAnalysisOpen, setCompetitionAnalysisOpen] = useState(false);
  const [updateLogMode, setUpdateLogMode] = useState<"latest" | "recent">(
    "latest",
  );
  const [updateLogOpen, setUpdateLogOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(UPDATE_STORAGE_KEY) !== APP_VERSION;
  });

  const humanRound = game?.playerRounds[HUMAN_PLAYER_ID];
  const humanSeat = game?.seats.find((seat) => seat.id === HUMAN_PLAYER_ID);
  const competitionHumanRegistration =
    competitionGame?.registrations[HUMAN_PLAYER_ID] ?? null;
  const competitionHumanAction =
    competitionGame?.turnActions[HUMAN_PLAYER_ID] ?? false;
  const requiredDiscards =
    game && isDiscardPhase(game.phase)
      ? getRequiredDiscardCountForPlayer(game, HUMAN_PLAYER_ID)
      : 0;
  const latestResult = game?.roundResults.at(-1) ?? null;
  const ghostwriterPending = Boolean(humanRound?.ghostwriterDiscardPending);
  const unlockedBondIds = useMemo(() => getUnlockedBondIds(game), [game]);
  const roleButtonHint = game ? getRoleButtonHint(game, selectedCards.length) : null;
  const discardButtonHint = game
    ? getDiscardButtonHint(game, selectedCards.length, requiredDiscards)
    : null;
  const stageGuide = game ? getStageGuide(game, selectedCards.length, requiredDiscards) : null;
  const peaceAnalysis = useMemo(
    () =>
      game && humanRound
        ? analyzePeaceCards(game, HUMAN_PLAYER_ID, humanRound.hand)
        : null,
    [game, humanRound],
  );
  const competitionAnalysis = useMemo(
    () =>
      competitionGame && competitionGame.phase === "register"
        ? analyzeCompetitionCards(
            competitionGame,
            HUMAN_PLAYER_ID,
            competitionGame.market,
          )
        : null,
    [competitionGame],
  );

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!achievementMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setAchievementMessage(null);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [achievementMessage]);

  useEffect(() => {
    if (!competitionGame || competitionGame.phase !== "register") {
      return;
    }

    const humanHasRegistered = Boolean(competitionGame.registrations[HUMAN_PLAYER_ID]);
    if (!humanHasRegistered) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const next = runCompetitionAiForTurn(competitionGame);
        setCompetitionGame(next);
        setMessage(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [competitionGame]);

  const markerCounts = useMemo(() => {
    const counts = Object.fromEntries(
      MARKER_CONFIGS.map((marker) => [marker.id, 0]),
    ) as Record<MarkerCategory, number>;

    for (const marker of game?.drawnMarkers ?? []) {
      counts[marker] += 1;
    }

    return counts;
  }, [game?.drawnMarkers]);

  function safely(action: () => GameState | null, clearSelection = true) {
    try {
      const next = action();
      if (next) {
        setGame(next);
      }
      if (clearSelection) {
        setSelectedCards([]);
        setSelectedScoringCard(null);
      }
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function startGame() {
    safely(() => createGame({ playerCount, humanRoleId: roleId }));
  }

  function returnHome() {
    setMode("home");
    setGame(null);
    setCompetitionGame(null);
    setSelectedCards([]);
    setSelectedScoringCard(null);
    setSelectedCompetitionCard(null);
    setRulesOpen(false);
    setLogOpen(false);
  }

  function openUpdateLog() {
    setUpdateLogMode("recent");
    setUpdateLogOpen(true);
  }

  function closeUpdateLog() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(UPDATE_STORAGE_KEY, APP_VERSION);
    }
    setUpdateLogOpen(false);
  }

  async function copyFeedbackContext(context: string) {
    try {
      await navigator.clipboard.writeText(context);
      setMessage("已复制自动信息，请在反馈页粘贴到正文里。");
      setFeedbackContextVisible(false);
    } catch {
      setFeedbackContextVisible(true);
      setMessage("浏览器阻止了自动复制，请手动复制自动信息。");
    }
  }

  function openFeedback() {
    const context = buildFeedbackContext({
      competitionGame,
      game,
      mode,
      playerCount,
      roleId,
    });

    setFeedbackContext(context);
    setFeedbackFrameSrc(buildFeedbackFrameUrl());
    setFeedbackContextVisible(false);
    setFeedbackOpen(true);
    void copyFeedbackContext(context);
  }

  function closeFeedback() {
    setFeedbackOpen(false);
    setFeedbackContext("");
    setFeedbackFrameSrc("");
    setFeedbackContextVisible(false);
  }

  function drawStep() {
    if (!game) {
      return;
    }

    safely(() => runAiForCurrentDecision(drawCurrentStep(game)));
  }

  function submitDiscards() {
    if (!game) {
      return;
    }

    if (ghostwriterPending) {
      submitGhostwriterDiscard();
      return;
    }

    safely(() => {
      let next = discardCards(game, HUMAN_PLAYER_ID, selectedCards);
      next = runAiForCurrentDecision(next);
      return canAdvanceAfterDiscards(next) ? advanceAfterDiscards(next) : next;
    });
  }

  function submitGhostwriterDiscard() {
    if (!game || selectedCards.length !== 1) {
      setMessage("请选择 1 张角色拍立得作为代笔人技能弃置。");
      return;
    }

    try {
      const next = discardGhostwriterCard(game, HUMAN_PLAYER_ID, selectedCards[0]!);
      setGame(next);
      setSelectedCards([]);
      setSelectedScoringCard(null);
      setMessage("代笔人技能弃置完成；现在请继续完成本阶段正常弃置。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function submitWager() {
    if (!game || selectedCards.length !== 1) {
      setMessage("请选择 1 张角色拍立得签署。");
      return;
    }

    safely(() => placeWager(game, HUMAN_PLAYER_ID, selectedCards[0]!), false);
  }

  function submitCancelWager() {
    if (!game) {
      return;
    }

    safely(() => cancelWager(game, HUMAN_PLAYER_ID), false);
  }

  function useRoleAbility() {
    if (!game || !humanSeat) {
      return;
    }

    try {
      let next: GameState;
      switch (humanSeat.roleId) {
        case "ghostwriter": {
          next = useGhostwriterAbility(game, HUMAN_PLAYER_ID);
          setGame(next);
          setSelectedCards([]);
          setSelectedScoringCard(null);
          setMessage("代笔人已先抽 1 张角色拍立得；请从当前持有的拍立得中选择 1 张作为技能弃置。");
          return;
        }
        case "stage_manager":
          if (selectedCards.length !== 1) {
            setMessage("请选择 1 张角色拍立得作为舞台监督的排演对象。");
            return;
          }
          next = useStageManagerAbility(game, HUMAN_PLAYER_ID, selectedCards[0]!);
          break;
        case "casino_backer":
          next = useCasinoBackerAbility(game, HUMAN_PLAYER_ID);
          break;
        case "bartender":
          next = useBartenderAbility(game, HUMAN_PLAYER_ID);
          break;
        default:
          next = game;
      }
      setGame(next);
      setSelectedCards([]);
      setSelectedScoringCard(null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function resolveCurrentRound() {
    if (!game) {
      return;
    }

    const successfulCards = humanRound
      ? getSuccessfulScoringCards(game, humanRound.hand)
      : [];
    if (!selectedScoringCard && successfulCards.length > 1) {
      setMessage("你有多张人物可计分，请先选择 1 张作为本轮计分人物。");
      return;
    }

    if (
      selectedScoringCard &&
      !successfulCards.some((card) => card.id === selectedScoringCard)
    ) {
      setMessage("这张拍立得当前未满足条件，不能作为本轮计分拍立得。");
      return;
    }

    try {
      let next = game;
      const scoringCardId = selectedScoringCard ?? successfulCards[0]?.id;
      if (scoringCardId) {
        next = selectScoringCard(next, HUMAN_PLAYER_ID, scoringCardId);
      }
      const previousUnlockedBondIds = getUnlockedBondIds(game);
      next = runAiForCurrentDecision(next);
      const resolved = resolveRound(next);
      const unlockedNames = getNewUnlockedBondNames(previousUnlockedBondIds, resolved);
      setGame(resolved);
      setSelectedCards([]);
      setSelectedScoringCard(null);
      setMessage(null);
      if (unlockedNames.length > 0) {
        setAchievementMessage(`解锁羁绊成就：${unlockedNames.join("、")}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function beginNextRound() {
    if (!game) {
      return;
    }

    safely(() => startRound(game));
  }

  function startCompetitionGame() {
    setCompetitionGame(
      createCompetitionGame({
        playerCount: competitionPlayerCount,
        targetScore: competitionTargetScore,
      }),
    );
    setSelectedCompetitionCard(null);
    setMessage(null);
  }

  function submitCompetitionRegistration() {
    if (!competitionGame || !selectedCompetitionCard) {
      return;
    }

    try {
      const registered = registerCompetitionCard(
        competitionGame,
        HUMAN_PLAYER_ID,
        selectedCompetitionCard,
      );
      setCompetitionGame(runCompetitionAiForTurn(registered));
      setSelectedCompetitionCard(null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function passCompetitionRegistration() {
    if (!competitionGame) {
      return;
    }

    try {
      const passed = passCompetitionTurn(competitionGame, HUMAN_PLAYER_ID);
      setCompetitionGame(runCompetitionAiForTurn(passed));
      setSelectedCompetitionCard(null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function beginNextCompetitionRound() {
    if (!competitionGame) {
      return;
    }

    try {
      setCompetitionGame(startCompetitionRound(competitionGame));
      setSelectedCompetitionCard(null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function advanceCompetitionTurn() {
    if (!competitionGame) {
      return;
    }

    try {
      const next = advanceCompetitionAfterActions(runCompetitionAiForTurn(competitionGame));
      setCompetitionGame(next);
      setSelectedCompetitionCard(null);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function toggleSelectedCard(cardId: string) {
    if (!game || !isDiscardPhase(game.phase)) {
      return;
    }

    setSelectedCards((current) => {
      if (current.includes(cardId)) {
        return current.filter((id) => id !== cardId);
      }

      const maxSelection = ghostwriterPending ? 1 : Math.max(1, requiredDiscards);

      if (current.length >= maxSelection) {
        return [...current.slice(1), cardId];
      }

      return [...current, cardId];
    });
  }

  if (mode === "home") {
    return (
      <main className="app-shell">
        <section className="setup-panel">
          <div>
            <div className="game-title-row">
              <h1>战斗吧！Bocchetti！</h1>
              <span>FROM @真理追赶交替</span>
            </div>
            <div className="version-row">
              <span className="version-pill">{APP_VERSION}</span>
              <button className="text-action" onClick={openUpdateLog}>
                更新记录
              </button>
              <button className="text-action" onClick={openFeedback}>
                反馈
              </button>
            </div>
          </div>

          <div className="mode-grid">
            <article className="mode-card">
              <div>
                <p className="eyebrow">和平模式</p>
                <h2>公共积点与拍立得取舍</h2>
              </div>
              <p>
                所有观众面对同一组积点，通过弃置、签署、观众技能和一轮内羁绊争取得分。
              </p>
              <button className="primary-action" onClick={() => setMode("peace")}>
                进入和平模式
              </button>
            </article>

            <article className="mode-card">
              <div>
                <p className="eyebrow">竞争模式</p>
                <h2>秘密登记与拍立得选择</h2>
              </div>
              <p>
                公开拍立得翻开后，每名观众独立抽积点并秘密登记。小局结束后公开结算，抢先达成目标分者获胜。
              </p>
              <button
                className="primary-action"
                onClick={() => setMode("competition")}
              >
                进入竞争模式
              </button>
            </article>
          </div>
        </section>
        {updateLogOpen && (
          <UpdateLogPopover mode={updateLogMode} onClose={closeUpdateLog} />
        )}
        {feedbackOpen && (
          <FeedbackModal
            context={feedbackContext}
            contextVisible={feedbackContextVisible}
            frameSrc={feedbackFrameSrc}
            onClose={closeFeedback}
            onCopy={() => void copyFeedbackContext(feedbackContext)}
            onToggleContext={() =>
              setFeedbackContextVisible((current) => !current)
            }
          />
        )}
        {message && (
          <div className="message-toast" role="status">
            {message}
          </div>
        )}
      </main>
    );
  }

  if (mode === "competition") {
    return (
      <CompetitionModeScreen
        analysisOpen={competitionAnalysisOpen}
        analysisReport={competitionAnalysis}
        competitionGame={competitionGame}
        competitionPlayerCount={competitionPlayerCount}
        competitionTargetScore={competitionTargetScore}
        feedbackContext={feedbackContext}
        feedbackContextVisible={feedbackContextVisible}
        feedbackFrameSrc={feedbackFrameSrc}
        feedbackOpen={feedbackOpen}
        message={message}
        selectedCompetitionCard={selectedCompetitionCard}
        updateLogMode={updateLogMode}
        updateLogOpen={updateLogOpen}
        humanAction={competitionHumanAction}
        humanRegistration={competitionHumanRegistration}
        onBeginNextRound={beginNextCompetitionRound}
        onCloseFeedback={closeFeedback}
        onCloseUpdateLog={closeUpdateLog}
        onCopyFeedback={() => void copyFeedbackContext(feedbackContext)}
        onFeedback={openFeedback}
        onHome={returnHome}
        onAdvanceTurn={advanceCompetitionTurn}
        onPass={passCompetitionRegistration}
        onRegister={submitCompetitionRegistration}
        onSelectCard={setSelectedCompetitionCard}
        onSetPlayerCount={setCompetitionPlayerCount}
        onSetTargetScore={setCompetitionTargetScore}
        onStart={startCompetitionGame}
        onToggleAnalysis={() => setCompetitionAnalysisOpen((current) => !current)}
        onToggleFeedbackContext={() =>
          setFeedbackContextVisible((current) => !current)
        }
        onUpdateLog={openUpdateLog}
      />
    );
  }

  if (!game) {
    return (
      <main className="app-shell">
        <section className="setup-panel">
          <div>
            <div className="game-title-row">
              <h1>战斗吧！Bocchetti！</h1>
              <span>FROM @真理追赶交替</span>
            </div>
            <div className="version-row">
              <span className="version-pill">{APP_VERSION}</span>
              <button className="text-action" onClick={openUpdateLog}>
                更新记录
              </button>
              <button className="text-action" onClick={openFeedback}>
                反馈
              </button>
            </div>
          </div>

          <div className="setup-grid">
            <label className="field">
              <span>对局人数</span>
              <select
                value={playerCount}
                onChange={(event) =>
                  setPlayerCount(Number(event.target.value) as 2 | 3 | 4)
                }
              >
                <option value={2}>2 人</option>
                <option value={3}>3 人</option>
                <option value={4}>4 人</option>
              </select>
            </label>

            <label className="field">
              <span>观众角色</span>
              <select
                value={roleId}
                onChange={(event) =>
                  setRoleId(event.target.value as PlayerRoleId)
                }
              >
                {PLAYER_ROLES.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SelectedRoleIntro roleId={roleId} />

          <button className="secondary-action" onClick={() => setRulesOpen(true)}>
            游戏规则
          </button>

          <button className="primary-action" onClick={startGame}>
            开始对局
          </button>
          <button onClick={returnHome}>返回主页</button>
        </section>
        {rulesOpen && (
          <RulesModal
            onClose={() => setRulesOpen(false)}
            unlockedBondIds={unlockedBondIds}
          />
        )}
        {updateLogOpen && (
          <UpdateLogPopover mode={updateLogMode} onClose={closeUpdateLog} />
        )}
        {feedbackOpen && (
          <FeedbackModal
            context={feedbackContext}
            contextVisible={feedbackContextVisible}
            frameSrc={feedbackFrameSrc}
            onClose={closeFeedback}
            onCopy={() => void copyFeedbackContext(feedbackContext)}
            onToggleContext={() =>
              setFeedbackContextVisible((current) => !current)
            }
          />
        )}
        {message && (
          <div className="message-toast" role="status">
            {message}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">第 {game.round} 轮</p>
          <h1>{phaseLabels[game.phase]}</h1>
          <div className="version-row">
            <span className="version-pill">{APP_VERSION}</span>
            <button className="text-action" onClick={openUpdateLog}>
              更新记录
            </button>
            <button className="text-action" onClick={openFeedback}>
              反馈
            </button>
          </div>
        </div>
        <div className="top-actions">
          <button onClick={() => setRulesOpen(true)}>游戏规则</button>
          <button onClick={() => setLogOpen((current) => !current)}>
            {logOpen ? "隐藏日志" : "对局日志"}
          </button>
          <button onClick={() => setGame(null)}>重开</button>
          <button onClick={returnHome}>主页</button>
          {game.phase === "setup" && (
            <button className="primary-action" onClick={beginNextRound}>
              开始下一轮
            </button>
          )}
          {game.phase === "resolution" && (
            <button className="primary-action" onClick={resolveCurrentRound}>
              结算本轮
            </button>
          )}
        </div>
      </header>

      {stageGuide && (
        <section className="stage-guide" aria-live="polite">
          <div>
            <span>当前建议</span>
            <strong>{stageGuide.title}</strong>
          </div>
          <p>{stageGuide.body}</p>
        </section>
      )}

      {message && (
        <div className="message-toast" role="status">
          {message}
        </div>
      )}

      {achievementMessage && (
        <div className="achievement-toast" role="status">
          {achievementMessage}
        </div>
      )}

      {updateLogOpen && (
        <UpdateLogPopover mode={updateLogMode} onClose={closeUpdateLog} />
      )}
      {feedbackOpen && (
        <FeedbackModal
          context={feedbackContext}
          contextVisible={feedbackContextVisible}
          frameSrc={feedbackFrameSrc}
          onClose={closeFeedback}
          onCopy={() => void copyFeedbackContext(feedbackContext)}
          onToggleContext={() => setFeedbackContextVisible((current) => !current)}
        />
      )}

      <section className="score-row">
        {game.seats.map((seat) => (
          <article className="score-card" key={seat.id}>
            <span>{seat.name}</span>
            <strong>{seat.score}</strong>
            <small>{getRoleName(seat.roleId)}</small>
          </article>
        ))}
        <article className="score-card target">
          <span>目标分</span>
          <strong>{game.victoryScore}</strong>
          <small>{game.seats.length} 人局</small>
        </article>
      </section>

      <section className={logOpen ? "board-grid" : "board-grid board-grid-solo"}>
        <section className="board-panel">
          <div className="panel-heading">
            <div>
              <h2>积点</h2>
              <span>已抽 {game.drawnMarkers.length} / 10</span>
            </div>
            {isDrawPhase(game.phase) && (
              <button className="primary-action" onClick={drawStep}>
                抽取积点
              </button>
            )}
          </div>
          <div className="marker-pile">
            {game.drawnMarkers.length === 0 && (
              <span className="empty-state">等待第一幕抽取积点</span>
            )}
            {game.drawnMarkers.map((marker, index) => (
              <span className={`marker marker-${marker}`} key={`${marker}-${index}`}>
                {markerLabels[marker]}
              </span>
            ))}
          </div>
          <div className="marker-counts">
            {MARKER_CONFIGS.map((marker) => (
              <div key={marker.id}>
                <span>{marker.label}</span>
                <strong>
                  {markerCounts[marker.id]}/{marker.count}
                </strong>
              </div>
            ))}
          </div>
        </section>

        {logOpen && (
          <section className="board-panel log-panel">
            <div className="panel-heading">
              <h2>对局日志</h2>
              <button onClick={() => setLogOpen(false)}>隐藏</button>
            </div>
            <ol>
              {game.log.slice(-10).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ol>
          </section>
        )}
      </section>

      {latestResult && (game.phase === "setup" || game.phase === "game_over") && (
        <section className="result-panel">
          <div className="panel-heading">
            <h2>上一轮结算</h2>
            <span>第 {latestResult.round} 轮</span>
          </div>
          <div className="result-grid">
            {latestResult.scores.map((score) => (
              <article className="result-card" key={score.playerId}>
                <strong>{getSeatLabel(game, score.playerId)}</strong>
                <span>{score.cardId ? getCardById(score.cardId).name : "未得分"}</span>
                <b>{formatRoundScore(score)}</b>
                <small>{score.bonusReasons.join(" / ") || score.reason}</small>
              </article>
            ))}
          </div>
        </section>
      )}
      {rulesOpen && (
        <RulesModal
          onClose={() => setRulesOpen(false)}
          unlockedBondIds={unlockedBondIds}
        />
      )}

      {game.phase === "game_over" && (
        <FinalResults game={game} />
      )}

      {humanRound && game.phase !== "setup" && game.phase !== "game_over" && (
        <section className="hand-panel">
          <div className="panel-heading">
            <div>
              <h2>你的拍立得</h2>
              {isDiscardPhase(game.phase) && (
                <span>本阶段需要弃置 {requiredDiscards} 张</span>
              )}
              {ghostwriterPending && (
                <span>代笔人待弃置：请选择 1 张技能弃置</span>
              )}
              {game.phase === "resolution" && (
                <span>请选择 1 张成功角色拍立得作为本轮计分拍立得</span>
              )}
            </div>
            <div className="hand-actions">
              <button
                className={`secondary-action analysis-toggle ${
                  analysisOpen ? "active" : ""
                }`}
                onClick={() => setAnalysisOpen((current) => !current)}
              >
                {analysisOpen ? "关闭辅助" : "辅助分析"}
              </button>
              {canUseRoleButton(game) && (
                <button
                  className="secondary-action"
                  title={roleButtonHint ?? undefined}
                  disabled={
                    ghostwriterPending ||
                    (humanSeat?.roleId === "stage_manager" &&
                      selectedCards.length !== 1)
                  }
                  onClick={useRoleAbility}
                >
                  {humanSeat?.roleId === "ghostwriter"
                    ? "代笔：先抽1张"
                    : humanSeat?.roleId === "stage_manager"
                      ? "排演所选拍立得"
                      : "使用技能"}
                </button>
              )}
              {game.phase === "discard_2" && !ghostwriterPending && (
                humanRound.wageredCardId ? (
                  <button onClick={submitCancelWager}>取消签署</button>
                ) : (
                  <button onClick={submitWager}>签署拍立得</button>
                )
              )}
              {isDiscardPhase(game.phase) && (
                <button
                  className="primary-action"
                  title={discardButtonHint ?? undefined}
                  disabled={
                    selectedCards.length !== (ghostwriterPending ? 1 : requiredDiscards)
                  }
                  onClick={submitDiscards}
                >
                  {ghostwriterPending ? "确认代笔弃置" : "确认弃置"}
                </button>
              )}
            </div>
          </div>

          {analysisOpen && peaceAnalysis && (
            <AnalysisSummaryPanel report={peaceAnalysis} />
          )}

          <div className="card-grid">
            {humanRound.hand.map((cardId) => {
              const card = getCardById(cardId);
              const bondNames = getHandBondNames(humanRound.hand, cardId);
              const evaluation = evaluateCardConditionForPlayer(
                game,
                HUMAN_PLAYER_ID,
                cardId,
              );
              const selected = selectedCards.includes(cardId);
              const scoringSelected = selectedScoringCard === cardId;

              return (
                <CharacterCardView
                  card={card}
                  evaluationMet={evaluation.met}
                  key={card.id}
                  bondNames={bondNames}
                  analysis={analysisOpen ? getAnalysisForCard(peaceAnalysis, cardId) : undefined}
                  disabled={game.phase === "resolution" && !evaluation.met}
                  mode={game.phase === "resolution" ? "score" : "discard"}
                  selected={game.phase === "resolution" ? scoringSelected : selected}
                  stageManaged={humanRound.stageManagedCardId === cardId}
                  wagered={humanRound.wageredCardId === cardId}
                  onClick={() => {
                    if (game.phase === "resolution") {
                      if (!evaluation.met) {
                        setMessage("这张拍立得当前未满足条件，不能作为本轮计分拍立得。");
                        return;
                      }
                      setSelectedScoringCard(cardId);
                    } else {
                      toggleSelectedCard(cardId);
                    }
                  }}
                />
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

function RulesModal(props: {
  onClose: () => void;
  unlockedBondIds: Set<string>;
}) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "skills" | "special" | "bonds"
  >(
    "basic",
  );

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="rules-modal">
        <div className="panel-heading">
          <div>
            <h2>游戏规则</h2>
          </div>
          <button onClick={props.onClose}>关闭</button>
        </div>
        <div className="rules-tabs">
          <button
            className={activeTab === "basic" ? "active" : ""}
            onClick={() => setActiveTab("basic")}
          >
            基本规则
          </button>
          <button
            className={activeTab === "special" ? "active" : ""}
            onClick={() => setActiveTab("special")}
          >
            特殊规则
          </button>
          <button
            className={activeTab === "skills" ? "active" : ""}
            onClick={() => setActiveTab("skills")}
          >
            观众技能
          </button>
          <button
            className={activeTab === "bonds" ? "active" : ""}
            onClick={() => setActiveTab("bonds")}
          >
            羁绊成就
          </button>
        </div>
        {activeTab === "basic" && <BasicRules />}
        {activeTab === "special" && <SpecialRules />}
        {activeTab === "skills" && <SkillRules />}
        {activeTab === "bonds" && (
          <BondAchievements unlockedBondIds={props.unlockedBondIds} />
        )}
      </section>
    </div>
  );
}

function SelectedRoleIntro(props: { roleId: PlayerRoleId }) {
  const role = PLAYER_ROLES.find((item) => item.id === props.roleId);

  if (!role) {
    return null;
  }

  return (
    <article className="role-card active selected-role-card">
      <div className="selected-role-heading">
        <strong>{role.name}</strong>
        <span>{role.shortName}</span>
      </div>
      <p>{role.timing}</p>
      <p>{role.abilityText}</p>
      <small>{role.strategyText}</small>
    </article>
  );
}

function UpdateLogPopover(props: {
  mode: "latest" | "recent";
  onClose: () => void;
}) {
  const logs = props.mode === "latest" ? UPDATE_LOGS.slice(0, 1) : UPDATE_LOGS.slice(0, 3);

  return (
    <aside className="update-log-popover" role="status">
      <div>
        <span>{props.mode === "latest" ? APP_VERSION : "最近三个版本"}</span>
        <button onClick={props.onClose}>关闭</button>
      </div>
      <h2>{props.mode === "latest" ? "最新更新" : "更新记录"}</h2>
      <ul className="update-log-list">
        {logs.map((log) => (
          <li className="update-log-version" key={log.version}>
            <h3>{log.version}</h3>
            <ul className="update-log-items">
              {log.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function FeedbackModal(props: {
  context: string;
  contextVisible: boolean;
  frameSrc: string;
  onClose: () => void;
  onCopy: () => void;
  onToggleContext: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="rules-modal feedback-modal">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">观众反馈</p>
            <h2>反馈这局体验</h2>
          </div>
          <button onClick={props.onClose}>关闭</button>
        </div>

        <div className="feedback-layout">
          <article className="feedback-card">
            <h3>提交反馈</h3>
            <p>
              打开反馈时，系统会先复制一段自动信息。提交问卷时请把它粘贴到对应输入框里，再补充你遇到的问题或感受。
            </p>
            <div className="feedback-actions">
              <a
                className="button-link primary-action"
                href={FEEDBACK_FORM_URL}
                rel="noreferrer"
                target="_blank"
              >
                新窗口打开问卷
              </a>
              <button onClick={props.onCopy}>复制自动信息</button>
              <button onClick={props.onToggleContext}>
                {props.contextVisible ? "隐藏自动信息" : "显示自动信息"}
              </button>
            </div>
          </article>

          <article className="feedback-card">
            <h3>建议写清楚</h3>
            <ul>
              <li>你当时想做什么，实际发生了什么。</li>
              <li>哪张拍立得、哪个技能或哪条羁绊让你困惑。</li>
              <li>节奏是太快、太慢，还是某个选择没有价值。</li>
            </ul>
          </article>
        </div>

        {props.frameSrc && (
          <div className="feedback-frame-shell">
            <iframe
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
              src={props.frameSrc}
              title="观众反馈问卷"
            />
          </div>
        )}

        <textarea
          className={props.contextVisible ? "feedback-context" : "feedback-context hidden"}
          readOnly
          value={props.context}
        />
      </section>
    </div>
  );
}

function BasicRules() {
  return (
    <div className="info-grid">
      <article>
        <h3>首局只看这里</h3>
        <p>
          你的目标是保留最可能成功的 2 张角色拍立得。每张拍立得都会写明它需要哪些积点；条件满足后，结算时可以选 1 张得分。
        </p>
        <p>
          不确定时，优先保留已经接近条件、分数较高、或能和另一张形成羁绊的拍立得。
        </p>
      </article>
      <article>
        <h3>一轮怎么走</h3>
        <p>
          每轮先拿 5 张拍立得。积点分四幕抽出：4 枚、3 枚、2 枚、1 枚。前三次抽完都要弃置，最后只留下 2 张。
        </p>
        <p>
          到本轮结算时，每名观众最多选择 1 张满足条件的拍立得得分；没有满足条件就不得分。
        </p>
      </article>
      <article>
        <h3>积点怎么看</h3>
        <p>
          积点池共 18 枚，每轮抽 10 枚。每类积点总数都是 3 枚，界面上的 `家族 1/3` 表示本轮已经抽出 1 枚家族。
        </p>
        <p>
          每轮会重新洗一整袋积点。某类积点已经出现很多时，再指望它继续出现就更冒险。
        </p>
      </article>
      <article>
        <h3>拍立得条件</h3>
        <p>
          `&gt;=` 是至少，`&lt;=` 是最多，`&` 是同时满足，`/` 是满足其中一种，`最后 =` 只看终幕最后一枚积点。
        </p>
        <p>
          `家族 = 爱情` 代表两类积点数量相等，并且相关积点至少出现 1 枚。
        </p>
      </article>
      <article>
        <h3>签署拍立得</h3>
        <p>
          第二次弃置阶段可以签署 1 张当前持有的拍立得。若它最后被你选为计分拍立得并成功，额外 +1。
        </p>
        <p>
          签署可以取消；如果签署的拍立得后来被弃置，本轮签署就不会加分。
        </p>
      </article>
      <article>
        <h3>奖励上限</h3>
        <p>
          签署、人物羁绊和部分角色技能都属于额外奖励。每轮额外分最高 +2，避免单轮分数爆炸。
        </p>
      </article>
    </div>
  );
}

function buildFeedbackContext(input: {
  competitionGame: CompetitionGameState | null;
  game: GameState | null;
  mode: "home" | "peace" | "competition";
  playerCount: 2 | 3 | 4;
  roleId: PlayerRoleId;
}) {
  const pageUrl = typeof window === "undefined" ? "unknown" : window.location.href;
  const channel =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "local-dev"
      : "public";
  const timestamp = new Date().toLocaleString(undefined, {
    hour12: false,
    timeZoneName: "short",
  });
  const game = input.game;
  const competitionGame = input.competitionGame;
  const humanSeat =
    game?.seats.find((seat) => seat.id === HUMAN_PLAYER_ID) ?? null;
  const humanRound = game?.playerRounds[HUMAN_PLAYER_ID] ?? null;
  const scoreSummary =
    game?.seats
      .map((seat) => `${seat.name}:${seat.familyGlory ? "家族荣光" : seat.score}`)
      .join(" / ") ?? "未开局";
  const markerSummary =
    game?.drawnMarkers.map((marker) => markerLabels[marker]).join("、") || "无";
  const handSummary =
    humanRound?.hand
      .map((cardId) => {
        const card = getCardById(cardId);
        return `${card.name}《${card.versionTitle}》`;
      })
      .join(" / ") || "无";
  const competitionRegistration =
    competitionGame?.registrations[HUMAN_PLAYER_ID] ?? null;
  const competitionScoreSummary =
    competitionGame?.seats
      .map((seat) => `${seat.name}:${seat.score}`)
      .join(" / ") ?? "无";

  return [
    `版本: ${APP_VERSION}`,
    `渠道: ${channel}`,
    `时间: ${timestamp}`,
    `页面: ${pageUrl}`,
    `模式: ${getModeLabel(input.mode)}`,
    `画面: ${
      competitionGame
        ? getCompetitionPhaseTitle(competitionGame)
        : game
          ? phaseLabels[game.phase]
          : "启动页"
    }`,
    `人数: ${competitionGame?.seats.length ?? game?.seats.length ?? input.playerCount}`,
    `观众角色: ${getRoleName(humanSeat?.roleId ?? input.roleId)}`,
    `轮数: ${competitionGame ? `第 ${competitionGame.round} 小局 / 第 ${competitionGame.turn} 回合` : game?.round ?? "未开局"}`,
    `目标分: ${competitionGame?.targetScore ?? game?.victoryScore ?? "未开局"}`,
    `比分: ${competitionGame ? competitionScoreSummary : scoreSummary}`,
    `本轮积点: ${
      competitionGame
        ? (competitionGame.playerMarkers[HUMAN_PLAYER_ID] ?? [])
            .map((marker) => markerLabels[marker])
            .join("、") || "无"
        : markerSummary
    }`,
    `你的拍立得: ${handSummary}`,
    `竞争模式登记: ${
      competitionRegistration
        ? `${getCardById(competitionRegistration.cardId).name}《${getCardById(competitionRegistration.cardId).versionTitle}》`
        : "无"
    }`,
    `最近日志: ${(competitionGame?.log ?? game?.log)?.slice(-3).join(" / ") || "无"}`,
  ].join("\n");
}

function buildFeedbackFrameUrl() {
  const url = new URL(FEEDBACK_FORM_URL);
  url.searchParams.set("_t", String(Date.now()));
  return url.toString();
}

function SpecialRules() {
  return (
    <div className="info-grid special-rule-grid">
      <article>
        <h3>人物羁绊</h3>
        <p>
          羁绊要求两张相关角色拍立得同时留到结算。只要你选择计分的那张拍立得满足条件，就能获得对应羁绊分。
        </p>
        <p>
          所有羁绊奖励统一为 +1，并计入每轮额外奖励上限。
        </p>
        <p>
          手牌中已经凑齐羁绊组合时，卡面会提前提示“羁绊”。这只是提醒组合存在，不代表一定能加分。
        </p>
      </article>
      <article>
        <h3>羁绊成就</h3>
        <p>
          成功触发过的羁绊会解锁为羁绊成就。未解锁前，成就页只显示组合，剧情解说保持隐藏。
        </p>
        <p>
          羁绊成就是剧情收集目标，不会改变之后的牌堆或积点池。
        </p>
      </article>
      <article>
        <h3>家族荣光</h3>
        <p>
          少数拍立得不是普通分数，而是“家族荣光”。它们条件更难；一旦达成并被选为本轮计分拍立得，会直接赢得整局。
        </p>
        <p>
          家族荣光拍立得不参与人物羁绊，也不受普通额外分上限影响。
        </p>
      </article>
    </div>
  );
}

function BondAchievements(props: { unlockedBondIds: Set<string> }) {
  return (
    <div className="bond-grid">
      {BOND_RULES.map((bond) => {
        const left = getCardById(bond.characterIds[0]);
        const right = getCardById(bond.characterIds[1]);
        const unlocked = props.unlockedBondIds.has(bond.id);

        return (
          <article
            className={unlocked ? "bond-card unlocked" : "bond-card locked"}
            key={bond.id}
          >
            <div>
              <strong>{bond.name}</strong>
              <span>{unlocked ? "已解锁" : "未解锁"}</span>
            </div>
            <p>
              {left.name}《{left.versionTitle}》 + {right.name}《
              {right.versionTitle}》
            </p>
            <em>{unlocked ? bond.storyText : "？？？"}</em>
          </article>
        );
      })}
    </div>
  );
}

function SkillRules() {
  return (
    <div className="info-grid">
      {PLAYER_ROLES.map((role) => (
        <article key={role.id}>
          <h3>{role.name}</h3>
          <p>{role.timing}</p>
          <p>{role.abilityText}</p>
          <small>{role.strategyText}</small>
          <small>{getRoleUseHint(role.id)}</small>
        </article>
      ))}
    </div>
  );
}

function FinalResults(props: { game: GameState }) {
  const latestResult = props.game.roundResults.at(-1);
  const winners = new Set(getWinners(props.game).map((seat) => seat.id));
  const ranking = [...props.game.seats].sort(
    (left, right) =>
      Number(right.familyGlory) - Number(left.familyGlory) ||
      right.score - left.score ||
      left.name.localeCompare(right.name),
  );

  return (
    <section className="result-panel final-results">
      <div className="panel-heading">
        <div>
          <h2>最终结算</h2>
          <span>按总分从高到低排序</span>
        </div>
        <strong>{getWinners(props.game).map((seat) => seat.name).join("、")} 获胜</strong>
      </div>
      <div className="final-ranking">
        {ranking.map((seat, index) => {
          const lastScore = latestResult?.scores.find(
            (score) => score.playerId === seat.id,
          );
          const scoringCard = lastScore?.cardId ? getCardById(lastScore.cardId) : null;

          return (
            <article
              className={winners.has(seat.id) ? "final-row winner" : "final-row"}
              key={seat.id}
            >
              <b>#{index + 1}</b>
              <div>
                <strong>{seat.name}</strong>
                <span>{getRoleName(seat.roleId)}</span>
              </div>
              <strong>{seat.familyGlory ? "家族荣光" : `${seat.score} 分`}</strong>
              <small>
                最后一轮 {lastScore ? formatRoundScore(lastScore) : "+0"}
                {scoringCard ? ` / ${scoringCard.name}《${scoringCard.versionTitle}》` : ""}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompetitionModeScreen(props: {
  analysisOpen: boolean;
  analysisReport: AnalysisReport | null;
  competitionGame: CompetitionGameState | null;
  competitionPlayerCount: 2 | 3 | 4;
  competitionTargetScore: number;
  feedbackContext: string;
  feedbackContextVisible: boolean;
  feedbackFrameSrc: string;
  feedbackOpen: boolean;
  humanAction: boolean;
  humanRegistration: { cardId: string; turn: number } | null;
  message: string | null;
  selectedCompetitionCard: string | null;
  updateLogMode: "latest" | "recent";
  updateLogOpen: boolean;
  onBeginNextRound: () => void;
  onCloseFeedback: () => void;
  onCloseUpdateLog: () => void;
  onCopyFeedback: () => void;
  onFeedback: () => void;
  onHome: () => void;
  onAdvanceTurn: () => void;
  onPass: () => void;
  onRegister: () => void;
  onSelectCard: (cardId: string | null) => void;
  onSetPlayerCount: (count: 2 | 3 | 4) => void;
  onSetTargetScore: (score: number) => void;
  onStart: () => void;
  onToggleAnalysis: () => void;
  onToggleFeedbackContext: () => void;
  onUpdateLog: () => void;
}) {
  const game = props.competitionGame;
  const [rulesOpen, setRulesOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  if (!game) {
    return (
      <main className="app-shell">
        <section className="setup-panel">
          <div>
            <p className="eyebrow">竞争模式</p>
            <h1>秘密登记拍立得</h1>
            <div className="version-row">
              <span className="version-pill">{APP_VERSION}</span>
              <button className="text-action" onClick={props.onUpdateLog}>
                更新记录
              </button>
              <button className="text-action" onClick={props.onFeedback}>
                反馈
              </button>
            </div>
          </div>

          <div className="setup-grid">
            <label className="field">
              <span>观众人数</span>
              <select
                value={props.competitionPlayerCount}
                onChange={(event) =>
                  props.onSetPlayerCount(Number(event.target.value) as 2 | 3 | 4)
                }
              >
                <option value={2}>2 人</option>
                <option value={3}>3 人</option>
                <option value={4}>4 人</option>
              </select>
            </label>

            <label className="field">
              <span>目标分</span>
              <select
                value={props.competitionTargetScore}
                onChange={(event) => props.onSetTargetScore(Number(event.target.value))}
              >
                <option value={10}>10 分快速局</option>
                <option value={15}>15 分标准局</option>
                <option value={20}>20 分长局</option>
              </select>
            </label>
          </div>

          <div className="info-grid special-rule-grid">
            <article>
              <h3>玩法差异</h3>
              <p>
                每小局翻开人数 +1 张公开拍立得。每名观众独立抽积点，最多秘密登记 1 张，结算前不公开。
              </p>
            </article>
            <article>
              <h3>结算重点</h3>
              <p>
                同一张拍立得多人登记时，满足条件者中登记更早者得分；同回合冲突用本小局随机优先序。
              </p>
            </article>
          </div>

          <button className="secondary-action" onClick={() => setRulesOpen(true)}>
            游戏规则
          </button>

          <button className="primary-action" onClick={props.onStart}>
            开始竞争模式
          </button>
          <button onClick={props.onHome}>返回主页</button>
          {rulesOpen && (
            <CompetitionRulesModal
              unlockedBondIds={new Set()}
              onClose={() => setRulesOpen(false)}
            />
          )}
        </section>
        <SharedOverlays
          feedbackContext={props.feedbackContext}
          feedbackContextVisible={props.feedbackContextVisible}
          feedbackFrameSrc={props.feedbackFrameSrc}
          feedbackOpen={props.feedbackOpen}
          message={props.message}
          updateLogMode={props.updateLogMode}
          updateLogOpen={props.updateLogOpen}
          onCloseFeedback={props.onCloseFeedback}
          onCloseUpdateLog={props.onCloseUpdateLog}
          onCopyFeedback={props.onCopyFeedback}
          onToggleFeedbackContext={props.onToggleFeedbackContext}
        />
      </main>
    );
  }

  const latestResult = game.roundResults.at(-1);
  const humanMarkers = game.playerMarkers[HUMAN_PLAYER_ID] ?? [];
  const humanCanAct =
    game.phase === "register" &&
    !props.humanRegistration &&
    !props.humanAction;
  const competitionTurnComplete =
    game.phase === "register" &&
    game.seats.every((seat) => game.registrations[seat.id] || game.turnActions[seat.id]);

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">竞争模式 / 第 {game.round} 小局</p>
          <h1>{getCompetitionPhaseTitle(game)}</h1>
          <div className="version-row">
            <span className="version-pill">{APP_VERSION}</span>
            <button className="text-action" onClick={props.onUpdateLog}>
              更新记录
            </button>
            <button className="text-action" onClick={props.onFeedback}>
              反馈
            </button>
          </div>
        </div>
        <div className="top-actions">
          <button onClick={() => setGuideOpen((current) => !current)}>
            {guideOpen ? "隐藏建议" : "显示建议"}
          </button>
          <button onClick={() => props.onSelectCard(null)}>清除选择</button>
          <button onClick={() => setRulesOpen(true)}>游戏规则</button>
          <button onClick={props.onHome}>主页</button>
          {game.phase === "round_result" && (
            <button className="primary-action" onClick={props.onBeginNextRound}>
              开始下一小局
            </button>
          )}
        </div>
      </header>

      {guideOpen ? (
        <section className="stage-guide stage-guide-dismissible" aria-live="polite">
          <div>
            <span>当前建议</span>
            <strong>{getCompetitionGuideTitle(game, props.humanRegistration, props.humanAction)}</strong>
          </div>
          <p>{getCompetitionGuideBody(game, props.humanRegistration, props.humanAction)}</p>
        </section>
      ) : null}

      <SharedOverlays
        feedbackContext={props.feedbackContext}
        feedbackContextVisible={props.feedbackContextVisible}
        feedbackFrameSrc={props.feedbackFrameSrc}
        feedbackOpen={props.feedbackOpen}
        message={props.message}
        updateLogMode={props.updateLogMode}
        updateLogOpen={props.updateLogOpen}
        onCloseFeedback={props.onCloseFeedback}
        onCloseUpdateLog={props.onCloseUpdateLog}
        onCopyFeedback={props.onCopyFeedback}
        onToggleFeedbackContext={props.onToggleFeedbackContext}
      />

      <section className="score-row">
        {game.seats.map((seat) => (
          <article className="score-card" key={seat.id}>
            <span>{seat.name}</span>
            <strong>{seat.score}</strong>
            <small title={getCompetitionArchiveSummary(game, seat.id)}>
              {getCompetitionArchiveSummary(game, seat.id)}
            </small>
          </article>
        ))}
        <article className="score-card target">
          <span>目标分</span>
          <strong>{game.targetScore}</strong>
          <small>竞争模式</small>
        </article>
      </section>

      {game.phase === "register" && (
        <section className="competition-layout">
          <section className="hand-panel competition-market-panel">
            <div className="panel-heading">
              <div>
                <h2>公开拍立得</h2>
                <span>结算前只公开拍立得，不公开其他观众登记</span>
              </div>
              <button
                className={`secondary-action analysis-toggle ${
                  props.analysisOpen ? "active" : ""
                }`}
                onClick={props.onToggleAnalysis}
              >
                {props.analysisOpen ? "关闭辅助" : "辅助分析"}
              </button>
            </div>
            {props.analysisOpen && props.analysisReport && (
              <AnalysisSummaryPanel report={props.analysisReport} />
            )}
            <div className="card-grid competition-card-grid">
              {game.market.map((cardId) => {
                const card = getCardById(cardId);
                const evaluation = evaluateCompetitionCardCondition(
                  game,
                  HUMAN_PLAYER_ID,
                  cardId,
                );

                return (
                  <CharacterCardView
                    bondNames={getCompetitionArchiveBondNames(
                      game.archives[HUMAN_PLAYER_ID] ?? [],
                      cardId,
                      game.unlockedBondIds[HUMAN_PLAYER_ID] ?? [],
                    )}
                    card={card}
                    evaluationMet={evaluation.met}
                    key={card.id}
                    analysis={
                      props.analysisOpen
                        ? getAnalysisForCard(props.analysisReport, cardId)
                        : undefined
                    }
                    mode="score"
                    scoreLabel={`${getCompetitionCardScore(cardId)} 分`}
                    selected={props.selectedCompetitionCard === cardId}
                    stageManaged={false}
                    wagered={props.humanRegistration?.cardId === cardId}
                    wagerLabel="已登记"
                    onClick={() => {
                      if (humanCanAct) {
                        props.onSelectCard(cardId);
                      }
                    }}
                  />
                );
              })}
            </div>
          </section>

          <div className="competition-side-stack">
            <section className="board-panel">
              <div className="panel-heading">
                <div>
                  <h2>你的积点</h2>
                  <span>本小局已抽 {humanMarkers.length} / 10</span>
                </div>
                <span>第 {game.turn} / 4 回合</span>
              </div>
              <div className="marker-pile">
                {humanMarkers.length === 0 && (
                  <span className="empty-state">等待本小局第一回合抽取积点</span>
                )}
                {humanMarkers.map((marker, index) => (
                  <span className={`marker marker-${marker}`} key={`${marker}-${index}`}>
                    {markerLabels[marker]}
                  </span>
                ))}
              </div>
              <div className="marker-counts">
                {MARKER_CONFIGS.map((marker) => (
                  <div key={marker.id}>
                    <span>{marker.label}</span>
                    <strong>
                      {humanMarkers.filter((item) => item === marker.id).length}/{marker.count}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="board-panel">
              <div className="panel-heading">
                <div>
                  <h2>秘密登记</h2>
                  <span>{getCompetitionRegistrationLabel(game, props.humanRegistration, props.humanAction)}</span>
                </div>
                <div className="hand-actions">
                  {humanCanAct && (
                    <>
                      <button
                        className="primary-action"
                        disabled={!props.selectedCompetitionCard}
                        onClick={props.onRegister}
                      >
                        秘密登记所选
                      </button>
                      <button onClick={props.onPass}>本回合不登记</button>
                    </>
                  )}
                </div>
              </div>
              {competitionTurnComplete && (
                <button className="primary-action full-width-action" onClick={props.onAdvanceTurn}>
                  {game.turn >= 4 ? "结算本小局" : "抽取积点"}
                </button>
              )}
              <div className="competition-secret-list">
                <div>
                  <strong>你</strong>
                  <span>
                    {getHumanCompetitionSecretLabel(
                      props.humanRegistration,
                      props.humanAction,
                    )}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}

      {latestResult && game.phase === "round_result" && (
        <CompetitionRoundResultPanel game={game} result={latestResult} />
      )}

      {game.phase === "game_over" && <CompetitionFinalResults game={game} />}
      {rulesOpen && (
        <CompetitionRulesModal
          unlockedBondIds={getCompetitionUnlockedBondIds(game)}
          onClose={() => setRulesOpen(false)}
        />
      )}
    </main>
  );
}

function SharedOverlays(props: {
  feedbackContext: string;
  feedbackContextVisible: boolean;
  feedbackFrameSrc: string;
  feedbackOpen: boolean;
  message: string | null;
  updateLogMode: "latest" | "recent";
  updateLogOpen: boolean;
  onCloseFeedback: () => void;
  onCloseUpdateLog: () => void;
  onCopyFeedback: () => void;
  onToggleFeedbackContext: () => void;
}) {
  return (
    <>
      {props.updateLogOpen && (
        <UpdateLogPopover mode={props.updateLogMode} onClose={props.onCloseUpdateLog} />
      )}
      {props.feedbackOpen && (
        <FeedbackModal
          context={props.feedbackContext}
          contextVisible={props.feedbackContextVisible}
          frameSrc={props.feedbackFrameSrc}
          onClose={props.onCloseFeedback}
          onCopy={props.onCopyFeedback}
          onToggleContext={props.onToggleFeedbackContext}
        />
      )}
      {props.message && (
        <div className="message-toast" role="status">
          {props.message}
        </div>
      )}
    </>
  );
}

function CompetitionRoundResultPanel(props: {
  game: CompetitionGameState;
  result: NonNullable<CompetitionGameState["roundResults"][number]>;
}) {
  return (
    <section className="result-panel">
      <div className="panel-heading">
        <div>
          <h2>第 {props.result.round} 小局结算</h2>
          <span>秘密登记已公开</span>
        </div>
      </div>
      <div className="result-grid">
        {props.result.playerResults.map((score) => {
          const card = score.cardId ? getCardById(score.cardId) : null;
          const bondNames = score.bondIds
            .map((bondId) => BOND_RULES.find((bond) => bond.id === bondId)?.name)
            .filter((name): name is string => Boolean(name));

          return (
            <article className="result-card" key={score.playerId}>
              <strong>{getCompetitionSeatLabel(props.game, score.playerId)}</strong>
              <span>{card ? `${card.name}《${card.versionTitle}》` : "未登记"}</span>
              <b>{score.success ? `+${score.totalScore}` : "+0"}</b>
              <small>
                {score.registrationTurn ? `第 ${score.registrationTurn} 回合登记 / ` : ""}
                {score.reason}
                {bondNames.length > 0 ? ` / 羁绊：${bondNames.join("、")}` : ""}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CompetitionFinalResults(props: { game: CompetitionGameState }) {
  const winners = new Set(getCompetitionWinners(props.game).map((seat) => seat.id));
  const ranking = [...props.game.seats].sort(
    (left, right) => right.score - left.score || left.name.localeCompare(right.name),
  );

  return (
    <section className="result-panel final-results">
      <div className="panel-heading">
        <div>
          <h2>竞争模式最终结算</h2>
          <span>达到目标分后结束</span>
        </div>
        <strong>{getCompetitionWinners(props.game).map((seat) => seat.name).join("、")} 获胜</strong>
      </div>
      <div className="final-ranking">
        {ranking.map((seat, index) => (
          <article
            className={winners.has(seat.id) ? "final-row winner" : "final-row"}
            key={seat.id}
          >
            <b>#{index + 1}</b>
            <div>
              <strong>{seat.name}</strong>
              <span>剧情档案 {props.game.archives[seat.id]?.length ?? 0} 张</span>
            </div>
            <strong>{seat.score} 分</strong>
            <small>
              竞争羁绊成就 {props.game.unlockedBondIds[seat.id]?.length ?? 0} 条
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompetitionRulesModal(props: {
  unlockedBondIds: Set<string>;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<
    "basic" | "score" | "bonds" | "achievements"
  >("basic");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="rules-modal">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">竞争模式</p>
            <h2>游戏规则</h2>
          </div>
          <button onClick={props.onClose}>关闭</button>
        </div>
        <div className="rules-tabs">
          <button
            className={activeTab === "basic" ? "active" : ""}
            onClick={() => setActiveTab("basic")}
          >
            基本规则
          </button>
          <button
            className={activeTab === "score" ? "active" : ""}
            onClick={() => setActiveTab("score")}
          >
            结算规则
          </button>
          <button
            className={activeTab === "bonds" ? "active" : ""}
            onClick={() => setActiveTab("bonds")}
          >
            羁绊规则
          </button>
          <button
            className={activeTab === "achievements" ? "active" : ""}
            onClick={() => setActiveTab("achievements")}
          >
            羁绊成就
          </button>
        </div>

        {activeTab === "basic" && (
          <div className="info-grid">
            <article>
              <h3>一场怎么赢</h3>
              <p>
                竞争模式由多个小局组成。每小局固定 4 回合，整场对局会持续到有观众达到或超过目标分。
              </p>
              <p>
                默认目标分为 15 分；快速局是 10 分，长局是 20 分。
              </p>
            </article>
            <article>
              <h3>公开拍立得</h3>
              <p>
                每小局开始时，场面会翻开观众人数 +1 张公开拍立得。所有观众都从这组公开拍立得里选择是否登记。
              </p>
              <p>
                公开拍立得一直可见，但其他观众登记了哪一张会在结算前保持隐藏。
              </p>
            </article>
            <article>
              <h3>积点怎么抽</h3>
              <p>
                每名观众都有自己的积点区。4 回合分别抽取 4、3、2、1 枚积点，本小局总计 10 枚。
              </p>
              <p>
                积点统计里的“家族 1/3”表示本小局你已经抽到 1 枚家族积点。
              </p>
            </article>
            <article>
              <h3>秘密登记</h3>
              <p>
                每名观众每小局最多登记 1 张公开拍立得。登记后不可更换，也不能撤回。
              </p>
              <p>
                你也可以在当前回合选择等待，下一回合抽到新积点后再决定。
              </p>
            </article>
          </div>
        )}

        {activeTab === "score" && (
          <div className="info-grid">
            <article>
              <h3>先看条件</h3>
              <p>
                小局结束时统一公开登记结果。只有登记拍立得并满足条件的观众，才有资格拿到这张拍立得的分数。
              </p>
              <p>
                没有登记、条件未满足，或冲突失败，本小局都不会通过这张拍立得得分。
              </p>
            </article>
            <article>
              <h3>多人登记同一张</h3>
              <p>
                同一张拍立得被多人登记时，只能有一名观众得分。登记回合更早者优先。
              </p>
              <p>
                如果同回合登记同一张，则按本小局随机优先序破平；若更早者不满足条件，会顺延给下一个满足条件者。
              </p>
            </article>
            <article>
              <h3>家族荣光</h3>
              <p>
                家族荣光在竞争模式中不是直接胜利，而是 8 分高分牌。
              </p>
              <p>
                达到目标分后结束整场对局；多人同时达到时，分数更高者胜，仍同分则并列。
              </p>
            </article>
          </div>
        )}

        {activeTab === "bonds" && (
          <div className="info-grid">
            <article>
              <h3>剧情档案</h3>
              <p>
                只有成功计分过的拍立得会进入该观众的竞争模式剧情档案。
              </p>
              <p>
                条件失败或冲突失败的登记不会进入档案，也不会触发跨小局羁绊。
              </p>
            </article>
            <article>
              <h3>跨小局羁绊</h3>
              <p>
                当本小局新计分拍立得与剧情档案里的旧拍立得形成羁绊时，触发跨小局羁绊。
              </p>
              <p>
                竞争模式的所有羁绊奖励统一为 +1，每条羁绊每名观众每场只触发一次。
              </p>
            </article>
          </div>
        )}
        {activeTab === "achievements" && (
          <BondAchievements unlockedBondIds={props.unlockedBondIds} />
        )}
      </section>
    </div>
  );
}

function getSuccessfulScoringCards(
  game: GameState,
  hand: readonly string[],
): CharacterCard[] {
  return hand
    .map((cardId) => getCardById(cardId))
    .filter((card) =>
      evaluateCardConditionForPlayer(game, HUMAN_PLAYER_ID, card.id).met,
    );
}

function AnalysisSummaryPanel(props: { report: AnalysisReport }) {
  const recommendedCard = props.report.recommendedCardId
    ? getCardById(props.report.recommendedCardId)
    : null;

  return (
    <section className="analysis-panel">
      <div>
        <span>辅助分析</span>
        <strong>{props.report.summary}</strong>
      </div>
      {recommendedCard && (
        <small>
          推荐项：{recommendedCard.name}《{recommendedCard.versionTitle}》
        </small>
      )}
    </section>
  );
}

function getAnalysisForCard(
  report: AnalysisReport | null,
  cardId: string,
): CardAnalysis | undefined {
  return report?.items.find((item) => item.cardId === cardId);
}

function CharacterCardView(props: {
  card: CharacterCard;
  analysis?: CardAnalysis;
  bondNames: string[];
  disabled?: boolean;
  evaluationMet: boolean;
  mode: "discard" | "score";
  scoreLabel?: string;
  selected: boolean;
  stageManaged: boolean;
  wagered: boolean;
  wagerLabel?: string;
  onClick: () => void;
}) {
  const className = [
    "character-card",
    props.selected ? `selected selected-${props.mode}` : "",
    props.bondNames.length > 0 ? "bond-ready" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={className}
      disabled={props.disabled}
      onClick={props.onClick}
      type="button"
    >
      <div className="portrait-placeholder">{props.card.name}</div>
      <div className="card-body">
        <div className="card-title-row">
          <strong>{props.card.name}</strong>
          <span>{props.scoreLabel ?? formatCardScore(props.card)}</span>
        </div>
        <p>{props.card.versionTitle}</p>
        <div className="condition-summary">
          <ConditionSummary condition={props.card.condition} />
        </div>
        {props.bondNames.length > 0 && (
          <div className="bond-ready-strip">
            <span>羁绊</span>
            <strong>{props.bondNames.join(" / ")}</strong>
          </div>
        )}
        {props.analysis && (
          <div className={`analysis-strip risk-${props.analysis.riskTag}`}>
            <div>
              <span>{props.analysis.recommendationLabel}</span>
              <strong>
                {formatProbability(props.analysis.finalSuccessRate)} / 期望{" "}
                {props.analysis.expectedScore.toFixed(1)}
              </strong>
            </div>
            <small>
              {props.analysis.riskLabel}：{props.analysis.volatilityNote}
            </small>
            <small>{props.analysis.detailText}</small>
            {props.analysis.conflictNote && (
              <small>{props.analysis.conflictNote}</small>
            )}
          </div>
        )}
        <div className="tag-row">
          <b className={props.evaluationMet ? "status met" : "status pending"}>
            {props.evaluationMet ? "已满足" : "未满足"}
          </b>
          {props.wagered && <b className="status wager">{props.wagerLabel ?? "已签署"}</b>}
          {props.stageManaged && <b className="status stage-managed">已排演</b>}
          {props.selected && (
            <b className={props.mode === "score" ? "status action" : "status discard"}>
              {props.mode === "score" ? "待计分" : "待弃置"}
            </b>
          )}
        </div>
      </div>
    </button>
  );
}

function getHandBondNames(hand: readonly string[], cardId: string): string[] {
  return BOND_RULES.filter(
    (bond) =>
      bond.characterIds.includes(cardId) &&
      bond.characterIds.every((bondCardId) => hand.includes(bondCardId)),
  ).map((bond) => bond.name);
}

function getUnlockedBondIds(game: GameState | null): Set<string> {
  return new Set(
    game?.roundResults.flatMap((result) =>
      result.scores.flatMap((score) => score.bondIds),
    ) ?? [],
  );
}

function getCompetitionUnlockedBondIds(game: CompetitionGameState | null): Set<string> {
  return new Set(game?.unlockedBondIds[HUMAN_PLAYER_ID] ?? []);
}

function getCompetitionArchiveSummary(
  game: CompetitionGameState,
  playerId: string,
): string {
  const archive = game.archives[playerId] ?? [];
  if (archive.length === 0) {
    return "尚未达成拍立得";
  }

  return `已达成：${archive
    .map((cardId) => {
      const card = getCardById(cardId);
      return `${card.name}《${card.versionTitle}》`;
    })
    .join("、")}`;
}

function getNewUnlockedBondNames(
  previousUnlockedBondIds: Set<string>,
  game: GameState,
): string[] {
  return [...getUnlockedBondIds(game)]
    .filter((bondId) => !previousUnlockedBondIds.has(bondId))
    .map((bondId) => BOND_RULES.find((bond) => bond.id === bondId)?.name)
    .filter((name): name is string => Boolean(name));
}

function ConditionSummary(props: { condition: Condition }) {
  const condition = props.condition;

  switch (condition.type) {
    case "minCount":
      return (
        <>
          <ConditionMarker marker={condition.marker} /> {" >= "} {condition.count}
        </>
      );
    case "maxCount":
      return (
        <>
          <ConditionMarker marker={condition.marker} /> {" <= "} {condition.count}
        </>
      );
    case "equalCount":
      return (
        <>
          <ConditionMarker marker={condition.marker} /> ={" "}
          <ConditionMarker marker={condition.otherMarker} />
        </>
      );
    case "lastIs":
      return (
        <>
          最后 = <ConditionMarker marker={condition.marker} />
        </>
      );
    case "allOf":
      return (
        <>
          {condition.conditions.map((child, index) => (
            <span className="condition-fragment" key={index}>
              {index > 0 && <span className="condition-operator">&</span>}
              <ConditionSummary condition={child} />
            </span>
          ))}
        </>
      );
    case "anyOf":
      return (
        <>
          {condition.conditions.map((child, index) => (
            <span className="condition-fragment" key={index}>
              {index > 0 && <span className="condition-operator">/</span>}
              <ConditionSummary condition={child} />
            </span>
          ))}
        </>
      );
    default: {
      const exhaustive: never = condition;
      return exhaustive;
    }
  }
}

function ConditionMarker(props: { marker: MarkerCategory }) {
  return (
    <span className={`condition-marker marker-${props.marker}`}>
      {markerLabels[props.marker]}
    </span>
  );
}

function canUseRoleButton(game: GameState): boolean {
  const seat = game.seats.find((item) => item.id === HUMAN_PLAYER_ID);
  const round = game.playerRounds[HUMAN_PLAYER_ID];

  if (!seat || !round || round.usedRoleAbility || round.ghostwriterDiscardPending) {
    return false;
  }

  if (seat.roleId === "casino_backer") {
    return game.phase === "discard_2";
  }

  if (seat.roleId === "stage_manager") {
    return game.phase === "discard_1";
  }

  if (seat.roleId === "bartender") {
    return game.phase === "discard_1" || game.phase === "discard_2";
  }

  if (seat.roleId === "ghostwriter") {
    return game.phase === "discard_1" || game.phase === "discard_2";
  }

  return isDiscardPhase(game.phase);
}

function getStageGuide(
  game: GameState,
  selectedCount: number,
  requiredDiscards: number,
): { title: string; body: string } {
  const round = game.playerRounds[HUMAN_PLAYER_ID];
  const successfulCards = round
    ? getSuccessfulScoringCards(game, round.hand)
    : [];

  switch (game.phase) {
    case "setup":
      return {
        title: game.roundResults.length === 0 ? "准备开始第一轮" : "上一轮已结束",
        body:
          "确认人数和观众角色后，点击“开始下一轮”。每轮都会重新发拍立得并洗一整袋积点。",
      };
    case "draw_1":
    case "draw_2":
    case "draw_3":
    case "draw_4":
      return {
        title: "先抽积点",
        body:
          "点击“抽取积点”推进这一幕。抽完后再根据新出现的积点决定要留下哪几张拍立得。",
      };
    case "discard_1":
      if (round?.ghostwriterDiscardPending) {
        return {
          title: "先完成代笔弃置",
          body: "代笔人已经多抽 1 张。现在请选择 1 张拍立得作为技能弃置，再继续正常弃置。",
        };
      }
      return {
        title: "第一次取舍",
        body: `选择 ${requiredDiscards} 张最不想保留的拍立得，再点击“确认弃置”。已选 ${selectedCount}/${requiredDiscards}。`,
      };
    case "discard_2":
      if (round?.ghostwriterDiscardPending) {
        return {
          title: "先完成代笔弃置",
          body: "代笔人的技能弃置不算作本阶段正常弃置。先处理技能成本，再继续本阶段取舍。",
        };
      }
      return {
        title: "可以签署，也要继续取舍",
        body:
          `你可以先选择 1 张拍立得签署；如果它最后成功计分会额外 +1。随后选择 ${requiredDiscards} 张弃置，当前已选 ${selectedCount}/${requiredDiscards}。`,
      };
    case "discard_3":
      return {
        title: "最后一次取舍",
        body:
          `这一阶段后会留下 2 张拍立得进入结算。选择 ${requiredDiscards} 张弃置，当前已选 ${selectedCount}/${requiredDiscards}。`,
      };
    case "resolution":
      if (successfulCards.length > 1) {
        return {
          title: "选择本轮计分拍立得",
          body: "你有多张拍立得满足条件。请选择最想计分的 1 张，再点击“结算本轮”。",
        };
      }
      if (successfulCards.length === 1) {
        return {
          title: "可以结算",
          body: "你有 1 张拍立得满足条件。点击“结算本轮”后会计算基础分、签署和羁绊奖励。",
        };
      }
      return {
        title: "本轮没有成功拍立得",
        body: "没有拍立得满足条件也可以结算，本轮记为 0 分，然后进入下一轮。",
      };
    case "game_over":
      return {
        title: "整局结束",
        body: "最终结算会按总分排序；如果有人达成家族荣光，会直接成为胜者。",
      };
    default:
      return {
        title: "继续对局",
        body: "按照当前阶段按钮推进即可。",
      };
  }
}

function getRoleButtonHint(game: GameState, selectedCount: number): string | null {
  const seat = game.seats.find((item) => item.id === HUMAN_PLAYER_ID);
  const round = game.playerRounds[HUMAN_PLAYER_ID];

  if (!seat || !round || !canUseRoleButton(game)) {
    return null;
  }

  if (round.ghostwriterDiscardPending) {
    return "先完成代笔人的技能弃置。";
  }

  if (seat.roleId === "stage_manager" && selectedCount !== 1) {
    return "舞台监督需要先选择 1 张拍立得作为排演对象。";
  }

  return null;
}

function getDiscardButtonHint(
  game: GameState,
  selectedCount: number,
  requiredDiscards: number,
): string | null {
  const round = game.playerRounds[HUMAN_PLAYER_ID];

  if (!isDiscardPhase(game.phase) || !round) {
    return null;
  }

  if (round.ghostwriterDiscardPending && selectedCount !== 1) {
    return "请选择 1 张拍立得作为代笔人的技能弃置。";
  }

  if (!round.ghostwriterDiscardPending && selectedCount !== requiredDiscards) {
    return `本阶段需要选择 ${requiredDiscards} 张弃置，当前已选 ${selectedCount} 张。`;
  }

  return null;
}

function getRoleUseHint(roleId: PlayerRoleId): string {
  switch (roleId) {
    case "ghostwriter":
      return "按钮只会在第一次或第二次弃置阶段出现；使用后必须先弃 1 张技能成本。";
    case "stage_manager":
      return "按钮只会在第一次弃置阶段出现；需要先点选 1 张拍立得。";
    case "casino_backer":
      return "按钮只会在第二次弃置阶段出现；适合你已经决定赌这一轮时使用。";
    case "bartender":
      return "按钮只会在第一次或第二次弃置阶段出现；本次少弃，下一次要补弃。";
    default:
      return "";
  }
}

function getCompetitionPhaseTitle(game: CompetitionGameState): string {
  if (game.phase === "game_over") {
    return "竞争模式结束";
  }

  if (game.phase === "round_result") {
    return "小局结算";
  }

  return `第 ${game.turn} 回合秘密登记`;
}

function getCompetitionGuideTitle(
  game: CompetitionGameState,
  registration: { cardId: string; turn: number } | null,
  acted: boolean,
): string {
  if (game.phase === "game_over") {
    return "整场对局结束";
  }

  if (game.phase === "round_result") {
    return "查看公开登记结果";
  }

  if (registration) {
    return "本小局已经登记";
  }

  if (acted) {
    return "等待进入下一回合";
  }

  return "选择是否秘密登记";
}

function getCompetitionGuideBody(
  game: CompetitionGameState,
  registration: { cardId: string; turn: number } | null,
  acted: boolean,
): string {
  if (game.phase === "game_over") {
    return "分数达到目标分后结束。竞争模式的羁绊成就与和平模式分开记录。";
  }

  if (game.phase === "round_result") {
    return "本小局的秘密登记已经公开。查看得分、冲突顺延和跨小局羁绊后，开始下一小局。";
  }

  if (registration) {
    const card = getCardById(registration.cardId);
    return `你在第 ${registration.turn} 回合登记了 ${card.name}《${card.versionTitle}》。登记后不能更换，继续等待结算。`;
  }

  if (acted) {
    return "你本回合选择不登记。下一回合会抽取新的积点，你仍可继续等待。";
  }

  return "你可以登记 1 张场面拍立得，也可以继续等待更多积点。登记后不可更换，结算前其他观众看不到你的选择。";
}

function getCompetitionRegistrationLabel(
  game: CompetitionGameState,
  registration: { cardId: string; turn: number } | null,
  acted: boolean,
): string {
  if (registration) {
    return `已在第 ${registration.turn} 回合秘密登记`;
  }

  if (acted) {
    return "本回合已选择等待";
  }

  if (game.phase !== "register") {
    return "登记阶段已结束";
  }

  return "本小局尚未登记";
}

function getHumanCompetitionSecretLabel(
  registration: { cardId: string; turn: number } | null,
  acted: boolean,
): string {
  if (registration) {
    const card = getCardById(registration.cardId);
    return `你已登记：${card.name}《${card.versionTitle}》`;
  }

  return acted ? "本回合等待" : "尚未登记";
}

function getCompetitionArchiveBondNames(
  archive: readonly string[],
  cardId: string,
  unlockedBondIds: readonly string[],
): string[] {
  return BOND_RULES.filter(
    (bond) =>
      !unlockedBondIds.includes(bond.id) &&
      bond.characterIds.includes(cardId) &&
      bond.characterIds.some((bondCardId) => archive.includes(bondCardId)),
  ).map((bond) => bond.name);
}

function getCompetitionSeatLabel(
  game: CompetitionGameState,
  playerId: string,
): string {
  return game.seats.find((seat) => seat.id === playerId)?.name ?? playerId;
}

function getModeLabel(mode: "home" | "peace" | "competition"): string {
  switch (mode) {
    case "home":
      return "主页";
    case "peace":
      return "和平模式";
    case "competition":
      return "竞争模式";
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

function canAdvanceAfterDiscards(game: GameState): boolean {
  if (!isDiscardPhase(game.phase)) {
    return false;
  }

  return game.seats.every((seat) => {
    const round = game.playerRounds[seat.id];
    return (
      round &&
      !round.ghostwriterDiscardPending &&
      round.hand.length ===
        expectedHandSize(game.phase) + round.deferredDiscardCount
    );
  });
}

function expectedHandSize(phase: RoundPhase): number {
  switch (phase) {
    case "discard_1":
      return 4;
    case "discard_2":
      return 3;
    case "discard_3":
      return 2;
    default:
      return 0;
  }
}

function isDiscardPhase(phase: RoundPhase): boolean {
  return phase === "discard_1" || phase === "discard_2" || phase === "discard_3";
}

function isDrawPhase(phase: RoundPhase): boolean {
  return phase === "draw_1" || phase === "draw_2" || phase === "draw_3" || phase === "draw_4";
}

function getRoleName(roleId: PlayerRoleId): string {
  return PLAYER_ROLES.find((role) => role.id === roleId)?.name ?? roleId;
}

function getSeatLabel(game: GameState, playerId: string): string {
  return game.seats.find((seat) => seat.id === playerId)?.name ?? playerId;
}

function formatCardScore(card: CharacterCard): string {
  return card.score === "family_glory" ? "家族荣光" : `${card.score} 分`;
}

function formatRoundScore(score: { totalScore: number; bonusSources: string[] }): string {
  return score.bonusSources.includes("family_glory")
    ? "家族荣光"
    : `+${score.totalScore}`;
}

function formatProbability(value: number): string {
  return `${Math.round(value * 100)}%`;
}
