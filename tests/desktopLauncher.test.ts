import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createInitialEscapeProgress,
  markEscapeNodeCleared,
  shouldStartOnDesktop,
} from '../src/engine/escapeMap.ts';
import {
  activateM1DesktopEndingSequence,
  findNearestFreeGridCell,
  loadDesktopPersistedState,
  resetDesktopPersistedState,
  resetM1DesktopEndingSequence,
  saveDesktopPersistedState,
} from '../src/engine/desktopState.ts';
import {
  LIN_LONGXIN_CASUAL_EXPRESSION_PATHS,
  resolveLinLongxinCasualSprite,
} from '../src/engine/storyCharacters.ts';

function createMemoryDesktopStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe('Windows pixel desktop launcher (MINGAN-OS 98)', () => {
  it('shows desktop launcher automatically ONLY on a brand-new save before SEC-00 is cleared', () => {
    const fresh = createInitialEscapeProgress();
    assert.equal(shouldStartOnDesktop(fresh), true);

    const afterSec00 = markEscapeNodeCleared(fresh, 0);
    assert.equal(shouldStartOnDesktop(afterSec00), false);

    assert.equal(
      shouldStartOnDesktop({ ...fresh, currentNodeIndex: 2, highestUnlockedIndex: 2 }),
      false
    );
    assert.equal(
      shouldStartOnDesktop({ ...fresh, escapedReality: true }),
      false
    );
  });

  it('includes WeXin chat icon, Recycle Bin with deleted 黑域协议网.lnk, cluttered files including 仇恨之书.txt, settings Start Menu, and bottom-right system clock', async () => {
    const root = process.cwd();
    const viewSrc = await fs.readFile(
      path.join(root, 'src', 'components', 'WindowsDesktopView.tsx'),
      'utf8'
    );
    const appSrc = await fs.readFile(path.join(root, 'src', 'App.tsx'), 'utf8');

    // Primary desktop icons
    assert.ok(viewSrc.includes("id: 'desktop-icon-recycle'"));
    assert.ok(viewSrc.includes('回收站'));
    assert.ok(viewSrc.includes("id: 'desktop-icon-wexin'"));
    assert.ok(viewSrc.includes('维心'));

    // Decorative cluttered folders & files including exact user lore edit
    for (const name of [
      '新建文件夹 (3)',
      '未命名截图_final_v2.png',
      '房租水电催缴.pdf',
      '工作目录_勿删',
      '系统日志_crash.txt',
      '旧版备份_2025',
      '仇恨之书.txt',
      '别碰黑域网',
      '临时转储_0x4F',
      '桌面清理待办.note',
    ]) {
      assert.ok(viewSrc.includes(name), `Expected desktop item/copy "${name}"`);
    }

    // Recycle bin window -> restore to desktop -> double-click desktop shortcut flow
    assert.ok(viewSrc.includes('id="desktop-window-recycle"'));
    assert.ok(viewSrc.includes('id="recycle-item-mingan-lnk"'));
    assert.ok(viewSrc.includes('黑域协议网.lnk'));
    assert.ok(viewSrc.includes('id="recycle-btn-restore-mingan"'));
    assert.ok(viewSrc.includes("id: 'desktop-icon-mingan'"));
    assert.ok(viewSrc.includes('handleRestoreMinganToDesktop'));
    assert.ok(viewSrc.includes('activateIconByDoubleOrEnter'));

    // Taskbar, Start Menu (free table + settings), and system clock
    assert.ok(viewSrc.includes('id="desktop-btn-start"'));
    assert.ok(viewSrc.includes('id="desktop-start-menu"'));
    assert.ok(viewSrc.includes('id="start-menu-free-table"'));
    assert.ok(viewSrc.includes('id="start-menu-llm"'));
    assert.ok(viewSrc.includes('id="start-menu-tuning"'));
    assert.ok(viewSrc.includes('id="desktop-taskbar-clock"'));

    // Two-level categorized system settings menu
    assert.ok(appSrc.includes('SETTINGS_CATEGORIES'));
    assert.ok(appSrc.includes("id: 'menu-cat-mode'"));
    assert.ok(appSrc.includes("id: 'menu-cat-p2p-role'"));
    assert.ok(appSrc.includes("id: 'menu-cat-ai-rules'"));
    assert.ok(appSrc.includes("id: 'menu-cat-audio-debug'"));
    assert.ok(appSrc.includes('id="menu-sub-back"'));

    // Windows auto snap-to-grid drag & collision avoidance
    assert.ok(viewSrc.includes('handleIconPointerDown'));
    assert.ok(viewSrc.includes('findNearestFreeGridCell'));
    assert.ok(viewSrc.includes('px-desktop-grid-snap-preview'));
    assert.ok(viewSrc.includes('is-dragging'));

    // Pink WeXin icon
    const iconsSrc = await fs.readFile(
      path.join(root, 'src', 'components', 'CyberIcons.tsx'),
      'utf8'
    );
    const wexinBlockMatch = iconsSrc.match(/export function PixelWexinIcon[\s\S]*?\n\}/);
    assert.ok(wexinBlockMatch && wexinBlockMatch[0].includes('#FF2E88'));

    // Openable 仇恨之书.txt notepad diary
    assert.ok(viewSrc.includes('id="desktop-window-hatred-book"'));
    assert.ok(viewSrc.includes('id="taskbar-btn-hatred-book"'));
    assert.ok(viewSrc.includes('十二分钟惨案'));
    assert.ok(viewSrc.includes('退游立誓'));

    // App.tsx boots fresh save into 'desktop' and returning save into 'terminal-login'
    assert.ok(appSrc.includes("shouldStartOnDesktop(loadEscapeProgress()) ? 'desktop' : 'terminal-login'"));
    assert.ok(appSrc.includes('WindowsDesktopView'));
    assert.ok(appSrc.includes('TerminalLoginView'));
  });

  it('persists restored 黑域协议网.lnk state and dragged icon grid positions across desktop switches', () => {
    const store = createMemoryDesktopStorage();
    assert.equal(loadDesktopPersistedState(store), null);

    const occupied = new Set(['0,0', '0,1']);
    const snapped = findNearestFreeGridCell(0, 1, occupied, 6, 4);
    assert.notEqual(`${snapped.col},${snapped.row}`, '0,0');
    assert.notEqual(`${snapped.col},${snapped.row}`, '0,1');

    saveDesktopPersistedState(
      {
        minganRestored: true,
        iconCells: {
          'desktop-icon-mingan': { col: 0, row: 2 },
          'desktop-decor-hatred-book': { col: 4, row: 1 },
        },
      },
      store
    );

    const reloaded = loadDesktopPersistedState(store);
    assert.ok(reloaded);
    assert.equal(reloaded?.minganRestored, true);
    assert.deepEqual(reloaded?.iconCells['desktop-icon-mingan'], { col: 0, row: 2 });
    assert.deepEqual(reloaded?.iconCells['desktop-decor-hatred-book'], { col: 4, row: 1 });

    resetDesktopPersistedState(store);
    assert.equal(loadDesktopPersistedState(store), null);
  });

  it('implements M1 post-SEC-04 EXIT-RL auto-disconnect, hatred book add-entry flow, official Black Domain notice, and Lin Longxin WeXin popup without Blackbox spoilers', async () => {
    const store = createMemoryDesktopStorage();
    saveDesktopPersistedState(
      {
        minganRestored: true,
        iconCells: { 'desktop-decor-hatred-book': { col: 3, row: 2 } },
      },
      store
    );

    const activated = activateM1DesktopEndingSequence(store);
    assert.equal(activated.m1EndingStage, 'guide-hatred');
    assert.equal(activated.minganRestored, true);
    assert.deepEqual(activated.iconCells['desktop-decor-hatred-book'], { col: 3, row: 2 });

    const resetM1 = resetM1DesktopEndingSequence(store);
    assert.ok(resetM1);
    assert.equal(resetM1.m1EndingStage, 'none');
    assert.equal(resetM1.hatredBookEscapeEntryAdded, false);
    assert.deepEqual(resetM1.iconCells['desktop-decor-hatred-book'], { col: 3, row: 2 });

    // Casual Lin Longxin sprite expressions resolve cleanly
    for (const expr of ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'] as const) {
      assert.equal(
        resolveLinLongxinCasualSprite(expr),
        LIN_LONGXIN_CASUAL_EXPRESSION_PATHS[expr]
      );
      assert.ok(resolveLinLongxinCasualSprite(expr).includes(`./assets/story/longxin-casual/${expr}.webp`));
    }

    const root = process.cwd();
    const viewSrc = await fs.readFile(
      path.join(root, 'src', 'components', 'WindowsDesktopView.tsx'),
      'utf8'
    );
    const mapSrc = await fs.readFile(
      path.join(root, 'src', 'components', 'EscapeRouteMapView.tsx'),
      'utf8'
    );
    const appSrc = await fs.readFile(path.join(root, 'src', 'App.tsx'), 'utf8');

    // User's exact edited first-person escape diary entry & add-entry button
    assert.ok(viewSrc.includes('id="hatred-btn-add-entry"'));
    assert.ok(viewSrc.includes('脑子都快停机了'));
    assert.ok(viewSrc.includes('今天我早就交代在网线那头了'));
    assert.ok(viewSrc.includes('别碰黑域协议网！不管谁再吹得天花乱坠，这辈子也绝对、永远、再也别碰黑域协议网！'));

    // Chained bottom-right popups: Black Domain official notice -> Lin Longxin WeXin message
    assert.ok(viewSrc.includes('id="desktop-popup-blackdomain"'));
    assert.ok(viewSrc.includes('黑域协议网 // 官方协议通知'));
    assert.ok(viewSrc.includes('【官方通知】猎杀榜 NO.1 席位更替'));
    assert.ok(viewSrc.includes('已正式取代原榜首'));
    assert.ok(viewSrc.includes('id="desktop-popup-wexin-longxin"'));
    assert.ok(viewSrc.includes("resolveLinLongxinCasualSprite('surprise')"));
    assert.ok(viewSrc.includes('今晚出来见一面给我好好交代清楚到底发生了什么呀'));
    assert.ok(viewSrc.includes("playSound('popup-alert')"));
    assert.ok(viewSrc.includes("playSound('wexin-ping')"));
    assert.ok(!viewSrc.includes('黑盒'));
    assert.ok(!/black\s*box/i.test(viewSrc));

    // SEC-04 EXIT-RL auto disconnect back to desktop
    assert.ok(appSrc.includes('triggerExitDisconnectToDesktop'));
    assert.ok(appSrc.includes('activateM1DesktopEndingSequence'));
    assert.ok(mapSrc.includes('CHAPTER 1 CLEARED // 现实逃脱完成'));
    assert.ok(!mapSrc.includes('突围测试闭环完成'));
    assert.ok(mapSrc.includes('id="escape-btn-skip-disconnect"'));
  });
});
