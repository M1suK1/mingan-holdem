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
  const [relayAvailable, setRelayAvailable] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [guestOfferInput, setGuestOfferInput] = useState('');
  const [hostAnswerInput, setHostAnswerInput] = useState('');

  useEffect(() => {
    let alive = true;
    void probeRoomSignaling().then((ok) => {
      if (alive) setRelayAvailable(ok);
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
            <span id="p2p-modal-title">黑域 P2P 好友直连大厅 // 邀请码与房间号直连</span>
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
          <div
            className="cyber-panel-box"
            style={{ borderColor: isConnected ? 'var(--neon-emerald)' : 'var(--px-border-bright)' }}
          >
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
              {/* 方式一：零服务器邀请码直连（默认首屏直接展示，方便一键复制/粘贴） */}
              <div className="cyber-panel-box">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--neon-cyan-soft)' }}>
                  <Link2 size={14} aria-hidden="true" />
                  方式一：零服务器邀请码直连（任意网络/纯静态打开均可直接复制发送）
                </div>
                <div className="cmd-grid cols-2">
                  <div className="cyber-panel-box">
                    <strong style={{ fontSize: 12.5, color: 'var(--neon-cyan-soft)' }}>
                      我是房主 · 建房并生成邀请码
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
                          className="os-nav-btn highlight"
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
                    <strong style={{ fontSize: 12.5, color: 'var(--neon-pink-soft)' }}>
                      我是好友 · 粘贴邀请码并回传应答码
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
              </div>

              {/* 方式二：6 位房间号秒连（同服务下自动中继信令） */}
              <div className="cyber-panel-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--text-main)' }}>
                    <PlugZap size={14} aria-hidden="true" />
                    方式二：6 位房间号秒连
                  </span>
                  <span className={`cyber-badge ${relayAvailable ? 'cyan' : 'pink'}`}>
                    {relayAvailable ? '当前 Vite 信令服务可用' : '纯静态模式不可用（请用上方邀请码）'}
                  </span>
                </div>
                <div className="cmd-grid cols-2">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      id="p2p-btn-room-create"
                      type="button"
                      className="os-nav-btn highlight"
                      disabled={isBusy || !relayAvailable}
                      onClick={() => onHostCreateRoomRelay(generateRoomCode())}
                    >
                      <RefreshCw size={13} aria-hidden="true" />
                      {roomCode ? `已建房：${roomCode}` : '生成 6 位房间号'}
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

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      id="p2p-input-join-room"
                      type="text"
                      className="cyber-text-input"
                      style={{ flex: 1 }}
                      placeholder="输入 6 位房间号"
                      maxLength={12}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                    />
                    <button
                      id="p2p-btn-room-join"
                      type="button"
                      className="os-nav-btn highlight"
                      disabled={isBusy || !relayAvailable || joinCodeInput.trim().length < 4}
                      onClick={() => onGuestJoinRoomRelay(joinCodeInput.trim())}
                    >
                      <Check size={13} aria-hidden="true" />
                      加入
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
