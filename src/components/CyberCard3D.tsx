import type { DragEvent } from 'react';
import type { Card } from '../engine/types.ts';
import { formatRank, formatSuitLabel } from '../engine/gameEngine.ts';

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
  draggable?: boolean;
  isDragSource?: boolean;
  isDropTarget?: boolean;
  isDropHover?: boolean;
  isSwappingHidden?: boolean;
  swapSource?: 'human' | 'ai';
  tamperLabel?: string;
  isScanTarget?: boolean;
  isScannedClean?: boolean;
  actionHint?: string;
  onClick?: () => void;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
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
  draggable = false,
  isDragSource = false,
  isDropTarget = false,
  isDropHover = false,
  isSwappingHidden = false,
  swapSource,
  tamperLabel,
  isScanTarget = false,
  isScannedClean = false,
  actionHint,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: CyberCard3DProps) {
  const isPink = card?.suit === 'P';
  const rankTxt = card ? formatRank(card.rank) : '';
  const hexCode = card ? `0x${card.rank.toString(16).toUpperCase().padStart(2, '0')}` : '';
  const suitName = card ? formatSuitLabel(card.suit) : '';
  const interactive = Boolean(onClick);

  const bodyClasses = [
    'px-card-3d',
    faceDown ? 'is-facedown' : '',
    interactive ? 'clickable' : '',
    draggable ? 'is-draggable' : '',
    isDragSource ? 'is-drag-source' : '',
    isDropTarget ? 'is-drop-target' : '',
    isDropHover ? 'is-drop-hover' : '',
    isSwappingHidden ? 'is-swapping-hidden' : '',
    isScanTarget ? 'is-scan-target' : '',
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
        draggable={draggable}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
          {/* Cyber Top Header Strip */}
          <div className="px-card-hud-top">
            <span className="px-card-hex">{tamperLabel ?? hexCode}</span>
            {isScanTarget ? (
              <span className="px-card-scan-tag">SCAN</span>
            ) : isOwnPrivate ? (
              <span className="px-card-priv-tag">PRIV</span>
            ) : tamperLabel ? (
              <span className="px-card-hack-tag">MOD</span>
            ) : isScannedClean ? (
              <span className="px-card-clean-tag">OK</span>
            ) : (
              <span className="px-card-mini-dot" aria-hidden="true" />
            )}
          </div>

          {/* Enlarged Center Rank Display (Color = Suit, No Traditional Suit Symbols) */}
          <div className="px-card-hero-stage">
            <span
              className={`px-card-hero-rank ${isPink ? 'rank-pink' : 'rank-cyan'} ${
                rankTxt === '10' ? 'is-ten' : ''
              }`}
            >
              {rankTxt}
            </span>
          </div>

          {/* Color-Coded Cyber Footer Strip */}
          <div className="px-card-hud-bot" aria-hidden="true">
            {swapSource && (
              <span className={`px-card-swap-badge ${swapSource}`}>
                {swapSource === 'human' ? '己换' : '敌换'}
              </span>
            )}
            <span className="px-card-suit-bar" />
            <span className="px-card-pips">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>

        {/* Encrypted Firewall Card Back */}
        <div className="px-card-face px-card-back">
          <div className="px-back-grid-icon" aria-hidden="true">
            <span />
          </div>
          <span className="px-back-code">{isScanTarget ? 'SCAN' : backCode}</span>
        </div>
      </div>
    </div>
  );
}
