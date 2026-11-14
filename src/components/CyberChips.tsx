import type { PlayerId, VfxEvent } from '../engine/types.ts';

interface CyberChipsProps {
  amount: number;
  compact?: boolean;
}

export function CyberChips({ amount, compact = false }: CyberChipsProps) {
  if (amount <= 0) return null;

  const pinkCount = Math.min(5, Math.max(1, Math.floor(amount / 40) + 1));
  const blackCount = Math.min(4, Math.max(1, Math.ceil((amount % 40) / 10) || 1));

  const cols = compact
    ? [{ tone: 'pink', count: Math.min(4, pinkCount) }]
    : [
        { tone: 'black', count: blackCount },
        { tone: 'pink', count: pinkCount },
        { tone: 'black', count: Math.max(1, Math.floor(pinkCount / 2)) },
      ];

  return (
    <div className="cyber-chips-stack" aria-hidden="true">
      {cols.map((c, idx) => (
        <div key={idx} className="cyber-chip-col">
          {Array.from({ length: c.count }).map((_, dIdx) => (
            <div
              key={dIdx}
              className={`cyber-chip-disc ${c.tone}`}
              style={{ bottom: `${dIdx * 3.5}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ChipPushAnim({
  eventId,
  actor,
  amount,
}: {
  eventId: string;
  actor: PlayerId;
  amount: number;
}) {
  return (
    <div
      key={`push-${eventId}`}
      className={`chip-push-anim ${actor === 'human' ? 'from-human' : 'from-ai'}`}
      aria-hidden="true"
    >
      <CyberChips amount={amount} compact />
      <span className="bet-chip-pill">+{amount}</span>
    </div>
  );
}

export function CyberVfxOverlay({ event }: { event?: VfxEvent }) {
  if (!event || event.type === 'deal') return null;

  const burstTone =
    event.type === 'raise' || event.type === 'swap' || event.type === 'allin-reveal'
      ? 'pink'
      : event.type === 'fold'
        ? 'danger'
        : event.type === 'showdown'
          ? 'emerald'
          : '';

  return (
    <div key={event.id} className="cyber-vfx-layer" aria-hidden="true">
      {event.type !== 'end-turn' && <div className={`vfx-holo-burst ${burstTone}`} />}
      {event.type === 'swap' && (
        <div className={`vfx-packet-beam ${event.actor === 'ai' ? 'from-ai' : ''}`} />
      )}
      <div className={`vfx-hud-banner ${event.actor === 'ai' ? 'ai-banner' : ''}`}>
        {event.label}
      </div>
    </div>
  );
}
