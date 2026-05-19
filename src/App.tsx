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
  draw_1: "第一幕抽取",
  discard_1: "第一次弃牌",
  draw_2: "第二幕抽取",
  discard_2: "第二次弃牌",
  draw_3: "第三幕抽取",
  discard_3: "第三次弃牌",
  draw_4: "终幕抽取",
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

  const humanRound = game?.playerRounds[HUMAN_PLAYER_ID];
  const humanSeat = game?.seats.find((seat) => seat.id === HUMAN_PLAYER_ID);
  const requiredDiscards =
    game && isDiscardPhase(game.phase)
      ? getRequiredDiscardCountForPlayer(game, HUMAN_PLAYER_ID)
      : 0;
  const latestResult = game?.roundResults.at(-1) ?? null;
  const ghostwriterPending = Boolean(humanRound?.ghostwriterDiscardPending);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [message]);

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
      setMessage("请选择 1 张人物作为代笔人技能弃牌。");
      return;
    }

    try {
      const next = discardGhostwriterCard(game, HUMAN_PLAYER_ID, selectedCards[0]!);
      setGame(next);
      setSelectedCards([]);
      setSelectedScoringCard(null);
      setMessage("代笔人技能弃牌完成；现在请继续完成本阶段正常弃牌。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function submitWager() {
    if (!game || selectedCards.length !== 1) {
      setMessage("请选择 1 张人物卡下注。");
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
          setMessage("代笔人已先抽 1 张人物；请从当前手牌中选择 1 张作为技能弃牌。");
          return;
        }
        case "stage_manager":
          if (selectedCards.length !== 1) {
            setMessage("请选择 1 张人物作为舞台监督的排演对象。");
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
      next = runAiForCurrentDecision(next);
      return resolveRound(next);
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
            <p className="eyebrow">V1 规则灰盒</p>
            <div className="game-title-row">
              <h1>战斗吧！Bocchetti！</h1>
              <span>FROM @真理追赶交替</span>
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
              <span>玩家角色</span>
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

          <div className="role-list">
            {PLAYER_ROLES.map((role) => (
              <article
                className={role.id === roleId ? "role-card active" : "role-card"}
                key={role.id}
              >
                <strong>{role.name}</strong>
                <span>{role.shortName}</span>
                <p>{role.abilityText}</p>
              </article>
            ))}
          </div>

          <button className="secondary-action" onClick={() => setRulesOpen(true)}>
            游戏规则
          </button>

          <button className="primary-action" onClick={startGame}>
            开始对局
          </button>
        </section>
        {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      </main>
    );
  }

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">第 {game.round} 轮</p>
          <h1>{phaseLabels[game.phase]}</h1>
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
          {isDrawPhase(game.phase) && (
            <button className="primary-action" onClick={drawStep}>
              抽取剧情标记
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
              <h2>剧情标记</h2>
              <span>已抽 {game.drawnMarkers.length} / 10</span>
            </div>
          </div>
          <div className="marker-pile">
            {game.drawnMarkers.length === 0 && (
              <span className="empty-state">等待第一幕抽取</span>
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
                <b>+{score.totalScore}</b>
                <small>{score.bonusReasons.join(" / ") || score.reason}</small>
              </article>
            ))}
          </div>
        </section>
      )}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}

      {game.phase === "game_over" && (
        <section className="result-panel">
          <div className="panel-heading">
            <h2>胜者</h2>
          </div>
          <p>{getWinners(game).map((seat) => seat.name).join("、")}</p>
        </section>
      )}

      {humanRound && game.phase !== "setup" && game.phase !== "game_over" && (
        <section className="hand-panel">
          <div className="panel-heading">
            <div>
              <h2>你的手牌</h2>
              {isDiscardPhase(game.phase) && (
                <span>本阶段需要弃 {requiredDiscards} 张</span>
              )}
              {ghostwriterPending && (
                <span>代笔人待弃：请选择 1 张技能弃牌</span>
              )}
              {game.phase === "resolution" && (
                <span>请选择 1 张成功人物作为本轮计分人物</span>
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
                      ? "排演所选人物"
                      : "使用技能"}
                </button>
              )}
              {game.phase === "discard_2" && !ghostwriterPending && (
                humanRound.wageredCardId ? (
                  <button onClick={submitCancelWager}>取消下注</button>
                ) : (
                  <button onClick={submitWager}>剧情下注</button>
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
                  {ghostwriterPending ? "确认代笔弃牌" : "确认弃牌"}
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

function RulesModal(props: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"basic" | "skills" | "special">(
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
            玩家技能
          </button>
        </div>
        {activeTab === "basic" && <BasicRules />}
        {activeTab === "special" && <SpecialRules />}
        {activeTab === "skills" && <SkillRules />}
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
          每名玩家抽 5 张人物目标卡。剧情标记按 4、3、2、1
          分四幕抽出，每次抽完后玩家弃牌，最终保留 2 张人物进入结算。
        </p>
        <p>
          结算时每名玩家最多选择 1 张满足条件的人物得分；若没有满足条件的人物，本轮不得分。
        </p>
      </article>
      <article>
        <h3>下注和奖励</h3>
        <p>
          第二次弃牌阶段可以对 1 张手牌进行剧情下注。若该人物最终成功计分，额外 +1。
        </p>
        <p>
          人物羁绊、下注和角色技能奖励共享每轮奖励上限，单轮额外分最高为 2。
        </p>
      </article>
      <article>
        <h3>标记池</h3>
        <p>
          V1 当前标记池共 18 枚，每轮抽 10 枚。标记越早被抽出，后续继续追同类标记的风险越高。
        </p>
        <p>
          主界面只显示已抽出的标记和每类已抽数量，玩家需要根据牌面自行判断是否继续赌。
        </p>
      </article>
    </div>
  );
}

function SpecialRules() {
  return (
    <>
      <div className="info-grid special-rule-grid">
        <article>
          <h3>人物羁绊</h3>
          <p>
            羁绊要求两张相关人物同时留在最终手牌并满足条件，适合在已有标记趋势明确后再追。
          </p>
        </article>
        <article>
          <h3>奖励上限</h3>
          <p>
            羁绊、下注和角色技能奖励共享每轮奖励上限。即使触发多个奖励，单轮额外分最高为 2。
          </p>
        </article>
      </div>
      <div className="bond-grid">
        {BOND_RULES.map((bond) => {
          const left = getCardById(bond.characterIds[0]);
          const right = getCardById(bond.characterIds[1]);

          return (
            <article className="bond-card" key={bond.id}>
              <div>
                <strong>{bond.name}</strong>
                <span>+{bond.bonus}</span>
              </div>
              <p>
                {left.name}《{left.versionTitle}》 + {right.name}《
                {right.versionTitle}》
              </p>
              <small>{bond.conditionText}</small>
              <em>{bond.storyText}</em>
            </article>
          );
        })}
      </div>
    </>
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
    props.selected ? "selected" : "",
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
      <div className="portrait-placeholder">{props.card.portraitKey}</div>
      <div className="card-body">
        <div className="card-title-row">
          <strong>{props.card.name}</strong>
          <span>{props.card.score} 分</span>
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
          {props.wagered && <b className="status wager">已下注</b>}
          {props.stageManaged && <b className="status stage-managed">已排演</b>}
          <b className="status">{props.mode === "score" ? "计分" : "取舍"}</b>
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

function conditionSummary(condition: Condition): string {
  switch (condition.type) {
    case "minCount":
      return `${markerLabels[condition.marker]} >= ${condition.count}`;
    case "maxCount":
      return `${markerLabels[condition.marker]} <= ${condition.count}`;
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
