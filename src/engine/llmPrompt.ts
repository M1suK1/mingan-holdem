/**
 * 提示词编排：把「预设词条 + 世界书命中 + 牌桌宏」合成为一次请求的 system prompt。
 *
 * 分层顺序与 night-sugar-office 一致：
 *   正文词条（按预设顺序） → 世界书兜底 → 输出契约（永远最后）
 */
import type { GameState } from './types.ts';
import type { ContractCharacter } from './contractCards.ts';
import type { LlmActionOption } from './llmActionSpace.ts';
import type { LlmConfig } from './llmClient.ts';
import {
  activePrompts,
  boundPreset,
  loadPresets,
  renderPresetSystem,
  samplingPayload,
  type ChatPreset,
  type PromptScope,
} from './llmPreset.ts';
import { loadWorldbook, worldbookContext, type WorldbookContext, type WorldbookEntry } from './worldbook.ts';
import { describeStateForMacro } from './promptMacros.ts';
import type { MacroContext } from './promptMacros.ts';

export interface ComposePromptInput {
  character: ContractCharacter;
  state: GameState;
  config: LlmConfig;
  scope: PromptScope;
  /** 事件描述或玩家发言，用于世界书关键词命中 */
  sceneText?: string;
  triggerText?: string;
  legalActions?: LlmActionOption[];
  /** 测试或导入时可注入，缺省从本地存储读取 */
  presets?: ChatPreset[];
  worldbook?: WorldbookEntry[];
  overloadPersona?: boolean;
}

export interface ComposedPrompt {
  system: string;
  preset: ChatPreset;
  worldbook: WorldbookContext;
  used: string[];
  missing: string[];
  sampling: Record<string, number>;
  chars: number;
}

export function resolveActivePreset(config: LlmConfig, presets?: ChatPreset[]): ChatPreset {
  return boundPreset(presets ?? loadPresets(), config.presetId);
}

export function composeOpponentPrompt(input: ComposePromptInput): ComposedPrompt {
  const { character, state, config, scope, sceneText, triggerText, legalActions } = input;
  const preset = resolveActivePreset(config, input.presets);
  const entries = activePrompts(preset, scope);

  const worldbookEntries = input.worldbook ?? loadWorldbook(character);
  const hitText = [sceneText ?? '', triggerText ?? '', describeStateForMacro(state)].join('\n');
  const wb = config.worldbookEnabled
    ? worldbookContext(hitText, worldbookEntries, config.worldbookBudget)
    : { text: '', hits: [], chars: 0, dropped: 0 };

  const ctx: MacroContext = {
    character,
    state,
    trigger: triggerText,
    legalActions: legalActions?.map((option) => option.example),
    worldbook: wb.text,
  };

  const rendered = renderPresetSystem(entries, ctx);

  return {
    system: rendered.system,
    preset,
    worldbook: wb,
    used: rendered.used,
    missing: rendered.missing,
    sampling: samplingPayload(preset),
    chars: rendered.chars,
  };
}
