/**
 * Vite Dev / Preview 内置轻量 P2P 房间信令转发中间件 (/api/p2p-signal)
 * 用于局域网/同服务下「输入 6 位房间号」自动交换 WebRTC Offer / Answer，零额外进程。
 */
const ROOM_TTL_MS = 10 * 60 * 1000;

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 128 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function p2pSignalingPlugin() {
  const rooms = new Map();

  function pruneExpired() {
    const now = Date.now();
    for (const [code, entry] of rooms.entries()) {
      if (now - entry.updatedAt > ROOM_TTL_MS) {
        rooms.delete(code);
      }
    }
  }

  function middleware() {
    return async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/api/p2p-signal') {
        next();
        return;
      }

      pruneExpired();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');

      const action = url.searchParams.get('action') ?? '';
      const room = (url.searchParams.get('room') ?? '').trim().toUpperCase();

      if (action === 'ping') {
        res.end(JSON.stringify({ ok: true, mode: 'vite-relay', activeRooms: rooms.size }));
        return;
      }

      if (!/^[A-Z0-9]{4,12}$/.test(room)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, message: '房间号格式无效（需 4-12 位字母或数字）' }));
        return;
      }

      if (req.method === 'POST' && action === 'create') {
        try {
          const data = await readJsonBody(req);
          if (typeof data.offer !== 'string' || !data.offer.startsWith('MGP2P:')) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, message: '缺少有效 Offer 令牌' }));
            return;
          }
          rooms.set(room, { offer: data.offer, answer: null, updatedAt: Date.now() });
          res.end(JSON.stringify({ ok: true, room }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, message: '请求体解析失败' }));
        }
        return;
      }

      if (req.method === 'GET' && action === 'poll-offer') {
        const entry = rooms.get(room);
        if (!entry) {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, message: '房间不存在或已过期' }));
          return;
        }
        res.end(JSON.stringify({ ok: true, offer: entry.offer }));
        return;
      }

      if (req.method === 'POST' && action === 'answer') {
        const entry = rooms.get(room);
        if (!entry) {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, message: '房间不存在或已过期' }));
          return;
        }
        try {
          const data = await readJsonBody(req);
          if (typeof data.answer !== 'string' || !data.answer.startsWith('MGP2P:')) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, message: '缺少有效 Answer 令牌' }));
            return;
          }
          entry.answer = data.answer;
          entry.updatedAt = Date.now();
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, message: '请求体解析失败' }));
        }
        return;
      }

      if (req.method === 'GET' && action === 'poll-answer') {
        const entry = rooms.get(room);
        if (!entry) {
          res.statusCode = 404;
          res.end(JSON.stringify({ ok: false, message: '房间已过期' }));
          return;
        }
        res.end(JSON.stringify({ ok: true, answer: entry.answer }));
        return;
      }

      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, message: '未知信令操作' }));
    };
  }

  return {
    name: 'mingan:p2p-signaling',
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
