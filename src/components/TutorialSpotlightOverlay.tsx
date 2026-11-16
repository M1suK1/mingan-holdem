import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  clampSpotlightRect,
  type ClampedSpotlightRect,
  type SpotlightPlan,
  type SpotlightTargetSpec,
} from '../engine/tutorialSpotlight';

interface MeasuredSpotlightBox {
  spec: SpotlightTargetSpec;
  rect: ClampedSpotlightRect;
}

interface MeasuredArrow {
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  label?: string;
  tone: 'cyan' | 'amber';
}

interface TutorialSpotlightOverlayProps {
  plan: SpotlightPlan;
  mobileChatOpen: boolean;
}

function isElementVisibleInViewport(el: HTMLElement, vw: number, vh: number): boolean {
  const raw = el.getBoundingClientRect();
  if (raw.width <= 1 || raw.height <= 1) return false;
  if (raw.right <= 0 || raw.left >= vw || raw.bottom <= 0 || raw.top >= vh) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  return true;
}

export function TutorialSpotlightOverlay({
  plan,
  mobileChatOpen,
}: TutorialSpotlightOverlayProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `lc-spotlight-mask-${uid}`;
  const arrowId = `lc-spotlight-arrow-${uid}`;

  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  });
  const [boxes, setBoxes] = useState<MeasuredSpotlightBox[]>([]);
  const [arrow, setArrow] = useState<MeasuredArrow | null>(null);
  const lastMeasureSigRef = useRef<string>('');

  const measure = useCallback(() => {
    if (!plan.active || typeof window === 'undefined' || typeof document === 'undefined') {
      if (lastMeasureSigRef.current !== 'off') {
        lastMeasureSigRef.current = 'off';
        setBoxes([]);
        setArrow(null);
      }
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    setViewport((prev) => (prev.w === vw && prev.h === vh ? prev : { w: vw, h: vh }));

    const isMobileNarrow = vw <= 960;
    const activeSpecs =
      isMobileNarrow && !mobileChatOpen && plan.mobileFallbackTargets?.length
        ? plan.mobileFallbackTargets
        : plan.targets;

    const nextBoxes: MeasuredSpotlightBox[] = [];
    const rectById = new Map<string, ClampedSpotlightRect>();

    for (const spec of activeSpecs) {
      const el = document.getElementById(spec.id);
      if (!el || !isElementVisibleInViewport(el, vw, vh)) continue;
      const raw = el.getBoundingClientRect();
      const clamped = clampSpotlightRect(raw, spec.padding ?? 6, vw, vh);
      if (clamped.width <= 0 || clamped.height <= 0) continue;
      nextBoxes.push({ spec, rect: clamped });
      rectById.set(spec.id, clamped);
    }

    let nextArrow: MeasuredArrow | null = null;
    if (plan.arrow) {
      const fromRect = rectById.get(plan.arrow.fromId);
      const toRect = rectById.get(plan.arrow.toId);
      if (fromRect && toRect) {
        const fromCx = fromRect.left + fromRect.width / 2;
        const fromCy = fromRect.top + fromRect.height / 2;
        const toCx = toRect.left + toRect.width / 2;
        const toCy = toRect.top + toRect.height / 2;

        // Start/end slightly closer to facing edges so arrowheads stay clear of card text
        const dx = toCx - fromCx;
        const dy = toCy - fromCy;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const startOffset = Math.min(28, Math.min(fromRect.width, fromRect.height) * 0.36);
        const endOffset = Math.min(30, Math.min(toRect.width, toRect.height) * 0.38);

        const x1 = fromCx + ux * startOffset;
        const y1 = fromCy + uy * startOffset;
        const x2 = toCx - ux * endOffset;
        const y2 = toCy - uy * endOffset;

        // Gentle perpendicular curve offset
        const curveOffset = Math.min(46, Math.max(18, dist * 0.14));
        const cx = (x1 + x2) / 2 - uy * curveOffset;
        const cy = (y1 + y2) / 2 + ux * curveOffset;
        const midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
        const midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;

        nextArrow = {
          x1,
          y1,
          cx,
          cy,
          x2,
          y2,
          midX,
          midY,
          label: plan.arrow.label,
          tone: plan.arrow.tone ?? 'cyan',
        };
      }
    }

    const sig = JSON.stringify({
      vw,
      vh,
      mode: plan.mode,
      b: nextBoxes.map((item) => [
        item.spec.id,
        item.spec.label ?? '',
        item.spec.tone ?? '',
        Boolean(item.spec.subtle),
        item.rect.left,
        item.rect.top,
        item.rect.width,
        item.rect.height,
      ]),
      a: nextArrow
        ? [
            Math.round(nextArrow.x1),
            Math.round(nextArrow.y1),
            Math.round(nextArrow.x2),
            Math.round(nextArrow.y2),
            nextArrow.label ?? '',
            nextArrow.tone,
          ]
        : null,
    });
    if (sig === lastMeasureSigRef.current) return;
    lastMeasureSigRef.current = sig;

    setBoxes(nextBoxes);
    setArrow(nextArrow);
  }, [plan, mobileChatOpen]);

  useEffect(() => {
    if (!plan.active) {
      lastMeasureSigRef.current = 'off';
      setBoxes([]);
      setArrow(null);
      return;
    }

    let rafId = 0;
    const scheduleMeasure = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    // Follow-up measurements while transition/floating-bubble animations settle
    const t1 = window.setTimeout(scheduleMeasure, 110);
    const t2 = window.setTimeout(scheduleMeasure, 280);

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    const shell = document.querySelector('.lc-shell');
    const resizeObs =
      typeof ResizeObserver !== 'undefined' && shell
        ? new ResizeObserver(scheduleMeasure)
        : null;
    if (resizeObs && shell) {
      resizeObs.observe(shell);
    }

    const mutObs =
      typeof MutationObserver !== 'undefined' && shell
        ? new MutationObserver((records) => {
            const onlySelf = records.every((rec) => {
              const node = rec.target;
              return node instanceof Element && node.closest('.lc-spotlight-layer') !== null;
            });
            if (!onlySelf) {
              scheduleMeasure();
            }
          })
        : null;
    if (mutObs && shell) {
      mutObs.observe(shell, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'disabled'],
      });
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      resizeObs?.disconnect();
      mutObs?.disconnect();
    };
  }, [plan, mobileChatOpen, measure]);

  if (!plan.active || boxes.length === 0) return null;

  return (
    <div
      className={`lc-spotlight-layer mode-${plan.mode}`}
      aria-hidden="true"
    >
      <svg
        className="lc-spotlight-svg"
        width={viewport.w}
        height={viewport.h}
        viewBox={`0 0 ${viewport.w} ${viewport.h}`}
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="white" />
            {boxes.map((b) => (
              <rect
                key={b.spec.id}
                x={b.rect.left}
                y={b.rect.top}
                width={b.rect.width}
                height={b.rect.height}
                rx={3}
                ry={3}
                fill="black"
              />
            ))}
          </mask>
          <marker
            id={arrowId}
            viewBox="0 0 12 12"
            refX="9"
            refY="6"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
          >
            <path
              d="M 1 1 L 11 6 L 1 11 L 3.5 6 Z"
              fill={arrow?.tone === 'amber' ? '#ffb020' : '#00f0ff'}
            />
          </marker>
        </defs>

        <rect
          x="0"
          y="0"
          width={viewport.w}
          height={viewport.h}
          fill={`rgba(2, 4, 10, ${plan.dimOpacity})`}
          mask={`url(#${maskId})`}
        />

        {arrow && (
          <g className={`lc-spotlight-arrow-group tone-${arrow.tone}`}>
            <path
              d={`M ${arrow.x1} ${arrow.y1} Q ${arrow.cx} ${arrow.cy} ${arrow.x2} ${arrow.y2}`}
              className="lc-spotlight-arrow-glow"
            />
            <path
              d={`M ${arrow.x1} ${arrow.y1} Q ${arrow.cx} ${arrow.cy} ${arrow.x2} ${arrow.y2}`}
              className="lc-spotlight-arrow-line"
              markerEnd={`url(#${arrowId})`}
            />
          </g>
        )}
      </svg>

      {boxes.map((b) => {
        const tone = b.spec.tone ?? 'cyan';
        const placeTagBelow = b.rect.top < 30;
        const tagLeft = Math.min(viewport.w - 140, Math.max(8, b.rect.left));
        return (
          <div
            key={b.spec.id}
            className={`lc-spotlight-reticle tone-${tone} ${b.spec.subtle ? 'is-subtle' : ''}`}
            style={{
              left: `${b.rect.left}px`,
              top: `${b.rect.top}px`,
              width: `${b.rect.width}px`,
              height: `${b.rect.height}px`,
            }}
          >
            {b.spec.label && !b.spec.subtle && (
              <span
                className={`lc-spotlight-tag tone-${tone} ${placeTagBelow ? 'is-below' : 'is-above'}`}
                style={{
                  maxWidth: `${Math.max(120, viewport.w - tagLeft - 12)}px`,
                }}
              >
                {b.spec.label}
              </span>
            )}
          </div>
        );
      })}

      {arrow?.label && (
        <div
          className={`lc-spotlight-arrow-label tone-${arrow.tone}`}
          style={{
            left: `${Math.round(arrow.midX)}px`,
            top: `${Math.round(arrow.midY)}px`,
          }}
        >
          {arrow.label}
        </div>
      )}
    </div>
  );
}
