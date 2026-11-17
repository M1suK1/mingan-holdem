import type { VfxEvent } from '../engine/types.ts';
import { PixelCpuIcon } from './CyberIcons.tsx';

interface ComputePoolBarProps {
  pot: number;
  startingChips: number;
  lastAction?: VfxEvent;
  statusLabel?: string;
  statusWarn?: boolean;
}

const TOTAL_SEGMENTS = 20;

/**
 * Left-Rail Vertical Segmented Pixel Compute Pool Bar
 * Supports real-time pot surge + [DATA +N] fly-in animation.
 */
export function ComputePoolBar({
  pot,
  startingChips,
  lastAction,
  statusLabel,
  statusWarn,
}: ComputePoolBarProps) {
  const maxRef = Math.max(120, Math.round(startingChips * 0.45));
  const ratio = Math.min(1, pot / maxRef);
  const litSegments = Math.max(2, Math.round(ratio * TOTAL_SEGMENTS));

  const hasDataGain =
    Boolean(lastAction) &&
    (lastAction!.type === 'raise' ||
      lastAction!.type === 'call' ||
      lastAction!.type === 'swap') &&
    (lastAction!.amount ?? 0) > 0;

  const tierCode =
    ratio >= 0.8 ? 'OVERLOAD' : ratio >= 0.45 ? 'SURGE' : 'ACTIVE';

  return (
    <div
      className="lc-hud-box lc-pool-wrap"
      role="meter"
      aria-label="算力奖池垂直充能柱"
      aria-valuenow={pot}
      aria-valuemin={0}
      aria-valuemax={maxRef}
    >
      <div className="lc-pool-header">
        <span className="lc-pool-label">
          <PixelCpuIcon size={13} />
          算力池
        </span>
        <strong key={`pot-${pot}`} className={`lc-pool-value ${hasDataGain ? 'surge' : ''}`}>
          {String(pot).padStart(4, '0')}
        </strong>
      </div>

      <div key={`track-${pot}`} className={`lc-pool-track ${hasDataGain ? 'hit-flash' : ''}`}>
        {Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => {
          const segLevel = TOTAL_SEGMENTS - idx;
          const isLit = segLevel <= litSegments;
          const isTopCap = segLevel === litSegments;
          const isHigh = segLevel >= 15;

          return (
            <div
              key={segLevel}
              className={`lc-pool-seg ${isLit ? 'lit' : ''} ${
                isTopCap ? 'cap' : ''
              } ${isHigh && isLit ? 'high' : ''} ${isTopCap && hasDataGain ? 'just-grown' : ''}`}
            />
          );
        })}

        {hasDataGain && lastAction && (
          <div
            key={`pkt-${lastAction.id}`}
            className={`lc-data-pkt ${lastAction.actor === 'ai' ? 'from-ai' : 'from-human'}`}
            aria-hidden="true"
          >
            +{lastAction.amount}
          </div>
        )}
      </div>

      {statusLabel && (
        <span
          className={`lc-pool-status-alert ${statusWarn ? 'is-critical' : 'is-warn'}`}
          role="status"
        >
          {statusLabel}
        </span>
      )}

      <span className="lc-pool-tier">{tierCode}</span>
    </div>
  );
}

export function PixelActionVfxOverlay({ event }: { event?: VfxEvent }) {
  if (!event) return null;
  return null;
}
