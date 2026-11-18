import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BGM_TRACK_META,
  DEFAULT_BGM_SETTINGS,
  DEFAULT_SOUND_SETTINGS,
  actionToSoundCue,
  getCurrentBgmScene,
  midiToFreq,
  playSound,
  previewBgmScene,
  resolveBgmScene,
  sanitizeBgmSettings,
  sanitizeSoundSettings,
  setBgmScene,
  showdownToSoundCue,
  stopBgm,
  unlockAudioContext,
} from '../src/engine/soundEngine.ts';

describe('soundEngine: action/showdown cue mapping, settings clamping & Node fallback', () => {
  it('sanitizes sound settings with valid defaults and clamps volume into [0, 1]', () => {
    assert.deepEqual(sanitizeSoundSettings(null), DEFAULT_SOUND_SETTINGS);
    assert.deepEqual(sanitizeSoundSettings({ enabled: false, volume: 1.8 }), {
      enabled: false,
      volume: 1,
    });
    assert.deepEqual(sanitizeSoundSettings({ enabled: true, volume: -0.4 }), {
      enabled: true,
      volume: 0,
    });
    assert.deepEqual(sanitizeSoundSettings({ volume: Number.NaN }), {
      enabled: true,
      volume: DEFAULT_SOUND_SETTINGS.volume,
    });
  });

  it('maps every GameAction / ActionLogEntry type cleanly to a distinct SoundCue', () => {
    assert.equal(actionToSoundCue(null), null);
    assert.equal(actionToSoundCue({ type: 'flip' }), 'flip');
    assert.equal(actionToSoundCue({ type: 'swap' }), 'swap');
    assert.equal(actionToSoundCue({ type: 'check' }), 'check');
    assert.equal(actionToSoundCue({ type: 'call' }), 'call');
    assert.equal(actionToSoundCue({ type: 'raise', amount: 20 }), 'raise');
    assert.equal(actionToSoundCue({ type: 'raise', amount: 120 }), 'raise-heavy');
    assert.equal(actionToSoundCue({ type: 'fold' }), 'fold');
    assert.equal(actionToSoundCue({ type: 'hack', actor: 'human' }), 'hack');
    assert.equal(actionToSoundCue({ type: 'hack', actor: 'ai' }), null);
    assert.equal(actionToSoundCue({ type: 'scan', caught: false }), 'scan-clean');
    assert.equal(actionToSoundCue({ type: 'scan', caught: true }), 'scan-caught');
    assert.equal(actionToSoundCue({ type: 'use-skill' }), 'skill');
    assert.equal(
      actionToSoundCue({ type: 'use-skill', actor: 'human', label: '我方 激活「富兰克林之死」' }),
      'blade-slash'
    );
    assert.equal(
      actionToSoundCue({ type: 'scan', actor: 'human', caught: true, label: '见切·燕返拔刀反杀' }),
      'blade-slash'
    );
    assert.equal(
      actionToSoundCue({ type: 'flip', actor: 'human', label: '触动「灼心·火符」灼烧 -100 算力！' }),
      'fire-burn'
    );
    assert.equal(
      actionToSoundCue({ type: 'swap', actor: 'human', label: '触动「灼心·火符」灼烧 -100 算力！' }),
      'fire-burn'
    );
  });

  it('maps showdown & bankrupt outcomes accurately for player vs opponent', () => {
    assert.equal(
      showdownToSoundCue({ winner: 'ai', reason: 'showdown' }, 0, 2000),
      'human-bankrupt'
    );
    assert.equal(
      showdownToSoundCue({ winner: 'human', reason: 'showdown' }, 2000, 0),
      'ai-bankrupt'
    );
    assert.equal(
      showdownToSoundCue({ winner: 'human', reason: 'scan-caught' }, 1200, 800),
      'win'
    );
    assert.equal(
      showdownToSoundCue({ winner: 'ai', reason: 'fold' }, 900, 1100),
      'round-loss'
    );
    assert.equal(
      showdownToSoundCue({ winner: 'tie', reason: 'showdown' }, 1000, 1000),
      'tie'
    );
  });

  it('degrades safely with zero exceptions in headless Node without AudioContext', () => {
    assert.doesNotThrow(() => unlockAudioContext());
    assert.equal(playSound('flip'), false);
    assert.equal(playSound('charge-tick', { progress: 55 }), false);
    assert.equal(playSound('wall-hit'), false);
    assert.equal(playSound('rewind-crack'), false);
    assert.equal(playSound('rewind-shatter'), false);
    assert.equal(playSound('alarm-siren'), false);
    assert.equal(playSound('popup-alert'), false);
    assert.equal(playSound('wexin-ping'), false);
  });

  it('sanitizes BGM settings, maps all 5 cyber-noir BGM scenes accurately, and degrades safely in Node', () => {
    assert.deepEqual(sanitizeBgmSettings(null), DEFAULT_BGM_SETTINGS);
    assert.deepEqual(sanitizeBgmSettings({ enabled: false, volume: 1.5 }), {
      enabled: false,
      volume: 1,
    });
    assert.deepEqual(sanitizeBgmSettings({ enabled: true, volume: -0.2 }), {
      enabled: true,
      volume: 0,
    });
    assert.deepEqual(sanitizeBgmSettings({ volume: Number.NaN }), {
      enabled: true,
      volume: DEFAULT_BGM_SETTINGS.volume,
    });

    assert.equal(midiToFreq(69), 440);
    assert.equal(Math.round(midiToFreq(81)), 880);

    for (const id of ['desktop', 'escape-map', 'story-vn', 'table-calm', 'table-tension'] as const) {
      assert.ok(BGM_TRACK_META[id].title.length > 0);
      assert.ok(BGM_TRACK_META[id].bpm >= 60);
    }

    assert.equal(resolveBgmScene({ viewMode: 'desktop' }), 'desktop');
    assert.equal(resolveBgmScene({ viewMode: 'terminal-login' }), 'desktop');
    assert.equal(resolveBgmScene({ viewMode: 'escape-map' }), 'escape-map');
    assert.equal(
      resolveBgmScene({ viewMode: 'escape-map', isOfflineDisconnected: true }),
      'desktop'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', activeVnKind: 'sec01-intro' }),
      'story-vn'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', activeVnKind: 'sec04-berserk' }),
      'table-tension'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', activeEscapeNodeIndex: 1 }),
      'table-calm'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', activeEscapeNodeIndex: null, isDangerCompute: true }),
      'table-tension'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', activeEscapeNodeIndex: 4 }),
      'table-tension'
    );
    assert.equal(
      resolveBgmScene({ viewMode: 'arena', sec04ClimaxPhase: 'hand-0' }),
      'table-tension'
    );

    assert.doesNotThrow(() => setBgmScene('table-calm'));
    assert.equal(getCurrentBgmScene(), 'table-calm');
    assert.equal(previewBgmScene('story-vn'), false);
    assert.equal(getCurrentBgmScene(), 'story-vn');
    assert.doesNotThrow(() => stopBgm());
    assert.equal(getCurrentBgmScene(), null);
  });
});
