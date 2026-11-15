import type { Suit } from '../engine/types.ts';

interface SuitEmblemProps {
  suit: Suit;
  size?: number;
  className?: string;
}

/**
 * Crisp 16-bit Pixel-Art Cyber Suit Emblems (crispEdges, zero anti-alias blur, zero emoji).
 * - 'B' (黑曜脉冲): Stepped pixel obsidian blade-spade with silver rim & cyan center pixel.
 * - 'P' (绯霓电弧): Stepped pixel neon-pink cyber prism-heart with specular white pixel.
 */
export function CyberSuitEmblem({ suit, size = 20, className = '' }: SuitEmblemProps) {
  if (suit === 'P') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        shapeRendering="crispEdges"
        className={`px-suit-svg px-suit-pink ${className}`}
        aria-hidden="true"
      >
        {/* Outer highlight pixel border */}
        <path
          d="M2 2h4v1h2V2h4v1h1v4h-1v2h-2v2H8v2H6v-2H4V9H2V7H1V3h1V2z"
          fill="#FF2E88"
        />
        {/* Inner neon core */}
        <path d="M3 3h3v2h2V3h3v4H9v2H7v2H5V9H3V3z" fill="#FF6EB0" />
        {/* Specular white pixel */}
        <rect x="3" y="3" width="2" height="2" fill="#FFFFFF" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      shapeRendering="crispEdges"
      className={`px-suit-svg px-suit-black ${className}`}
      aria-hidden="true"
    >
      {/* Silver-cyan pixel outline */}
      <path
        d="M6 1h2v2h2v2h2v3h-2v2H8v1h2v2H4v-2h2v-1H4V8H2V5h2V3h2V1z"
        fill="#B8C7E6"
      />
      {/* Deep obsidian pixel fill */}
      <path d="M6 3h2v2h2v2H8v2H6V7H4V5h2V3z" fill="#141A2E" />
      {/* Cyan pixel core */}
      <rect x="6" y="5" width="2" height="2" fill="#00F0FF" />
    </svg>
  );
}

export function NetrunnerBrandLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="px-brand-svg"
    >
      <rect x="1" y="1" width="14" height="14" fill="#12182B" />
      <path d="M1 1h14v2H1V1zm0 12h14v2H1v-2zM1 3h2v10H1V3zm12 0h2v10h-2V3z" fill="#FF2E88" />
      <path d="M4 4h2v8H4V4zm6 0h2v8h-2V4zM6 6h2v2H6V6zm2 2h2v2H8V8z" fill="#00F0FF" />
    </svg>
  );
}
