import { Cpu } from 'lucide-react';
import type { VfxEvent } from '../engine/types.ts';
import { PixelWindow } from './PixelWindow.tsx';

interface ComputePoolBarProps {
  pot: number;
  startingChips: number;
  lastAction?: VfxEvent;
  statusLabel: string;
  statusWarn?: boolean;
}

const TOTAL_SEGMENTS = 18;

/**
 * Pixel-Art Compute Pool Column Bar + Flying Data Sector Animation.
 * Replaces traditional poker chip stacks: raises/calls/swaps launch a [DATA +N] block
 * into the bar receptor, causing the segmented energy column to surge upward.
 */
export function ComputePoolBar({
  pot,
  startingChips,
  lastAction,
  statusLabel,
  statusWarn = false,
}: ComputePoolBarProps) {
  // Scale full bar to ~45% of combined starting chips (e.g. 450 for 1000 stacks) so growth is dramatic every bet!
  const maxRef = Math.max(120, Math.round(startingChips * 0.45));
  const ratio = Math.min(1, pot / maxRef);
  const litSegments = Math.max(1, Math.round(ratio * TOTAL_SEGMENTS));

  const hasDataGain =
    Boolean(lastAction) &&
    (lastAction!.type === 'raise' ||
      lastAction!.type === 'call' ||
      lastAction!.type === 'swap') &&
    (lastAction!.amount ?? 0) > 0;

  const loadTier =
    ratio >= 0.8
      ? 'OVERLOAD'
      : ratio >= 0.45
        ? 'HIGH_LOAD'
        : ratio >= 0.2
          ? 'ACTIVE'
          : 'STANDBY';

  return (
    <PixelWindow
      title="算力主池"
      code="POOL.EXE"
      icon={<Cpu size={13} color="var(--accent-telemetry)" aria-hidden="true" />}
      className="compute-pool-win"
      bodyClassName="compute-pool-body"
      activeGlow={hasDataGain}
      ariaLabel="算力奖池柱状计量窗"
    >
      {/* Digital Pixel Readout */}
      <div className="pool-digital-box">
        <span className="pool-sub-label">当前汇聚算力</span>
        <strong key={`pot-val-${pot}`} className={`pool-num-readout ${hasDataGain ? 'surge' : ''}`}>
          {String(pot).padStart(4, '0')}
        </strong>
        <span className="pool-tier-tag">{loadTier}</span>
      </div>

      {/* Vertical Segmented Pixel Column + Flying Data Packet */}
      <div className="pool-column-stage">
        <div
          key={`bar-${pot}`}
          className={`pool-bar-frame ${hasDataGain ? 'bar-hit-flash' : ''}`}
          role="meter"
          aria-label="算力池充能柱"
          aria-valuenow={pot}
          aria-valuemin={0}
          aria-valuemax={maxRef}
        >
          {Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => {
            // Render top-to-bottom so index 0 is highest segment
            const segLevel = TOTAL_SEGMENTS - idx;
            const isLit = segLevel <= litSegments;
            const isTopLit = segLevel === litSegments;
            const segTone =
              segLevel >= 14
                ? 'seg-crimson'
                : segLevel >= 9
                  ? 'seg-pink'
                  : 'seg-cyan';

            return (
              <div
                key={segLevel}
                className={`pool-bar-seg ${isLit ? `lit ${segTone}` : ''} ${
                  isTopLit && hasDataGain ? 'seg-just-grown' : ''
                }`}
              />
            );
          })}
        </div>

        {/* Flying Data Sector Block on Raise / Call / Swap */}
        {hasDataGain && lastAction && (
          <div
            key={`pkt-${lastAction.id}`}
            className={`data-sector-flight ${
              lastAction.actor === 'ai' ? 'pkt-from-ai' : 'pkt-from-human'
            }`}
            aria-hidden="true"
          >
            <span className="pkt-bits">1011</span>
            <span className="pkt-amount">DATA +{lastAction.amount}</span>
          </div>
        )}
      </div>

      {/* Turn / Table State Indicator */}
      <div className={`pool-status-readout ${statusWarn ? 'warn' : ''}`}>{statusLabel}</div>
    </PixelWindow>
  );
}

export function PixelActionVfxOverlay({ event }: { event?: VfxEvent }) {
  if (!event || event.type === 'deal') return null;

  const toneClass =
    event.type === 'raise' || event.type === 'swap' || event.type === 'allin-reveal'
      ? 'pink'
      : event.type === 'fold'
        ? 'danger'
        : event.type === 'showdown'
          ? 'emerald'
          : 'cyan';

  return (
    <div key={event.id} className="px-vfx-layer" aria-hidden="true">
      {event.type !== 'end-turn' && <div className={`px-vfx-frame-burst ${toneClass}`} />}
      {event.type === 'swap' && (
        <div className={`px-vfx-swap-packet ${event.actor === 'ai' ? 'from-ai' : ''}`}>
          <span>SWAP</span>
        </div>
      )}
      <div className={`px-vfx-banner ${event.actor === 'ai' ? 'ai-banner' : ''}`}>
        {event.label}
      </div>
    </div>
  );
}
