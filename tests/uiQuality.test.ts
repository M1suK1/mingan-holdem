import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const EMOJI_REGEX = /[\p{Extended_Pictographic}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const EXTERNAL_ALERT_REGEX = /\bwindow\.(alert|confirm|prompt)\s*\(|\b(alert|confirm|prompt)\s*\(/;

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await collectFiles(full)));
    } else if (/\.(ts|tsx|css|html)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('UI quality gates: zero emoji, zero external alerts, unique descriptive IDs', () => {
  it('contains zero emoji or Unicode suit pictographs across src/ and index.html', async () => {
    const root = process.cwd();
    const files = [
      path.join(root, 'index.html'),
      ...(await collectFiles(path.join(root, 'src'))),
    ];
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const match = content.match(EMOJI_REGEX);
      assert.equal(
        match,
        null,
        `Found forbidden emoji/pictograph "${match?.[0]}" in ${path.relative(root, file)}`
      );
    }
  });

  it('uses internal OS notifications instead of window.alert/confirm/prompt', async () => {
    const root = process.cwd();
    const files = await collectFiles(path.join(root, 'src'));
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const match = content.match(EXTERNAL_ALERT_REGEX);
      assert.equal(
        match,
        null,
        `Found external alert/confirm/prompt "${match?.[0]}" in ${path.relative(root, file)}`
      );
    }
  });

  it('gives every JSX interactive control (<button, <input, <select, <textarea) a unique id attribute', async () => {
    const root = process.cwd();
    const files = (await collectFiles(path.join(root, 'src'))).filter((f) => f.endsWith('.tsx'));
    const tagRegex = /<(button|input|select|textarea)\b([\s\S]*?)>/g;
    const seenStaticIds = new Map<string, string>();

    for (const file of files) {
      const rel = path.relative(root, file);
      const content = await fs.readFile(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = tagRegex.exec(content)) !== null) {
        const attrs = m[2];
        assert.ok(
          /\bid=/.test(attrs),
          `Missing id attribute on <${m[1]}> in ${rel}: <${m[1]}${attrs.slice(0, 80)}>`
        );
        const staticMatch = attrs.match(/\bid="([^"]+)"/);
        if (staticMatch) {
          const idVal = staticMatch[1];
          assert.equal(
            seenStaticIds.has(idVal),
            false,
            `Duplicate static id="${idVal}" across ${seenStaticIds.get(idVal)} and ${rel}`
          );
          seenStaticIds.set(idVal, rel);
        }
      }
    }
  });

  it('separates story table buttons (settings, escape map, rewind) from free table buttons (settings, quick restart, p2p, switch char)', async () => {
    const appSrc = await fs.readFile(path.join(process.cwd(), 'src', 'App.tsx'), 'utf8');
    const stackBlockMatch = appSrc.match(
      /className=\{`lc-left-action-stack[\s\S]*?<\/div>\s*\{\/\* COL 2, ROW 1/
    );
    assert.ok(stackBlockMatch, 'Could not locate lc-left-action-stack block in App.tsx');
    const stackBlock = stackBlockMatch[0];
    const [storyBranch, freeBranch] = stackBlock.split(') : (');
    assert.ok(storyBranch && freeBranch, 'Expected isStoryTable ternary branch in lc-left-action-stack');

    assert.ok(stackBlock.includes('id="hud-btn-settings"'));
    assert.ok(storyBranch.includes('id="hud-btn-escape-map"'));
    assert.ok(storyBranch.includes('id="hud-btn-rewind"'));
    assert.ok(storyBranch.includes('data-tap-locked={human.chips > 0'));
    assert.ok(storyBranch.includes('data-durability-stage={rewindButtonMeta.durability.stage}'));
    assert.ok(storyBranch.includes('data-durability-pct={rewindButtonMeta.durability.durabilityPct}'));
    assert.ok(storyBranch.includes('startHoldStoryRewind'));
    assert.ok(storyBranch.includes('is-rewind-fill'));
    assert.equal(storyBranch.includes('id="hud-btn-quick-restart"'), false);
    assert.equal(storyBranch.includes('id="hud-btn-p2p"'), false);
    assert.equal(storyBranch.includes('id="hud-btn-switch-char"'), false);

    assert.ok(freeBranch.includes('id="hud-btn-quick-restart"'));
    assert.ok(freeBranch.includes('id="hud-btn-p2p"'));
    assert.ok(freeBranch.includes('id="hud-btn-switch-char"'));
    assert.equal(freeBranch.includes('id="hud-btn-escape-map"'), false);
    assert.equal(freeBranch.includes('id="hud-btn-rewind"'), false);
  });
});
