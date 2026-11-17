import { useEffect, useRef, useState } from 'react';
import type { StoryVnDualSprite, StoryVnLine } from '../engine/storyVnTypes.ts';
import {
  LIN_LONGXIN_CASUAL_SPRITE,
  resolveEcho0Sprite,
  resolveSec01Sprite,
  resolveSec02Sprite,
  resolveSec03Sprite,
} from '../engine/storyCharacters.ts';
import { playSound } from '../engine/soundEngine.ts';
import {
  PixelCheckIcon,
  PixelNodesIcon,
  PixelSeverIcon,
  PixelSurgeIcon,
} from './CyberIcons.tsx';

interface VisualNovelStoryModalProps {
  script: StoryVnLine[];
  lineIndex: number;
  onChangeLine: (nextIndex: number) => void;
  onFinish: () => void;
  playerCodename?: string;
  skipLabel?: string;
  finishLabel?: string;
}

function resolveDualSpriteSrc(sprite: StoryVnDualSprite): string {
  if (sprite.character === 'sec01') return resolveSec01Sprite(sprite.expression);
  if (sprite.character === 'sec02') return resolveSec02Sprite(sprite.expression);
  if (sprite.character === 'sec03') return resolveSec03Sprite(sprite.expression);
  if (sprite.character === 'linlongxin') return LIN_LONGXIN_CASUAL_SPRITE;
  return resolveEcho0Sprite(sprite.expression);
}

