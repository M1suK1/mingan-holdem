import type { Suit } from '../engine/types.ts';

interface SuitEmblemProps {
  suit: Suit;
  size?: number;
  className?: string;
}

/**
 * Bespoke vector cyber-suit emblems (Zero emoji / Zero font-dependent glyphs).
 * - 'B' (黑曜脉冲): Layered obsidian stealth-blade polygon with silver-chrome circuit core.
 * - 'P' (绯霓电弧): Faceted neon-pink cyber-prism crystal with glowing inner pulse node.
 */
export function CyberSuitEmblem({ suit, size = 20, className = '' }: SuitEmblemProps) {
  if (suit === 'P') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        className={`cyber-suit-svg suit-pink-svg ${className}`}
        aria-hidden="true"
      >
        <polygon
          points="14,2 25,11 19.5,25.5 8.5,25.5 3,11"
          fill="rgba(255, 46, 136, 0.24)"
          stroke="#FF55A3"
          strokeWidth="1.8"
        />
        <polygon
          points="14,5.5 21,11.8 14,22.5 7,11.8"
          fill="#FF2E88"
          stroke="#FFD1E6"
          strokeWidth="1"
        />
        <circle cx="14" cy="12.5" r="2.1" fill="#FFFFFF" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={`cyber-suit-svg suit-black-svg ${className}`}
      aria-hidden="true"
    >
      <polygon
        points="14,2 24.5,14 14,26 3.5,14"
        fill="#141929"
        stroke="#B8C7E6"
        strokeWidth="1.8"
      />
      <polygon
        points="14,6.5 19.8,14 14,21.5 8.2,14"
        fill="#27314A"
        stroke="#7F95C2"
        strokeWidth="1.1"
      />
      <rect x="12.2" y="12.2" width="3.6" height="3.6" transform="rotate(45 14 14)" fill="#E2ECFF" />
    </svg>
  );
}

export function NetrunnerBrandLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className="brand-logo-svg"
    >
      <polygon
        points="18,2 33,10.5 33,25.5 18,34 3,25.5 3,10.5"
        fill="rgba(255, 46, 136, 0.14)"
        stroke="#FF2E88"
        strokeWidth="1.8"
      />
      <polygon
        points="18,7 28,13 28,23 18,29 8,23 8,13"
        fill="rgba(0, 240, 255, 0.08)"
        stroke="#00F0FF"
        strokeWidth="1.3"
      />
      <path
        d="M13 22V14L23 22V14"
        stroke="#F8FAFC"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
