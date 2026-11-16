import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHO0_CHARACTER_DOSSIER,
  SEC01_CHARACTER_DOSSIER,
  SEC01_EXPRESSION_PATHS,
  STORY_CHARACTER_DOSSIERS,
  getStoryCharacterByEscapeNode,
  resolveSec01Sprite,
} from '../src/engine/storyCharacters.ts';
import { ESCAPE_ROUTE_NODES } from '../src/engine/escapeMap.ts';
import {
  fetchContractCatalog,
  loadContractCharacterByFile,
} from '../src/engine/cardRepository.ts';
import { CONTRACT_EXPRESSIONS } from '../src/engine/contractCards.ts';
import { builtinWorldbook, worldbookContext } from '../src/engine/worldbook.ts';
import {
  applyAction,
  createDeck,
  createInitialState,
  getVisibleHandCard,
  getVisiblePlayerChips,
  isActionLegal,
} from '../src/engine/gameEngine.ts';
import { getSkillById } from '../src/engine/skillPool.ts';

describe('storyCharacters: SEC-01 新人物「凌翡 // JADE-01」千金大小姐档案与技能保留', () => {
  it('defines SEC01_CHARACTER_DOSSIER with arrogant heiress persona, traits, voice, and 6 expressions', () => {
    assert.equal(SEC01_CHARACTER_DOSSIER.name, '凌翡');
    assert.equal(SEC01_CHARACTER_DOSSIER.codename, 'JADE-01');
    assert.equal(SEC01_CHARACTER_DOSSIER.expressionCount, 6);
    assert.ok(SEC01_CHARACTER_DOSSIER.title.includes('千金'));
    assert.ok(SEC01_CHARACTER_DOSSIER.personality.includes('千金') || SEC01_CHARACTER_DOSSIER.personality.includes('傲慢'));
    assert.ok(SEC01_CHARACTER_DOSSIER.traits.length >= 3);
    assert.ok((SEC01_CHARACTER_DOSSIER.voice?.samples.length ?? 0) >= 4);

    for (const expr of CONTRACT_EXPRESSIONS) {
      assert.equal(
        resolveSec01Sprite(expr),
        `./assets/story/sec01/${expr}.webp`,
        `SEC-01 sprite for ${expr} should resolve cleanly`
      );
      assert.equal(SEC01_CHARACTER_DOSSIER.variants[`witchform:${expr}`], SEC01_EXPRESSION_PATHS[expr]);
      assert.equal(SEC01_CHARACTER_DOSSIER.variants[`custom:${expr}`], SEC01_EXPRESSION_PATHS[expr]);
    }
  });

  it('resolves story dossiers by escape node index', () => {
    assert.equal(getStoryCharacterByEscapeNode(0)?.id, ECHO0_CHARACTER_DOSSIER.id);
    assert.equal(getStoryCharacterByEscapeNode(1)?.id, SEC01_CHARACTER_DOSSIER.id);
    assert.equal(getStoryCharacterByEscapeNode(99), null);
    assert.ok(STORY_CHARACTER_DOSSIERS.some((d) => d.id === SEC01_CHARACTER_DOSSIER.id));
  });

  it('binds SEC-01 node to 「凌翡」 while preserving all SEC-01 skills and rewards unchanged', () => {
    const sec01 = ESCAPE_ROUTE_NODES[1];
    assert.equal(sec01.code, 'SEC-01');
    assert.equal(sec01.opponentName, '凌翡');
    assert.equal(sec01.opponentChips, 600);
    assert.equal(sec01.difficulty, 'rookie');
    assert.equal(sec01.signatureSkillId, 'siphon-cache');
    assert.equal(sec01.signatureSkillName, '算力虹吸');
    assert.deepEqual(sec01.rewardSkillChoices, ['siphon-cache', 'overclock-bluff']);
  });

  it('exposes SEC-01 and ECHO-0 dossiers cleanly through cardRepository', async () => {
    const loaded = await loadContractCharacterByFile(SEC01_CHARACTER_DOSSIER.fileName);
    assert.equal(loaded.name, '凌翡');
    assert.equal(loaded.codename, 'JADE-01');

    const { cards } = await fetchContractCatalog();
    assert.ok(cards.some((c) => c.fileName === SEC01_CHARACTER_DOSSIER.fileName));
  });

  it('syncs Black River / BLACK BOX / Perfect Virtual Entity / ECHO-0 empathy lore into worldbook and dossiers', () => {
    const entries = builtinWorldbook();
    const res = worldbookContext('黑河企业 黑盒 猎杀榜 完美虚拟实体 ECHO-0 共情', entries, 4000);
    assert.ok(res.text.includes('黑河企业'));
    assert.ok(res.text.includes('黑盒'));
    assert.ok(res.text.includes('完美虚拟实体'));
    assert.ok(res.text.includes('共情'));

    assert.ok(!ECHO0_CHARACTER_DOSSIER.goal.includes('原初账本'));
    assert.ok(ECHO0_CHARACTER_DOSSIER.goal.includes('完美虚拟实体'));
    assert.ok(ECHO0_CHARACTER_DOSSIER.personality.includes('共情'));

    assert.ok(SEC01_CHARACTER_DOSSIER.personality.includes('实名'));
    assert.ok(SEC01_CHARACTER_DOSSIER.personality.includes('没人敢赢'));
    assert.ok(SEC01_CHARACTER_DOSSIER.traits.some((t) => t.name.includes('钦定王牌')));
  });

  it('executes Ling Fei special cheat skill crown-ace to turn an open hand card into same-suit Ace secretly', () => {
    const skillMeta = getSkillById('crown-ace');
    assert.ok(skillMeta);
    assert.equal(skillMeta.name, '钦定王牌');
    assert.equal(ESCAPE_ROUTE_NODES[1].specialCheatSkillId, 'crown-ace');

    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;

    let state = createInitialState({
      opponentName: '凌翡',
      chips: { human: 600, ai: 600 },
      aiSpecialCheatSkill: 'crown-ace',
      deckOverride: [
        pick(10, 'B', 0), pick(9, 'P', 0), pick(4, 'B', 0),
        pick(3, 'P', 0), pick(12, 'B', 0), pick(5, 'B', 0),
        pick(7, 'B', 0), pick(8, 'P', 0), pick(11, 'B', 0), pick(6, 'P', 0),
      ],
    });
    // Force AI turn with diff = 0 to test AI crown-ace
    state = { ...state, currentTurn: 'ai' };
    const legalAct = { type: 'use-skill' as const, skillId: 'crown-ace', targetIndex: 0 };
    assert.equal(isActionLegal(state, legalAct), true);

    const afterCheat = applyAction(state, legalAct);
    // Card[0] was 3P -> becomes 14P (Ace of Pink), originalCard preserved as 3P
    assert.equal(afterCheat.players.ai.hand[0].card.rank, 14);
    assert.equal(afterCheat.players.ai.hand[0].card.suit, 'P');
    assert.equal(afterCheat.players.ai.hand[0].originalCard?.rank, 3);
    assert.equal(afterCheat.currentTurn, 'ai'); // Does NOT end turn
    // Human viewer still sees unmodified 3P and unmodified chips!
    assert.equal(getVisibleHandCard(afterCheat.players.ai.hand[0], 'human', 'ai', false).rank, 3);
    assert.equal(getVisiblePlayerChips(afterCheat, 'ai', 'human'), 590); // 600 - 10 ante

    // Human can scan and catch the crown-ace tamper!
    const humanTurnState = applyAction(afterCheat, { type: 'flip', boardIndex: 1 });
    const afterScan = applyAction(humanTurnState, { type: 'scan', targetKind: 'hand', targetIndex: 0 });
    assert.equal(afterScan.phase, 'showdown');
    assert.equal(afterScan.result?.reason, 'scan-caught');
    assert.equal(afterScan.result?.winner, 'human');
  });
});
