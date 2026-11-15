/**
 * Google Vertex AI 浏览器直连层（参考 night-sugar-office/src/vertex.ts）
 * - 支持服务账号 JSON（本地 WebCrypto RS256 签名换取 OAuth2 Access Token）
 * - 支持 Express 模式密钥（AIza 开头，走 global 端点）
 * - 自动在 v1 / v1beta1 与 thinkingConfig 写法间降级兼容
 */

export interface VertexServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

export type VertexMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface VertexParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  thinking?: boolean;
}

export type ThinkingVariant = 'plain' | 'level' | 'budget' | 'off';

export type VertexCallResult =
  | {
      ok: true;
      text: string;
      reasoning?: string;
      finish?: string;
      thinkingDropped?: boolean;
      thinkingVariant?: ThinkingVariant;
      usage?: { prompt?: number; completion?: number; total?: number };
    }
  | {
      ok: false;
      message: string;
      reasoning?: string;
      status?: number;
      thinkingDropped?: boolean;
      thinkingVariant?: ThinkingVariant;
    };

export const DEFAULT_VERTEX_LOCATION = 'us-central1';
export const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const THINKING_TOKEN_RESERVE = 32_768;
const MAX_OUTPUT_TOKENS = 65_536;

export function normalizeServiceAccountText(text: string): string {
  let raw = text.replace(/^\uFEFF/, '').trim();
  if (!raw) return '';
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const inner = JSON.parse(raw);
      if (typeof inner === 'string') raw = inner.replace(/^\uFEFF/, '').trim();
    } catch {
      /* keep raw */
    }
  }
  if (!raw.startsWith('{')) return raw;
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

export function parseVertexServiceAccount(text: string): VertexServiceAccount | null {
  const raw = normalizeServiceAccountText(text);
  if (!raw.startsWith('{')) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const projectId = typeof record.project_id === 'string' ? record.project_id.trim() : '';
  const clientEmail = typeof record.client_email === 'string' ? record.client_email.trim() : '';
  const privateKey = typeof record.private_key === 'string' ? record.private_key.trim() : '';
  if (!projectId || !clientEmail || !privateKey) return null;
  const tokenUri =
    typeof record.token_uri === 'string' && record.token_uri.trim()
      ? record.token_uri.trim()
      : DEFAULT_TOKEN_URI;
  return { projectId, clientEmail, privateKey, tokenUri };
}

export function readVertexCredential(
  secret: string
): { kind: 'service-account'; serviceAccount: VertexServiceAccount } | { kind: 'express-key' } | null {
  const text = normalizeServiceAccountText(secret);
  if (!text) return null;
  const sa = parseVertexServiceAccount(text);
  if (sa) return { kind: 'service-account', serviceAccount: sa };
  if (text.startsWith('{')) return null;
  return { kind: 'express-key' };
}

export function describeVertexCredential(secret: string): {
  kind: 'empty' | 'service-account' | 'express-key' | 'invalid';
  projectId?: string;
  clientEmail?: string;
  message: string;
} {
  const text = secret.trim();
  if (!text) return { kind: 'empty', message: '尚未导入 Vertex 凭证。' };
  const sa = parseVertexServiceAccount(text);
  if (sa) {
    return {
      kind: 'service-account',
      projectId: sa.projectId,
      clientEmail: sa.clientEmail,
      message: `服务账号已就绪 (${sa.projectId})`,
    };
  }
  if (text.startsWith('{')) {
    return {
      kind: 'invalid',
      message: 'JSON 缺少 project_id / client_email / private_key。',
    };
  }
  return {
    kind: 'express-key',
    message: '按 Vertex Express API Key 模式处理（走 global 端点）。',
  };
}

export function vertexLocation(location?: string): string {
  const value = (location ?? '').trim();
  return value || DEFAULT_VERTEX_LOCATION;
}

