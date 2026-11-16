import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEBUG_CHEAT_COMMANDS,
  applyDebugWinHand,
  applyDebugChipsOverride,
  applyDebugPresetHand,
  parseDebugCommand,
} from '../src/engine/debugCmd.ts';
import { createInitialState } from '../src/engine/gameEngine.ts';
import { evaluateSevenCards } from '../src/engine/evaluator.ts';

describe('debugCmd: 黑域调试终端指令解析与作弊效果', () => {
  it('parses cheat commands case-insensitively with aliases and flags invalid arguments', () => {
    assert.deepEqual(parseDebugCommand('help'), { ok: true, cmd: 'help' });
    assert.deepEqual(parseDebugCommand('  WIN '), { ok: true, cmd: 'win' });
    assert.deepEqual(parseDebugCommand('clearnode'), { ok: true, cmd: 'win' });
    assert.deepEqual(parseDebugCommand('gg'), { ok: true, cmd: 'win' });
    assert.deepEqual(parseDebugCommand('goto 3'), { ok: true, cmd: 'goto', nodeIndex: 3 });
    assert.deepEqual(parseDebugCommand('chips ai 50'), {
      ok: true,
      cmd: 'chips',
      target: 'ai',
      amount: 50,
    });
    assert.deepEqual(parseDebugCommand('hand quads'), {
      ok: true,
      cmd: 'hand',
      preset: 'quads',
    });
    assert.deepEqual(parseDebugCommand('resetprofile'), { ok: true, cmd: 'resetprofile' });
    assert.deepEqual(parseDebugCommand('wipe'), { ok: true, cmd: 'resetprofile' });
    assert.deepEqual(parseDebugCommand('clearprofile'), { ok: true, cmd: 'resetprofile' });

    const badGoto = parseDebugCommand('goto 99');
    assert.equal(badGoto.ok, false);
    const unknown = parseDebugCommand('sudo rm -rf');
    assert.equal(unknown.ok, false);
    assert.ok(DEBUG_CHEAT_COMMANDS.length >= 6);
  });

  it('forces an instant clean victory showdown with ai chips reduced to 0', () => {
    const base = createInitialState({ chips: { human: 1000, ai: 400 } });
    const won = applyDebugWinHand(base);

    assert.equal(won.phase, 'showdown');
    assert.equal(won.players.ai.chips, 0);
    assert.equal(won.players.human.chips + won.players.ai.chips, 1400);
    assert.equal(won.result?.winner, 'human');
    assert.equal(won.pot, 0);
  });

  it('overrides player or ai chips safely without negative values', () => {
    const base = createInitialState();
    const tweaked = applyDebugChipsOverride(base, 'ai', 10);
    assert.equal(tweaked.players.ai.chips, 10);
    const clamped = applyDebugChipsOverride(base, 'human', -50);
    assert.equal(clamped.players.human.chips, 0);
  });

  it('deals a valid non-duplicate preset hand (quads A) that evaluates to Four of a Kind', () => {
    const base = createInitialState();
    const rigged = applyDebugPresetHand(base, 'quads');
    const allSeven = [
      ...rigged.players.human.hand.map((h) => h.card),
      ...rigged.board.map((b) => b.card),
    ];
    const ids = new Set(allSeven.map((c) => c.id));
    assert.equal(ids.size, 7);

    const evalRes = evaluateSevenCards(allSeven);
    assert.equal(evalRes.categoryKey, 'four-of-a-kind');
  });
});
