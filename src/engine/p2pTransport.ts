import {
  P2pChunkAssembler,
  decodeP2pSignalToken,
  encodeP2pSignalToken,
  splitP2pWireMessage,
  type P2pPacket,
} from './p2pProtocol.ts';

export type P2pConnectionStatus = 'idle' | 'gathering' | 'waiting-answer' | 'connecting' | 'connected' | 'closed' | 'error';
export type P2pRole = 'host' | 'guest';

export interface P2pTransportCallbacks {
  onStatusChange: (status: P2pConnectionStatus, detail?: string) => void;
  onPacket: (packet: P2pPacket) => void;
  onLatency?: (rttMs: number) => void;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

async function waitForIceGathering(pc: RTCPeerConnection, maxWaitMs = 3400): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.removeEventListener('icegatheringstatechange', onState);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    pc.addEventListener('icegatheringstatechange', onState);
    window.setTimeout(finish, maxWaitMs);
  });
}

export class WebRtcP2pTransport {
  readonly role: P2pRole;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private pingTimer: number | null = null;
  private readonly chunkAssembler = new P2pChunkAssembler();
  private readonly callbacks: P2pTransportCallbacks;

  constructor(role: P2pRole, callbacks: P2pTransportCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
  }

  private setupPeerConnection(): RTCPeerConnection {
    if (this.pc) this.close();
    const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
    this.pc = pc;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.callbacks.onStatusChange('closed', 'ICE 网络穿透失败（可尝试切换同网 6 位房间号或检查防火墙）');
      } else if (pc.connectionState === 'disconnected') {
        this.callbacks.onStatusChange('connecting', '网络波动，正在尝试恢复 P2P 连接...');
      }
    };

    if (this.role === 'guest') {
      pc.ondatachannel = (ev) => {
        this.attachDataChannel(ev.channel);
      };
    }

    return pc;
  }

  private attachDataChannel(channel: RTCDataChannel): void {
    this.dc = channel;
    channel.onopen = () => {
      this.callbacks.onStatusChange('connected', 'P2P 数据通道已建立');
      this.startHeartbeat();
    };
    channel.onclose = () => {
      this.stopHeartbeat();
      this.callbacks.onStatusChange('closed', '联机通道已关闭');
    };
    channel.onerror = () => {
      this.callbacks.onStatusChange('error', 'P2P 数据传输异常');
    };
    channel.onmessage = (ev) => {
      try {
        const assembled = this.chunkAssembler.feed(String(ev.data));
        if (!assembled) return;
        const pkt = JSON.parse(assembled) as P2pPacket;
        if (pkt.type === 'PING') {
          this.send({ type: 'PONG', ts: pkt.ts });
          return;
        }
        if (pkt.type === 'PONG') {
          this.callbacks.onLatency?.(Math.max(1, Date.now() - pkt.ts));
          return;
        }
        this.callbacks.onPacket(pkt);
      } catch {
        // Ignore malformed packets
      }
    };
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'PING', ts: Date.now() });
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  async createHostOffer(): Promise<string> {
    if (this.role !== 'host') throw new Error('仅房主可创建 Offer');
    this.callbacks.onStatusChange('gathering', '正在收集网络穿透候选地址...');
    const pc = this.setupPeerConnection();
    const channel = pc.createDataChannel('mingan-p2p', { ordered: true });
    this.attachDataChannel(channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const localSdp = pc.localDescription?.sdp ?? offer.sdp ?? '';
    const token = await encodeP2pSignalToken({ kind: 'offer', sdp: localSdp });
    this.callbacks.onStatusChange('waiting-answer', '邀请码已就绪，请点击下方按钮复制 Offer 邀请码发给好友');
    return token;
  }

  async acceptHostOffer(offerToken: string): Promise<string> {
    if (this.role !== 'guest') throw new Error('仅客机可加入 Offer');
    const decoded = await decodeP2pSignalToken(offerToken);
    if (decoded.kind !== 'offer') throw new Error('请粘贴房主发来的 Offer 邀请码');

    this.callbacks.onStatusChange('gathering', '正在解析房主邀请并生成应答...');
    const pc = this.setupPeerConnection();
    await pc.setRemoteDescription({ type: 'offer', sdp: decoded.sdp });

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);

    const localSdp = pc.localDescription?.sdp ?? answer.sdp ?? '';
    const token = await encodeP2pSignalToken({ kind: 'answer', sdp: localSdp });
    this.callbacks.onStatusChange('connecting', '应答码已生成，请点击下方按钮复制并回传给房主');
    return token;
  }

  async completeHostAnswer(answerToken: string): Promise<void> {
    if (this.role !== 'host' || !this.pc) throw new Error('当前无等待应答的房间');
    const decoded = await decodeP2pSignalToken(answerToken);
    if (decoded.kind !== 'answer') throw new Error('请粘贴好友发回的 Answer 应答码');
    this.callbacks.onStatusChange('connecting', '正在建立端到端加密通道...');
    await this.pc.setRemoteDescription({ type: 'answer', sdp: decoded.sdp });
  }

  send(packet: P2pPacket): boolean {
    if (!this.dc || this.dc.readyState !== 'open') return false;
    try {
      const json = JSON.stringify(packet);
      const frames = splitP2pWireMessage(json, 14_000);
      for (const frame of frames) {
        this.dc.send(frame);
      }
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.stopHeartbeat();
    this.chunkAssembler.clear();
    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onclose = null;
      this.dc.onerror = null;
      this.dc.onmessage = null;
      try {
        this.dc.close();
      } catch {
        /* ignore */
      }
      this.dc = null;
    }
    if (this.pc) {
      this.pc.onconnectionstatechange = null;
      this.pc.ondatachannel = null;
      try {
        this.pc.close();
      } catch {
        /* ignore */
      }
      this.pc = null;
    }
  }
}

export async function probeRoomSignaling(): Promise<boolean> {
  try {
    const res = await fetch('/api/p2p-signal?action=ping');
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}

export async function publishRoomOffer(roomCode: string, offerToken: string): Promise<void> {
  const res = await fetch(`/api/p2p-signal?action=create&room=${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer: offerToken }),
  });
  if (!res.ok) throw new Error('发布房间信令失败');
}

export async function fetchRoomOffer(roomCode: string): Promise<string> {
  const res = await fetch(`/api/p2p-signal?action=poll-offer&room=${encodeURIComponent(roomCode)}`);
  const data = (await res.json()) as { ok?: boolean; offer?: string; message?: string };
  if (!res.ok || !data.offer) throw new Error(data.message || '未找到该房间或房主尚未建房');
  return data.offer;
}

export async function publishRoomAnswer(roomCode: string, answerToken: string): Promise<void> {
  const res = await fetch(`/api/p2p-signal?action=answer&room=${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: answerToken }),
  });
  if (!res.ok) throw new Error('回传房间应答失败');
}

export async function pollRoomAnswer(roomCode: string): Promise<string | null> {
  const res = await fetch(`/api/p2p-signal?action=poll-answer&room=${encodeURIComponent(roomCode)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { ok?: boolean; answer?: string | null };
  return data.answer ?? null;
}
