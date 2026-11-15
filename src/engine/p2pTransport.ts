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

export interface P2pTransport {
  readonly role: P2pRole;
  send(packet: P2pPacket): boolean;
  close(): void;
}

export interface TurnServerConfig {
  urls: string;
  username: string;
  credential: string;
}

const TURN_STORAGE_KEY = 'mingan_p2p_turn_config_v1';

export function loadTurnServerConfig(): TurnServerConfig {
  try {
    const raw = localStorage.getItem(TURN_STORAGE_KEY);
    if (!raw) return { urls: '', username: '', credential: '' };
    const parsed = JSON.parse(raw) as Partial<TurnServerConfig>;
    return {
      urls: typeof parsed.urls === 'string' ? parsed.urls : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      credential: typeof parsed.credential === 'string' ? parsed.credential : '',
    };
  } catch {
    return { urls: '', username: '', credential: '' };
  }
}

export function saveTurnServerConfig(cfg: TurnServerConfig): void {
  try {
    localStorage.setItem(TURN_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // Ignore storage quota issues
  }
}

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.hitv.com:3478' },
];

function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [...DEFAULT_STUN_SERVERS];
  const turn = loadTurnServerConfig();
  const cleanUrls = turn.urls
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  if (cleanUrls.length > 0) {
    servers.push({
      urls: cleanUrls,
      username: turn.username.trim() || undefined,
      credential: turn.credential || undefined,
    });
  }
  return servers;
}

interface IceCandidateStats {
  host: number;
  srflx: number;
  relay: number;
}

async function waitForIceGathering(
  pc: RTCPeerConnection,
  stats: IceCandidateStats,
  maxWaitMs = 4500
): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    let done = false;
    let settleTimer: number | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      pc.removeEventListener('icegatheringstatechange', onState);
      pc.removeEventListener('icecandidate', onCand);
      resolve();
    };
    const onState = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    const onCand = () => {
      // Once we have a public srflx or TURN relay candidate, allow a short settle then proceed
      if ((stats.relay > 0 || stats.srflx > 0) && settleTimer === null) {
        settleTimer = window.setTimeout(finish, 650);
      }
    };
    pc.addEventListener('icegatheringstatechange', onState);
    pc.addEventListener('icecandidate', onCand);
    window.setTimeout(finish, maxWaitMs);
  });
}

export class WebRtcP2pTransport implements P2pTransport {
  readonly role: P2pRole;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private pingTimer: number | null = null;
  private readonly chunkAssembler = new P2pChunkAssembler();
  private readonly callbacks: P2pTransportCallbacks;
  private candidateStats: IceCandidateStats = { host: 0, srflx: 0, relay: 0 };

  constructor(role: P2pRole, callbacks: P2pTransportCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
  }

  private setupPeerConnection(): RTCPeerConnection {
    if (this.pc) this.close();
    this.candidateStats = { host: 0, srflx: 0, relay: 0 };
    const pc = new RTCPeerConnection({
      iceServers: buildIceServers(),
      iceCandidatePoolSize: 4,
    });
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      const cand = ev.candidate?.candidate || '';
      if (!cand) return;
      if (cand.includes(' typ relay')) this.candidateStats.relay += 1;
      else if (cand.includes(' typ srflx')) this.candidateStats.srflx += 1;
      else if (cand.includes(' typ host')) this.candidateStats.host += 1;
    };

    const reportFailure = () => {
      const { host, srflx, relay } = this.candidateStats;
      this.callbacks.onStatusChange(
        'closed',
        `ICE 网络穿透失败（host:${host} / srflx:${srflx} / relay:${relay}）。手机 4G/5G 或严格防火墙下请使用「6 位房间号云端中继」或配置 TURN`
      );
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        reportFailure();
      } else if (pc.connectionState === 'disconnected') {
        this.callbacks.onStatusChange('connecting', '网络波动，正在尝试恢复 P2P 连接...');
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        reportFailure();
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
    await waitForIceGathering(pc, this.candidateStats);

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
    await waitForIceGathering(pc, this.candidateStats);

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
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
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

export class WsRelayP2pTransport implements P2pTransport {
  readonly role: P2pRole;
  private ws: WebSocket | null = null;
  private pingTimer: number | null = null;
  private readonly chunkAssembler = new P2pChunkAssembler();
  private readonly callbacks: P2pTransportCallbacks;
  private connectedOnce = false;
  private closedManually = false;

  constructor(role: P2pRole, callbacks: P2pTransportCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
  }

  connect(roomCode: string): void {
    this.close();
    this.closedManually = false;
    this.connectedOnce = false;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/api/p2p-ws?room=${encodeURIComponent(roomCode)}&role=${this.role}`;
    this.callbacks.onStatusChange('connecting', `正在连接云端房间 ${roomCode}...`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      if (this.role === 'host') {
        this.callbacks.onStatusChange('waiting-answer', `云端房间 ${roomCode} 已就绪，等待好友输入房间号加入...`);
      } else {
        this.callbacks.onStatusChange('connecting', `已进入房间 ${roomCode}，正在握手建立通道...`);
      }
    };

    ws.onmessage = (ev) => {
      const raw = String(ev.data);
      if (raw === 'pong') return;
      try {
        const assembled = this.chunkAssembler.feed(raw);
        if (!assembled) return;
        const parsed = JSON.parse(assembled) as P2pPacket | { type: '__RELAY_STATUS__'; peerConnected?: boolean };
        if (parsed.type === '__RELAY_STATUS__') {
          if (parsed.peerConnected) {
            if (!this.connectedOnce) {
              this.connectedOnce = true;
              this.callbacks.onStatusChange('connected', '云端中继通道已建立（跨网/4G/5G 手机直连可用）');
              this.startHeartbeat();
            }
          } else if (this.connectedOnce) {
            this.stopHeartbeat();
            this.callbacks.onStatusChange('closed', '好友已退出房间或网络断开');
          }
          return;
        }
        const pkt = parsed as P2pPacket;
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

    ws.onerror = () => {
      if (!this.closedManually) {
        this.callbacks.onStatusChange('error', '云端中继通道连接异常');
      }
    };

    ws.onclose = () => {
      this.stopHeartbeat();
      if (!this.closedManually) {
        this.callbacks.onStatusChange('closed', '云端中继通道已关闭');
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

  send(packet: P2pPacket): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      const json = JSON.stringify(packet);
      const frames = splitP2pWireMessage(json, 14_000);
      for (const frame of frames) {
        this.ws.send(frame);
      }
      return true;
    } catch {
      return false;
    }
  }

  close(): void {
    this.closedManually = true;
    this.stopHeartbeat();
    this.chunkAssembler.clear();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close(1000, 'closed');
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
  }
}

export interface RoomCapabilities {
  available: boolean;
  wsRelay: boolean;
}

export async function probeRoomCapabilities(): Promise<RoomCapabilities> {
  try {
    const res = await fetch('/api/p2p-signal?action=ping');
    if (!res.ok) return { available: false, wsRelay: false };
    const data = (await res.json()) as { ok?: boolean; wsRelay?: boolean };
    return {
      available: Boolean(data.ok),
      wsRelay: Boolean(data.ok && data.wsRelay),
    };
  } catch {
    return { available: false, wsRelay: false };
  }
}

export async function probeRoomSignaling(): Promise<boolean> {
  const caps = await probeRoomCapabilities();
  return caps.available;
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
