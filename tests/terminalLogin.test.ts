import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createInitialCampaign } from '../src/engine/campaign.ts';
import { createInitialEscapeProgress, markEscapeNodeCleared } from '../src/engine/escapeMap.ts';
import {
  buildHelpOutputLines,
  buildSaveSlotsSummaryLines,
  completeTerminalInput,
  deleteTerminalSlot,
  hasContinuableProgress,
  loadFromTerminalSlot,
  loadTerminalSaveSlots,
  parseTerminalCommand,
  saveToTerminalSlot,
} from '../src/engine/terminalLogin.ts';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
  };
}

describe('Terminal Login Start Screen (MINGAN_NET // TTY-01)', () => {
  it('parses /help, /new, /continue, /save, /load, /delete, /settings, /clear, /desktop and rejects invalid input cleanly', () => {
    assert.deepEqual(parseTerminalCommand('/help'), { kind: 'help' });
    assert.deepEqual(parseTerminalCommand('help'), { kind: 'help' });
    assert.deepEqual(parseTerminalCommand('/new'), { kind: 'new', confirm: false });
    assert.deepEqual(parseTerminalCommand('/new confirm'), { kind: 'new', confirm: true });
    assert.deepEqual(parseTerminalCommand('/continue'), { kind: 'continue', target: 'arena' });
    assert.deepEqual(parseTerminalCommand('/continue map'), { kind: 'continue', target: 'escape-map' });
    assert.deepEqual(parseTerminalCommand('/save'), { kind: 'save-list' });
    assert.deepEqual(parseTerminalCommand('/save 2 战前备份'), {
      kind: 'save-write',
      slotId: 2,
      label: '战前备份',
    });
    assert.deepEqual(parseTerminalCommand('/load 2'), { kind: 'save-load', slotId: 2 });
    assert.deepEqual(parseTerminalCommand('/delete 3'), {
      kind: 'save-delete',
      slotId: 3,
      confirm: false,
    });
    assert.deepEqual(parseTerminalCommand('/delete 3 confirm'), {
      kind: 'save-delete',
      slotId: 3,
      confirm: true,
    });
    assert.deepEqual(parseTerminalCommand('/settings'), { kind: 'settings', subTarget: 'menu' });
    assert.deepEqual(parseTerminalCommand('/settings llm'), { kind: 'settings', subTarget: 'llm' });
    assert.deepEqual(parseTerminalCommand('/settings rules'), {
      kind: 'settings',
      subTarget: 'protocol',
    });
    assert.deepEqual(parseTerminalCommand('/clear'), { kind: 'clear' });
    assert.deepEqual(parseTerminalCommand('/desktop'), { kind: 'desktop' });
    assert.equal(parseTerminalCommand('/save 9').kind, 'invalid-arg');
    assert.equal(parseTerminalCommand('/unknowncmd').kind, 'unknown');
  });

  it('auto-completes terminal prefixes with Tab completion', () => {
    assert.equal(completeTerminalInput('/h'), '/help');
    assert.equal(completeTerminalInput('/co'), '/continue');
    assert.equal(completeTerminalInput('/se'), '/settings');
    assert.equal(completeTerminalInput('/sa'), '/save');
    assert.equal(completeTerminalInput('new'), '/new');
  });

  it('persists multi-slot save archives and separates continuable progress from brand-new saves', () => {
    const storage = createMemoryStorage();
    const freshEsc = createInitialEscapeProgress();
    const freshCamp = createInitialCampaign('TEST-00');
    assert.equal(hasContinuableProgress(freshEsc), false);

    const progressedEsc = markEscapeNodeCleared(freshEsc, 0);
    assert.equal(hasContinuableProgress(progressedEsc), true);

    const afterSave = saveToTerminalSlot(1, progressedEsc, freshCamp, 'SEC-01 前哨', storage);
    assert.equal(afterSave.length, 1);
    assert.equal(afterSave[0].nodeCode, 'SEC-01');
    assert.equal(afterSave[0].label, 'SEC-01 前哨');

    const loadedList = loadTerminalSaveSlots(storage);
    assert.equal(loadedList.length, 1);
    const loadedSlot = loadFromTerminalSlot(1, storage);
    assert.ok(loadedSlot);
    assert.equal(loadedSlot?.clearedCount, 1);
    assert.equal(loadedSlot?.playerCodename, 'TEST-00');

    const summary = buildSaveSlotsSummaryLines(loadedList, progressedEsc, freshCamp).join('\n');
    assert.ok(summary.includes('[SLOT-1]'));
    assert.ok(summary.includes('SEC-01 前哨'));

    const helpLines = buildHelpOutputLines().join('\n');
    assert.ok(helpLines.includes('/new'));
    assert.ok(helpLines.includes('/continue'));
    assert.ok(helpLines.includes('/save'));
    assert.ok(helpLines.includes('/settings'));

    const afterDelete = deleteTerminalSlot(1, storage);
    assert.equal(afterDelete.length, 0);
    assert.equal(loadFromTerminalSlot(1, storage), null);
  });

  it('renders game title, MinganProtocolHeroLogo, /help prompt, CLI input, and command chips in TerminalLoginView', async () => {
    const root = process.cwd();
    const ttySrc = await fs.readFile(
      path.join(root, 'src', 'components', 'TerminalLoginView.tsx'),
      'utf8'
    );
    const iconsSrc = await fs.readFile(
      path.join(root, 'src', 'components', 'CyberIcons.tsx'),
      'utf8'
    );

    assert.ok(iconsSrc.includes('export function MinganProtocolHeroLogo'));
    assert.ok(ttySrc.includes('MinganProtocolHeroLogo'));
    assert.ok(ttySrc.includes('黑域协议：替壳者'));
    assert.ok(ttySrc.includes('/help'));
    assert.ok(ttySrc.includes('id="terminal-login-input"'));
    assert.ok(ttySrc.includes('id="terminal-login-submit"'));
    assert.ok(ttySrc.includes('id="terminal-chip-help"'));
    assert.ok(ttySrc.includes('id="terminal-chip-new"'));
    assert.ok(ttySrc.includes('id="terminal-chip-continue"'));
    assert.ok(ttySrc.includes('id="terminal-chip-save"'));
    assert.ok(ttySrc.includes('id="terminal-chip-settings"'));
  });
});
