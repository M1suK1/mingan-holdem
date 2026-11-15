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
  actionHint?: string;
  onClick?: () => void;
}

export function CyberCard3D({
  id,
  card,
  faceDown = false,
  size = 'md',
  backCode = '暗码',
  isOwnPrivate = false,
  justActed = false,
  selected = false,
  targetable = false,
  isWinner = false,
  actionHint,
  onClick,
}: CyberCard3DProps) {
  const isPink = card?.suit === 'P';
  const rankTxt = card ? formatRank(card.rank) : '';
  const suitName = card ? formatSuitLabel(card.suit) : '';
  const interactive = Boolean(onClick);

  const bodyClasses = [
    'px-card-3d',
    faceDown ? 'is-facedown' : '',
    interactive ? 'clickable' : '',
    selected ? 'is-selected' : '',
    targetable ? 'is-targetable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const frontClasses = [
    'px-card-face',
    'px-card-front',
    isPink ? 'suit-P' : 'suit-B',
    isOwnPrivate ? 'own-private-blink' : '',
    justActed ? 'acted-flash' : '',
    isWinner ? 'winner-glow' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const centerSize = size === 'sm' ? 20 : size === 'lg' ? 28 : 24;
  const cornerSize = size === 'sm' ? 11 : 13;

  const ariaLabel = faceDown
    ? `加密卡牌 ${backCode}${actionHint ? `（${actionHint}）` : ''}`
    : `${suitName}色 ${rankTxt}${isOwnPrivate ? '（己方私有暗牌）' : ''}${
        actionHint ? `（${actionHint}）` : ''
      }`;

  return (
    <div className={`px-card-scene sz-${size}`}>
      <div
        id={id}
        className={bodyClasses}
        onClick={onClick}
        role={interactive ? 'button' : 'img'}
        aria-label={ariaLabel}
        title={actionHint}
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
          <div className="px-card-corner">
            <span className={`px-card-rank ${isPink ? 'rank-pink' : 'rank-black'}`}>
              {rankTxt}
            </span>
            {card && <CyberSuitEmblem suit={card.suit} size={cornerSize} />}
          </div>

          <div className="px-card-center">
            {card && <CyberSuitEmblem suit={card.suit} size={centerSize} />}
          </div>

          <div className="px-card-corner bottom">
            <span className={`px-card-rank ${isPink ? 'rank-pink' : 'rank-black'}`}>
              {rankTxt}
            </span>
            {card && <CyberSuitEmblem suit={card.suit} size={cornerSize} />}
          </div>
        </div>

        <div className="px-card-face px-card-back">
          <div className="px-back-grid-icon" aria-hidden="true">
            <span />
          </div>
          <span className="px-back-code">{backCode}</span>
        </div>
      </div>
    </div>
  );
}
