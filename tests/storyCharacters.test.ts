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
});
