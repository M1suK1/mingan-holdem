import type {
  Card,
  ContractExpression,
  GameAction,
  GameState,
  HandCard,
  PlayerId,
  ShowdownResult,
} from './types.ts';
import { otherPlayer } from './gameEngine.ts';

export interface P2pPeerProfile {
  name: string;
  codename: string;
  title: string;
  portrait: string;
  accentColor: string;
  characterFileName?: string;
}

export type P2pPacket =
  | { type: 'HELLO'; peer: P2pPeerProfile }
  | { type: 'STATE_SYNC'; seq: number; state: GameState }
  | { type: 'ACTION_REQ'; seq: number; action: GameAction; bundledSpeech?: string }
  | {
      type: 'CHAT_MSG';
      id: string;
      speaker: string;
      text: string;
      msgKind: 'speech' | 'thought';
      expression?: ContractExpression;
    }
  | { type: 'EXPRESSION_SYNC'; expression: ContractExpression }
  | { type: 'NEXT_HAND_REQ' }
  | { type: 'REMATCH_REQ' }
  | { type: 'PING'; ts: number }
  | { type: 'PONG'; ts: number };

export interface P2pSignalPayload {
  kind: 'offer' | 'answer';
  sdp: string;
}

function maskedCard(id: string): Card {
  return { id, suit: 'B', rank: 2, copy: 0 };
}

function flipPlayer(id: PlayerId): PlayerId {
  return otherPlayer(id);
}

function flipScannedKey(key: string): string {
  if (key.startsWith('human:')) return `ai:${key.slice(6)}`;
  if (key.startsWith('ai:')) return `human:${key.slice(3)}`;
  return key;
}

/**
 * 房主权威端向客机下发状态前执行的严格防泄密清洗：
 * - 清空牌堆 deck 与 hackEscrowPot
 * - 隐藏未翻开公共节点
 * - 隐藏房主 (human) 私有暗牌
 * - 对房主已改过但尚未摊牌揭露的明牌/公共换入牌，还原为 originalCard 并抹除 tamperedBy
 * - 过滤未揭露的房主暗中改牌日志
 */
export function sanitizeStateForGuest(hostState: GameState): GameState {
  const cloned = structuredClone(hostState);
  const revealAll = cloned.phase === 'showdown' || cloned.config.revealOpponentHidden;

  cloned.deck = [];
  if (!revealAll) {
    cloned.hackEscrowPot = 0;
  }

  // Host (human) hand sanitization
  cloned.players.human.hand = cloned.players.human.hand.map((hc, idx): HandCard => {
    if (hc.visibility === 'private' && !revealAll) {
      return {
        card: maskedCard(`masked-host-hand-${idx}`),
        visibility: 'private',
        lockedFromSwap: hc.lockedFromSwap,
      };
    }
    if (!revealAll && hc.originalCard) {
      return {
        card: { ...hc.originalCard },
        visibility: hc.visibility,
        lockedFromSwap: hc.lockedFromSwap,
      };
    }
    return hc;
  });

  // Community board sanitization
  cloned.board = cloned.board.map((slot) => {
    if (!slot.isOpen && !revealAll) {
      return {
        index: slot.index,
        card: maskedCard(`masked-board-${slot.index}`),
        isOpen: false,
        source: 'initial',
      };
    }
    if (!revealAll && slot.swappedBy === 'human' && slot.originalCard) {
      return {
        index: slot.index,
        card: { ...slot.originalCard },
        isOpen: slot.isOpen,
        source: slot.source,
        swappedBy: slot.swappedBy,
      };
    }
    return slot;
  });

  // Hide host-only peeked/frozen private hints unless revealed
  cloned.peekedBoardIndices = [];
  if (!revealAll) {
    cloned.actionHistory = cloned.actionHistory.filter(
      (entry) => !(entry.actor === 'human' && entry.summary.includes('终端篡改'))
    );
    if (cloned.lastAction?.actor === 'human' && cloned.lastAction.type === 'hack') {
      cloned.lastAction = undefined;
    }
  }

  return cloned;
}

