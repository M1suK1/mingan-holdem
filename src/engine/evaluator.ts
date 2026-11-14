import type { Card, HandEvaluation, PlayerId, ThreeCardEval, VisibleHandSummary } from './types.ts';

const HAND_NAMES: Record<HandEvaluation['categoryKey'], string> = {
  'high-card': '高牌',
  'one-pair': '一对',
  'two-pair': '两对',
  'three-of-a-kind': '三条',
  straight: '顺子',
  flush: '同花',
  'full-house': '葫芦',
  'four-of-a-kind': '四条',
  'straight-flush': '同花顺',
};

const THREE_NAMES = ['高牌', '一对', '三条'] as const;

function encodeBase15(category: number, tiebreakers: number[]): number {
  let score = category;
  for (let i = 0; i < 5; i++) {
    score = score * 15 + (tiebreakers[i] ?? 0);
  }
  return score;
}

/**
 * Rule Section 1: Compare initial 3 open cards for first-actor decision.
 * Three-of-a-kind > One-pair > High-card.
 */
export function evaluateThreeCards(cards: Card[]): ThreeCardEval {
  if (cards.length !== 3) {
    throw new Error(`evaluateThreeCards expects 3 cards, got ${cards.length}`);
  }
  const counts = new Map<number, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  let category: 0 | 1 | 2 = 0;
  if (groups[0][1] === 3) category = 2;
  else if (groups[0][1] === 2) category = 1;

  const tiebreakers = groups.map(([rank]) => rank);
  let score = category;
  for (let i = 0; i < 3; i++) {
    score = score * 15 + (tiebreakers[i] ?? 0);
  }

  return {
    category,
    categoryName: THREE_NAMES[category],
    tiebreakers,
    score,
  };
}

/**
 * Weaker initial 3-card hand acts first; exact rank tie uses tieStarter.
 */
export function pickFirstActor(
  humanCards: Card[],
  aiCards: Card[],
  tieStarter: PlayerId
): PlayerId {
  const h = evaluateThreeCards(humanCards);
  const a = evaluateThreeCards(aiCards);
  if (h.score < a.score) return 'human';
  if (a.score < h.score) return 'ai';
  return tieStarter;
}

function getStraightHigh(sortedUniqueRanksDesc: number[]): number | null {
  if (sortedUniqueRanksDesc.length !== 5) return null;
  if (sortedUniqueRanksDesc[0] - sortedUniqueRanksDesc[4] === 4) {
    return sortedUniqueRanksDesc[0];
  }
  if (
    sortedUniqueRanksDesc[0] === 14 &&
    sortedUniqueRanksDesc[1] === 5 &&
    sortedUniqueRanksDesc[2] === 4 &&
    sortedUniqueRanksDesc[3] === 3 &&
    sortedUniqueRanksDesc[4] === 2
  ) {
    return 5;
  }
  return null;
}

export function evaluateFiveCards(cards: Card[]): HandEvaluation {
  if (cards.length !== 5) {
    throw new Error(`evaluateFiveCards expects 5 cards, got ${cards.length}`);
  }
  const ranksDesc = cards.map((c) => c.rank).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const counts = new Map<number, number>();
  for (const r of ranksDesc) {
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }

  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const uniqueDesc = groups.length === 5 ? ranksDesc : [];
  const straightHigh = getStraightHigh(uniqueDesc);

  let category = 0;
  let categoryKey: HandEvaluation['categoryKey'] = 'high-card';
  let tiebreakers: number[] = ranksDesc;

  if (isFlush && straightHigh !== null) {
    category = 8;
    categoryKey = 'straight-flush';
    tiebreakers = [straightHigh];
  } else if (groups[0][1] === 4) {
    category = 7;
    categoryKey = 'four-of-a-kind';
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = 6;
    categoryKey = 'full-house';
    tiebreakers = [groups[0][0], groups[1][0]];
  } else if (isFlush) {
    category = 5;
    categoryKey = 'flush';
    tiebreakers = ranksDesc;
  } else if (straightHigh !== null) {
    category = 4;
    categoryKey = 'straight';
    tiebreakers = [straightHigh];
  } else if (groups[0][1] === 3) {
    category = 3;
    categoryKey = 'three-of-a-kind';
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 2;
    categoryKey = 'two-pair';
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0]];
  } else if (groups[0][1] === 2) {
    category = 1;
    categoryKey = 'one-pair';
    tiebreakers = [groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  }

  return {
    category,
    categoryKey,
    categoryName: HAND_NAMES[categoryKey],
    tiebreakers,
    score: encodeBase15(category, tiebreakers),
    bestFive: [...cards].sort((a, b) => b.rank - a.rank),
  };
}

export function evaluateSevenCards(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    throw new Error(`evaluateSevenCards expects at least 5 cards, got ${cards.length}`);
  }
  let best: HandEvaluation | null = null;
  const n = cards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const candidate = evaluateFiveCards([
              cards[i],
              cards[j],
              cards[k],
              cards[l],
              cards[m],
            ]);
            if (!best || candidate.score > best.score) {
              best = candidate;
            }
          }
        }
      }
    }
  }
  return best!;
}

export function evaluateVisibleHandSummary(
  knownCards: Card[],
  hiddenCount: number
): VisibleHandSummary {
  const suffix = hiddenCount > 0 ? ` (+${hiddenCount}暗牌)` : '';
  const n = knownCards.length;

  if (n >= 5) {
    const res = evaluateSevenCards(knownCards);
    return {
      knownCount: n,
      hiddenCount,
      label: res.categoryName,
      detail: `已知${n}张${suffix}`,
      category: res.category,
    };
  }

  if (n === 0) {
    return {
      knownCount: 0,
      hiddenCount,
      label: '全暗牌',
      detail: `+${hiddenCount}暗牌`,
      category: 0,
    };
  }

  const rankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();
  for (const c of knownCards) {
    rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) ?? 0) + 1);
  }
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const maxSuit = Math.max(...suitCounts.values());

  let label = '高牌';
  let category = 0;
  if (counts[0] === 4) {
    label = '四条';
    category = 7;
  } else if (counts[0] === 3) {
    label = '三条';
    category = 3;
  } else if (counts[0] === 2 && counts[1] === 2) {
    label = '两对';
    category = 2;
  } else if (counts[0] === 2) {
    label = '一对';
    category = 1;
  }

  const drawTag = n >= 4 && maxSuit === 4 ? ' · 同花听牌' : '';
  return {
    knownCount: n,
    hiddenCount,
    label,
    detail: `已知${n}张${suffix}${drawTag}`,
    category,
  };
}
