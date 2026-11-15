import { memo } from 'react';
import type { BattleSituation } from '../engine/types.ts';

interface CyberBackdropProps {
  situation: BattleSituation;
  pot: number;
}

export const SITUATION_META: Record<
  BattleSituation,
  { label: string; code: string; firewallPct: number }
> = {
  recon: { label: '侦察潜伏', code: 'PIXEL_OS // SEC_01_RECON', firewallPct: 94 },
  intrusion: { label: '协议交锋', code: 'PIXEL_OS // SEC_02_INTRUSION', firewallPct: 68 },
  overclock: { label: '算力过载', code: 'PIXEL_OS // SEC_03_OVERCLOCK', firewallPct: 36 },
  breach: { label: '核心熔断', code: 'PIXEL_OS // ALERT_ALL_IN', firewallPct: 8 },
  victory: { label: '破译接管', code: 'PIXEL_OS // ROOT_GRANTED', firewallPct: 100 },
  disconnect: { label: '链路受阻', code: 'PIXEL_OS // ICE_BLOCKED', firewallPct: 20 },
};

const PIXEL_STREAMS = [
  '01001110 0x7F [SYN]',
  '11010010 PKT::PINK',
  '00110101 ICE::NODE',
  '10101100 HASH::B0P1',
  '01110010 PORT::5178',
];

export const CyberBackdrop = memo(function CyberBackdrop({
  situation,
  pot,
}: CyberBackdropProps) {
  return (
    <div
      className={`px-backdrop situation-${situation}`}
      data-situation={situation}
      aria-hidden="true"
    >
      <div className="px-dither-bg" />
      <div className="px-grid-floor" />

      {/* Stepped 8-bit square-wave telemetry line */}
      <svg
        viewBox="0 0 640 80"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className="px-wave-svg"
      >
        <path
          d={
            situation === 'breach'
              ? 'M0,40 H80 V10 H110 V70 H140 V16 H170 V64 H210 V40 H360 V8 H390 V72 H430 V20 H470 V40 H640'
              : situation === 'overclock'
                ? 'M0,40 H90 V20 H150 V60 H210 V20 H270 V40 H410 V18 H470 V62 H530 V40 H640'
                : situation === 'intrusion'
                  ? 'M0,40 H120 V28 H200 V52 H280 V40 H440 V28 H520 V52 H640'
                  : 'M0,40 H200 V34 H280 V46 H360 V40 H640'
          }
          fill="none"
          stroke={
            situation === 'breach'
              ? '#FF4757'
              : situation === 'overclock' || situation === 'intrusion'
                ? '#FF2E88'
                : situation === 'victory'
                  ? '#10F5A0'
                  : '#00F0FF'
          }
          strokeWidth="2"
        />
      </svg>

      <div className="px-data-rain">
        {PIXEL_STREAMS.map((txt, idx) => (
          <div
            key={idx}
            className="px-rain-col"
            style={{ animationDuration: `${13 - Math.min(6, Math.floor(pot / 50)) + idx * 1.8}s` }}
          >
            <span>{txt}</span>
            <span>{txt}</span>
          </div>
        ))}
      </div>

      <div className="px-crt-scanlines" />
    </div>
  );
});
