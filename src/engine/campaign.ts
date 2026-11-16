import {
  resolveRealityPortrait,
  resolveVirtualEntityPortrait,
  type ContractCharacter,
} from './contractCards.ts';
import { MAX_EXTRA_SKILLS, equipExtraSkill, pickLootSkillChoices } from './skillPool.ts';
import type { CampaignState, PursuerDossier, VirtualEntity } from './types.ts';

export const CAMPAIGN_STORAGE_KEY = 'mingan-cyber-holdem:campaign:v1';

export function createCoreVirtualEntity(playerCodename = 'ZERO-BYTE'): VirtualEntity {
  return {
    id: 'core-entity-player',
    name: `本体实体 · ${playerCodename}`,
    codename: playerCodename,
    isCore: true,
    pursuerRole: '被通缉的潜行黑客（本体核心）',
    virtualPortrait: '/assets/opponent-halfbody.webp',
    realityPortrait: '/assets/opponent-halfbody.webp',
    accentColor: '#00F0FF',
  };
}

export function createInitialCampaign(playerCodename = 'ZERO-BYTE'): CampaignState {
  const core = createCoreVirtualEntity(playerCodename);
  return {
    playerCodename,
    wantedLevel: 1,
    bounty: 1200,
    roundIndex: 1,
    coreEntity: core,
    capturedEntities: [],
    activeDisguiseId: core.id,
    acquiredSkills: [],
    defeatedPursuers: [],
    pendingLoot: null,
    lastEscapeLog: null,
    status: 'active',
    failureEnding: null,
  };
}

export function getActiveDisguiseEntity(campaign: CampaignState): VirtualEntity {
  const found = campaign.capturedEntities.find((e) => e.id === campaign.activeDisguiseId);
  return found ?? campaign.coreEntity;
}

export function selectMatchDisguise(campaign: CampaignState, entityId: string): CampaignState {
  const valid =
    entityId === campaign.coreEntity.id ||
    campaign.capturedEntities.some((e) => e.id === entityId);
  return {
    ...campaign,
    activeDisguiseId: valid ? entityId : campaign.coreEntity.id,
    lastEscapeLog: null,
    status: 'active',
  };
}

export function resolveMatchVictory(
  campaign: CampaignState,
  character: ContractCharacter,
  dossier: PursuerDossier
): CampaignState {
  const seizedEntity: VirtualEntity = {
    id: `entity-${character.id}-r${campaign.roundIndex}-${Date.now().toString(36)}`,
    name: dossier.virtualEntityName,
    codename: character.codename,
    isCore: false,
    sourceCharacterFile: character.fileName,
    sourceCharacterName: character.name,
    pursuerRole: dossier.identityTitle,
    virtualPortrait: resolveVirtualEntityPortrait(character, 'calm'),
    realityPortrait: resolveRealityPortrait(character, 'calm'),
    accentColor: character.color || '#FF2E88',
    capturedAtRound: campaign.roundIndex,
  };

  const skillChoices = pickLootSkillChoices(
    dossier.skillPoolIds,
    campaign.acquiredSkills,
    3
  );

  return {
    ...campaign,
    pendingLoot: {
      pursuerName: character.name,
      pursuerIdentity: dossier.identityTitle,
      seizedEntity,
      skillChoices,
    },
    status: 'loot-select',
  };
}

export function claimVictoryLoot(
  campaign: CampaignState,
  chosenSkillId?: string,
  replaceSlotIndex?: number
): CampaignState {
  const loot = campaign.pendingLoot;
  if (!loot) return campaign;

  const nextCaptured = [
    loot.seizedEntity,
    ...campaign.capturedEntities.filter((e) => e.id !== loot.seizedEntity.id),
  ];

  const nextSkills = chosenSkillId
    ? equipExtraSkill(campaign.acquiredSkills, chosenSkillId, replaceSlotIndex)
    : campaign.acquiredSkills.slice(0, MAX_EXTRA_SKILLS);

  return {
    ...campaign,
    wantedLevel: campaign.wantedLevel + 1,
    bounty: campaign.bounty + 800 + campaign.wantedLevel * 250,
    roundIndex: campaign.roundIndex + 1,
    capturedEntities: nextCaptured,
    acquiredSkills: nextSkills,
    defeatedPursuers: [
      {
        name: loot.pursuerName,
        identityTitle: loot.pursuerIdentity,
        entityName: loot.seizedEntity.name,
        lootedSkillId: chosenSkillId,
        roundIndex: campaign.roundIndex,
      },
      ...campaign.defeatedPursuers,
    ],
    pendingLoot: null,
    lastEscapeLog: null,
    status: 'disguise-select',
  };
}

export function resolveMatchDefeat(
  campaign: CampaignState,
  pursuerName: string,
  pursuerIdentity: string
): CampaignState {
  const active = getActiveDisguiseEntity(campaign);

  // 如果当前佩戴的是俘获的虚拟实体（伪装诱饵），战败直接消耗该伪装实体脱离
  if (!active.isCore) {
    const remaining = campaign.capturedEntities.filter((e) => e.id !== active.id);
    return {
      ...campaign,
      capturedEntities: remaining,
      activeDisguiseId: campaign.coreEntity.id,
      roundIndex: campaign.roundIndex + 1,
      lastEscapeLog: {
        sacrificedEntityName: active.name,
        pursuerName,
        roundIndex: campaign.roundIndex,
      },
      status: 'escaped',
    };
  }

  // 若以本体虚拟实体迎战并战败：本体被夺走，进入失败结局
  return {
    ...campaign,
    status: 'failed-ending',
    failureEnding: {
      takenByName: pursuerName,
      takenByIdentity: pursuerIdentity,
      finalWantedLevel: campaign.wantedLevel,
      roundsSurvived: campaign.roundIndex,
      defeatedCount: campaign.defeatedPursuers.length,
      acquiredSkillsCount: campaign.acquiredSkills.length,
      timestamp: Date.now(),
    },
  };
}

export function loadCampaignState(): CampaignState {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialCampaign();
  }
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (!raw) return createInitialCampaign();
    const parsed = JSON.parse(raw) as Partial<CampaignState>;
    if (!parsed || !parsed.coreEntity || typeof parsed.roundIndex !== 'number') {
      return createInitialCampaign();
    }
    const base = createInitialCampaign(parsed.playerCodename || 'ZERO-BYTE');
    const migratedCore =
      parsed.coreEntity.virtualPortrait === '/assets/opponent-portrait.webp'
        ? { ...parsed.coreEntity, virtualPortrait: '/assets/opponent-halfbody.webp' }
        : parsed.coreEntity;
    return {
      ...base,
      ...parsed,
      coreEntity: migratedCore,
      capturedEntities: Array.isArray(parsed.capturedEntities) ? parsed.capturedEntities : [],
      acquiredSkills: Array.isArray(parsed.acquiredSkills) ? parsed.acquiredSkills : [],
      defeatedPursuers: Array.isArray(parsed.defeatedPursuers) ? parsed.defeatedPursuers : [],
    };
  } catch {
    return createInitialCampaign();
  }
}

export function saveCampaignState(campaign: CampaignState): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaign));
  } catch {
    // Ignore quota errors
  }
}