/**
 * 客机本地视角镜像转换：将服务端视角下的 ai(客机) 映射为本地 human(底部操作区)，
 * human(房主) 映射为 ai(上方对手区)，从而 100% 复用既有 UI。
 */
export function mirrorStateForGuestView(sanitizedHostState: GameState): GameState {
  const s = structuredClone(sanitizedHostState);

  const hostPlayer = { ...s.players.human, id: 'ai' as const };
  const guestPlayer = { ...s.players.ai, id: 'human' as const };

  s.players = {
    human: guestPlayer,
    ai: hostPlayer,
  };
  s.currentTurn = flipPlayer(s.currentTurn);
  s.tieStarter = flipPlayer(s.tieStarter);

  s.board = s.board.map((slot) => ({
    ...slot,
    swappedBy: slot.swappedBy ? flipPlayer(slot.swappedBy) : undefined,
  }));

  s.scannedKeys = s.scannedKeys.map(flipScannedKey);

  if (s.lastAction) {
    s.lastAction = {
      ...s.lastAction,
      actor: flipPlayer(s.lastAction.actor),
    };
  }

  s.actionHistory = s.actionHistory.map((entry) => ({
    ...entry,
    actor: entry.actor === 'system' ? 'system' : flipPlayer(entry.actor),
  }));

  if (s.result) {
    const res: ShowdownResult = {
      ...s.result,
      winner: s.result.winner === 'tie' ? 'tie' : flipPlayer(s.result.winner),
      humanEval: s.result.aiEval,
      aiEval: s.result.humanEval,
      payouts: {
        human: s.result.payouts.ai,
        ai: s.result.payouts.human,
      },
    };
    s.result = res;
  }

  s.pastHands = (s.pastHands ?? []).map((p) => ({
    ...p,
    winner: p.winner === 'tie' ? 'tie' : flipPlayer(p.winner),
    committedByHuman: p.committedByAi,
    committedByAi: p.committedByHuman,
    humanEndChips: p.aiEndChips,
    aiEndChips: p.humanEndChips,
    humanHandCategory: p.aiHandCategory,
    aiHandCategory: p.humanHandCategory,
    humanHadTamper: p.aiHadTamper,
    aiHadTamper: p.humanHadTamper,
  }));

  return s;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function compressDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function decompressDeflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    await writer.write(new Uint8Array(bytes));
    await writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function encodeP2pSignalToken(payload: P2pSignalPayload): Promise<string> {
  const rawBytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await compressDeflate(rawBytes);
  if (compressed && compressed.length < rawBytes.length) {
    return `MGP2P:Z:${bytesToBase64Url(compressed)}`;
  }
  return `MGP2P:R:${bytesToBase64Url(rawBytes)}`;
}

export async function decodeP2pSignalToken(token: string): Promise<P2pSignalPayload> {
  const trimmed = token.trim();
  if (!trimmed.startsWith('MGP2P:')) {
    throw new Error('无效的联机邀请码格式（必须以 MGP2P: 开头）');
  }
  const rest = trimmed.slice(6);
  const mode = rest.slice(0, 2);
  const body = rest.slice(2);
  const rawBytes = base64UrlToBytes(body);
  let text: string;
  if (mode === 'Z:') {
    const inflated = await decompressDeflate(rawBytes);
    if (!inflated) throw new Error('当前环境无法解压该联机邀请码');
    text = new TextDecoder().decode(inflated);
  } else if (mode === 'R:') {
    text = new TextDecoder().decode(rawBytes);
  } else {
    throw new Error('未知的邀请码编码版本');
  }
  const parsed = JSON.parse(text) as Partial<P2pSignalPayload>;
  if ((parsed.kind !== 'offer' && parsed.kind !== 'answer') || typeof parsed.sdp !== 'string') {
    throw new Error('邀请码内容损坏或不完整');
  }
  return { kind: parsed.kind, sdp: parsed.sdp };
}
