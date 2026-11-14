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
  recon: { label: '侦察潜伏', code: 'SEC_LEVEL_01 // RECON', firewallPct: 94 },
  intrusion: { label: '协议交锋', code: 'SEC_LEVEL_02 // INTRUSION', firewallPct: 68 },
  overclock: { label: '算力过载', code: 'SEC_LEVEL_03 // OVERCLOCK', firewallPct: 36 },
  breach: { label: '核心熔断', code: 'CRITICAL // ALL_IN_BREACH', firewallPct: 8 },
  victory: { label: '破译接管', code: 'ROOT_ACCESS // GRANTED', firewallPct: 100 },
  disconnect: { label: '链路受阻', code: 'ICE_COUNTER // BLOCKED', firewallPct: 20 },
};

const HEX_COLUMNS = [
  '0x7F A4 19 C2 8E FF 01 4B',
  'PKT::SYNC 99 2E 88 D0 41',
  'ICE::NODE 00 F0 FF 7A 13',
  'HASH::4C 9B E2 10 77 C8',
  'PORT::5178 ACK 3D 9F 02',
  'CIPHER::B0 P1 14 0E 6A',
];

export const CyberBackdrop = memo(function CyberBackdrop({
  situation,
  pot,
}: CyberBackdropProps) {
  return (
    <div
      className={`cyber-backdrop situation-${situation}`}
      data-situation={situation}
      aria-hidden="true"
    >
      {/* Dynamic radial aura responding to situation */}
      <div className="cyber-aura-layer" />

      {/* 3D perspective cyberspace matrix floor */}
      <div className="cyber-grid-horizon">
        <div className="cyber-grid-plane" />
      </div>

      {/* Vertical flowing packet telemetry columns */}
      <div className="cyber-data-streams">
        {HEX_COLUMNS.map((text, idx) => (
          <div
            key={idx}
            className={`data-stream-col col-${idx + 1}`}
            style={{ animationDuration: `${14 - Math.min(7, Math.floor(pot / 45)) + idx * 1.7}s` }}
          >
            <span>{text}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* Dynamic Battleground Signal Waveform */}
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          top: '18%',
          left: 0,
          width: '100%',
          height: '140px',
          opacity: situation === 'breach' || situation === 'overclock' ? 0.34 : 0.16,
          transition: 'opacity 0.6s ease',
        }}
      >
        <path
          d={
            situation === 'breach'
              ? 'M0,80 L180,80 L220,18 L260,142 L310,30 L360,130 L420,80 L720,80 L760,12 L810,148 L860,26 L920,80 L1440,80'
              : situation === 'overclock'
                ? 'M0,80 Q180,10 360,80 T720,80 T1080,80 T1440,80'
                : situation === 'intrusion'
                  ? 'M0,80 Q240,42 480,80 T960,80 T1440,80'
                  : 'M0,80 Q360,66 720,80 T1440,80'
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
          strokeWidth="1.6"
        />
      </svg>

      {/* Subtle CRT / Tactical HUD scanlines & corner brackets */}
      <div className="cyber-scanlines" />
      <div className="hud-corner corner-tl" />
      <div className="hud-corner corner-tr" />
      <div className="hud-corner corner-bl" />
      <div className="hud-corner corner-br" />
    </div>
  );
});
