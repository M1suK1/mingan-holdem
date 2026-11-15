import fs from 'node:fs/promises';
import path from 'node:path';

const FEATURED_STATIC_FILES = [
  '夜糖事务所-契约卡-银狼.json',
  '夜糖事务所-契约卡-伊冯.json',
  '夜糖事务所-契约卡-凯伊.json',
  '夜糖事务所-契约卡-龙华妃咲.json',
  '夜糖事务所-契约卡-古明地恋.json',
  '夜糖事务所-契约卡-千夏.json',
];

const PRIORITY_NAMES = new Map([
  ['银狼', 1],
  ['伊冯', 2],
  ['凯伊', 3],
  ['普拉娜', 4],
  ['龙华妃咲', 5],
  ['古明地恋', 6],
  ['千夏', 7],
]);

function extractSummary(parsed, fileName, bytes) {
  const girl = parsed?.girl ?? parsed;
  if (!girl || typeof girl !== 'object' || typeof girl.name !== 'string') {
    return null;
  }
  const s = girl.stats ?? {};
  const variants = girl.importedVariants && typeof girl.importedVariants === 'object'
    ? Object.keys(girl.importedVariants).length
    : 0;
  return {
    fileName,
    name: girl.name.trim(),
    codename: typeof girl.codename === 'string' && girl.codename.trim() ? girl.codename.trim() : 'NET-OP',
    title: typeof girl.title === 'string' && girl.title.trim() ? girl.title.trim() : '契约特工',
    element: typeof girl.element === 'string' && girl.element.trim() ? girl.element.trim() : '数据系',
    archetype: typeof girl.archetype === 'string' && girl.archetype.trim() ? girl.archetype.trim() : '控制',
    color: typeof girl.color === 'string' && girl.color.trim() ? girl.color.trim() : '#FF2E88',
    quote: typeof girl.quote === 'string' ? girl.quote.trim() : '',
    stats: {
      magic: Number(s.magic) || 65,
      insight: Number(s.insight) || 70,
      agility: Number(s.agility) || 60,
      empathy: Number(s.empathy) || 55,
    },
    expressionCount: variants,
    hasVoice: Boolean(girl.voice),
    bytes,
  };
}

export function nightSugarCardsPlugin(projectRoot = process.cwd()) {
  const externalSourceDir = path.resolve(projectRoot, '../night-sugar-office/data/cards');
  const bundledSourceDir = path.resolve(projectRoot, 'public/cards');
  let outDir = path.resolve(projectRoot, 'dist');
  let cachedIndex = null;
  let resolvedSourceDir = null;

  async function resolveSourceDir() {
    if (resolvedSourceDir) return resolvedSourceDir;
    for (const candidate of [externalSourceDir, bundledSourceDir]) {
      try {
        const st = await fs.stat(candidate);
        if (st.isDirectory()) {
          const entries = await fs.readdir(candidate);
          if (entries.some((n) => n.toLowerCase().endsWith('.json') && n !== 'index.json')) {
            resolvedSourceDir = candidate;
            return resolvedSourceDir;
          }
        }
      } catch {
        // Try next candidate
      }
    }
    return null;
  }

  async function buildIndex() {
    if (cachedIndex) return cachedIndex;
    const activeDir = await resolveSourceDir();
    if (!activeDir) {
      cachedIndex = [];
      return cachedIndex;
    }
    let names = [];
    try {
      names = await fs.readdir(activeDir);
    } catch {
      cachedIndex = [];
      return cachedIndex;
    }

    const summaries = [];
    for (const name of names) {
      if (!name.toLowerCase().endsWith('.json') || name === 'index.json') continue;
      try {
        const full = path.join(activeDir, name);
        const stat = await fs.stat(full);
        if (!stat.isFile()) continue;
        const raw = await fs.readFile(full, 'utf8');
        const parsed = JSON.parse(raw);
        const sum = extractSummary(parsed, name, stat.size);
        if (sum) summaries.push(sum);
      } catch {
        // Ignore malformed file
      }
    }

    summaries.sort((a, b) => {
      const pa = PRIORITY_NAMES.get(a.name) ?? 999;
      const pb = PRIORITY_NAMES.get(b.name) ?? 999;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    cachedIndex = summaries;
    return cachedIndex;
  }

  function createMiddleware() {
    return async (req, res, next) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (!url.pathname.startsWith('/api/contract-cards')) {
        next();
        return;
      }

      const fileParam = url.searchParams.get('file');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');

      if (!fileParam) {
        const items = await buildIndex();
        res.end(JSON.stringify({ ok: true, source: 'night-sugar-office', cards: items }));
        return;
      }

      const safeFile = path.basename(fileParam);
      if (safeFile !== fileParam || !safeFile.toLowerCase().endsWith('.json')) {
        res.statusCode = 400;
        res.end(JSON.stringify({ ok: false, message: '非法契约卡文件名' }));
        return;
      }

      try {
        const activeDir = await resolveSourceDir();
        if (!activeDir) throw new Error('missing card directory');
        const raw = await fs.readFile(path.join(activeDir, safeFile), 'utf8');
        res.end(raw);
      } catch {
        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, message: `未找到契约卡: ${safeFile}` }));
      }
    };
  }

  return {
    name: 'mingan:night-sugar-cards',
    configResolved(cfg) {
      outDir = path.isAbsolute(cfg.build.outDir)
        ? cfg.build.outDir
        : path.resolve(projectRoot, cfg.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    },
    async closeBundle() {
      // Emit featured static contract cards into dist/cards so pure static hosting works out-of-the-box
      const activeDir = await resolveSourceDir();
      if (!activeDir) return;
      const targetDir = path.join(outDir, 'cards');
      await fs.mkdir(targetDir, { recursive: true });
      const all = await buildIndex();
      const staticCards = [];

      for (const fileName of FEATURED_STATIC_FILES) {
        const found = all.find((c) => c.fileName === fileName);
        if (!found) continue;
        try {
          await fs.copyFile(path.join(activeDir, fileName), path.join(targetDir, fileName));
          staticCards.push(found);
        } catch {
          // Ignore missing optional card
        }
      }

      if (staticCards.length > 0) {
        await fs.writeFile(
          path.join(targetDir, 'index.json'),
          JSON.stringify({ ok: true, source: 'static-bundle', cards: staticCards }, null, 2),
          'utf8'
        );
      }
    },
  };
}
