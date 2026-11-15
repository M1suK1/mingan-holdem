import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, type Card } from '../src/engine/types.ts';
import { applyAction, createInitialState, isActionLegal } from '../src/engine/gameEngine.ts';
import {
  mirrorStateForGuestView,
  sanitizeStateForGuest,
  encodeP2pSignalToken,
  decodeP2pSignalToken,
} from '../src/engine/p2pProtocol.ts';

function c(rank: Card['rank'], suit: Card['suit'], copy: 0 | 1 = 0): Card {
  return { id: `${rank}${suit}-${copy}`, suit, rank, copy };
}

describe('P2P Protocol: strict anti-sniff sanitization & guest perspective mirroring', () => {
  it('hides unopened board cards, host private cards, deck, hackEscrowPot, and host hacks from guest', () => {
    const deckOverride: Card[] = [
      c(14, 'P', 0), c(7, 'B', 0), c(8, 'B', 0), // host (human)
      c(5, 'P', 0), c(6, 'P', 0), c(9, 'B', 0), // guest (ai)
      c(10, 'P', 0), c(11, 'B', 0), c(12, 'B', 0), c(3, 'P', 0), // board
    ];
    let hostState = createInitialState({
      deckOverride,
      tieStarter: 'ai',
      config: { ...DEFAULT_CONFIG },
    });
    // AI (guest) has weaker 9-high vs Host A-high -> AI acts first; flip board[1] so Host acts
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 1 });
    assert.equal(hostState.currentTurn, 'human');

    // Host hacks hand[1] (7B -> 8B) and keeps hand[2] private after swapping board[0]
    hostState = applyAction(hostState, { type: 'hack', handIndex: 1, skill: 'plus-one' });
    hostState = applyAction(hostState, { type: 'swap', handIndex: 2, boardIndex: 0 });

    const sanitized = sanitizeStateForGuest(hostState);

    // Deck & hackEscrowPot must never cross the wire
    assert.equal(sanitized.deck.length, 0);
    assert.equal(sanitized.hackEscrowPot, 0);

    // Board slot 0 was swapped-in by Host so it is open with Host's discarded 8B; unopened slots (2, 3) are masked
    assert.equal(sanitized.board[0].isOpen, true);
    assert.equal(sanitized.board[0].card.rank, 8);
    assert.equal(sanitized.board[2].isOpen, false);
    assert.equal(sanitized.board[2].card.id.startsWith('masked-'), true);
    assert.equal(sanitized.board[3].card.id.startsWith('masked-'), true);
    // Open board slot 1 stays visible
    assert.equal(sanitized.board[1].isOpen, true);
    assert.equal(sanitized.board[1].card.rank, 11);

    // Host private hand[2] must be masked
    assert.equal(sanitized.players.human.hand[2].visibility, 'private');
    assert.equal(sanitized.players.human.hand[2].card.id.startsWith('masked-'), true);

    // Host hacked open hand[1] must revert to original 7B with tamperedBy stripped!
    assert.equal(sanitized.players.human.hand[1].card.rank, 7);
    assert.equal(sanitized.players.human.hand[1].originalCard, undefined);
    assert.equal(sanitized.players.human.hand[1].tamperedBy, undefined);

    // Unrevealed host tamper log must be filtered from actionHistory
    assert.equal(
      sanitized.actionHistory.some((a) => a.actor === 'human' && a.summary.includes('终端篡改')),
      false
    );
  });

  it('mirrors state cleanly so Guest sees themselves as bottom human and Host as top opponent', () => {
    const deckOverride: Card[] = [
      c(14, 'P', 0), c(7, 'B', 0), c(8, 'B', 0),
      c(5, 'P', 0), c(6, 'P', 0), c(9, 'B', 0),
      c(10, 'P', 0), c(11, 'B', 0), c(12, 'B', 0), c(3, 'P', 0),
    ];
    let hostState = createInitialState({
      deckOverride,
      tieStarter: 'ai',
      opponentName: '客机玩家',
    });
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 1 });
    hostState = applyAction(hostState, { type: 'hack', handIndex: 1, skill: 'plus-one' });
    hostState = applyAction(hostState, { type: 'raise', amount: 20 });

    const guestView = mirrorStateForGuestView(sanitizeStateForGuest(hostState));

    // Guest is now 'human' (bottom) and it is Guest's turn!
    assert.equal(guestView.currentTurn, 'human');
    assert.equal(guestView.players.human.name, '客机玩家');
    assert.equal(guestView.players.human.hand[0].card.rank, 5);
    // Host is now 'ai' (top) with roundBet 20 and unhacked visible rank 7
    assert.equal(guestView.players.ai.roundBet, 20);
    assert.equal(guestView.players.ai.hand[1].card.rank, 7);
    // Guest can legally call on their mirrored view
    assert.equal(isActionLegal(guestView, { type: 'call' }), true);
  });

  it('reveals host tampered cards in sanitized showdown state after settlement', () => {
    const deckOverride: Card[] = [
      c(14, 'P', 0), c(7, 'B', 0), c(8, 'B', 0),
      c(5, 'P', 0), c(6, 'P', 0), c(9, 'B', 0),
      c(10, 'P', 0), c(11, 'B', 0), c(12, 'B', 0), c(3, 'P', 0),
    ];
    let hostState = createInitialState({ deckOverride, tieStarter: 'ai' });
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 1 });
    hostState = applyAction(hostState, { type: 'hack', handIndex: 1, skill: 'plus-one' }); // 7B -> 8B
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 0 });
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 2 });
    hostState = applyAction(hostState, { type: 'flip', boardIndex: 3 });
    hostState = applyAction(hostState, { type: 'check' });
    hostState = applyAction(hostState, { type: 'check' });
    assert.equal(hostState.phase, 'showdown');

    const guestShowdown = mirrorStateForGuestView(sanitizeStateForGuest(hostState));
    assert.equal(guestShowdown.phase, 'showdown');
    // At showdown, Host's hacked 8B and originalCard 7B are finally revealed to Guest!
    assert.equal(guestShowdown.players.ai.hand[1].card.rank, 8);
    assert.equal(guestShowdown.players.ai.hand[1].originalCard?.rank, 7);
  });

  it('round-trips compact P2P signal invite tokens cleanly', async () => {
    const sample = { kind: 'offer' as const, sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\n' };
    const encoded = await encodeP2pSignalToken(sample);
    assert.ok(encoded.startsWith('MGP2P:'));
    const decoded = await decodeP2pSignalToken(encoded);
    assert.deepEqual(decoded, sample);
  });
});
