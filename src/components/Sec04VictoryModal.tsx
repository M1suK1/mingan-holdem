import { resolveEcho0Sprite, resolveSec04Sprite } from '../engine/storyCharacters.ts';
import {
  PixelCheckIcon,
  PixelNodesIcon,
  PixelSeverIcon,
  PixelSurgeIcon,
} from './CyberIcons.tsx';

interface Sec04VictoryModalProps {
  playerCodename: string;
  potWon: number;
  humanChips: number;
  aiRemainingChips: number;
  foldCount: number;
  onConfirmEscape: () => void;
  onStayReview: () => void;
}

export default function Sec04VictoryModal({
  playerCodename,
  potWon,
  humanChips,
  aiRemainingChips,
  foldCount,
  onConfirmEscape,
  onStayReview,
}: Sec04VictoryModalProps) {
  return (
    <div
      className="lc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sec04-victory-title"
    >
      <div className="lc-hud-box lc-sec04-victory-modal">
        <div className="lc-sec04-victory-banner">
          <PixelSurgeIcon size={15} />
          <span>BLACKBOX PRIORITY-1 // 猎杀榜 NO.1 突围成功</span>
        </div>

        <h2 id="sec04-victory-title" className="lc-sec04-victory-title">
          零号离线闸门破防 · 绝命覆写「四条 A」
        </h2>

        <div className="lc-sec04-victory-portraits">
          <div className="lc-sec04-vp-card is-echo0">
            <img src={resolveEcho0Sprite('err2')} alt="ECHO-0" className="lc-sec04-vp-img" />
            <div className="lc-sec04-vp-meta">
              <span className="lc-micro-tag cyan">{playerCodename} // SHELL://ECHO-0</span>
              <strong>四条 A（AAAA + J）</strong>
              <span className="lc-sec04-vp-sub">绝命覆写生效 · 赢取底池 {potWon}</span>
            </div>
          </div>

          <div className="lc-sec04-vp-vs">
            <PixelCheckIcon size={16} />
            <span>四条 &gt; 同花顺</span>
          </div>

          <div className="lc-sec04-vp-card is-kiri04">
            <img src={resolveSec04Sprite('sad')} alt="绯凪·千夜" className="lc-sec04-vp-img" />
            <div className="lc-sec04-vp-meta">
              <span className="lc-micro-tag pink">KIRI-04 // 绯凪·千夜</span>
              <strong>黑曜同花顺（K-Q-J-10-9）</strong>
              <span className="lc-sec04-vp-sub">
                残余算力 {aiRemainingChips}（暴走透支丧失追击能力）
              </span>
            </div>
          </div>
        </div>

        <div className="lc-sec04-victory-log">
          <p>
            <strong>「绝命覆写 // FOUR ACES」：</strong>
            在全部回溯锚点碎裂、公共区 4/4 火符封死且弃牌退路锁闭（累计弃牌 {foldCount}/3）的绝境瞬间，ECHO-0
            献祭全部剩余黑客权限抑制火符引爆，强行将手牌重写为三枚 A 并联动公共区唯一天然 A 构成四条 A。
          </p>
          <p>
            <strong>「强制断连 · 逃出生天」：</strong>
            绯凪·千夜虽仍保留 {aiRemainingChips} 点残余算力，但开启暴走维持全火符与超限重注已严重透支神经过载，遭遇四条 A
            反杀后无力再维持闸门封锁与追捕。{playerCodename}（当前算力 {humanChips}）当即强制断开牌桌连接，穿过熄灭的苍红火墙冲向 EXIT-RL 现实终端出口。
          </p>
        </div>

        <div className="lc-sec04-victory-actions">
          <button
            id="sec04-victory-escape-btn"
            type="button"
            className="lc-stack-btn"
            onClick={onConfirmEscape}
          >
            <span className="lc-btn-inline">
              <PixelNodesIcon size={15} />
              断开牌桌 · 逃往 EXIT-RL 现实出口
            </span>
            <span className="lc-stack-sub">标记 SEC-04 通关并推进第一章终局突围</span>
          </button>

          <button
            id="sec04-victory-stay-btn"
            type="button"
            className="lc-escape-btn"
            onClick={onStayReview}
          >
            <PixelSeverIcon size={14} />
            <span>留在本桌查看终局牌面</span>
          </button>
        </div>
      </div>
    </div>
  );
}
