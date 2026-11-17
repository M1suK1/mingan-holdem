import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHO0_CHARACTER_DOSSIER,
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
  resolveSec01Sprite,
  resolveSec02Sprite,
  resolveSec03Sprite,
  resolveSec04Sprite,
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

    // Triggering a gate-minefield trap reports「灼心·火符」
    const trapState = createInitialState({
      opponentName: '绯凪·千夜',
      opponentSignatureSkill: 'gate-minefield',
      trappedBoardIndices: [0, 1, 2],
    });
    const afterTrap = applyAction({ ...trapState, currentTurn: 'human' }, { type: 'flip', boardIndex: 0 });
    assert.equal(afterTrap.phase, 'showdown');
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
});
