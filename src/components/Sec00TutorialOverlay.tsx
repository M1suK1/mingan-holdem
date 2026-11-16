import {
  SEC00_MONOLOGUE_STEPS,
  type Sec00Guidance,
} from '../engine/sec00Tutorial.ts';
import { PixelChatIcon, PixelRestartIcon } from './CyberIcons.tsx';

interface Sec00TutorialOverlayProps {
  introStepIndex: number | null;
  guidance: Sec00Guidance;
  onSkipIntro: () => void;
  onOpenMobileChat: () => void;
  onRetrySec00: () => void;
  onDismissGuide: () => void;
}

export default function Sec00TutorialOverlay({
  introStepIndex,
  guidance,
  onSkipIntro,
  onOpenMobileChat,
  onRetrySec00,
  onDismissGuide,
}: Sec00TutorialOverlayProps) {
  if (introStepIndex !== null) {
    const step = SEC00_MONOLOGUE_STEPS[introStepIndex] ?? SEC00_MONOLOGUE_STEPS[0];
    return (
      <section
        id="lc-tutorial-guide-bar"
        className="lc-tutorial-bar"
        aria-label="SEC-00 开局自言自语引导栏"
      >
        <div className="lc-tutorial-head">
          <div className="lc-tutorial-title-wrap">
            <span className="lc-tutorial-badge">{step.tag}</span>
            <strong className="lc-tutorial-title">开局独白进行中 · 请查看右侧通讯栏虚线独白框</strong>
          </div>

          <div className="lc-tutorial-actions">
            <button
              id="sec00-bar-open-chat"
              type="button"
              className="lc-tutorial-btn primary lc-mobile-chat-btn"
              onClick={onOpenMobileChat}
            >
              <PixelChatIcon size={12} />
              打开通讯栏看独白
            </button>
            <button
              id="sec00-bar-skip-intro"
              type="button"
              className="lc-tutorial-btn"
              onClick={onSkipIntro}
            >
              跳过独白直接开操
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="lc-tutorial-guide-bar"
      className={`lc-tutorial-bar ${guidance.completed ? 'is-passed' : ''}`}
      aria-label="SEC-00 教学实操引导栏"
    >
      <div className="lc-tutorial-head">
        <div className="lc-tutorial-title-wrap">
          <span className="lc-tutorial-badge">{guidance.badge}</span>
          <strong className="lc-tutorial-title">{guidance.title}</strong>
        </div>

        <div className="lc-tutorial-actions">
          <button
            id="sec00-btn-retry"
            type="button"
            className="lc-tutorial-btn"
            onClick={onRetrySec00}
          >
            <PixelRestartIcon size={12} />
            重开 SEC-00 教学
          </button>
          <button
            id="sec00-btn-skip-guide"
            type="button"
            className="lc-tutorial-btn danger"
            onClick={onDismissGuide}
          >
            关闭引导自由打
          </button>
        </div>
      </div>

      <div className="lc-tutorial-body">
        <div className="lc-tutorial-instruction">{guidance.instruction}</div>
        <div className="lc-tutorial-subnote">{guidance.subNote}</div>
      </div>
    </section>
  );
}
