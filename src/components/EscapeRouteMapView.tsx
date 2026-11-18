import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ESCAPE_ROUTE_NODES,
  canEnterEscapeNode,
  samplePolylinePoint,
  type EscapeMapProgress,
  type EscapeRouteNode,
} from '../engine/escapeMap.ts';
import { playSound } from '../engine/soundEngine.ts';
import { MAX_EXTRA_SKILLS, getSkillById } from '../engine/skillPool.ts';
import { NetrunnerBrandLogo, PixelCheckIcon, PixelLockIcon, PixelSurgeIcon } from './CyberIcons.tsx';

interface EscapeRouteMapViewProps {
  progress: EscapeMapProgress;
  onEnterNode: (nodeIndex: number) => void;
  onCompleteTransition: () => void;
  onRevealWall: (nodeIndex: number) => void;
  onReturnToArena: () => void;
  onEnterFreeTable?: () => void;
  onReturnToDesktop?: () => void;
  isDisconnectingToDesktop?: boolean;
  onSkipDisconnectToDesktop?: () => void;
  onResetRoute: () => void;
  onOpenCmd: () => void;
}

const TRANSITION_DURATION_MS = 2200;

function formatPolylinePoints(pts: Array<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

function getEscapePhaseLabel(t: number): { tag: string; detail: string } {
  if (t < 0.16) {
    return {
      tag: 'BREAKOUT // 高速突围前出',
      detail: '正在沿前方看似畅通的主干路由全速撤离...',
    };
  }
  if (t < 0.44) {
    return {
      tag: 'AMBUSH WALL // 撞击隐形封锁墙',
      detail: '隐形红墙骤然显形拦截！信标急停折返并连续转向...',
    };
  }
  if (t < 0.84) {
    return {
      tag: 'GAP BREACH // 贴壁钻缝逃生',
      detail: '发现两道封锁墙之间的极窄夹缝，全速穿行脱困中！',
    };
  }
  return {
    tag: 'SEALED BEHIND // 身后闭锁脱身',
    detail: '已成功甩开围堵并切入下一路由节点！',
  };
}

export default function EscapeRouteMapView({
  progress,
  onEnterNode,
  onCompleteTransition,
  onRevealWall,
  onReturnToArena,
  onEnterFreeTable,
  onReturnToDesktop,
  isDisconnectingToDesktop = false,
  onSkipDisconnectToDesktop,
  onResetRoute,
  onOpenCmd,
}: EscapeRouteMapViewProps) {
  const transition = progress.pendingTransition;
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number>(() => {
    if (transition) return transition.toIndex;
    if (progress.escapedReality) return 4;
    return Math.min(4, progress.highestUnlockedIndex);
  });
  const [animProgress, setAnimProgress] = useState<number>(transition ? 0 : 1);
  const completedRef = useRef<string | null>(null);
  const wallHitAudioKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (transition) {
      setSelectedNodeIndex(Math.min(4, transition.toIndex));
    } else if (!progress.escapedReality) {
      setSelectedNodeIndex(Math.min(4, progress.highestUnlockedIndex));
    }
  }, [transition, progress.highestUnlockedIndex, progress.escapedReality]);

  useEffect(() => {
    if (!transition) {
      setAnimProgress(1);
      completedRef.current = null;
      return;
    }

    const transitionKey = `${transition.fromIndex}->${transition.toIndex}:${transition.startedAt}`;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setAnimProgress(1);
      if (wallHitAudioKeyRef.current !== transitionKey) {
        wallHitAudioKeyRef.current = transitionKey;
        onRevealWall(transition.fromIndex);
      }
      if (completedRef.current !== transitionKey) {
        completedRef.current = transitionKey;
        onCompleteTransition();
      }
      return;
    }

    let rafId = 0;
    const startTs = performance.now();
    setAnimProgress(0);

    const tick = (now: number) => {
      const elapsed = now - startTs;
      const ratio = Math.max(0, Math.min(1, elapsed / TRANSITION_DURATION_MS));
      setAnimProgress(ratio);
      if (ratio >= 0.16 && wallHitAudioKeyRef.current !== transitionKey) {
        wallHitAudioKeyRef.current = transitionKey;
        onRevealWall(transition.fromIndex);
        playSound('wall-hit');
      }
      if (ratio < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else if (completedRef.current !== transitionKey) {
        completedRef.current = transitionKey;
        onCompleteTransition();
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [transition, onCompleteTransition, onRevealWall]);

  const activeTransitionNode: EscapeRouteNode | null = transition
    ? ESCAPE_ROUTE_NODES[transition.fromIndex] ?? null
    : null;

  const cursorPos = useMemo(() => {
    if (transition && activeTransitionNode && activeTransitionNode.escapePath.length >= 2) {
      return samplePolylinePoint(activeTransitionNode.escapePath, animProgress);
    }
    const standNode = ESCAPE_ROUTE_NODES[progress.currentNodeIndex] ?? ESCAPE_ROUTE_NODES[0];
    return { x: standNode.pos.x, y: standNode.pos.y, angleDeg: 0 };
  }, [transition, activeTransitionNode, animProgress, progress.currentNodeIndex]);

  const trailPoints = useMemo(() => {
    if (!transition || !activeTransitionNode) return '';
    const samples = 14;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= samples; i += 1) {
      const sampleT = (animProgress * i) / samples;
      const p = samplePolylinePoint(activeTransitionNode.escapePath, sampleT);
      pts.push({ x: p.x, y: p.y });
    }
    return formatPolylinePoints(pts);
  }, [transition, activeTransitionNode, animProgress]);

  const selectedNode = ESCAPE_ROUTE_NODES[selectedNodeIndex] ?? ESCAPE_ROUTE_NODES[0];
  const canLaunchSelected = !selectedNode.isExit && canEnterEscapeNode(progress, selectedNode.index);
  const clearedCount = progress.clearedIndices.length;
  const phaseBanner = transition ? getEscapePhaseLabel(animProgress) : null;
  const hitWallImpact = Boolean(transition && animProgress >= 0.16 && animProgress <= 0.38);
  const gapSealClosed = Boolean(transition && animProgress >= 0.84);

  const handleSelectOrEnterNode = (node: EscapeRouteNode) => {
    if (transition) {
      onCompleteTransition();
    }
    if (node.isExit) return;
    if (!canEnterEscapeNode(progress, node.index)) return;
    setSelectedNodeIndex(node.index);
  };

  return (
    <section
      className="lc-escape-shell"
      aria-label="黑域协议：替壳者 逃亡路线关卡界面"
    >
      <header className="lc-hud-box lc-escape-topbar">
        <div className="lc-escape-brand">
          <NetrunnerBrandLogo size={28} />
          <div>
            <h1 className="lc-escape-title">黑域协议：替壳者</h1>
            <p className="lc-escape-subtitle">
              BLACK-DOMAIN ESCAPE TOPOLOGY // 围堵突破路线图
            </p>
          </div>
        </div>

        <div className="lc-escape-status-group">
          <div className="lc-escape-stat-pill">
            <span className="lc-escape-stat-label">突围进度</span>
            <strong className="lc-escape-stat-val">{clearedCount} / 5</strong>
          </div>
          <div className="lc-escape-stat-pill">
            <span className="lc-escape-stat-label">额外技能</span>
            <strong className="lc-escape-stat-val">
              {progress.equippedSkills.length} / {MAX_EXTRA_SKILLS}
            </strong>
          </div>
          <div className="lc-escape-stat-pill danger">
            <span className="lc-escape-stat-label">追兵压迫</span>
            <strong className="lc-escape-stat-val">
              {progress.escapedReality ? '已甩脱' : transition ? '合围突破中' : `LV.${Math.min(5, clearedCount + 1)}`}
            </strong>
          </div>
        </div>

        <div className="lc-escape-topbar-actions">
          {transition && (
            <button
              id="escape-btn-skip-anim"
              type="button"
              className="lc-escape-btn amber"
              onClick={onCompleteTransition}
            >
              跳过钻缝动画
            </button>
          )}
          <button
            id="escape-btn-open-cmd"
            type="button"
            className="lc-escape-btn"
            onClick={onOpenCmd}
            aria-label="打开调试控制台 CMD"
          >
            &gt;_ CMD
          </button>
          <button
            id="escape-btn-reset-route"
            type="button"
            className="lc-escape-btn"
            onClick={onResetRoute}
          >
            重置逃亡路线
          </button>
          <button
            id="escape-btn-free-table"
            type="button"
            className="lc-escape-btn"
            onClick={() => (onEnterFreeTable ?? onReturnToArena)()}
          >
            自由牌桌
          </button>
          <button
            id="escape-btn-back-arena"
            type="button"
            className="lc-escape-btn cyan"
            onClick={onReturnToArena}
          >
            返回当前牌桌
          </button>
        </div>
      </header>

      <div className="lc-hud-box lc-escape-map-card">
        <div className="lc-escape-map-header">
          <div className="lc-escape-map-caption">
            <span className="lc-escape-live-dot" aria-hidden="true" />
            <span>
              {phaseBanner
                ? `${phaseBanner.tag} — ${phaseBanner.detail}`
                : progress.escapedReality
                  ? '全线突破完成 // 已通过零号离线闸门抵达现实断开点'
                  : `当前坐标：${ESCAPE_ROUTE_NODES[progress.currentNodeIndex]?.code ?? 'SEC-00'} · 选择已解锁节点接入牌局`}
            </span>
          </div>
          <div className="lc-escape-legend" aria-label="图例说明">
            <span className="lc-legend-item cleared">已突破</span>
            <span className="lc-legend-item unlocked">可接入</span>
            <span className="lc-legend-item blocked">暗墙（撞击显形）</span>
          </div>
        </div>

        <div className="lc-escape-svg-wrap">
          <svg
            className="lc-escape-svg"
            viewBox="0 0 960 410"
            role="img"
            aria-label="黑域协议网五阶段围堵逃生路线图"
          >
            <defs>
              <pattern id="lc-escape-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="rgba(0, 240, 255, 0.08)"
                  strokeWidth="1"
                />
              </pattern>
              <filter
                id="lc-cyan-glow"
                filterUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="960"
                height="410"
              >
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00f0ff" floodOpacity="0.8" />
              </filter>
              <filter
                id="lc-red-glow"
                filterUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="960"
                height="410"
              >
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor="#ff4757" floodOpacity="0.85" />
              </filter>
            </defs>

            <rect width="960" height="410" fill="#060913" />
            <rect width="960" height="410" fill="url(#lc-escape-grid)" />

            {/* Route corridors & hidden containment walls (revealed on impact and kept until reset!) */}
            {ESCAPE_ROUTE_NODES.slice(0, 5).map((node) => {
              const isCleared = progress.clearedIndices.includes(node.index);
              const isWallDiscovered = progress.revealedWallIndices.includes(node.index);
              const isAnimatingThis = transition?.fromIndex === node.index;
              const isNextAfterCleared = isCleared && !isAnimatingThis;
              const wallsVisible =
                isWallDiscovered || (isAnimatingThis && animProgress >= 0.16);
              const isWallImpactFlash =
                isAnimatingThis && animProgress >= 0.16 && animProgress <= 0.28;
              const nextNode = ESCAPE_ROUTE_NODES[node.index + 1];
              const topWall = node.barricadeWalls[0];
              const botWall = node.barricadeWalls[1];
              const sealY1 = topWall ? topWall.y2 : 0;
              const sealY2 = botWall ? botWall.y1 : 0;

              return (
                <g key={`route-${node.id}`}>
                  {/* Before hitting the invisible wall, show a normal decoy straight route; reveal zigzag after impact or clear */}
                  {wallsVisible || isNextAfterCleared ? (
                    <polyline
                      points={formatPolylinePoints(node.escapePath)}
                      fill="none"
                      stroke={
                        isAnimatingThis
                          ? 'rgba(0, 240, 255, 0.42)'
                          : 'rgba(16, 245, 160, 0.65)'
                      }
                      strokeWidth={isAnimatingThis ? 3 : 2}
                      strokeDasharray={isNextAfterCleared ? undefined : '6 5'}
                    />
                  ) : (
                    nextNode && (
                      <line
                        x1={node.pos.x}
                        y1={node.pos.y}
                        x2={nextNode.pos.x}
                        y2={nextNode.pos.y}
                        stroke="rgba(148, 163, 184, 0.24)"
                        strokeWidth="1.8"
                        strokeDasharray="6 5"
                      />
                    )
                  )}

                  {/* Active glowing trail during animation */}
                  {isAnimatingThis && trailPoints && (
                    <polyline
                      points={trailPoints}
                      fill="none"
                      stroke="#00f0ff"
                      strokeWidth="3.5"
                      strokeLinecap="square"
                      filter="url(#lc-cyan-glow)"
                    />
                  )}

                  {/* Containment walls: hidden until player hits them, then stay visible until reset */}
                  {wallsVisible &&
                    node.barricadeWalls.map((wall, wIdx) => (
                      <line
                        key={`wall-${node.index}-${wIdx}`}
                        x1={wall.x1}
                        y1={wall.y1}
                        x2={wall.x2}
                        y2={wall.y2}
                        stroke={isWallImpactFlash ? '#ffffff' : '#ff4757'}
                        strokeWidth={isWallImpactFlash ? 5 : isAnimatingThis ? 4 : 3.2}
                        strokeLinecap="square"
                        filter="url(#lc-red-glow)"
                      />
                    ))}

                  {/* Narrow gap highlight indicator aligned dead-center between topWall.y2 and botWall.y1 */}
                  {wallsVisible && topWall && botWall && (
                    <>
                      <circle
                        cx={topWall.x1}
                        cy={(sealY1 + sealY2) / 2}
                        r={isAnimatingThis ? 11 : 7}
                        fill="none"
                        stroke={
                          (isAnimatingThis && gapSealClosed) || isNextAfterCleared
                            ? '#ff4757'
                            : '#00f0ff'
                        }
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        opacity={isAnimatingThis ? 0.95 : 0.6}
                      />
                      {((isAnimatingThis && gapSealClosed) || isNextAfterCleared) && (
                        <line
                          x1={topWall.x1}
                          y1={sealY1}
                          x2={topWall.x1}
                          y2={sealY2}
                          stroke="#ff4757"
                          strokeWidth="4"
                          filter="url(#lc-red-glow)"
                        />
                      )}
                    </>
                  )}

                  {/* Encirclement radar pulse + wall collision spark */}
                  {isAnimatingThis && (
                    <g>
                      <circle
                        cx={node.pos.x}
                        cy={node.pos.y}
                        r={26 + (1 - Math.min(1, animProgress * 2)) * 28}
                        fill="none"
                        stroke="#ff4757"
                        strokeWidth="1.8"
                        strokeDasharray="6 4"
                        opacity={Math.max(0.2, 0.9 - animProgress * 0.7)}
                      />
                      {hitWallImpact && node.escapePath[1] && (
                        <g transform={`translate(${node.escapePath[1].x}, ${node.escapePath[1].y})`}>
                          <circle r="12" fill="rgba(255, 71, 87, 0.25)" stroke="#ff4757" strokeWidth="2" />
                          <text
                            x="0"
                            y="-16"
                            fill="#ff8a95"
                            fontSize="10"
                            fontWeight="700"
                            textAnchor="middle"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            BLOCKED
                          </text>
                        </g>
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Tactical Nodes */}
            {ESCAPE_ROUTE_NODES.map((node) => {
              const isCleared = progress.clearedIndices.includes(node.index);
              const isUnlocked = canEnterEscapeNode(progress, node.index);
              const isCurrent = progress.currentNodeIndex === node.index && !transition;
              const isSelected = selectedNodeIndex === node.index && !node.isExit;
              const isExitReached = node.isExit && progress.escapedReality;

              const strokeColor = isExitReached
                ? '#10f5a0'
                : isCurrent
                  ? '#00f0ff'
                  : isCleared
                    ? '#10f5a0'
                    : isUnlocked
                      ? node.accentColor
                      : '#475569';

              const fillColor = isExitReached
                ? '#0b291e'
                : isCurrent || isSelected
                  ? '#0e2238'
                  : isCleared
                    ? '#0a1f1a'
                    : '#0b101d';

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.pos.x}, ${node.pos.y})`}
                  className={`lc-escape-svg-node ${isUnlocked ? 'is-clickable' : ''} ${
                    isSelected ? 'is-selected' : ''
                  }`}
                  role={isUnlocked ? 'button' : undefined}
                  tabIndex={isUnlocked ? 0 : -1}
                  aria-label={
                    node.isExit
                      ? `${node.code} ${node.title}${isExitReached ? '（已逃出）' : '（未抵达）'}`
                      : `${node.code} ${node.title}，对手 ${node.opponentName}，${
                          isCleared ? '已突破' : isUnlocked ? '可接入' : '未解锁'
                        }`
                  }
                  onClick={() => handleSelectOrEnterNode(node)}
                  onKeyDown={(e) => {
                    if (isUnlocked && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      handleSelectOrEnterNode(node);
                    }
                  }}
                >
                  {/* Minimum 44px+ hit target in viewBox space */}
                  <circle r="30" fill="transparent" />

                  {(isCurrent || (isUnlocked && !isCleared)) && (
                    <circle
                      r="26"
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className="lc-escape-node-pulse"
                    />
                  )}

                  {node.isExit ? (
                    <rect
                      x="-22"
                      y="-22"
                      width="44"
                      height="44"
                      rx="4"
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isExitReached ? 3 : 2}
                    />
                  ) : (
                    <polygon
                      points="0,-22 22,0 0,22 -22,0"
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={isSelected || isCurrent ? 3 : 2}
                    />
                  )}

                  <text
                    x="0"
                    y="4"
                    fill="#f8fafc"
                    fontSize="10"
                    fontWeight="800"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.code}
                  </text>

                  <text
                    x="0"
                    y="38"
                    fill={isUnlocked || isExitReached ? '#e2f6ff' : '#94a3b8'}
                    fontSize="11.5"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="Noto Sans SC, sans-serif"
                  >
                    {node.title}
                  </text>

                  <text
                    x="0"
                    y="53"
                    fill={
                      isExitReached
                        ? '#10f5a0'
                        : isCleared
                          ? '#34d399'
                          : isUnlocked
                            ? '#00f0ff'
                            : '#64748b'
                    }
                    fontSize="9.5"
                    fontWeight="700"
                    textAnchor="middle"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {node.isExit
                      ? isExitReached
                        ? '[ESCAPED]'
                        : '[EXIT]'
                      : isCleared
                        ? '[CLEARED]'
                        : isUnlocked
                          ? '[BREACH READY]'
                          : '[LOCKED]'}
                  </text>
                </g>
              );
            })}

            {/* Moving Player Escape Beacon */}
            <g
              transform={`translate(${cursorPos.x}, ${cursorPos.y}) rotate(${cursorPos.angleDeg})`}
              filter="url(#lc-cyan-glow)"
              aria-hidden="true"
            >
              <polygon points="13,0 -9,-8 -4,0 -9,8" fill="#00f0ff" stroke="#ffffff" strokeWidth="1.4" />
              <circle cx="0" cy="0" r="3" fill="#ffffff" />
            </g>
          </svg>
        </div>

        {/* Accessible node strip for touch / keyboard / mobile portrait */}
        <div className="lc-escape-node-strip" role="group" aria-label="路线节点快速选择栏">
          {ESCAPE_ROUTE_NODES.map((node) => {
            const isCleared = progress.clearedIndices.includes(node.index);
            const isUnlocked = canEnterEscapeNode(progress, node.index);
            const isSelected = selectedNodeIndex === node.index && !node.isExit;
            const isExitReached = node.isExit && progress.escapedReality;

            return (
              <button
                key={`pill-${node.id}`}
                id={`escape-node-btn-${node.index}`}
                type="button"
                disabled={!isUnlocked}
                className={`lc-escape-node-pill ${isSelected ? 'is-selected' : ''} ${
                  isCleared || isExitReached ? 'is-cleared' : ''
                }`}
                style={{ '--node-accent': node.accentColor } as CSSProperties}
                onClick={() => handleSelectOrEnterNode(node)}
              >
                <span className="lc-escape-pill-code">{node.code}</span>
                <span className="lc-escape-pill-name">{node.title}</span>
                <span className="lc-escape-pill-state">
                  {node.isExit ? (
                    isExitReached ? (
                      <>
                        <PixelCheckIcon size={12} /> 已脱出
                      </>
                    ) : (
                      <>
                        <PixelLockIcon size={12} /> 出口
                      </>
                    )
                  ) : isCleared ? (
                    <>
                      <PixelCheckIcon size={12} /> 已突破
                    </>
                  ) : isUnlocked ? (
                    <>
                      <PixelSurgeIcon size={12} /> 可接入
                    </>
                  ) : (
                    <>
                      <PixelLockIcon size={12} /> 封锁
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Briefing & Primary Action Dock */}
      <footer className="lc-hud-box lc-escape-brief-bar" aria-label="目标节点简报与接入操作">
        {progress.escapedReality ? (
          <div className="lc-escape-victory-banner">
            <div>
              <div className="lc-escape-brief-tag success">CHAPTER 1 CLEARED // 现实逃脱完成</div>
              <h2 className="lc-escape-brief-title">已穿破零号离线闸门并安全断开终端</h2>
              <p className="lc-escape-brief-desc">
                你已携替壳协议脱离黑域协议网并退回本地主机。你可以切回 MINGAN-OS 桌面查看后续动态、从头重温突围循环，或进入自由牌桌继续博弈。
              </p>
            </div>
            <div className="lc-escape-brief-cta-group">
              {onReturnToDesktop && (
                <button
                  id="escape-btn-victory-desktop"
                  type="button"
                  className="lc-escape-cta primary"
                  onClick={onReturnToDesktop}
                >
                  返回 MINGAN-OS 桌面
                </button>
              )}
              <button
                id="escape-btn-replay-loop"
                type="button"
                className="lc-escape-cta"
                onClick={onResetRoute}
              >
                从 SEC-00 重新体验逃亡循环
              </button>
              <button
                id="escape-btn-victory-arena"
                type="button"
                className="lc-escape-cta"
                onClick={() => (onEnterFreeTable ?? onReturnToArena)()}
              >
                返回自由牌桌
              </button>
            </div>
          </div>
        ) : (
          <div className="lc-escape-brief-inner">
            <div className="lc-escape-brief-meta">
              <div className="lc-escape-brief-tag">
                {selectedNode.code} · {selectedNode.sector}
              </div>
              <h2 className="lc-escape-brief-title">
                {selectedNode.title} — 截击目标：{selectedNode.opponentName}
              </h2>
              <p className="lc-escape-brief-desc">
                {selectedNode.opponentSubtitle} · 敌方算力 {selectedNode.opponentChips} · 推荐强度{' '}
                {selectedNode.difficulty === 'master'
                  ? '高危大师'
                  : selectedNode.difficulty === 'standard'
                    ? '中层标准'
                    : '外围新兵'}
                {selectedNode.signatureSkillName
                  ? ` ｜ 敌方特技「${selectedNode.signatureSkillName}」：${selectedNode.signatureSkillDesc}`
                  : ''}
              </p>
              {progress.equippedSkills.length > 0 && (
                <p className="lc-escape-brief-desc" style={{ color: '#7dd3fc' }}>
                  当前已装备额外技能（{progress.equippedSkills.length}/{MAX_EXTRA_SKILLS}）：
                  {progress.equippedSkills.map((id) => getSkillById(id)?.name ?? id).join(' / ')}
                </p>
              )}
            </div>

            <div className="lc-escape-brief-cta-group">
              <button
                id="escape-btn-launch-node"
                type="button"
                disabled={!canLaunchSelected}
                className="lc-escape-cta primary"
                onClick={() => {
                  if (transition) onCompleteTransition();
                  onEnterNode(selectedNode.index);
                }}
              >
                {transition
                  ? '立即跳过动画并接入下一节点'
                  : `接入 ${selectedNode.code} 牌局 // 开始突围`}
              </button>
            </div>
          </div>
        )}
      </footer>

      {isDisconnectingToDesktop && (
        <div
          className="lc-escape-disconnect-overlay"
          role="status"
          aria-live="assertive"
        >
          <div className="lc-hud-box lc-escape-disconnect-box">
            <div className="lc-escape-brief-tag success">
              EXIT-RL REACHED // 物理链路强制熔断
            </div>
            <h2 className="lc-escape-disconnect-title">正在自动关闭黑域协议网终端…</h2>
            <p className="lc-escape-disconnect-desc">
              已穿出零号离线闸门并到达现实出口，正在切断接入通道并退回 MINGAN-OS 98 本地桌面。
            </p>
            <div className="lc-escape-disconnect-bar" aria-hidden="true">
              <span className="lc-escape-disconnect-fill" />
            </div>
            {onSkipDisconnectToDesktop && (
              <button
                id="escape-btn-skip-disconnect"
                type="button"
                className="lc-escape-cta primary"
                onClick={onSkipDisconnectToDesktop}
              >
                立即返回电脑桌面
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
