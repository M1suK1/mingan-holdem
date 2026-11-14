import type { Card } from '../engine/types.ts';
import { formatRank, formatSuitLabel } from '../engine/gameEngine.ts';
import { CyberSuitEmblem } from './CyberIcons.tsx';

interface CyberCard3DProps {
  id: string;
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  backCode?: string;
  isOwnPrivate?: boolean;
  justActed?: boolean;
  selected?: boolean;
  targetable?: boolean;
  isWinner?: boolean;
  onClick?: () => void;
}

export function CyberCard3D({
  id,
  card,
  faceDown = false,
  size = 'md',
  backCode = 'ICE_NODE',
  isOwnPrivate = false,
  justActed = false,
  selected = false,
  targetable = false,
  isWinner = false,
  onClick,
}: CyberCard3DProps) {
  const isPink = card?.suit === 'P';
  const rankTxt = card ? formatRank(card.rank) : '';
  const suitName = card ? formatSuitLabel(card.suit) : '';
  const interactive = Boolean(onClick);

  const bodyClasses = [
    'cyber-card-3d',
    faceDown ? 'is-facedown' : '',
    interactive ? 'clickable' : '',
    selected ? 'is-selected' : '',
    targetable ? 'is-targetable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const frontClasses = [
    'cyber-card-face',
    'cyber-card-front',
    isPink ? 'suit-P' : 'suit-B',
    isOwnPrivate ? 'own-private-blink' : '',
    justActed ? 'acted-flash' : '',
    isWinner ? 'winner-glow' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const centerSize = size === 'sm' ? 20 : size === 'lg' ? 30 : 26;
  const cornerSize = size === 'sm' ? 11 : 13;

  const ariaLabel = faceDown
    ? `加密卡牌 ${backCode}`
    : `${suitName}色 ${rankTxt}${isOwnPrivate ? '（己方私有暗牌）' : ''}`;

  return (
    <div className={`cyber-card-scene sz-${size}`}>
      <div
        id={id}
        className={bodyClasses}
        onClick={onClick}
        role={interactive ? 'button' : 'img'}
        aria-label={ariaLabel}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
      >
        <div className={frontClasses}>
          <div className="card-holo-sheen" />
          <div className="card-corner-row">
            <span className={`card-rank-txt ${isPink ? 'rank-pink' : 'rank-black'}`}>
              {rankTxt}
            </span>
            {card && <CyberSuitEmblem suit={card.suit} size={cornerSize} />}
          </div>

          <div className="card-center-emblem">
            {card && <CyberSuitEmblem suit={card.suit} size={centerSize} />}
          </div>

          <div className="card-corner-row bottom">
            <span className={`card-rank-txt ${isPink ? 'rank-pink' : 'rank-black'}`}>
              {rankTxt}
            </span>
            {card && <CyberSuitEmblem suit={card.suit} size={cornerSize} />}
          </div>
        </div>

        <div className="cyber-card-face cyber-card-back">
          <div className="card-holo-sheen" />
          <div className="ice-hex-core">
            <div className="ice-hex-dot" />
          </div>
          <span className="ice-slot-code">{backCode}</span>
        </div>
      </div>
    </div>
  );
}
