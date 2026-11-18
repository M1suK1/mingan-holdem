export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const PORTRAIT_TEAR_SLICES = [
  { top: 0, bottom: 84, cls: 'slice-a' },
  { top: 15, bottom: 71, cls: 'slice-b' },
  { top: 28, bottom: 56, cls: 'slice-c' },
  { top: 43, bottom: 40, cls: 'slice-d' },
  { top: 59, bottom: 23, cls: 'slice-e' },
  { top: 76, bottom: 0, cls: 'slice-f' },
] as const;

export const MOSAIC_FLICKER_SHARDS = Array.from({ length: 52 }, (_, i) => {
  const w = 3.5 + seededUnit(i + 301) * 22;
  const h = 2.2 + seededUnit(i + 353) * 11;
  const left = seededUnit(i + 401) * (100 - w * 0.6);
  const top = seededUnit(i + 449) * (100 - h * 0.6);
  const t = seededUnit(i + 503);
  const tone = t < 0.28 ? 't1' : t < 0.56 ? 't2' : t < 0.84 ? 't3' : 't4';
  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
    width: `${w.toFixed(1)}%`,
    height: `${h.toFixed(1)}%`,
    tone,
  };
});

export const MOSAIC_FLOOD_SHARDS = Array.from({ length: 68 }, (_, i) => {
  const w = 5 + seededUnit(i + 601) * 26;
  const h = 3.5 + seededUnit(i + 653) * 15;
  const left = seededUnit(i + 701) * (100 - w * 0.5);
  const top = seededUnit(i + 751) * (100 - h * 0.5);
  const t = seededUnit(i + 809);
  const tone = t < 0.26 ? 'pink' : t < 0.48 ? 'cyan' : t < 0.82 ? 'void' : 'red';
  const delay = (seededUnit(i + 863) * 0.55).toFixed(2);
  return {
    left: `${left.toFixed(1)}%`,
    top: `${top.toFixed(1)}%`,
    width: `${w.toFixed(1)}%`,
    height: `${h.toFixed(1)}%`,
    tone,
    delay: `${delay}s`,
  };
});