export function normalizeVertexModel(model: string): string {
  return model
    .trim()
    .replace(/^https?:\/\/[^/]+\/v1\//i, '')
    .replace(/^projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\//i, '')
    .replace(/^publishers\/google\/models\//i, '')
    .replace(/^models\//i, '')
    .replace(/^google\//i, '')
    .replace(/:(generateContent|streamGenerateContent)$/i, '');
}

export type VertexVersion = 'v1' | 'v1beta1';

export function vertexTarget(
  input: { model: string; location?: string; expressKey?: string; version?: VertexVersion },
  serviceAccount?: VertexServiceAccount
): { url: string; model: string; display: string } {
  const model = normalizeVertexModel(input.model);
  const version = input.version ?? 'v1';
  if (serviceAccount) {
    const location = vertexLocation(input.location);
    const host =
      location === 'global'
        ? 'aiplatform.googleapis.com'
        : `${location}-aiplatform.googleapis.com`;
    const path = `/${version}/projects/${serviceAccount.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    return { url: `https://${host}${path}`, model, display: `https://${host}${path}` };
  }
  const path = `/${version}/publishers/google/models/${model}:generateContent`;
  const key = input.expressKey?.trim();
  return {
    url: `https://aiplatform.googleapis.com${path}${key ? `?key=${encodeURIComponent(key)}` : ''}`,
    model,
    display: `https://aiplatform.googleapis.com${path}`,
  };
}

function base64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlText(text: string): string {
  return base64Url(new TextEncoder().encode(text));
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signAssertion(serviceAccount: VertexServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlText(
    JSON.stringify({
      iss: serviceAccount.clientEmail,
      scope: VERTEX_SCOPE,
      aud: serviceAccount.tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  );
  return `${header}.${claims}.${base64Url(new Uint8Array(signature as ArrayBuffer))}`;
}

interface CachedToken {
  key: string;
  token: string;
  expiresAt: number;
}
let cachedToken: CachedToken | null = null;

export function clearVertexToken(): void {
  cachedToken = null;
}

export async function vertexAccessToken(
  serviceAccount: VertexServiceAccount,
  timeoutMs = 20_000
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const cacheKey = `${serviceAccount.clientEmail}|${serviceAccount.projectId}`;
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const assertion = await signAssertion(serviceAccount);
    const response = await fetch(serviceAccount.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent(
        'urn:ietf:params:oauth:grant-type:jwt-bearer'
      )}&assertion=${encodeURIComponent(assertion)}`,
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (!response.ok || !body?.access_token) {
      const detail = body?.error_description ?? body?.error ?? '';
      return {
        ok: false,
        message: `换取 Vertex 令牌失败 (${response.status})${detail ? `: ${detail}` : ''}`,
      };
    }
    const ttl = Number(body.expires_in ?? 3600);
    cachedToken = {
      key: cacheKey,
      token: body.access_token,
      expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000,
    };
    return { ok: true, token: body.access_token };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '网络异常';
    return { ok: false, message: `连接 Google OAuth2 失败: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

interface VertexResponseBody {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
    finishMessage?: string;
  }>;
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { code?: number; message?: string };
}

function thinkingConfigOf(variant: ThinkingVariant): Record<string, unknown> | undefined {
  if (variant === 'plain') return { includeThoughts: true };
  if (variant === 'level') return { includeThoughts: true, thinkingLevel: 'high' };
  if (variant === 'budget') return { includeThoughts: true, thinkingBudget: -1 };
  return undefined;
}

function thinkingLadder(model: string, enabled = true): ThinkingVariant[] {
  if (!enabled) return ['off'];
  const modern = /gemini-(?:[3-9]|\d{2,})/i.test(model);
  return modern ? ['level', 'plain', 'budget', 'off'] : ['plain', 'budget', 'off'];
}

const workingVariant = new Map<string, ThinkingVariant>();

export async function vertexChat(
  input: { model: string; location?: string; secret: string; timeoutMs?: number },
  messages: VertexMessage[],
  params: VertexParams = {}
): Promise<VertexCallResult> {
  const credential = readVertexCredential(input.secret);
  if (!credential) {
    return {
      ok: false,
      message: 'Vertex 凭证为空或格式无效，请导入服务账号 JSON 或填写 Express 密钥。',
    };
  }
  if (!input.model.trim()) {
    return { ok: false, message: '请填写 Vertex 模型名称（例如 gemini-2.5-pro）。' };
  }

  const serviceAccount = credential.kind === 'service-account' ? credential.serviceAccount : undefined;
  let token: string | undefined;
  if (serviceAccount) {
    const auth = await vertexAccessToken(serviceAccount);
    if (!auth.ok) return { ok: false, message: auth.message };
    token = auth.token;
  }

  const systemParts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content);
    } else {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      });
    }
  }
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: '请开始响应。' }] });
  }
  const systemText = systemParts.join('\n\n');
  const model = normalizeVertexModel(input.model);

  const buildPayload = (variant: ThinkingVariant, capMax?: number) => {
    const generationConfig: Record<string, unknown> = {};
    if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
    if (params.topP !== undefined) generationConfig.topP = params.topP;
    const baseTokens = Math.max(4096, params.maxTokens ?? 8000);
    if (capMax !== undefined) {
      generationConfig.maxOutputTokens = capMax;
    } else {
      generationConfig.maxOutputTokens =
        variant === 'off'
          ? baseTokens
          : Math.min(baseTokens + THINKING_TOKEN_RESERVE, MAX_OUTPUT_TOKENS);
    }
    const tc = thinkingConfigOf(variant);
    if (tc) generationConfig.thinkingConfig = tc;
    const body: Record<string, unknown> = { contents };
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
    if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
    return body;
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 45_000);

  const send = async (version: VertexVersion, payload: Record<string, unknown>) => {
    const target = vertexTarget(
      {
        model,
        location: input.location,
        expressKey: serviceAccount ? undefined : input.secret,
        version,
      },
      serviceAccount
    );
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let body: VertexResponseBody | null = null;
      try {
        body = JSON.parse(text) as VertexResponseBody;
      } catch {
        /* keep raw */
      }
      return {
        ok: false as const,
        status: res.status,
        message: `Vertex AI 返回 ${res.status}: ${body?.error?.message ?? text.slice(0, 180)}`,
      };
    }
    const body = (await res.json().catch(() => null)) as VertexResponseBody | null;
    if (!body) {
      return { ok: false as const, status: 500, message: 'Vertex AI 返回了空响应体。' };
    }
    return { ok: true as const, body };
  };

  const baseLadder = thinkingLadder(model, params.thinking !== false);
  const cachedVar = workingVariant.get(model);
  const ladder =
    cachedVar && baseLadder.includes(cachedVar)
      ? [cachedVar, ...baseLadder.filter((v) => v !== cachedVar)]
      : baseLadder;

  try {
    let fallback: VertexCallResult | null = null;
    let fallbackVariant: ThinkingVariant | null = null;

    for (const variant of ladder) {
      let attempt = await send('v1', buildPayload(variant));
      if (!attempt.ok && attempt.status === 404) {
        attempt = await send('v1beta1', buildPayload(variant));
      }
      if (!attempt.ok && attempt.status === 400 && /maxOutputTokens/i.test(attempt.message)) {
        attempt = await send('v1', buildPayload(variant, Math.min(8192, Math.max(4096, params.maxTokens ?? 8000))));
      }
      if (!attempt.ok) {
        if (attempt.status === 400 && /thinking|thought/i.test(attempt.message) && variant !== 'off') {
          continue;
        }
        return {
          ok: false,
          status: attempt.status,
          message: attempt.message,
          thinkingDropped: params.thinking !== false && fallback !== null,
        };
      }

      const cand = attempt.body.candidates?.[0];
      const parts = cand?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('');
      const reasoning =
        parts
          .filter((p) => p.thought && typeof p.text === 'string')
          .map((p) => p.text as string)
          .join('') || undefined;
      const usage = attempt.body.usageMetadata
        ? {
            prompt: attempt.body.usageMetadata.promptTokenCount,
            completion: attempt.body.usageMetadata.candidatesTokenCount,
            total: attempt.body.usageMetadata.totalTokenCount,
          }
        : undefined;

      if (!text.trim()) {
        const block = attempt.body.promptFeedback?.blockReason;
        // 思维链烧光额度导致 MAX_TOKENS 且无正文时，自动降级至后续档位（含非思考模式 off）重试！
        if (!block && cand?.finishReason === 'MAX_TOKENS' && variant !== 'off') {
          continue;
        }
        return {
          ok: false,
          message: block
            ? `请求被 Vertex 安全策略拦截 (${block})`
            : `Vertex 返回正文为空 (${cand?.finishReason ?? 'UNKNOWN'})`,
          reasoning,
        };
      }

      if (reasoning) {
        workingVariant.set(model, variant);
        return {
          ok: true,
          text,
          reasoning,
          finish: cand?.finishReason,
          thinkingDropped: false,
          thinkingVariant: variant,
          usage,
        };
      }

      if (!fallback) {
        fallback = {
          ok: true,
          text,
          finish: cand?.finishReason,
          usage,
        };
        fallbackVariant = variant;
      }
      if (variant === 'off' || params.thinking === false) break;
    }

    if (fallback && fallback.ok) {
      if (fallbackVariant && params.thinking !== false) {
        workingVariant.set(model, fallbackVariant);
      }
      return {
        ...fallback,
        thinkingDropped: params.thinking !== false,
        thinkingVariant: fallbackVariant ?? undefined,
      };
    }

    return { ok: false, message: 'Vertex AI 未返回有效响应。' };
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, message: 'Vertex AI 请求超时。' };
    }
    return {
      ok: false,
      message: `Vertex AI 网络连接失败: ${err instanceof Error ? err.message : '未知错误'}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
