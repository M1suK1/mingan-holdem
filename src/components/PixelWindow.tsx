import type { CSSProperties, ReactNode } from 'react';
import { X } from 'lucide-react';

interface PixelWindowProps {
  title: string;
  code?: string;
  accentColor?: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  className?: string;
  bodyClassName?: string;
  activeGlow?: boolean;
  closeButtonId?: string;
  onClose?: () => void;
  ariaLabel?: string;
  role?: 'region' | 'dialog' | 'complementary';
  children: ReactNode;
}

/**
 * Reusable Retro Pixel Cyber-Windows OS Frame.
 * Supports custom accentColor (used to wrap the Opponent Portrait in her signature contract color!).
 */
export function PixelWindow({
  title,
  code,
  accentColor,
  icon,
  headerRight,
  className = '',
  bodyClassName = '',
  activeGlow = false,
  closeButtonId,
  onClose,
  ariaLabel,
  role,
  children,
}: PixelWindowProps) {
  const customStyle = accentColor
    ? ({ '--win-accent': accentColor } as CSSProperties)
    : undefined;

  return (
    <section
      className={`px-win ${activeGlow ? 'px-win-active' : ''} ${accentColor ? 'px-win-tinted' : ''} ${className}`}
      style={customStyle}
      aria-label={ariaLabel ?? title}
      role={role}
    >
      <div className="px-titlebar">
        <div className="px-title-left">
          <span className="px-title-sq" aria-hidden="true" />
          {icon}
          <span className="px-title-text">{title}</span>
        </div>

        <div className="px-title-dither" aria-hidden="true" />

        <div className="px-title-right">
          {headerRight}
          {code && <span className="px-win-code">{code}</span>}
          {onClose && closeButtonId ? (
            <button
              id={closeButtonId}
              type="button"
              className="px-win-close-btn"
              onClick={onClose}
              aria-label={`关闭${title}`}
            >
              <X size={13} aria-hidden="true" />
            </button>
          ) : (
            <span className="px-win-deco-btns" aria-hidden="true">
              <i className="px-deco-box">_</i>
              <i className="px-deco-box">□</i>
            </span>
          )}
        </div>
      </div>

      <div className={`px-win-body ${bodyClassName}`}>{children}</div>
    </section>
  );
}
