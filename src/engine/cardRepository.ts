import {
  FALLBACK_CONTRACT_CHARACTER,
  parseNightSugarCard,
  type ContractCardSummary,
  type ContractCharacter,
} from './contractCards.ts';

const characterCache = new Map<string, ContractCharacter>();
let cachedCatalog: ContractCardSummary[] | null = null;
let catalogSourceMode: 'api' | 'static' | 'fallback' = 'fallback';

export async function fetchContractCatalog(): Promise<{
  cards: ContractCardSummary[];
  source: 'api' | 'static' | 'fallback';
}> {
  if (cachedCatalog && cachedCatalog.length > 0) {
    return { cards: cachedCatalog, source: catalogSourceMode };
  }

  // 1. Try live Vite / preview API scanning night-sugar-office/data/cards
  try {
    const res = await fetch('/api/contract-cards');
    if (res.ok) {
      const payload = (await res.json()) as { ok?: boolean; cards?: ContractCardSummary[] };
      if (payload.ok && Array.isArray(payload.cards) && payload.cards.length > 0) {
        cachedCatalog = payload.cards;
        catalogSourceMode = 'api';
        return { cards: cachedCatalog, source: 'api' };
      }
    }
  } catch {
    // Fall through to static bundle
  }

  // 2. Try static bundle ./cards/index.json
  try {
    const res = await fetch('./cards/index.json');
    if (res.ok) {
      const payload = (await res.json()) as { ok?: boolean; cards?: ContractCardSummary[] };
      if (payload.ok && Array.isArray(payload.cards) && payload.cards.length > 0) {
        cachedCatalog = payload.cards;
        catalogSourceMode = 'static';
        return { cards: cachedCatalog, source: 'static' };
      }
    }
  } catch {
    // Fall through to embedded fallback
  }

  cachedCatalog = [FALLBACK_CONTRACT_CHARACTER];
  catalogSourceMode = 'fallback';
  return { cards: cachedCatalog, source: 'fallback' };
}

export async function loadContractCharacterByFile(fileName: string): Promise<ContractCharacter> {
  const hit = characterCache.get(fileName);
  if (hit) return hit;

  // Try API first
  try {
    const res = await fetch(`/api/contract-cards?file=${encodeURIComponent(fileName)}`);
    if (res.ok) {
      const raw = await res.text();
      const parsed = parseNightSugarCard(raw, fileName);
      characterCache.set(fileName, parsed);
      return parsed;
    }
  } catch {
    // Fall through
  }

  // Try static ./cards/<fileName>
  try {
    const res = await fetch(`./cards/${encodeURIComponent(fileName)}`);
    if (res.ok) {
      const raw = await res.text();
      const parsed = parseNightSugarCard(raw, fileName);
      characterCache.set(fileName, parsed);
      return parsed;
    }
  } catch {
    // Fall through
  }

  return FALLBACK_CONTRACT_CHARACTER;
}

export function registerImportedContractCard(
  rawJson: string,
  fileName: string
): ContractCharacter {
  const character = parseNightSugarCard(rawJson, fileName);
  characterCache.set(character.fileName, character);
  if (cachedCatalog) {
    const existsIdx = cachedCatalog.findIndex((c) => c.fileName === character.fileName);
    if (existsIdx >= 0) {
      cachedCatalog[existsIdx] = character;
    } else {
      cachedCatalog = [character, ...cachedCatalog];
    }
  } else {
    cachedCatalog = [character];
  }
  return character;
}