export default function VisualNovelStoryModal({
  script,
  lineIndex,
  onChangeLine,
  onFinish,
  playerCodename = 'ZERO-BYTE',
  skipLabel = '跳过剧情',
  finishLabel = '继续',
}: VisualNovelStoryModalProps) {
  const clampedIdx = Math.max(0, Math.min(script.length - 1, lineIndex));
  const line = script[clampedIdx];
  const resolvedText = line.text.replaceAll('{codename}', playerCodename);
  const isFirst = clampedIdx === 0;
  const isLast = clampedIdx === script.length - 1;
  const playedLineRef = useRef<number>(-1);
  const [revealedCount, setRevealedCount] = useState<number>(0);

  const isTyping = revealedCount < resolvedText.length;

  useEffect(() => {
    playedLineRef.current = -1;
  }, [script]);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setRevealedCount(resolvedText.length);
      return;
    }

    setRevealedCount(0);
    const timer = window.setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= resolvedText.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 18);

    return () => window.clearInterval(timer);
  }, [clampedIdx, resolvedText]);

  useEffect(() => {
    if (playedLineRef.current === clampedIdx) return;
    playedLineRef.current = clampedIdx;
    if (line.soundCue) {
      playSound(line.soundCue);
    } else {
      playSound('ui-click');
    }
  }, [clampedIdx, line.soundCue]);

  const handleAdvance = () => {
    if (isTyping) {
      setRevealedCount(resolvedText.length);
      return;
    }
    if (isLast) {
      onFinish();
    } else {
      onChangeLine(clampedIdx + 1);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFinish();
      } else if (e.key === 'ArrowLeft' && clampedIdx > 0) {
        e.preventDefault();
        onChangeLine(clampedIdx - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (revealedCount < resolvedText.length) {
          setRevealedCount(resolvedText.length);
        } else if (isLast) {
          onFinish();
        } else {
          onChangeLine(clampedIdx + 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clampedIdx, isLast, resolvedText.length, revealedCount, onChangeLine, onFinish]);

  const isDualMode = Boolean(line.auxLeftSprite || line.leftSprite || line.rightSprite);
  const hasAuxLeft = Boolean(line.auxLeftSprite);
  const hasCollisionFx =
    line.leftSprite?.effect === 'collide' || line.rightSprite?.effect === 'collide';
  const singleSpriteMode = line.spriteMode ?? 'none';
  const portraitUrl = line.expression
    ? resolveEcho0Sprite(line.expression)
    : resolveEcho0Sprite('calm');

  const progressPct = Math.round(((clampedIdx + 1) / script.length) * 100);
  const isAlarmTone = line.tone === 'alarm';
  const showCenterTelemetry = !isDualMode && singleSpriteMode === 'none';
  const showRadarPanel =
    line.stageEffect === 'radar-ping' ||
    line.stageEffect === 'pursuer-tags' ||
    line.stageEffect === 'alarm-intense';

  const nextButtonLabel = isTyping
    ? '显示全文'
    : line.nextButtonOverride
      ? line.nextButtonOverride
      : line.stageEffect === 'escape-cta'
        ? '扯断连接，逃离暗区'
        : isLast
          ? finishLabel
          : '继续';

  const roleBadgeText = line.isThought
    ? 'THOUGHT'
    : line.speakerKind === 'player'
      ? 'SELF-TALK'
      : line.speakerKind === 'opponent'
        ? 'OPP'
        : 'NARRATOR';

  return (
    <div
      className={`lc-vn-backdrop tone-${line.tone} fx-${line.stageEffect}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="vn-story-title"
    >
      {/* Top Centered Compact VN Bar */}
      <header className="lc-vn-topbar">
        <div className="lc-vn-topbar-left">
          <span className={`lc-vn-chapter-badge tone-${line.tone}`}>
            {line.chapterLabel}
          </span>
          <h2 id="vn-story-title" className="lc-vn-line-counter">
            {line.lineNo} / {String(script.length).padStart(2, '0')}
          </h2>
          <div className="lc-vn-mini-progress" aria-hidden="true">
            <div
              className={`lc-vn-mini-progress-fill tone-${line.tone}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="lc-vn-topbar-actions">
          <button
            id="vn-story-prev"
            type="button"
            className="lc-escape-btn"
            disabled={isFirst}
            onClick={() => onChangeLine(Math.max(0, clampedIdx - 1))}
          >
            上一句
          </button>
          <button
            id="vn-story-skip"
            type="button"
            className="lc-escape-btn"
            onClick={onFinish}
          >
            {skipLabel}
          </button>
        </div>
      </header>

      {/* Main Visual Novel Character & Environment Stage */}
      <main className="lc-vn-stage">
        <div className="lc-vn-hud-stack">
          {isAlarmTone && (
            <div className="lc-vn-alarm-ribbon" aria-hidden="true">
              <span>RED ALERT // HIGH-PRIORITY ANOMALY BEACON ACTIVE</span>
            </div>
          )}

          {!isDualMode && singleSpriteMode !== 'none' && line.spriteTag && (
            <div className={`lc-vn-sprite-tag mode-${singleSpriteMode} tone-${line.tone}`}>
              {line.spriteTag}
            </div>
          )}

          {!showCenterTelemetry && line.hudAlerts && line.hudAlerts.length > 0 && (
            <aside
              className={`lc-vn-side-alerts ${showRadarPanel ? 'is-radar' : ''} tone-${line.tone}`}
              aria-label="系统提示"
            >
              {showRadarPanel && (
                <div className="lc-vn-side-radar-title">
                  <PixelNodesIcon size={13} />
                  <span>局部拓扑追踪警报</span>
                </div>
              )}
              <div className="lc-vn-side-alerts-row">
                {line.hudAlerts.map((alertText, idx) => (
                  <div key={idx} className={`lc-vn-side-alert-pill tone-${line.tone}`}>
                    {alertText.replaceAll('{codename}', playerCodename)}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>

        {showCenterTelemetry && (
          <div className={`lc-vn-center-telemetry tone-${line.tone}`}>
            <div className="lc-vn-telemetry-head">
              <PixelSeverIcon size={14} />
              <span>
                {line.stageEffect === 'glitch-override'
                  ? 'CRITICAL // CORE SHELL OVERRIDE'
                  : line.stageEffect === 'reverse-flux' || line.stageEffect === 'error-popups'
                    ? 'WARNING // REVERSE WRITEBACK DETECTED'
                    : 'SYNC // NEURAL PORT TRANSFER'}
              </span>
            </div>
            {line.hudAlerts && line.hudAlerts.length > 0 && (
              <div className="lc-vn-telemetry-lines">
                {line.hudAlerts.map((item, idx) => (
                  <div key={idx} className="lc-vn-telemetry-line">
                    {item.replaceAll('{codename}', playerCodename)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Dual / Trio Portraits (SEC-01+) */}
        {isDualMode && (
          <div
            className={`lc-vn-dual-stage ${hasAuxLeft ? 'has-aux-left' : ''} ${
              hasCollisionFx ? 'has-collision-fx' : ''
            }`}
          >
            {hasCollisionFx && (
              <div
                key={`collide-${clampedIdx}`}
                className="lc-vn-collision-fx"
                aria-hidden="true"
              >
                <span className="lc-vn-collision-burst" />
                <span className="lc-vn-collision-ring" />
                <span className="lc-vn-collision-spark spark-1" />
                <span className="lc-vn-collision-spark spark-2" />
                <span className="lc-vn-collision-spark spark-3" />
                <span className="lc-vn-collision-spark spark-4" />
              </div>
            )}
            {(hasAuxLeft
              ? [
                  { side: 'aux-left' as const, sprite: line.auxLeftSprite },
                  { side: 'left' as const, sprite: line.leftSprite },
                  { side: 'right' as const, sprite: line.rightSprite },
                ]
              : [
                  { side: 'left' as const, sprite: line.leftSprite },
                  { side: 'right' as const, sprite: line.rightSprite },
                ]
            ).map(({ side, sprite }) => {
              if (!sprite) {
                return <div key={side} className={`lc-vn-dual-slot is-${side} vis-hidden`} />;
              }
              const resolvedLabel = sprite.label?.replaceAll('{codename}', playerCodename);
              return (
                <div
                  key={side}
                  className={`lc-vn-dual-slot is-${side} char-${sprite.character} vis-${sprite.visibility} fx-${sprite.effect ?? 'none'}`}
                >
                  {resolvedLabel && sprite.visibility !== 'hidden' && (
                    <span
                      className={`lc-vn-dual-slot-tag char-${sprite.character} vis-${sprite.visibility}`}
                    >
                      {resolvedLabel}
                    </span>
                  )}
                  <div className="lc-vn-dual-frame">
                    <img
                      src={resolveDualSpriteSrc(sprite)}
                      alt={resolvedLabel ?? sprite.character}
                      className="lc-vn-dual-img"
                    />
                    {(sprite.character === 'echo0' || sprite.effect === 'flashback') && (
                      <div className="lc-vn-mirror-scanlines" aria-hidden="true" />
                    )}
                    {sprite.effect === 'blade-cut' && (
                      <div
                        key={`slash-${clampedIdx}`}
                        className="lc-vn-blade-slash-fx"
                        aria-hidden="true"
                      >
                        <span className="lc-vn-slash-arc slash-primary" />
                        <span className="lc-vn-slash-arc slash-secondary" />
                        <span className="lc-vn-slash-flash" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Single Centered Portrait (SEC-00) */}
        {!isDualMode && singleSpriteMode !== 'none' && (
          <div
            className={`lc-vn-sprite-stage mode-${singleSpriteMode} fx-${line.stageEffect} tone-${line.tone}`}
          >
            <div className={`lc-vn-sprite-frame mode-${singleSpriteMode} tone-${line.tone}`}>
              <img
                src={portraitUrl}
                alt={line.spriteTag ?? line.speakerName}
                className="lc-vn-sprite-img"
              />
              {singleSpriteMode === 'mirror' && (
                <div className="lc-vn-mirror-scanlines" aria-hidden="true" />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Classic Visual Novel Dialogue Box */}
      <footer className="lc-vn-dialogue-wrap">
        <div
          className={`lc-vn-dialogue-box speaker-${line.speakerKind} tone-${line.tone} ${
            line.isThought ? 'is-thought' : ''
          } ${
            line.stageEffect === 'reverse-flux' || line.stageEffect === 'glitch-override'
              ? 'is-shaking'
              : ''
          }`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            handleAdvance();
          }}
        >
          <div
            className={`lc-vn-nameplate speaker-${line.speakerKind} tone-${line.tone} ${
              line.isThought ? 'is-thought' : ''
            }`}
          >
            <span>{line.speakerName}</span>
            <span className="lc-vn-nameplate-role">{roleBadgeText}</span>
          </div>

          <div className="lc-vn-text" aria-live="polite">
            {resolvedText.slice(0, revealedCount)}
            {isTyping && <span className="lc-vn-caret" aria-hidden="true" />}
          </div>

          <div className="lc-vn-dialogue-foot">
            <span className="lc-vn-hint">点击对话框或按 Space / Enter 推进</span>
            <button
              id="vn-story-next"
              type="button"
              className={`lc-escape-cta lc-vn-next-btn ${
                isAlarmTone ? 'danger' : line.tone === 'gold' ? 'gold' : 'primary'
              }`}
              onClick={handleAdvance}
            >
              <span className="lc-btn-inline">
                {line.stageEffect === 'escape-cta' || isLast ? (
                  <PixelSurgeIcon size={14} />
                ) : (
                  <PixelCheckIcon size={14} />
                )}
                {nextButtonLabel}
              </span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
