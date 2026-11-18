import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHO0_CHARACTER_DOSSIER,
  LIN_LONGXIN_CASUAL_SPRITE,
  MUTE_DECOY_THOUGHT_POOL,
  SEC01_CHARACTER_DOSSIER,
  SEC02_CHARACTER_DOSSIER,
  SEC03_CHARACTER_DOSSIER,
  SEC04_CHARACTER_DOSSIER,
  SEC01_EXPRESSION_PATHS,
  SEC02_EXPRESSION_PATHS,
  SEC03_EXPRESSION_PATHS,
  SEC04_EXPRESSION_PATHS,
  STORY_CHARACTER_DOSSIERS,
  formatMuteGarbledText,
  getStoryCharacterByEscapeNode,
  isMuteGarbledCharacter,
  pickMuteActionThought,
  resolveEcho0Sprite,
  resolveSec01Sprite,
  resolveSec02Sprite,
  resolveSec03Sprite,
  resolveSec04Sprite,
  resolveStoryPlayerEntity,
} from '../src/engine/storyCharacters.ts';
import { SEC00_VN_SCRIPT } from '../src/engine/sec00Tutorial.ts';
import { SEC01_VN_SCRIPT } from '../src/engine/sec01Intro.ts';
import { SEC01_EPILOGUE_VN_SCRIPT } from '../src/engine/sec01Epilogue.ts';
import { SEC02_VN_SCRIPT } from '../src/engine/sec02Intro.ts';
import { SEC02_EPILOGUE_VN_SCRIPT } from '../src/engine/sec02Epilogue.ts';
import { SEC03_VN_SCRIPT } from '../src/engine/sec03Intro.ts';
import { SEC03_EPILOGUE_VN_SCRIPT } from '../src/engine/sec03Epilogue.ts';
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
  formatTamperLabel,
  getDisplayCardForTable,
  getRemainingSuitStats,
  getVisibleBoardCard,
  getVisibleHandCard,
  getVisiblePlayerChips,
  isActionLegal,
  isCardTamperedFromOriginal,
} from '../src/engine/gameEngine.ts';
import { evaluateSevenCards } from '../src/engine/evaluator.ts';
import { getSkillById, getSkillGroup } from '../src/engine/skillPool.ts';

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

  it('treats crown-ace as a hack-tier skill usable multiple times across turns in the same hand and sealed independently on scan', () => {
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
    // Force AI turn with diff = 0 to test AI crown-ace as a hack-tier skill
    state = { ...state, currentTurn: 'ai' };
    const hackCrown0 = { type: 'hack' as const, handIndex: 0, skill: 'crown-ace' as const };
    assert.equal(isActionLegal(state, hackCrown0), true);

    const afterFirstCheat = applyAction(state, hackCrown0);
    // Card[0] was 3P -> becomes 14P (Ace of Pink), originalCard preserved as 3P
    assert.equal(afterFirstCheat.players.ai.hand[0].card.rank, 14);
    assert.equal(afterFirstCheat.players.ai.hand[0].card.suit, 'P');
    assert.equal(afterFirstCheat.players.ai.hand[0].originalCard?.rank, 3);
    assert.deepEqual(afterFirstCheat.players.ai.hand[0].tamperedBy, ['crown-ace']);
    assert.equal(afterFirstCheat.currentTurn, 'ai'); // Does NOT end turn
    assert.equal(afterFirstCheat.usedHackThisTurn, true);
    assert.equal(afterFirstCheat.usedProtocolSkillThisHand, false); // Does NOT consume once-per-hand slot!
    // Human viewer still sees unmodified 3P and unmodified chips!
    assert.equal(getVisibleHandCard(afterFirstCheat.players.ai.hand[0], 'human', 'ai', false).rank, 3);
    assert.equal(getVisiblePlayerChips(afterFirstCheat, 'ai', 'human'), 590);

    // Same turn cannot hack twice, so AI flips board[1], then human flips board[2], returning turn to AI
    assert.equal(isActionLegal(afterFirstCheat, { type: 'hack', handIndex: 1, skill: 'crown-ace' }), false);
    const afterAiFlip = applyAction(afterFirstCheat, { type: 'flip', boardIndex: 1 });
    const backToAi = applyAction(afterAiFlip, { type: 'flip', boardIndex: 2 });
    assert.equal(backToAi.currentTurn, 'ai');
    assert.equal(backToAi.usedHackThisTurn, false);

    // Second turn in the SAME hand: AI can use crown-ace AGAIN on card[1] (12B -> 14B)!
    const hackCrown1 = { type: 'hack' as const, handIndex: 1, skill: 'crown-ace' as const };
    assert.equal(isActionLegal(backToAi, hackCrown1), true);
    const afterSecondCheat = applyAction(backToAi, hackCrown1);
    assert.equal(afterSecondCheat.players.ai.hand[1].card.rank, 14);
    assert.equal(afterSecondCheat.players.ai.hand[1].card.suit, 'B');

    // Human scans card[0] and catches crown-ace -> seals 'crown-ace' specifically, NOT 'plus-one'
    const humanTurnState = applyAction(afterSecondCheat, { type: 'flip', boardIndex: 3 });
    const afterScan = applyAction(humanTurnState, { type: 'scan', targetKind: 'hand', targetIndex: 0 });
    assert.equal(afterScan.phase, 'showdown');
    assert.equal(afterScan.result?.reason, 'scan-caught');
    assert.equal(afterScan.result?.winner, 'human');
    assert.ok(afterScan.players.ai.sealedSkills.includes('crown-ace'));
    assert.ok(!afterScan.players.ai.sealedSkills.includes('plus-one'));
  });

  it('replaces SEC-02 with mute orphan hunter 「芙兰 // MUTE-02」, renames cold-freq-lock to 富兰克林之死, and garbles speech', () => {
    assert.equal(SEC02_CHARACTER_DOSSIER.name, '芙兰');
    assert.equal(SEC02_CHARACTER_DOSSIER.codename, 'MUTE-02');
    assert.equal(SEC02_CHARACTER_DOSSIER.expressionCount, 6);
    assert.ok(SEC02_CHARACTER_DOSSIER.personality.includes('孤儿'));
    assert.ok(SEC02_CHARACTER_DOSSIER.personality.includes('失声'));
    assert.ok(SEC02_CHARACTER_DOSSIER.personality.includes('黑河'));
    assert.ok(SEC02_CHARACTER_DOSSIER.traits.length >= 3);
    assert.ok((SEC02_CHARACTER_DOSSIER.voice?.samples.length ?? 0) >= 4);

    for (const expr of CONTRACT_EXPRESSIONS) {
      assert.equal(resolveSec02Sprite(expr), `./assets/story/sec02/${expr}.webp`);
      assert.equal(SEC02_CHARACTER_DOSSIER.variants[`witchform:${expr}`], SEC02_EXPRESSION_PATHS[expr]);
    }

    assert.equal(getStoryCharacterByEscapeNode(2)?.id, SEC02_CHARACTER_DOSSIER.id);
    const sec02 = ESCAPE_ROUTE_NODES[2];
    assert.equal(sec02.opponentName, '芙兰');
    assert.equal(sec02.signatureSkillId, 'cold-freq-lock');
    assert.equal(sec02.signatureSkillName, '富兰克林之死');
    assert.equal(sec02.specialCheatSkillId, 'null-erase');
    assert.equal(getSkillById('cold-freq-lock')?.name, '富兰克林之死');

    assert.equal(isMuteGarbledCharacter(SEC02_CHARACTER_DOSSIER.id), true);
    assert.equal(isMuteGarbledCharacter(SEC01_CHARACTER_DOSSIER.id), false);
    const garbled = formatMuteGarbledText('准备收割你的算力链路');
    assert.ok(garbled.length > 4);
    assert.ok(!garbled.includes('准备收割你的算力链路'));

    // Decoy feral thoughts apply across non-cheat actions without leaking NULL/抹除/毒饵/脏东西
    assert.ok(MUTE_DECOY_THOUGHT_POOL.length >= 5);
    for (const t of MUTE_DECOY_THOUGHT_POOL) {
      assert.ok(!/NULL|抹除|废牌|毒饵|脏东西/.test(t), `Thought leaked cheat intent: ${t}`);
    }
    const flipDecoy = pickMuteActionThought('flip', () => 0.2);
    const swapThought = pickMuteActionThought('swap', () => 0.2);
    assert.equal(flipDecoy, swapThought);
    assert.ok(pickMuteActionThought('scan').includes('嗅到了'));
    assert.ok(pickMuteActionThought('fold').includes('退半步'));
  });

  it('executes null-erase on own open hand card secretly, excludes blank cards from evaluation, and seals on scan', () => {
    const sk = getSkillById('null-erase');
    assert.ok(sk);
    assert.equal(getSkillGroup('null-erase'), 'cheat');

    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;

    // 4 Aces would normally be Quads, but if one Ace is blanked (isBlank: true), only 3 Aces remain -> Trips!
    const erasedAce = { ...pick(14, 'P', 1), isBlank: true };
    const evalWithoutOne = evaluateSevenCards([
      pick(14, 'B', 0),
      pick(14, 'B', 1),
      pick(14, 'P', 0),
      erasedAce,
      pick(9, 'B', 0),
      pick(6, 'P', 0),
      pick(2, 'B', 0),
    ]);
    assert.equal(evalWithoutOne.categoryKey, 'three-of-a-kind');

    // Even when 3 cards are blanked leaving only 4 cards, evaluateSevenCards never throws
    const evalPartial = evaluateSevenCards([
      pick(13, 'B', 0),
      pick(13, 'P', 0),
      { ...pick(10, 'B', 0), isBlank: true },
      { ...pick(8, 'P', 0), isBlank: true },
      { ...pick(5, 'B', 0), isBlank: true },
      pick(4, 'P', 0),
      pick(2, 'B', 0),
    ]);
    assert.equal(evalPartial.categoryKey, 'one-pair');

    let state = createInitialState({
      opponentName: '芙兰',
      chips: { human: 750, ai: 750 },
      aiSpecialCheatSkill: 'null-erase',
      deckOverride: [
        pick(10, 'B', 0), pick(9, 'P', 0), pick(4, 'B', 0),
        pick(14, 'P', 0), pick(12, 'B', 0), pick(5, 'B', 0),
        pick(7, 'B', 0), pick(8, 'P', 0), pick(11, 'B', 0), pick(6, 'P', 0),
      ],
    });
    state = { ...state, currentTurn: 'ai' };
    const eraseAct = { type: 'hack' as const, handIndex: 0, skill: 'null-erase' as const };
    assert.equal(isActionLegal(state, eraseAct), true);

    const afterErase = applyAction(state, eraseAct);
    assert.equal(afterErase.players.ai.hand[0].card.isBlank, true);
    assert.equal(afterErase.players.ai.hand[0].originalCard?.rank, 14);
    assert.deepEqual(afterErase.players.ai.hand[0].tamperedBy, ['null-erase']);
    assert.equal(
      isCardTamperedFromOriginal(afterErase.players.ai.hand[0].card, afterErase.players.ai.hand[0].originalCard),
      true
    );
    assert.equal(
      formatTamperLabel(afterErase.players.ai.hand[0].card, afterErase.players.ai.hand[0].originalCard),
      '原:粉A'
    );
    assert.equal(formatTamperLabel(afterErase.players.ai.hand[1].card, afterErase.players.ai.hand[1].originalCard), undefined);
    assert.equal(afterErase.usedHackThisTurn, true);
    assert.equal(afterErase.usedProtocolSkillThisHand, false);
    // Opponent still sees unmodified 14P!
    assert.equal(getVisibleHandCard(afterErase.players.ai.hand[0], 'human', 'ai', false).isBlank, undefined);
    assert.equal(getVisibleHandCard(afterErase.players.ai.hand[0], 'human', 'ai', false).rank, 14);

    // AI swaps that erased card into board[0] -> human sees 14P on board, but real card is blanked!
    const afterSwap = applyAction(afterErase, { type: 'swap', handIndex: 0, boardIndex: 0 });
    assert.equal(afterSwap.board[0].card.isBlank, true);
    assert.equal(formatTamperLabel(afterSwap.board[0].card, afterSwap.board[0].originalCard), '原:粉A');
    assert.equal(getVisibleBoardCard(afterSwap.board[0], 'human', false).isBlank, undefined);
    assert.equal(getVisibleBoardCard(afterSwap.board[0], 'human', false).rank, 14);

    // Human scans board[0] and catches null-erase -> seals 'null-erase'
    const afterScan = applyAction(afterSwap, { type: 'scan', targetKind: 'board', targetIndex: 0 });
    assert.equal(afterScan.phase, 'showdown');
    assert.equal(afterScan.result?.reason, 'scan-caught');
    assert.equal(afterScan.result?.winner, 'human');
    assert.ok(afterScan.players.ai.sealedSkills.includes('null-erase'));
  });

  it('replaces SEC-03 with 「粉红软软龙 // NEON-03」, Neon Heart colleague lore, and 6 expressions', () => {
    assert.equal(SEC03_CHARACTER_DOSSIER.name, '粉红软软龙');
    assert.equal(SEC03_CHARACTER_DOSSIER.codename, 'NEON-03');
    assert.equal(SEC03_CHARACTER_DOSSIER.expressionCount, 6);
    assert.ok(SEC03_CHARACTER_DOSSIER.personality.includes('霓虹心'));
    assert.ok(SEC03_CHARACTER_DOSSIER.personality.includes('脸盲'));
    assert.ok(
      SEC03_CHARACTER_DOSSIER.personality.includes('假小子') ||
        SEC03_CHARACTER_DOSSIER.personality.includes('大大咧咧')
    );
    assert.ok(
      SEC03_CHARACTER_DOSSIER.personality.includes('身体接触') ||
        SEC03_CHARACTER_DOSSIER.traits.some((t) => t.description.includes('身体接触'))
    );
    assert.ok((SEC03_CHARACTER_DOSSIER.voice?.samples.length ?? 0) >= 4);

    for (const expr of CONTRACT_EXPRESSIONS) {
      assert.equal(resolveSec03Sprite(expr), `./assets/story/sec03/${expr}.webp`);
      assert.equal(
        SEC03_CHARACTER_DOSSIER.variants[`witchform:${expr}`],
        SEC03_EXPRESSION_PATHS[expr]
      );
      assert.equal(
        SEC03_CHARACTER_DOSSIER.variants[`custom:${expr}`],
        SEC03_EXPRESSION_PATHS[expr]
      );
    }

    assert.equal(getStoryCharacterByEscapeNode(3)?.id, SEC03_CHARACTER_DOSSIER.id);
    const sec03 = ESCAPE_ROUTE_NODES[3];
    assert.equal(sec03.opponentName, '粉红软软龙');
    assert.equal(sec03.signatureSkillId, 'pink-mirage');
    assert.equal(sec03.specialCheatSkillId, 'pink-double');

    const wbRes = worldbookContext('霓虹心 粉红软软龙', builtinWorldbook(), 4000);
    assert.ok(wbRes.text.includes('霓虹心'));
  });

  it('applies pink-mirage (Option 1) to display all open cards as Pink before showdown without leaking Black suits', () => {
    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;

    const blackCard = pick(9, 'B', 0);
    const blankCard = { ...pick(4, 'B', 0), isBlank: true };

    // Open card in play -> visually Pink; private card or showdown -> keeps real Black; blank stays blank
    const maskedOpen = getDisplayCardForTable(blackCard, {
      isOpen: true,
      signatureSkill: 'pink-mirage',
      revealAll: false,
    });
    assert.equal(maskedOpen.suit, 'P');

    const privateCard = getDisplayCardForTable(blackCard, {
      isOpen: false,
      signatureSkill: 'pink-mirage',
      revealAll: false,
    });
    assert.equal(privateCard.suit, 'B');

    const showdownCard = getDisplayCardForTable(blackCard, {
      isOpen: true,
      signatureSkill: 'pink-mirage',
      revealAll: true,
    });
    assert.equal(showdownCard.suit, 'B');

    const maskedBlank = getDisplayCardForTable(blankCard, {
      isOpen: true,
      signatureSkill: 'pink-mirage',
      revealAll: false,
    });
    assert.equal(maskedBlank.isBlank, true);

    // Remaining suit tracker under pink-mirage treats all 6 initial open cards as Pink (seenBlack = 0)
    const state = createInitialState({
      opponentName: '粉红软软龙',
      opponentSignatureSkill: 'pink-mirage',
      deckOverride: [
        pick(10, 'B', 0), pick(8, 'B', 0), pick(4, 'B', 0),
        pick(3, 'B', 0), pick(12, 'B', 0), pick(5, 'B', 0),
        pick(7, 'B', 0), pick(8, 'P', 0), pick(11, 'B', 0), pick(6, 'P', 0),
      ],
    });
    const stats = getRemainingSuitStats(state, 'human');
    assert.equal(stats.blackLeft, 26);
    assert.equal(stats.pinkLeft, 20);
  });

  it('executes pink-double (Option A) on Pink open card only, counts as 2 Pink cards for Flush without creating a pair, and seals on scan', () => {
    const sk = getSkillById('pink-double');
    assert.ok(sk);
    assert.equal(getSkillGroup('pink-double'), 'cheat');

    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;

    // Option A Flush test: 4 real Pink cards (1 doubled) + 1 Black card = 5 Pink count -> Flush!
    const flushWithDouble = evaluateSevenCards([
      { ...pick(14, 'P', 0), isDoublePink: true },
      pick(11, 'P', 0),
      pick(8, 'P', 0),
      pick(4, 'P', 0),
      pick(13, 'B', 0),
      pick(6, 'B', 0),
      pick(2, 'B', 0),
    ]);
    assert.equal(flushWithDouble.categoryKey, 'flush');

    // Option A non-duplication check: pink-double on Ace of Pink does NOT invent a Pair of Aces
    const noPhantomPair = evaluateSevenCards([
      { ...pick(14, 'P', 0), isDoublePink: true },
      pick(11, 'P', 0),
      pick(7, 'P', 0),
      pick(8, 'B', 0),
      pick(5, 'B', 0),
      pick(2, 'B', 0),
      pick(4, 'B', 1),
    ]);
    assert.equal(noPhantomPair.categoryKey, 'high-card');

    let state = createInitialState({
      opponentName: '粉红软软龙',
      chips: { human: 900, ai: 900 },
      opponentSignatureSkill: 'pink-mirage',
      aiSpecialCheatSkill: 'pink-double',
      playerCheatSkills: ['plus-one', 'minus-one', 'pink-double'],
      deckOverride: [
        pick(10, 'B', 0), pick(9, 'P', 0), pick(4, 'B', 0),
        pick(3, 'P', 0), pick(12, 'B', 0), pick(5, 'B', 0),
        pick(7, 'B', 0), pick(8, 'P', 0), pick(11, 'B', 0), pick(6, 'P', 0),
      ],
    });
    // Human cannot use pink-double on index 0 (real Black card, even though pink-mirage shows it Pink)
    state = { ...state, currentTurn: 'human' };
    assert.equal(isActionLegal(state, { type: 'hack', handIndex: 0, skill: 'pink-double' }), false);
    // Human CAN use pink-double on index 1 (real Pink 9P)
    const humanDoubleAct = { type: 'hack' as const, handIndex: 1, skill: 'pink-double' as const };
    assert.equal(isActionLegal(state, humanDoubleAct), true);

    const afterHumanDouble = applyAction(state, humanDoubleAct);
    assert.equal(afterHumanDouble.players.human.hand[1].card.isDoublePink, true);
    assert.equal(afterHumanDouble.players.human.hand[1].originalCard?.suit, 'P');
    assert.deepEqual(afterHumanDouble.players.human.hand[1].tamperedBy, ['pink-double']);
    assert.equal(
      isCardTamperedFromOriginal(
        afterHumanDouble.players.human.hand[1].card,
        afterHumanDouble.players.human.hand[1].originalCard
      ),
      true
    );
    assert.equal(
      formatTamperLabel(
        afterHumanDouble.players.human.hand[1].card,
        afterHumanDouble.players.human.hand[1].originalCard
      ),
      '原:粉9'
    );
    assert.equal(afterHumanDouble.usedHackThisTurn, true);
    assert.equal(afterHumanDouble.usedProtocolSkillThisHand, false);
    assert.equal(getVisibleHandCard(afterHumanDouble.players.human.hand[1], 'ai', 'human', false).isDoublePink, undefined);
    assert.equal(getVisiblePlayerChips(afterHumanDouble, 'human', 'ai'), 890);

    // Hand off turn to AI and scan human hand[1] -> catches pink-double and seals it
    const aiTurnState = applyAction(afterHumanDouble, { type: 'flip', boardIndex: 0 });
    assert.equal(aiTurnState.currentTurn, 'ai');
    const afterAiScan = applyAction(aiTurnState, { type: 'scan', targetKind: 'hand', targetIndex: 1 });
    assert.equal(afterAiScan.phase, 'showdown');
    assert.equal(afterAiScan.result?.reason, 'scan-caught');
    assert.equal(afterAiScan.result?.winner, 'ai');
    assert.ok(afterAiScan.players.human.sealedSkills.includes('pink-double'));
  });

  it('replaces SEC-04 with 「绯凪·千夜 // KIRI-04」, renames gate-minefield to 灼心·火符, and includes samurai big-sister lore', () => {
    assert.equal(SEC04_CHARACTER_DOSSIER.name, '绯凪·千夜');
    assert.equal(SEC04_CHARACTER_DOSSIER.codename, 'KIRI-04');
    assert.equal(SEC04_CHARACTER_DOSSIER.expressionCount, 6);
    assert.ok(SEC04_CHARACTER_DOSSIER.personality.includes('黑河'));
    assert.ok(SEC04_CHARACTER_DOSSIER.personality.includes('反黑客'));
    assert.ok(SEC04_CHARACTER_DOSSIER.personality.includes('武士'));
    assert.ok(
      SEC04_CHARACTER_DOSSIER.personality.includes('大姐姐') ||
        SEC04_CHARACTER_DOSSIER.title.includes('大姐姐')
    );
    assert.ok((SEC04_CHARACTER_DOSSIER.voice?.samples.length ?? 0) >= 4);

    for (const expr of CONTRACT_EXPRESSIONS) {
      assert.equal(resolveSec04Sprite(expr), `./assets/story/sec04/${expr}.webp`);
      assert.equal(
        SEC04_CHARACTER_DOSSIER.variants[`witchform:${expr}`],
        SEC04_EXPRESSION_PATHS[expr]
      );
      assert.equal(
        SEC04_CHARACTER_DOSSIER.variants[`custom:${expr}`],
        SEC04_EXPRESSION_PATHS[expr]
      );
    }

    assert.equal(getStoryCharacterByEscapeNode(4)?.id, SEC04_CHARACTER_DOSSIER.id);
    const sec04 = ESCAPE_ROUTE_NODES[4];
    assert.equal(sec04.opponentName, '绯凪·千夜');
    assert.equal(sec04.signatureSkillId, 'gate-minefield');
    assert.equal(sec04.signatureSkillName, '灼心·火符');
    assert.equal(sec04.specialCheatSkillId, 'mikiri-counter');
    assert.equal(sec04.specialCheatSkillName, '见切·燕返');

    const wbRes = worldbookContext('绯凪·千夜 反黑客组织 灼心·火符', builtinWorldbook(), 4000);
    assert.ok(wbRes.text.includes('反黑客') || wbRes.text.includes('绯凪·千夜'));

    // Triggering a gate-minefield trap in story mode (3 traps) zeroes compute; normal mode (1 trap) deducts 100
    const storyTrapAuto = createInitialState({
      opponentName: '绯凪·千夜',
      opponentSignatureSkill: 'gate-minefield',
      gateTrapMode: 'story',
    });
    assert.equal(storyTrapAuto.trappedBoardIndices?.length, 3);

    const storyTrapState = createInitialState({
      opponentName: '绯凪·千夜',
      chips: { human: 1000, ai: 1000 },
      opponentSignatureSkill: 'gate-minefield',
      gateTrapMode: 'story',
      trappedBoardIndices: [0, 1, 2],
    });
    const afterStoryTrap = applyAction({ ...storyTrapState, currentTurn: 'human' }, { type: 'flip', boardIndex: 1 });
    assert.equal(afterStoryTrap.phase, 'showdown');
    assert.equal(afterStoryTrap.players.human.chips, 0);
    assert.ok(afterStoryTrap.lastAction?.label.includes('灼心·火符'));

    const autoTrapState = createInitialState({
      opponentName: '绯凪·千夜',
      opponentSignatureSkill: 'gate-minefield',
      gateTrapMode: 'normal',
    });
    assert.equal(autoTrapState.trappedBoardIndices?.length, 1);

    const trapState = createInitialState({
      opponentName: '绯凪·千夜',
      chips: { human: 1000, ai: 1000 },
      opponentSignatureSkill: 'gate-minefield',
      gateTrapMode: 'normal',
      trappedBoardIndices: [2],
    });
    const beforeChips = trapState.players.human.chips;
    const afterTrap = applyAction({ ...trapState, currentTurn: 'human' }, { type: 'swap', handIndex: 0, boardIndex: 2 });
    assert.notEqual(afterTrap.phase, 'showdown');
    assert.equal(afterTrap.players.human.chips, beforeChips - 20 - 100);
    assert.equal(afterTrap.lastAction?.boardIndex, 2);
    assert.ok(afterTrap.lastAction?.label.includes('灼心·火符'));
  });

  it('executes mikiri-counter (见切·燕返) without stacking, follows swapped cards onto board, and wins round immediately when opponent scans it', () => {
    const sk = getSkillById('mikiri-counter');
    assert.ok(sk);
    assert.equal(getSkillGroup('mikiri-counter'), 'cheat');

    const full = createDeck();
    const pick = (rank: number, suit: 'B' | 'P', copy: 0 | 1 = 0) =>
      full.find((c) => c.rank === rank && c.suit === suit && (c.copy ?? 0) === copy)!;

    let state = createInitialState({
      opponentName: '绯凪·千夜',
      chips: { human: 1000, ai: 1000 },
      opponentSignatureSkill: 'gate-minefield',
      aiSpecialCheatSkill: 'mikiri-counter',
      playerCheatSkills: ['plus-one', 'minus-one', 'mikiri-counter'],
      trappedBoardIndices: [],
      deckOverride: [
        pick(10, 'B', 0), pick(9, 'P', 0), pick(4, 'B', 0),
        pick(3, 'P', 0), pick(12, 'B', 0), pick(5, 'B', 0),
        pick(7, 'B', 0), pick(8, 'P', 0), pick(11, 'B', 0), pick(6, 'P', 0),
      ],
    });

    // Cannot stack mikiri-counter on an already-tampered card, nor tamper a mikiri-counter card
    state = { ...state, currentTurn: 'human' };
    state = applyAction(state, { type: 'hack', handIndex: 0, skill: 'plus-one' });
    assert.equal(isActionLegal(state, { type: 'hack', handIndex: 0, skill: 'mikiri-counter' }), false);

    // Hand off to AI; AI places mikiri-counter on AI hand[0]
    state = applyAction(state, { type: 'flip', boardIndex: 0 });
    assert.equal(state.currentTurn, 'ai');
    const aiMikiri = { type: 'hack' as const, handIndex: 0, skill: 'mikiri-counter' as const };
    assert.equal(isActionLegal(state, aiMikiri), true);

    const afterAiMikiri = applyAction(state, aiMikiri);
    assert.equal(afterAiMikiri.players.ai.hand[0].card.isCounterTrap, true);
    assert.deepEqual(afterAiMikiri.players.ai.hand[0].tamperedBy, ['mikiri-counter']);
    assert.equal(
      formatTamperLabel(
        afterAiMikiri.players.ai.hand[0].card,
        afterAiMikiri.players.ai.hand[0].originalCard
      ),
      '见切:反制'
    );
    // Cannot stack another cheat skill on AI hand[0] in a later turn
    assert.equal(
      getVisibleHandCard(afterAiMikiri.players.ai.hand[0], 'human', 'ai', false).isCounterTrap,
      undefined
    );

    // Human flips board[1], AI flip board[2] -> check non-stacking on next turn
    const hFlip = applyAction(applyAction(afterAiMikiri, { type: 'flip', boardIndex: 1 }), {
      type: 'flip',
      boardIndex: 2,
    });
    // Wait: hFlip is AI's turn now? Let's trace: afterAiMikiri was AI's turn -> AI flipped 1 -> human's turn -> human flipped 2 -> AI's turn
    assert.equal(hFlip.currentTurn, 'ai');
    assert.equal(isActionLegal(hFlip, { type: 'hack', handIndex: 0, skill: 'plus-one' }), false);

    // Branch A: Human scans AI hand[0] directly -> mikiri-counter triggers, AI wins the hand immediately!
    const humanTurnForHandScan = applyAction(hFlip, { type: 'flip', boardIndex: 3 });
    assert.equal(humanTurnForHandScan.currentTurn, 'human');
    const handCounterWin = applyAction(humanTurnForHandScan, {
      type: 'scan',
      targetKind: 'hand',
      targetIndex: 0,
    });
    assert.equal(handCounterWin.phase, 'showdown');
    assert.equal(handCounterWin.result?.reason, 'mikiri-counter');
    assert.equal(handCounterWin.result?.winner, 'ai');
    assert.ok(handCounterWin.players.ai.chips > 1000);

    // Branch B: AI swaps mikiri-counter card onto hidden board[3] -> human scans board[3] -> AI still wins!
    const afterSwapBoard = applyAction(hFlip, { type: 'swap', handIndex: 0, boardIndex: 3 });
    assert.equal(afterSwapBoard.board[3].card.isCounterTrap, true);
    assert.equal(getVisibleBoardCard(afterSwapBoard.board[3], 'human', false).isCounterTrap, undefined);
    assert.equal(afterSwapBoard.currentTurn, 'human');
    const boardCounterWin = applyAction(afterSwapBoard, {
      type: 'scan',
      targetKind: 'board',
      targetIndex: 3,
    });
    assert.equal(boardCounterWin.phase, 'showdown');
    assert.equal(boardCounterWin.result?.reason, 'mikiri-counter');
    assert.equal(boardCounterWin.result?.winner, 'ai');
  });

  it('switches player portrait to ECHO-0 across story nodes after SEC-00 overwrite', () => {
    assert.equal(
      resolveStoryPlayerEntity({
        isStoryMode: false,
        activeNodeIndex: 1,
        clearedIndices: [0],
      }),
      null
    );
    assert.equal(
      resolveStoryPlayerEntity({
        isStoryMode: true,
        activeNodeIndex: 0,
        clearedIndices: [],
        sec00EpilogueBeatIndex: 0,
      }),
      null
    );

    const midVn = resolveStoryPlayerEntity({
      isStoryMode: true,
      activeNodeIndex: 0,
      clearedIndices: [],
      sec00EpilogueBeatIndex: 6,
      expression: 'surprise',
    });
    assert.ok(midVn);
    assert.equal(midVn.isOverwrittenEcho0, true);
    assert.equal(midVn.portraitSrc, './assets/story/echo0/surprise.webp');

    const sec01Player = resolveStoryPlayerEntity({
      isStoryMode: true,
      activeNodeIndex: 1,
      clearedIndices: [0],
    });
    assert.ok(sec01Player);
    assert.equal(sec01Player.isOverwrittenEcho0, true);
    assert.equal(sec01Player.label, '替壳：SHELL://ECHO-0');
    assert.equal(sec01Player.portraitSrc, './assets/story/echo0/calm.webp');
  });

  it('defines 18-line SEC-01 dual-portrait intro script with Ling Fei inner thoughts and zero ECHO-0 spoilers', () => {
    assert.equal(SEC01_VN_SCRIPT.length, 18);
    assert.equal(SEC01_VN_SCRIPT[0].rightSprite?.visibility, 'hidden');
    assert.equal(SEC01_VN_SCRIPT[0].leftSprite?.character, 'echo0');

    for (let i = 1; i < SEC01_VN_SCRIPT.length; i += 1) {
      const line = SEC01_VN_SCRIPT[i];
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.rightSprite?.character, 'sec01');
      assert.ok(line.leftSprite?.visibility !== 'hidden');
      assert.ok(line.rightSprite?.visibility !== 'hidden');
    }

    // Lines 13-14 (index 12-13) are Ling Fei's inner doubts rendered with dashed thought style
    assert.equal(SEC01_VN_SCRIPT[12].isThought, true);
    assert.equal(SEC01_VN_SCRIPT[13].isThought, true);
    assert.equal(SEC01_VN_SCRIPT[12].rightSprite?.expression, 'shy');

    const fullCopy = SEC01_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('凌翡'));
    assert.ok(fullCopy.includes('财黑帮'));
    assert.ok(fullCopy.includes('一败涂地'));
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-01 intro should not spoil "${spoiler}"`);
    }
  });

  it('defines 20-line SEC-01 post-defeat script covering dox threat, entity extraction, recognition, discard, and zero ECHO-0 spoilers', () => {
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT.length, 20);
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[3].isThought, true);
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[3].rightSprite?.expression, 'sad');
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[11].rightSprite?.visibility, 'shell-dim');
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[18].rightSprite?.visibility, 'hidden');
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[19].rightSprite?.visibility, 'hidden');
    assert.equal(SEC01_EPILOGUE_VN_SCRIPT[19].stageEffect, 'escape-cta');

    for (const line of SEC01_EPILOGUE_VN_SCRIPT) {
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.rightSprite?.character, 'sec01');
    }

    const fullCopy = SEC01_EPILOGUE_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('开盒'));
    assert.ok(fullCopy.includes('线下真实'));
    assert.ok(fullCopy.includes('你给我等着'));
    assert.ok(fullCopy.includes('凌翡'));
    assert.ok(fullCopy.includes('跑路'));
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-01 epilogue should not spoil "${spoiler}"`);
    }
  });

  it('defines 18-line SEC-02 ambush intro with garbled Fulan speech, no thought boxes, Lin Longxin flashback, and codename placeholders', () => {
    assert.equal(SEC02_VN_SCRIPT.length, 18);
    assert.equal(LIN_LONGXIN_CASUAL_SPRITE, './assets/story/sec03/casual.webp');

    // No psychological thought dialog boxes at all in SEC-02 intro
    for (const line of SEC02_VN_SCRIPT) {
      assert.equal(Boolean(line.isThought), false, `line ${line.lineNo} should not use isThought`);
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.leftSprite?.label, '{codename} // SHELL://ECHO-0');
    }

    // All Fulan speech lines are strictly [VOCAL_ERR] garbled output
    const fulanSpeech = SEC02_VN_SCRIPT.filter((l) => l.speakerKind === 'opponent');
    assert.equal(fulanSpeech.length, 5);
    for (const line of fulanSpeech) {
      assert.ok(line.text.startsWith('[VOCAL_ERR]'));
      assert.equal(line.rightSprite?.character, 'sec02');
    }

    // Line 02 (index 1) has blade-cut slash effect; Line 04 (index 3) shows Fulan silhouette; Line 05 (index 4) emerges from dark
    assert.equal(SEC02_VN_SCRIPT[1].leftSprite?.effect, 'blade-cut');
    assert.equal(SEC02_VN_SCRIPT[3].rightSprite?.character, 'sec02');
    assert.equal(SEC02_VN_SCRIPT[3].rightSprite?.visibility, 'silhouette');
    assert.equal(SEC02_VN_SCRIPT[4].rightSprite?.visibility, 'active');
    assert.equal(SEC02_VN_SCRIPT[4].rightSprite?.effect, 'emerge');

    // Line 10 (index 9) keeps Fulan on the right and places darkened Lin Longxin memory sprite on the left of player
    const flashback = SEC02_VN_SCRIPT[9];
    assert.equal(flashback.auxLeftSprite?.character, 'linlongxin');
    assert.equal(flashback.auxLeftSprite?.visibility, 'dimmed');
    assert.equal(flashback.auxLeftSprite?.effect, 'flashback');
    assert.equal(flashback.rightSprite?.character, 'sec02');
    assert.equal(flashback.rightSprite?.visibility, 'dimmed');
    assert.ok(flashback.text.includes('林龙心'));
    assert.ok(flashback.text.includes('{codename}'));

    // Zero Chinese/ASCII semicolons, narrator "你", or contradictory veteran phrases across all VN scripts
    for (const [name, script] of [
      ['SEC00_VN_SCRIPT', SEC00_VN_SCRIPT],
      ['SEC01_VN_SCRIPT', SEC01_VN_SCRIPT],
      ['SEC01_EPILOGUE_VN_SCRIPT', SEC01_EPILOGUE_VN_SCRIPT],
      ['SEC02_VN_SCRIPT', SEC02_VN_SCRIPT],
      ['SEC02_EPILOGUE_VN_SCRIPT', SEC02_EPILOGUE_VN_SCRIPT],
      ['SEC03_VN_SCRIPT', SEC03_VN_SCRIPT],
      ['SEC03_EPILOGUE_VN_SCRIPT', SEC03_EPILOGUE_VN_SCRIPT],
    ] as const) {
      for (const line of script) {
        assert.equal(line.text.includes('；'), false, `${name} line ${line.lineNo} contains "；"`);
        assert.equal(line.text.includes(';'), false, `${name} line ${line.lineNo} contains ";"`);
        if (line.speakerKind === 'narrator') {
          assert.equal(
            line.text.includes('你'),
            false,
            `${name} narrator line ${line.lineNo} should use "{codename}" instead of "你"`
          );
        }
        assert.equal(line.text.includes('老子'), false, `${name} line ${line.lineNo} contains "老子"`);
        assert.equal(line.text.includes('好几年'), false, `${name} line ${line.lineNo} contradicts rookie return lore`);
      }
    }

    // Final line enters combat CTA
    assert.equal(SEC02_VN_SCRIPT[17].stageEffect, 'escape-cta');

    const fullCopy = SEC02_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('富兰克林之死'));
    assert.ok(fullCopy.includes('算力猎手'));
    assert.ok(fullCopy.includes('心魔'));
    assert.equal(fullCopy.includes('老子'), false);
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-02 intro should not spoil "${spoiler}"`);
    }
  });

  it('defines 18-line SEC-02 post-defeat epilogue covering Black River forced logout, revocation, permanent deletion, and escape alarm', () => {
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT.length, 18);

    // Fulan continues using garbled speech without any thought dialog boxes
    for (const line of SEC02_EPILOGUE_VN_SCRIPT) {
      assert.equal(Boolean(line.isThought), false, `line ${line.lineNo} should not use isThought`);
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.leftSprite?.label, '{codename} // SHELL://ECHO-0');
    }

    const fulanSpeech = SEC02_EPILOGUE_VN_SCRIPT.filter((l) => l.speakerKind === 'opponent');
    assert.equal(fulanSpeech.length, 3);
    for (const line of fulanSpeech) {
      assert.ok(line.text.startsWith('[VOCAL_ERR]'));
      assert.equal(line.rightSprite?.character, 'sec02');
    }

    // Fulan uses sad tearful expression on corporate termination, then shell-dim + dissipating purge, then vanishes
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[5].rightSprite?.expression, 'sad');
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[7].rightSprite?.visibility, 'shell-dim');
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[8].rightSprite?.effect, 'dissipating');
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[9].rightSprite?.effect, 'dissipating');
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[10].rightSprite?.visibility, 'hidden');

    // Alarm triggers before escape CTA into SEC-03
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[15].soundCue, 'alarm-siren');
    assert.equal(SEC02_EPILOGUE_VN_SCRIPT[17].stageEffect, 'escape-cta');

    const fullCopy = SEC02_EPILOGUE_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('强行踢断登出'));
    assert.ok(SEC02_EPILOGUE_VN_SCRIPT[6].hudAlerts?.some((a) => a.includes('强制登出')));
    assert.ok(fullCopy.includes('注销'));
    assert.ok(fullCopy.includes('永久删除'));
    assert.ok(fullCopy.includes('被公司直接开除'));
    assert.ok(fullCopy.includes('红色警报'));
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-02 epilogue should not spoil "${spoiler}"`);
    }
  });

  it('defines 16-line SEC-03 collision intro with Pink Dragon misunderstanding ECHO-0 as Miss Zero and pulling player into duel', () => {
    assert.equal(SEC03_VN_SCRIPT.length, 16);
    for (const line of SEC03_VN_SCRIPT) {
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.leftSprite?.label, '{codename} // SHELL://ECHO-0');
      assert.equal(line.rightSprite?.character, 'sec03');
    }
    assert.equal(SEC03_VN_SCRIPT[1].soundCue, 'wall-hit');
    assert.equal(SEC03_VN_SCRIPT[1].leftSprite?.effect, 'collide');
    assert.equal(SEC03_VN_SCRIPT[1].rightSprite?.effect, 'collide');
    assert.equal(SEC03_VN_SCRIPT[15].stageEffect, 'escape-cta');

    const fullCopy = SEC03_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('撞进了对面'));
    assert.ok(fullCopy.includes('痛痛痛——哇啊、哪来的冒失鬼横冲直撞的？！等等，别急，让我先稳定一下平衡……'));
    assert.ok(fullCopy.includes('没事没事，我皮厚着呢！倒是我这双龙角差点戳到你——哎呀，等等，你这造型，我该不会真撞到大人物了吧？！'));
    assert.ok(fullCopy.includes('熟悉'));
    assert.ok(fullCopy.includes('现在全网都在传着你的消息呢，我可不会放过和强者对决的机会！来决斗吧，零小姐！'));
    assert.ok(fullCopy.includes('等等，我还没……'));
    assert.ok(fullCopy.includes('强行拖入了对局'));
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-03 intro should not spoil "${spoiler}"`);
    }
  });

  it('defines 18-line SEC-03 post-defeat epilogue with Lin Longxin recognition, ECHO-0 red-eye err1/err2 hijack, push-away, and no ECHO-0 mention by player', () => {
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT.length, 18);
    assert.equal(resolveEcho0Sprite('err1'), './assets/story/echo0/err1.webp');
    assert.equal(resolveEcho0Sprite('err2'), './assets/story/echo0/err2.webp');

    for (const line of SEC03_EPILOGUE_VN_SCRIPT) {
      assert.equal(line.leftSprite?.character, 'echo0');
      assert.equal(line.rightSprite?.character, 'sec03');
      if (line.speakerKind === 'player') {
        assert.equal(
          /echo-?0/i.test(line.text),
          false,
          `Player line ${line.lineNo} should not mention ECHO-0 by name`
        );
      }
    }

    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[5].leftSprite?.expression, 'err1');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[7].leftSprite?.expression, 'err2');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[8].leftSprite?.expression, 'err2');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[12].leftSprite?.expression, 'err2');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[14].leftSprite?.expression, 'angry');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[14].leftSprite?.effect, 'push-apart');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[14].rightSprite?.effect, 'push-apart');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[15].leftSprite?.effect, 'distanced');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[15].rightSprite?.effect, 'distanced');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[17].rightSprite?.visibility, 'hidden');
    assert.equal(SEC03_EPILOGUE_VN_SCRIPT[17].stageEffect, 'escape-cta');

    const fullCopy = SEC03_EPILOGUE_VN_SCRIPT.map((l) => `${l.speakerName} ${l.text}`).join(' ');
    assert.ok(fullCopy.includes('林龙心'));
    assert.ok(fullCopy.includes('强行夺取') || fullCopy.includes('强制实体夺取'));
    assert.ok(fullCopy.includes('推退数步'));
    assert.ok(fullCopy.includes('SEC-04'));
    for (const spoiler of ['猎杀榜', '黑盒', '叛逃']) {
      assert.equal(fullCopy.includes(spoiler), false, `SEC-03 epilogue should not spoil "${spoiler}"`);
    }
  });
});
