import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SOUND_SETTINGS,
  actionToSoundCue,
  playSound,
  sanitizeSoundSettings,
  showdownToSoundCue,
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
  });
});
