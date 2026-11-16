import { BookOpen, CheckCircle2, RotateCcw, SkipForward } from 'lucide-react';
import {
  TUTORIAL_STAGES,
  type TutorialGuidance,
} from '../engine/tutorial.ts';

interface TutorialOverlayBarProps {
  stageIndex: number;
  guidance: TutorialGuidance;
  onNextStage: () => void;
  onRetryStage: () => void;
  onExitTutorial: () => void;
}

export default function TutorialOverlayBar({
  stageIndex,
  guidance,
  onNextStage,
  onRetryStage,
  onExitTutorial,
}: TutorialOverlayBarProps) {
  const meta = TUTORIAL_STAGES[stageIndex] ?? TUTORIAL_STAGES[0];
  const isFinalStage = stageIndex >= TUTORIAL_STAGES.length - 1;

  return (
    <section
      id="lc-tutorial-guide-bar"
      className={`lc-tutorial-bar ${guidance.stagePassed ? 'is-passed' : ''}`}
      aria-label="新手教学引导栏"
    >
      <div className="lc-tutorial-head">
        <div className="lc-tutorial-title-wrap">
          <BookOpen size={14} color="var(--neon-cyan)" aria-hidden="true" />
          <span className="lc-tutorial-badge">{meta.badge}</span>
          <strong className="lc-tutorial-title">{meta.title}</strong>
        </div>

        <div className="lc-tutorial-actions">
          {guidance.stagePassed && (
            <button
              id="tutorial-btn-next"
              type="button"
              className="lc-tutorial-btn primary"
              onClick={onNextStage}
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              {isFinalStage ? '完成教程进入实战' : '下一关'}
            </button>
          )}
          <button
            id="tutorial-btn-retry"
            type="button"
            className="lc-tutorial-btn"
            onClick={onRetryStage}
          >
            <RotateCcw size={12} aria-hidden="true" />
            重练本关
          </button>
          <button
            id="tutorial-btn-exit"
            type="button"
            className="lc-tutorial-btn danger"
            onClick={onExitTutorial}
          >
            <SkipForward size={12} aria-hidden="true" />
            退出教程
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
