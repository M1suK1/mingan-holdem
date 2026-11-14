import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Card, Rank, Suit } from '../src/engine/types.ts';
import {
  evaluateFiveCards,
  evaluateThreeCards,
  evaluateSevenCards,
  evaluateVisibleHandSummary,
  pickFirstActor,
} from '../src/engine/evaluator.ts';

function c(rank: Rank, suit: Suit, copy: 0 | 1 = 0): Card {
  return { id: `${rank}${suit}-${copy}`, rank, suit, copy };
}

describe('evaluator: 2-suit (Black/Pink) 3-card initial hand & first actor', () => {
  it('ranks three-of-a-kind > one-pair > high-card with 2-suit cards', () => {
    const trips = evaluateThreeCards([c(2, 'B', 0), c(2, 'B', 1), c(2, 'P', 0)]);
    const pairAces = evaluateThreeCards([c(14, 'B', 0), c(14, 'P', 0), c(13, 'B', 0)]);
    const highAKQ = evaluateThreeCards([c(14, 'B', 0), c(13, 'P', 0), c(12, 'B', 0)]);

    assert.equal(trips.category, 2);
    assert.equal(pairAces.category, 1);
    assert.equal(highAKQ.category, 0);
    assert.ok(trips.score > pairAces.score);
    assert.ok(pairAces.score > highAKQ.score);
  });

  it('gives weaker initial 3-card hand first action, and alternates on exact rank tie', () => {
    const strong = [c(14, 'B', 0), c(14, 'P', 0), c(7, 'B', 0)];
    const weak = [c(13, 'B', 0), c(12, 'P', 0), c(2, 'P', 1)];
    assert.equal(pickFirstActor(strong, weak, 'human'), 'ai');
    assert.equal(pickFirstActor(weak, strong, 'ai'), 'human');

    const tieA = [c(14, 'B', 0), c(10, 'P', 0), c(5, 'B', 1)];
    const tieB = [c(14, 'P', 1), c(10, 'B', 0), c(5, 'P', 0)];
    assert.equal(pickFirstActor(tieA, tieB, 'human'), 'human');
    assert.equal(pickFirstActor(tieA, tieB, 'ai'), 'ai');
  });
});

describe('evaluator: probability-reranked 2-suit 52-card hierarchy', () => {
  it('orders Quads > StraightFlush > FullHouse > Straight > Trips > TwoPair > Flush > OnePair > HighCard', () => {
    const quads = evaluateSevenCards([
      c(9, 'B', 0), c(9, 'B', 1), c(9, 'P', 0), c(9, 'P', 1), c(14, 'B', 0), c(2, 'P', 0), c(3, 'B', 0),
    ]);
    const straightFlush = evaluateSevenCards([
      c(10, 'P', 0), c(11, 'P', 0), c(12, 'P', 0), c(13, 'P', 0), c(14, 'P', 0), c(14, 'P', 1), c(3, 'B', 0),
    ]);
    const fullHouse = evaluateSevenCards([
      c(13, 'B', 0), c(13, 'B', 1), c(13, 'P', 0), c(7, 'B', 0), c(7, 'P', 0), c(14, 'P', 0), c(2, 'B', 0),
    ]);
    const straight = evaluateSevenCards([
      c(14, 'B', 0), c(2, 'P', 0), c(3, 'B', 0), c(4, 'P', 0), c(5, 'B', 0), c(13, 'P', 0), c(9, 'B', 1),
    ]);
    const trips = evaluateSevenCards([
      c(8, 'B', 0), c(8, 'B', 1), c(8, 'P', 0), c(14, 'B', 0), c(11, 'P', 0), c(3, 'P', 0), c(2, 'B', 0),
    ]);
    const twoPair = evaluateSevenCards([
      c(12, 'B', 0), c(12, 'P', 0), c(6, 'B', 0), c(6, 'P', 0), c(14, 'B', 0), c(4, 'P', 0), c(2, 'B', 0),
    ]);
    const flushWithPair = evaluateSevenCards([
      c(14, 'P', 0), c(14, 'P', 1), c(11, 'P', 0), c(8, 'P', 0), c(4, 'P', 0), c(13, 'B', 0), c(3, 'B', 1),
    ]);
    const normalFlush = evaluateSevenCards([
      c(14, 'B', 0), c(13, 'B', 0), c(11, 'B', 0), c(8, 'B', 0), c(4, 'B', 0), c(2, 'P', 0), c(3, 'P', 0),
    ]);
    const onePair = evaluateSevenCards([
      c(10, 'B', 0), c(10, 'P', 0), c(14, 'B', 0), c(9, 'P', 0), c(5, 'B', 0), c(3, 'P', 0), c(2, 'P', 1),
    ]);
    const highCard = evaluateSevenCards([
      c(14, 'B', 0), c(12, 'P', 0), c(9, 'B', 0), c(6, 'P', 0), c(4, 'B', 0), c(3, 'P', 0), c(2, 'P', 1),
    ]);

    const ordered = [
      quads,
      straightFlush,
      fullHouse,
      straight,
      trips,
      twoPair,
      flushWithPair,
      normalFlush,
      onePair,
      highCard,
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      assert.ok(
        ordered[i].score > ordered[i + 1].score,
        `${ordered[i].categoryKey} (${ordered[i].score}) should beat ${ordered[i + 1].categoryKey} (${ordered[i + 1].score})`
      );
    }
    assert.equal(quads.category, 8);
    assert.equal(straightFlush.category, 7);
    assert.equal(twoPair.category, 3);
    assert.equal(normalFlush.category, 2);
  });

  it('scores a same-suit Two Pair as Two Pair (cat 3) rather than downgrading to Flush (cat 2)', () => {
    const suitedTwoPair = evaluateFiveCards([
      c(13, 'P', 0), c(13, 'P', 1), c(7, 'P', 0), c(7, 'P', 1), c(2, 'P', 0),
    ]);
    assert.equal(suitedTwoPair.categoryKey, 'two-pair');
    assert.equal(suitedTwoPair.category, 3);

    const suitedOnePair = evaluateFiveCards([
      c(14, 'P', 0), c(14, 'P', 1), c(9, 'P', 0), c(6, 'P', 0), c(2, 'P', 0),
    ]);
    assert.equal(suitedOnePair.categoryKey, 'flush');
    assert.equal(suitedOnePair.category, 2);
  });

  it('summarizes 2-4 known cards accurately and detects 2-suit flush draw', () => {
    const pair2 = evaluateVisibleHandSummary([c(14, 'B', 0), c(14, 'P', 0)], 1);
    assert.equal(pair2.label, '一对');
    assert.ok(pair2.detail.includes('+1暗牌'));

    const flushDraw4 = evaluateVisibleHandSummary(
      [c(13, 'P', 0), c(11, 'P', 0), c(8, 'P', 0), c(4, 'P', 0)],
      0
    );
    assert.ok(flushDraw4.detail.includes('同花听牌'));
  });
});
