import { useEffect, useMemo, useState } from "react";
import {
  BOND_RULES,
  MARKER_CONFIGS,
  PLAYER_ROLES,
  advanceAfterDiscards,
  cancelWager,
  createGame,
  discardCards,
  discardGhostwriterCard,
  drawCurrentStep,
  evaluateCardConditionForPlayer,
  getCardById,
  getRequiredDiscardCountForPlayer,
  getWinners,
  placeWager,
  resolveRound,
  runAiForCurrentDecision,
  selectScoringCard,
  startRound,
  useBartenderAbility,
  useCasinoBackerAbility,
  useGhostwriterAbility,
  useStageManagerAbility,
} from "./game";
import type {
  CharacterCard,
  Condition,
  GameState,
  MarkerCategory,
  PlayerRoleId,
  RoundPhase,
} from "./game";

const HUMAN_PLAYER_ID = "player-1";
const APP_VERSION = "v1.3.0";
const UPDATE_STORAGE_KEY = "bocchetti-battle-dismissed-version";
const UPDATE_LOG_ITEMS = [
  "新增页面内“反馈”入口，启动页和对局页都可以打开。",
  "打开反馈时会自动复制版本、页面、阶段、轮数、角色、比分和积点等信息。",
  "反馈浮窗提供手动复制和显示自动信息的兜底操作。",
  "当前反馈表单使用腾讯问卷内嵌提交，并保留新窗口打开兜底。",
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
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [roleId, setRoleId] = useState<PlayerRoleId>("ghostwriter");
  const [game, setGame] = useState<GameState | null>(null);
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
  const [updateLogOpen, setUpdateLogOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem(UPDATE_STORAGE_KEY) !== APP_VERSION;
  });

  const humanRound = game?.playerRounds[HUMAN_PLAYER_ID];
  const humanSeat = game?.seats.find((seat) => seat.id === HUMAN_PLAYER_ID);
  const requiredDiscards =
    game && isDiscardPhase(game.phase)
      ? getRequiredDiscardCountForPlayer(game, HUMAN_PLAYER_ID)
      : 0;
  const latestResult = game?.roundResults.at(-1) ?? null;
  const ghostwriterPending = Boolean(humanRound?.ghostwriterDiscardPending);
  const unlockedBondIds = useMemo(() => getUnlockedBondIds(game), [game]);

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

  function openUpdateLog() {
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
      game,
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

    safely(() => {
      let next = game;
      const scoringCardId = selectedScoringCard ?? successfulCards[0]?.id;
      if (scoringCardId) {
        next = selectScoringCard(next, HUMAN_PLAYER_ID, scoringCardId);
      }
      const previousUnlockedBondIds = getUnlockedBondIds(game);
      next = runAiForCurrentDecision(next);
      const resolved = resolveRound(next);
      const unlockedNames = getNewUnlockedBondNames(previousUnlockedBondIds, resolved);
      if (unlockedNames.length > 0) {
        setAchievementMessage(`解锁羁绊成就：${unlockedNames.join("、")}`);
      }
      return resolved;
    });
  }

  function beginNextRound() {
    if (!game) {
      return;
    }

    safely(() => startRound(game));
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
        </section>
        {rulesOpen && (
          <RulesModal
            onClose={() => setRulesOpen(false)}
            unlockedBondIds={unlockedBondIds}
          />
        )}
        {updateLogOpen && <UpdateLogPopover onClose={closeUpdateLog} />}
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

      {updateLogOpen && <UpdateLogPopover onClose={closeUpdateLog} />}
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
              {canUseRoleButton(game) && (
                <button
                  className="secondary-action"
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
                  mode={game.phase === "resolution" ? "score" : "discard"}
                  selected={game.phase === "resolution" ? scoringSelected : selected}
                  stageManaged={humanRound.stageManagedCardId === cardId}
                  wagered={humanRound.wageredCardId === cardId}
                  onClick={() => {
                    if (game.phase === "resolution") {
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
            <p className="eyebrow">V1 灰盒规则</p>
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

function UpdateLogPopover(props: { onClose: () => void }) {
  return (
    <aside className="update-log-popover" role="status">
      <div>
        <span>{APP_VERSION}</span>
        <button onClick={props.onClose}>关闭</button>
      </div>
      <h2>更新记录</h2>
      <ul>
        {UPDATE_LOG_ITEMS.map((item) => (
          <li key={item}>{item}</li>
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
        <h3>每轮流程</h3>
        <p>
          每名观众抽 5 张角色拍立得。积点按 4、3、2、1
          分四幕抽出，每次抽完后观众弃置，最终保留 2 张拍立得进入结算。
        </p>
        <p>
          结算时每名观众最多选择 1 张满足条件的拍立得得分；若没有满足条件的拍立得，本轮不得分。
        </p>
      </article>
      <article>
        <h3>签署和奖励</h3>
        <p>
          第二次弃置阶段可以签署 1 张当前持有的角色拍立得。若该拍立得最终成功计分，额外 +1。
        </p>
        <p>
          人物羁绊、签署拍立得和角色技能奖励共享每轮奖励上限，单轮额外分最高为 2。
        </p>
      </article>
      <article>
        <h3>积点池</h3>
        <p>
          V1 当前积点池共 18 枚，每轮抽 10 枚。积点越早被抽出，后续继续追同类积点的风险越高。
        </p>
        <p>
          每轮会重新洗一整袋积点；主界面只显示已抽出的积点和每类已抽数量。
        </p>
      </article>
    </div>
  );
}

function buildFeedbackContext(input: {
  game: GameState | null;
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

  return [
    `版本: ${APP_VERSION}`,
    `渠道: ${channel}`,
    `时间: ${timestamp}`,
    `页面: ${pageUrl}`,
    `画面: ${game ? phaseLabels[game.phase] : "启动页"}`,
    `人数: ${game?.seats.length ?? input.playerCount}`,
    `观众角色: ${getRoleName(humanSeat?.roleId ?? input.roleId)}`,
    `轮数: ${game?.round ?? "未开局"}`,
    `目标分: ${game?.victoryScore ?? "未开局"}`,
    `比分: ${scoreSummary}`,
    `本轮积点: ${markerSummary}`,
    `你的拍立得: ${handSummary}`,
    `最近日志: ${game?.log.slice(-3).join(" / ") || "无"}`,
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
          羁绊要求两张相关角色拍立得同时留到结算；只要计分拍立得满足条件，即可获得该组羁绊分。
        </p>
        <p>
          成功触发过的羁绊会解锁为羁绊成就；未解锁前，成就页只显示组合和奖励，剧情解说保持隐藏。
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
              <span>{unlocked ? "已解锁" : `+${bond.bonus}`}</span>
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

function CharacterCardView(props: {
  card: CharacterCard;
  bondNames: string[];
  evaluationMet: boolean;
  mode: "discard" | "score";
  selected: boolean;
  stageManaged: boolean;
  wagered: boolean;
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
      onClick={props.onClick}
      type="button"
    >
      <div className="portrait-placeholder">{props.card.name}</div>
      <div className="card-body">
        <div className="card-title-row">
          <strong>{props.card.name}</strong>
          <span>{formatCardScore(props.card)}</span>
        </div>
        <p>{props.card.versionTitle}</p>
        <small>{conditionSummary(props.card.condition)}</small>
        {props.bondNames.length > 0 && (
          <div className="bond-ready-strip">
            <span>羁绊</span>
            <strong>{props.bondNames.join(" / ")}</strong>
          </div>
        )}
        <div className="tag-row">
          <b className={props.evaluationMet ? "status met" : "status pending"}>
            {props.evaluationMet ? "已满足" : "未满足"}
          </b>
          {props.wagered && <b className="status wager">已签署</b>}
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

function getNewUnlockedBondNames(
  previousUnlockedBondIds: Set<string>,
  game: GameState,
): string[] {
  return [...getUnlockedBondIds(game)]
    .filter((bondId) => !previousUnlockedBondIds.has(bondId))
    .map((bondId) => BOND_RULES.find((bond) => bond.id === bondId)?.name)
    .filter((name): name is string => Boolean(name));
}

function conditionSummary(condition: Condition): string {
  switch (condition.type) {
    case "minCount":
      return `${markerLabels[condition.marker]} >= ${condition.count}`;
    case "maxCount":
      return `${markerLabels[condition.marker]} <= ${condition.count}`;
    case "equalCount":
      return `${markerLabels[condition.marker]} = ${markerLabels[condition.otherMarker]}`;
    case "lastIs":
      return `最后 = ${markerLabels[condition.marker]}`;
    case "allOf":
      return condition.conditions.map(conditionSummary).join(" & ");
    case "anyOf":
      return condition.conditions.map(conditionSummary).join(" / ");
    default: {
      const exhaustive: never = condition;
      return exhaustive;
    }
  }
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
