import { memo } from 'react';
import type { BattleSituation } from '../engine/types.ts';

interface CyberBackdropProps {
  situation?: BattleSituation;
  pot?: number;
  playerLowCompute?: boolean;
  playerBankrupt?: boolean;
}

export const SITUATION_META: Record<
  BattleSituation,
  { label: string; code: string; firewallPct: number }
> = {
  recon: { label: '侦察潜伏', code: 'CODE : RECON', firewallPct: 94 },
  intrusion: { label: '协议交锋', code: 'CODE : INTRUSION', firewallPct: 68 },
  overclock: { label: '算力过载', code: 'CODE : OVERCLOCK', firewallPct: 36 },
  breach: { label: '核心熔断', code: 'CODE : BREACH', firewallPct: 8 },
  victory: { label: '破译接管', code: 'CODE : ROOT', firewallPct: 100 },
  disconnect: { label: '链路受阻', code: 'CODE : BLOCKED', firewallPct: 20 },
};

const DATA_STREAMS = [
  { left: '4%', tokens: '01001101  0x7F  SYN::ACK  B_08', speed: '14s', delay: '-2s', tone: 'cyan' },
  { left: '11%', tokens: 'PKT::PINK  110101  NODE_01  CRC', speed: '18s', delay: '-7s', tone: 'pink' },
  { left: '19%', tokens: '0xA4  HASH::0040  ICE::LINK  101', speed: '16s', delay: '-4s', tone: 'dim' },
  { left: '31%', tokens: '00110101  NET::BUS  0x1C  PORT', speed: '22s', delay: '-11s', tone: 'dim' },
  { left: '69%', tokens: '10101100  MEM::ALLOC  0x9E  ACK', speed: '21s', delay: '-6s', tone: 'dim' },
  { left: '80%', tokens: '0xFF  STREAM::P12  010110  SYNC', speed: '15s', delay: '-3s', tone: 'cyan' },
  { left: '88%', tokens: 'HEX::2E88  110010  OVR::04  BIT', speed: '17s', delay: '-9s', tone: 'pink' },
  { left: '95%', tokens: '01110010  ROOT::SYS  0x00  END', speed: '13s', delay: '-5s', tone: 'cyan' },
];

const PIXEL_MOTES = [
  { left: '8%', top: '28%', delay: '0s', cyan: true },
  { left: '16%', top: '68%', delay: '-2.1s', cyan: false },
  { left: '24%', top: '18%', delay: '-3.5s', cyan: true },
  { left: '76%', top: '22%', delay: '-1.4s', cyan: false },
  { left: '84%', top: '62%', delay: '-3.6s', cyan: true },
  { left: '92%', top: '42%', delay: '-0.8s', cyan: false },
];

/**
 * Dynamic Pixel Data-Stream Backdrop (Last-Command Pitch-Black Aesthetic):
 * - Pitch-black void + faint dark monochrome pixel monolith silhouettes
 * - Scrolling vertical hex/binary pixel data streams
 * - Animated stepped SVG data-bus traces with traveling packet pulses
 */
export const CyberBackdrop = memo(function CyberBackdrop({
  situation = 'recon',
  pot = 60,
  playerLowCompute = false,
  playerBankrupt = false,
}: CyberBackdropProps) {
  const speedBoost = Math.min(4, Math.floor(pot / 80));

  return (
    <div
      className={`lc-backdrop situation-${situation} ${
        playerLowCompute ? 'is-player-low' : ''
      } ${playerBankrupt ? 'is-player-bankrupt' : ''}`}
      aria-hidden="true"
    >
      {/* Deep dark monochrome silhouettes + stepped pixel circuit bus traces */}
      <svg
        viewBox="0 0 1280 720"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        className="lc-banners-svg"
      >
        {/* Subtle dark pixel monolith silhouettes on outer edges */}
        <g fill="#0a0c12">
          <rect x="34" y="190" width="56" height="330" />
          <rect x="28" y="182" width="68" height="8" fill="#121620" />
          <rect x="1190" y="190" width="56" height="330" />
          <rect x="1184" y="182" width="68" height="8" fill="#121620" />
        </g>

        {/* Orthogonal pixel data-bus guide rails */}
        <g fill="none" stroke="#131926" strokeWidth="2">
          <path d="M0,148 H260 L292,180 H988 L1020,148 H1280" />
          <path d="M0,360 H220 M1060,360 H1280" />
          <path d="M0,564 H250 L282,532 H998 L1030,564 H1280" />
        </g>

        {/* Traveling glowing pixel data-bus pulses */}
        <path
          d="M0,148 H260 L292,180 H988 L1020,148 H1280"
          fill="none"
          stroke="#00F0FF"
          strokeWidth="2"
          className="lc-bus-pulse cyan"
        />
        <path
          d="M1280,564 H1030 L998,532 H282 L250,564 H0"
          fill="none"
          stroke="#FF2E88"
          strokeWidth="2"
          className="lc-bus-pulse pink"
        />

        {/* Stepped 8-bit square-wave telemetry horizon */}
        <path
          d="M0,360 H140 V344 H176 V376 H212 V360 H1068 V344 H1104 V376 H1140 V360 H1280"
          fill="none"
          stroke="#1f3147"
          strokeWidth="2"
        />
      </svg>

      {/* Scrolling vertical pixel data streams */}
      <div className="lc-data-rain">
        {DATA_STREAMS.map((stream, idx) => {
          const duration = Math.max(8, parseInt(stream.speed, 10) - speedBoost);
          return (
            <div
              key={idx}
              className={`lc-rain-col tone-${stream.tone}`}
              style={{
                left: stream.left,
                animationDuration: `${duration}s`,
                animationDelay: stream.delay,
              }}
            >
              <span>{stream.tokens}</span>
              <span>{stream.tokens}</span>
              <span>{stream.tokens}</span>
            </div>
          );
        })}
      </div>

      {/* Floating crisp 4px pixel motes */}
      <div className="lc-pixel-motes">
        {PIXEL_MOTES.map((m, idx) => (
          <span
            key={idx}
            className={`lc-mote ${m.cyan ? 'cyan' : ''}`}
            style={{ left: m.left, top: m.top, animationDelay: m.delay }}
          />
        ))}
      </div>

      <div className="lc-scanlines" />
    </div>
  );
});
