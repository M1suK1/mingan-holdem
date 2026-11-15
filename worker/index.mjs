import { DurableObject } from 'cloudflare:workers';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function normalizeRoomCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 16);
}

export class P2pRoomDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );
  }

  getConnectedRoles(excludeWs = null) {
    const roles = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excludeWs) continue;
      const att = ws.deserializeAttachment();
      if (att && typeof att.role === 'string') {
        roles.add(att.role);
      }
    }
    return roles;
  }

  broadcastRelayStatus() {
    const sockets = this.ctx.getWebSockets();
    const roles = this.getConnectedRoles();
    const bothReady = roles.has('host') && roles.has('guest');
    for (const ws of sockets) {
      const att = ws.deserializeAttachment();
      const myRole = att?.role || 'guest';
      const otherRole = myRole === 'host' ? 'guest' : 'host';
      try {
        ws.send(
          JSON.stringify({
            type: '__RELAY_STATUS__',
            role: myRole,
            peerConnected: bothReady || roles.has(otherRole),
          })
        );
      } catch {
        // Ignore stale socket
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/p2p-ws') {
      const upgrade = request.headers.get('Upgrade');
      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }
      const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';

      // Replace any previous socket holding the same role in this room
      for (const existing of this.ctx.getWebSockets()) {
        const att = existing.deserializeAttachment();
        if (att?.role === role) {
          try {
            existing.close(1000, 'replaced');
          } catch {
            // Ignore close failure
          }
        }
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ role });

      this.broadcastRelayStatus();

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === '/api/p2p-signal') {
      const action = url.searchParams.get('action') || '';
      if (action === 'create' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (!body || typeof body.offer !== 'string') {
          return jsonResponse({ ok: false, message: '缺少 offer' }, 400);
        }
        await this.ctx.storage.put('signal', {
          offer: body.offer,
          answer: null,
          updatedAt: Date.now(),
        });
        return jsonResponse({ ok: true });
      }
      if (action === 'poll-offer') {
        const rec = await this.ctx.storage.get('signal');
        if (!rec || !rec.offer) {
          return jsonResponse({ ok: false, message: '房间不存在或已过期' }, 404);
        }
        return jsonResponse({ ok: true, offer: rec.offer });
      }
      if (action === 'answer' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const rec = await this.ctx.storage.get('signal');
        if (!rec || typeof body?.answer !== 'string') {
          return jsonResponse({ ok: false, message: '房间不存在或缺少 answer' }, 400);
        }
        await this.ctx.storage.put('signal', {
          ...rec,
          answer: body.answer,
          updatedAt: Date.now(),
        });
        return jsonResponse({ ok: true });
      }
      if (action === 'poll-answer') {
        const rec = await this.ctx.storage.get('signal');
        if (!rec) return jsonResponse({ ok: false, answer: null }, 404);
        return jsonResponse({ ok: true, answer: rec.answer || null });
      }
    }

    return jsonResponse({ ok: false, message: 'Unsupported DO request' }, 400);
  }

  async webSocketMessage(ws, message) {
    if (message === 'ping') {
      ws.send('pong');
      return;
    }
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === ws) continue;
      try {
        peer.send(message);
      } catch {
        // Ignore broken peer socket
      }
    }
  }

  async webSocketClose(ws) {
    try {
      ws.close();
    } catch {
      // Ignore
    }
    for (const peer of this.ctx.getWebSockets()) {
      if (peer === ws) continue;
      const att = peer.deserializeAttachment();
      try {
        peer.send(
          JSON.stringify({
            type: '__RELAY_STATUS__',
            role: att?.role || 'guest',
            peerConnected: false,
          })
        );
      } catch {
        // Ignore
      }
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/p2p-signal') {
      const action = url.searchParams.get('action') || '';
      if (action === 'ping') {
        return jsonResponse({
          ok: true,
          mode: 'cloudflare-do',
          wsRelay: true,
        });
      }
      const room = normalizeRoomCode(url.searchParams.get('room'));
      if (!room || room.length < 4) {
        return jsonResponse({ ok: false, message: '房间号至少需要 4 位字符' }, 400);
      }
      const id = env.P2P_ROOM.idFromName(room);
      const stub = env.P2P_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === '/api/p2p-ws') {
      const room = normalizeRoomCode(url.searchParams.get('room'));
      if (!room || room.length < 4) {
        return new Response('Missing valid room code', { status: 400 });
      }
      const id = env.P2P_ROOM.idFromName(room);
      const stub = env.P2P_ROOM.get(id);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
