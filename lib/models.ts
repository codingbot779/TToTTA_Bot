import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { ModelKey } from "./types";

const CONFIG = {
  claude: {
    envKey: "ANTHROPIC_API_KEY",
    defaultId: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    create: (id: string) => anthropic(id),
  },
  chatgpt: {
    envKey: "OPENAI_API_KEY",
    defaultId: () => process.env.OPENAI_MODEL || "gpt-5.5",
    create: (id: string) => openai(id),
  },
  gemini: {
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    defaultId: () => process.env.GEMINI_MODEL || "gemini-3.5-flash",
    create: (id: string) => google(id),
  },
} as const;

export function isModelKey(value: unknown): value is ModelKey {
  return typeof value === "string" && value in CONFIG;
}

/** .env.local에 지정된(또는 기본) 모델 ID */
export function getDefaultModelId(key: ModelKey) {
  return CONFIG[key].defaultId();
}

/** 모델 ID 형식 검사 (영문/숫자/.-_ 만 허용) */
const MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$/;

/**
 * 선택한 제공사 + 모델 ID의 AI SDK 인스턴스.
 * 모델 ID가 없으면 기본 모델, API 키가 없으면 안내 메시지와 함께 에러
 */
export function getModel(key: ModelKey, modelId?: unknown) {
  const { envKey, create } = CONFIG[key];
  if (!process.env[envKey]) {
    throw new Error(`${envKey}가 설정되지 않았습니다. .env.local에 API 키를 입력한 뒤 서버를 재시작해 주세요.`);
  }
  const id = typeof modelId === "string" && MODEL_ID_PATTERN.test(modelId) ? modelId : getDefaultModelId(key);
  return { model: create(id), modelId: id };
}

/** API 키가 설정된 제공사 목록 */
export function getAvailableModels(): ModelKey[] {
  return (Object.keys(CONFIG) as ModelKey[]).filter((key) => !!process.env[CONFIG[key].envKey]);
}
