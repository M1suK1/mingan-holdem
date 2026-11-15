import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Link2,
  PlugZap,
  Radio,
  RefreshCw,
  Unplug,
  Users,
  X,
} from 'lucide-react';
import type { P2pConnectionStatus, P2pRole } from '../engine/p2pTransport.ts';
import type { P2pPeerProfile } from '../engine/p2pProtocol.ts';
import { probeRoomSignaling } from '../engine/p2pTransport.ts';

interface P2pLobbyModalProps {
  status: P2pConnectionStatus;
  statusDetail: string;
  role: P2pRole | null;
  latencyMs: number | null;
  remotePeer: P2pPeerProfile | null;
  localPlayerName: string;
  offerToken: string;
  answerToken: string;
  roomCode: string;
  onChangeLocalName: (name: string) => void;
  onHostCreateRoomRelay: (code: string) => void;
  onGuestJoinRoomRelay: (code: string) => void;
  onHostCreateManualOffer: () => void;
  onGuestAcceptManualOffer: (offer: string) => void;
  onHostConfirmManualAnswer: (answer: string) => void;
  onDisconnect: () => void;
  onNotify: (tone: 'info' | 'success' | 'warn' | 'error', title: string, detail?: string) => void;
  onClose: () => void;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export default function P2pLobbyModal({
  status,
  statusDetail,
  role,
  latencyMs,
  remotePeer,
  localPlayerName,
  offerToken,
  answerToken,
  roomCode,
  onChangeLocalName,
  onHostCreateRoomRelay,
  onGuestJoinRoomRelay,
  onHostCreateManualOffer,
  onGuestAcceptManualOffer,
  onHostConfirmManualAnswer,
  onDisconnect,
  onNotify,
  onClose,
}: P2pLobbyModalProps) {
  const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'room' | 'manual'>('room');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [guestOfferInput, setGuestOfferInput] = useState('');
  const [hostAnswerInput, setHostAnswerInput] = useState('');

  useEffect(() => {
    let alive = true;
    void probeRoomSignaling().then((ok) => {
      if (!alive) return;
      setRelayAvailable(ok);
      if (!ok) setTab('manual');
    });
    return () => {
      alive = false;
    };
  }, []);

  const copyText = async (txt: string, label: string) => {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      onNotify('success', `已复制${label}`, '请发送给好友粘贴使用');
    } catch {
      onNotify('warn', '无法访问系统剪贴板', '请手动全选文本框内容复制');
    }
  };

  const isConnected = status === 'connected';
  const isBusy = status === 'gathering' || status === 'connecting';

