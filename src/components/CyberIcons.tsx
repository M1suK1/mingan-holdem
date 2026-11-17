import type { Suit } from '../engine/types.ts';

interface SuitEmblemProps {
  suit: Suit;
  size?: number;
  className?: string;
}

interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Crisp 16-bit Pixel-Art Cyber Suit Emblems (crispEdges, zero anti-alias blur, zero emoji).
 */
export function CyberSuitEmblem({ suit, size = 20, className = '' }: SuitEmblemProps) {
  if (suit === 'P') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        shapeRendering="crispEdges"
        className={`px-suit-svg px-suit-pink lc-px-icon ${className}`}
        aria-hidden="true"
      >
        <path
          d="M2 2h4v1h2V2h4v1h1v4h-1v2h-2v2H8v2H6v-2H4V9H2V7H1V3h1V2z"
          fill="#FF2E88"
        />
        <path d="M3 3h3v2h2V3h3v4H9v2H7v2H5V9H3V3z" fill="#FF6EB0" />
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
      className={`px-suit-svg px-suit-black lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M6 1h2v2h2v2h2v3h-2v2H8v1h2v2H4v-2h2v-1H4V8H2V5h2V3h2V1z"
        fill="#B8C7E6"
      />
      <path d="M6 3h2v2h2v2H8v2H6V7H4V5h2V3z" fill="#141A2E" />
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
      className="px-brand-svg lc-px-icon"
    >
      <rect x="1" y="1" width="14" height="14" fill="#12182B" />
      <path d="M1 1h14v2H1V1zm0 12h14v2H1v-2zM1 3h2v10H1V3zm12 0h2v10h-2V3z" fill="#FF2E88" />
      <path d="M4 4h2v8H4V4zm6 0h2v8h-2V4zM6 6h2v2H6V6zm2 2h2v2H8V8z" fill="#00F0FF" />
    </svg>
  );
}

/* =========================================================================
   Unified 16x16 Crisp Pixel SVG Icons for All Functional Buttons & HUD Tags
   ========================================================================= */

export function PixelGearIcon({ size = 22, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M6 1h4v2h2v1h1v2h2v4h-2v2h-1v1h-2v2H6v-2H4v-1H3v-2H1V6h2V4h1V3h2V1zm0 5v4h4V6H6z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 快速重开: Pixel Reset / Loop Arrows */
export function PixelRestartIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M4 2h7v2h2v3h-2V5H5v2H3V4h1V2zm9 1v3h-3V4h2V3h1zM3 9h2v2h6V9h2v3h-1v2H5v-2H3V9zm0 1h3v2H4v1H3v-3z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 换人: Pixel User-Swap Icon */
export function PixelSwitchUserIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M4 2h4v4H4V2zm-2 5h8v3H2V7zm9-3h3v2h-2v2h-1V4zm2 5h2v4h-4v-2h2V9zm-4 3h2v2H9v-2z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 跟注 / 过牌: Pixel Shield-Check / Sync Icon */
export function PixelSyncIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h12v6h-1v3h-2v2H9v2H7v-2H5v-2H3V8H2V2zm2 2v4h1v2h2v2h2v-2h2V8h1V4H4z"
        fill="currentColor"
      />
      <path d="M5 7h2v2h1V8h1V6h2v2H9v2H7V9H5V7z" fill="#00F0FF" />
    </svg>
  );
}

/** 加注施压: Pixel Surge Flame / Double Up-Chevron */
export function PixelSurgeIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M7 1h2v2h2v2h2v2h-2V5H9V4H7v1H5v2H3V5h2V3h2V1zm0 6h2v2h2v2h2v2h-2v-2H9v-1H7v1H5v2H3v-2h2V9h2V7z"
        fill="currentColor"
      />
      <rect x="7" y="13" width="2" height="2" fill="#FF2E88" />
    </svg>
  );
}

/** 弃牌断连: Pixel Sever / Cross-Cut Icon */
export function PixelSeverIcon({ size = 16, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h3v2h2v2h2V4h2V2h3v3h-2v2h-2v2h2v2h2v3h-3v-2H9v-2H7v2H5v2H2v-3h2v-2h2V7H4V5H2V2z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 三档加注图标 (1/2/3阶梯像素块) */
export function PixelTierIcon({
  level,
  size = 16,
  className = '',
}: IconProps & { level: 1 | 2 | 3 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <rect x="2" y="10" width="3" height="4" fill="currentColor" />
      <rect
        x="6"
        y="6"
        width="3"
        height="8"
        fill={level >= 2 ? 'currentColor' : 'rgba(255,255,255,0.22)'}
      />
      <rect
        x="10"
        y="2"
        width="4"
        height="12"
        fill={level >= 3 ? 'currentColor' : 'rgba(255,255,255,0.22)'}
      />
    </svg>
  );
}

/** 触发发言: Pixel Speech Broadcast Waves */
export function PixelBroadcastIcon({ size = 13, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M1 3h10v8H6l-3 3v-3H1V3zm2 2v4h6V5H3zm10-1h2v6h-2V4z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 发送消息: Pixel Paper-Plane / Transmit Arrow */
export function PixelSendIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h4v2h4v2h4v4h-4v2H6v2H2v-4h4V9h3V7H6V6H2V2z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 算力池 / CPU 芯片像素图标 */
export function PixelCpuIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M5 1h2v2h2V1h2v2h2v2h2v2h-2v2h2v2h-2v2h-2v2H9v-2H7v2H5v-2H3v-2H1V9h2V7H1V5h2V3h2V1zm0 4v6h6V5H5zm2 2h2v2H7V7z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 公共加密节点: 4-Node Pixel Matrix */
export function PixelNodesIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <rect x="1" y="2" width="5" height="5" fill="currentColor" />
      <rect x="10" y="2" width="5" height="5" fill="currentColor" />
      <rect x="1" y="9" width="5" height="5" fill="currentColor" />
      <rect x="10" y="9" width="5" height="5" fill="#FF2E88" />
    </svg>
  );
}

/** 通讯栏像素图标 */
export function PixelChatIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h12v9H7l-3 3v-3H2V2zm2 2v5h8V4H4zm1 1h2v2H5V5zm4 0h2v2H9V5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 设置菜单各项像素图标 */
export function PixelMenuIcon({
  kind,
  size = 16,
  className = '',
}: IconProps & {
  kind: 'contracts' | 'llm' | 'rules' | 'audit' | 'tuning' | 'back';
}) {
  if (kind === 'contracts') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`lc-px-icon ${className}`}
        aria-hidden="true"
      >
        <path
          d="M2 2h12v12H2V2zm2 2v8h8V4H4zm2 1h4v3H6V5zm-1 4h6v2H5V9z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === 'llm') {
    return <PixelCpuIcon size={size} className={className} />;
  }
  if (kind === 'rules') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`lc-px-icon ${className}`}
        aria-hidden="true"
      >
        <path
          d="M2 2h5v12H2V2zm7 0h5v12H9V2zM4 4v2h1V4H4zm7 0v2h1V4h-1zM4 8v2h1V8H4zm7 0v2h1V8h-1z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === 'audit') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`lc-px-icon ${className}`}
        aria-hidden="true"
      >
        <path
          d="M2 2h12v12H2V2zm2 2v8h8V4H4zm1 1h6v2H5V5zm0 3h6v1H5V8zm0 2h4v1H5v-1z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (kind === 'tuning') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className={`lc-px-icon ${className}`}
        aria-hidden="true"
      >
        <path
          d="M3 2h2v5H7v2H5v5H3V9H1V7h2V2zm4 0h2v2h2v2H9v8H7V6H5V4h2V2zm4 0h2v7h2v2h-2v3h-2v-3H9V9h2V2z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M7 2v3h7v6H7v3L1 8l6-6zm-3 6l1 1V7L4 8z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 黑客技能 +1: Pixel Up-Increment Arrow */
export function PixelPlusOneIcon({ size = 13, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path d="M7 2h2v2h2v2h2v2H9v6H7V8H3V6h2V4h2V2z" fill="#00F0FF" />
    </svg>
  );
}

/** 黑客技能 -1: Pixel Down-Decrement Arrow */
export function PixelMinusOneIcon({ size = 13, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path d="M7 2h2v6h4v2h-2v2H9v2H7v-2H5v-2H3V8h4V2z" fill="#FFB020" />
    </svg>
  );
}

/** 黑客技能 反转花色: Pixel Dual-Suit Invert */
export function PixelFlipSuitIcon({ size = 13, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <rect x="1" y="2" width="6" height="6" fill="#00F0FF" />
      <rect x="9" y="8" width="6" height="6" fill="#FF2E88" />
      <path d="M9 2h5v4h-2V4H9V2zM2 10h2v2h3v2H2v-4z" fill="currentColor" />
    </svg>
  );
}

/** 通用技能 扫描牌: Pixel Crosshair Scanner */
export function PixelScanIcon({ size = 13, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h4v2H4v2H2V2zm8 0h4v4h-2V4h-2V2zM2 10h2v2h2v2H2v-4zm10 0h2v4h-4v-2h2v-2z"
        fill="currentColor"
      />
      <rect x="5" y="7" width="6" height="2" fill="#10F5A0" />
      <rect x="7" y="5" width="2" height="6" fill="#10F5A0" />
    </svg>
  );
}

/** 长按半数加注: Pixel Overclock Gauge */
export function PixelHoldIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 2h12v12H2V2zm2 2v8h8V4H4zm1 5h6v2H5V9zm0-3h4v2H5V6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function PixelCheckIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path d="M12 4h2v2h-2V4zm-2 2h2v2h-2V6zM8 8h2v2H8V8zm-2 2h2v2H6v-2zM4 8h2v2H4V8zM2 6h2v2H2V6z" fill="currentColor" />
    </svg>
  );
}

export function PixelLockIcon({ size = 14, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`lc-px-icon ${className}`}
      aria-hidden="true"
    >
      <path d="M5 2h6v2H5V2zM4 4h2v3H4V4zm6 0h2v3h-2V4zM2 7h12v7H2V7zm5 2v3h2V9H7z" fill="currentColor" />
    </svg>
  );
}

/** 回溯按钮裂纹像素叠层（72% 轻裂 / 48% 重裂 / 0% 碎裂） */
export function PixelRewindCrackOverlay({
  stage,
}: {
  stage: 'intact' | 'cracked-1' | 'cracked-2' | 'shattered';
}) {
  if (stage === 'intact') return null;

  return (
    <svg
      viewBox="0 0 64 32"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={`lc-rewind-crack-svg is-${stage}`}
      aria-hidden="true"
    >
      {/* Stage 1 (72%): upper-right to center hairline fracture */}
      <path
        d="M46 0h2v4h-2V0zm-2 4h2v4h-2V4zm-2 4h2v3h-2V8zm-3 3h3v2h-3v-2zm-3 2h3v2h-3v-2z"
        fill={stage === 'cracked-1' ? '#FFB020' : '#FF4757'}
        opacity={stage === 'cracked-1' ? 0.85 : 0.92}
      />

      {/* Stage 2 (48%): secondary bottom-left fracture + cross fissure */}
      {(stage === 'cracked-2' || stage === 'shattered') && (
        <>
          <path
            d="M12 32h2v-4h-2v4zm2-4h2v-3h-2v3zm2-3h3v-2h-3v2zm3-2h3v-3h-3v3zm3-3h4v-2h-4v2zm4-2h3v-3h-3v3z"
            fill="#FF4757"
            opacity={0.92}
          />
          <path
            d="M32 14h4v2h-4v-2zm4 2h3v2h-3v-2zm3 2h4v2h-4v-2zm4 2h3v3h-3v-3zm-9-8h2v3h-2v-3z"
            fill="#FFB020"
            opacity={0.8}
          />
        </>
      )}

      {/* Stage 3 (0% shattered): full shattered diagonal cross + dead pixel gaps */}
      {stage === 'shattered' && (
        <>
          <path
            d="M4 0h3v3H4V0zm3 3h3v3H7V3zm3 3h4v2h-4V6zm4 2h3v3h-3V8zm3 3h4v2h-4v-2zm4 2h3v3h-3v-3zm3 3h4v2h-4v-2zm16-6h4v2h-4v-2zm4 2h3v3h-3v-3zm3 3h4v2h-4v-2zm4 2h4v3h-4v-3zm-20 4h3v4h-3v-4zm3 4h3v4h-3v-4z"
            fill="#FF2E44"
            opacity={0.95}
          />
          <rect x="28" y="13" width="6" height="4" fill="#040509" opacity={0.85} />
          <rect x="18" y="6" width="3" height="2" fill="#FFFFFF" opacity={0.45} />
          <rect x="44" y="22" width="3" height="2" fill="#FFFFFF" opacity={0.45} />
        </>
      )}
    </svg>
  );
}
