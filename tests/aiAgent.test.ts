import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, type AiStyle } from '../src/engine/types.ts';
import {
  applyAction,
  createInitialState,
  isActionLegal,
  startNextHand,
} from '../src/engine/gameEngine.ts';
import { LocalAiAgent } from '../src/engine/aiAgent.ts';

describe('aiAgent: legality and full-hand self-play', () => {
  it('always produces legal actions across styles and completes 12 full hands without deadlock', async () => {
    const styles: AiStyle[] = ['balanced', 'aggressive', 'cautious'];
    const agents = {
      human: new LocalAiAgent('human', 'balanced'),
      ai: new LocalAiAgent('ai', 'aggressive'),
    };

    for (const style of styles) {
      agents.ai = new LocalAiAgent('ai', style);
      let state = createInitialState({
        config: { ...DEFAULT_CONFIG, aiStyle: style, aiDelayMs: 0 },
      });

      for (let h = 0; h < 4; h++) {
        let guard = 0;
        while (state.phase !== 'showdown') {
          guard++;
          assert.ok(guard < 120, `Hand exceeded 120 plies in style=${style}`);
          const actor = state.currentTurn;
          const decision = await agents[actor].decide(state);
          assert.ok(
            isActionLegal(state, decision.action),
            `Illegal AI action ${JSON.stringify(decision.action)} in phase ${state.phase}`
          );
          assert.ok(decision.dialogue.text.length > 0);
          state = applyAction(state, decision.action);
        }

        assert.equal(
          state.players.human.chips + state.players.ai.chips,
          DEFAULT_CONFIG.startingChips * 2
        );

        if (state.players.human.chips > 0 && state.players.ai.chips > 0) {
          state = startNextHand(state);
        } else {
          break;
        }
      }
    }
  });
});