  return (
    <div
      className="cyber-modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="p2p-modal-title"
    >
      <div className="cyber-modal-window">
        <div className="window-titlebar">
          <div className="window-title-left">
            <Users size={15} color="var(--neon-cyan)" aria-hidden="true" />
            <span id="p2p-modal-title">黑域 P2P 好友直连大厅 // WebRTC 端到端对战</span>
          </div>
          <button
            id="p2p-btn-close"
            type="button"
            className="os-nav-btn"
            onClick={onClose}
            aria-label="关闭 P2P 联机大厅"
          >
            <X size={15} aria-hidden="true" />
            关闭
          </button>
        </div>

        <div className="modal-content-scroll">
          <div className="cyber-panel-box" style={{ borderColor: isConnected ? 'var(--neon-emerald)' : 'var(--px-border-bright)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={15} color={isConnected ? 'var(--neon-emerald)' : 'var(--neon-cyan)'} aria-hidden="true" />
                <strong style={{ fontSize: 13 }}>
                  状态：{isConnected ? `已直连（${role === 'host' ? '房主权威端' : '客机端'}）` : statusDetail || '未连接'}
                </strong>
                {isConnected && latencyMs !== null && (
                  <span className="cyber-badge cyan">延迟 {latencyMs}ms</span>
                )}
              </div>
              {isConnected && (
                <button
                  id="p2p-btn-disconnect"
                  type="button"
                  className="os-nav-btn highlight"
                  onClick={onDisconnect}
                >
                  <Unplug size={13} aria-hidden="true" />
                  断开联机并切回单机
                </button>
              )}
            </div>

            {isConnected && remotePeer && (
              <div style={{ fontSize: 12, color: 'var(--neon-emerald)' }}>
                当前对战好友：{remotePeer.name}（{remotePeer.title} · {remotePeer.codename}）
              </div>
            )}

            <div className="form-field-row" style={{ marginTop: 4 }}>
              <label htmlFor="p2p-input-local-name">你的联机昵称（向好友显示）</label>
              <input
                id="p2p-input-local-name"
                type="text"
                className="cyber-text-input"
                style={{ maxWidth: 240 }}
                maxLength={20}
                value={localPlayerName}
                onChange={(e) => onChangeLocalName(e.target.value)}
              />
            </div>
          </div>

          {!isConnected && (
            <>
              <div className="modal-tab-strip" role="tablist" style={{ padding: 0, borderBottom: '1px solid var(--px-border)' }}>
                <button
                  id="p2p-tab-room"
                  type="button"
                  role="tab"
                  aria-selected={tab === 'room'}
                  className={`modal-tab-btn ${tab === 'room' ? 'active' : ''}`}
                  onClick={() => setTab('room')}
                >
                  <PlugZap size={14} aria-hidden="true" />
                  6 位房间号秒连 {relayAvailable ? '(本服务就绪)' : '(需 Vite 信令)'}
                </button>
                <button
                  id="p2p-tab-manual"
                  type="button"
                  role="tab"
                  aria-selected={tab === 'manual'}
                  className={`modal-tab-btn ${tab === 'manual' ? 'active' : ''}`}
                  onClick={() => setTab('manual')}
                >
                  <Link2 size={14} aria-hidden="true" />
                  零服务器邀请码直连（任意网络通用）
                </button>
              </div>

              {tab === 'room' ? (
                <div className="cmd-grid cols-2">
                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--neon-cyan-soft)' }}>
                      我是房主 · 创建 6 位房间号
                    </strong>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      双方通过同一 Vite 服务（局域网 / 内网穿透端口）访问时，创建房间后把 6 位房间号发给好友即可自动建立 P2P 直连。
                    </div>
                    <button
                      id="p2p-btn-room-create"
                      type="button"
                      className="cyber-cmd-btn primary-cyan"
                      disabled={isBusy || !relayAvailable}
                      onClick={() => onHostCreateRoomRelay(generateRoomCode())}
                    >
                      <RefreshCw size={14} aria-hidden="true" />
                      {roomCode ? `已建房：${roomCode}（等待好友加入）` : '生成房间号并等待好友'}
                    </button>
                    {roomCode && (
                      <button
                        id="p2p-btn-copy-room-code"
                        type="button"
                        className="os-nav-btn"
                        onClick={() => void copyText(roomCode, '房间号')}
                      >
                        <Copy size={13} aria-hidden="true" />
                        复制房间号：{roomCode}
                      </button>
                    )}
                  </div>

                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--neon-pink-soft)' }}>
                      我是好友 · 输入房间号加入
                    </strong>
                    <input
                      id="p2p-input-join-room"
                      type="text"
                      className="cyber-text-input"
                      placeholder="输入 6 位房间号（如 A7K9P2）"
                      maxLength={12}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    />
                    <button
                      id="p2p-btn-room-join"
                      type="button"
                      className="cyber-cmd-btn primary-pink"
                      disabled={isBusy || !relayAvailable || joinCodeInput.trim().length < 4}
                      onClick={() => onGuestJoinRoomRelay(joinCodeInput.trim())}
                    >
                      <Check size={14} aria-hidden="true" />
                      连接房间并开战
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cmd-grid cols-2">
                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--neon-cyan-soft)' }}>
                      房主流程（零服务器）
                    </strong>
                    <button
                      id="p2p-btn-manual-create-offer"
                      type="button"
                      className="cyber-cmd-btn primary-cyan"
                      disabled={isBusy}
                      onClick={onHostCreateManualOffer}
                    >
                      1. 生成房间邀请码 (Offer)
                    </button>
                    {offerToken && (
                      <>
                        <textarea
                          id="p2p-textarea-offer-out"
                          rows={3}
                          readOnly
                          className="cyber-text-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
                          value={offerToken}
                        />
                        <button
                          id="p2p-btn-copy-offer"
                          type="button"
                          className="os-nav-btn"
                          onClick={() => void copyText(offerToken, 'Offer 邀请码')}
                        >
                          <Copy size={13} aria-hidden="true" />
                          复制邀请码发给好友
                        </button>
                      </>
                    )}
                    <label htmlFor="p2p-textarea-answer-in" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      3. 粘贴好友发回的 Answer 应答码：
                    </label>
                    <textarea
                      id="p2p-textarea-answer-in"
                      rows={2}
                      className="cyber-text-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
                      placeholder="粘贴好友发回的 MGP2P:... 应答码"
                      value={hostAnswerInput}
                      onChange={(e) => setHostAnswerInput(e.target.value)}
                    />
                    <button
                      id="p2p-btn-confirm-answer"
                      type="button"
                      className="cyber-cmd-btn"
                      disabled={!offerToken || !hostAnswerInput.trim() || isBusy}
                      onClick={() => onHostConfirmManualAnswer(hostAnswerInput)}
                    >
                      确认应答并建立 P2P 直连
                    </button>
                  </div>

                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 13, color: 'var(--neon-pink-soft)' }}>
                      好友加入流程（零服务器）
                    </strong>
                    <label htmlFor="p2p-textarea-offer-in" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      1. 粘贴房主发来的 Offer 邀请码：
                    </label>
                    <textarea
                      id="p2p-textarea-offer-in"
                      rows={3}
                      className="cyber-text-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
                      placeholder="粘贴房主的 MGP2P:... 邀请码"
                      value={guestOfferInput}
                      onChange={(e) => setGuestOfferInput(e.target.value)}
                    />
                    <button
                      id="p2p-btn-accept-offer"
                      type="button"
                      className="cyber-cmd-btn primary-pink"
                      disabled={!guestOfferInput.trim() || isBusy}
                      onClick={() => onGuestAcceptManualOffer(guestOfferInput)}
                    >
                      2. 生成我的 Answer 应答码
                    </button>
                    {answerToken && (
                      <>
                        <textarea
                          id="p2p-textarea-answer-out"
                          rows={3}
                          readOnly
                          className="cyber-text-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}
                          value={answerToken}
                        />
                        <button
                          id="p2p-btn-copy-answer"
                          type="button"
                          className="os-nav-btn highlight"
                          onClick={() => void copyText(answerToken, 'Answer 应答码')}
                        >
                          <Copy size={13} aria-hidden="true" />
                          复制应答码发回给房主
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="cyber-panel-box">
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  <strong>安全防泄密说明：</strong>联机采用「房主权威 + 客机视野脱敏投影」架构。房主向好友同步牌桌时会自动擦除未翻开公共节点、己方私有暗牌与未摊牌的黑客改牌数据，抓包亦无法偷看底牌。若双方处于严格对称 NAT 下偶发无法直连，推荐使用局域网/虚拟组网（Tailscale / ZeroTier）配合 6 位房间号秒连。
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
