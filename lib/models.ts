import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { ModelKey } from "./types";

export const MODEL_OPTIONS: { key: ModelKey; label: string }[] = [
  { key: "claude", label: "Claude" },
  { key: "chatgpt", label: "ChatGPT" },
  { key: "gemini", label: "Gemini" },
];

const CONFIG = {
  claude: {
    envKey: "ANTHROPIC_API_KEY",
    create: () => anthropic(process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5"),
  },
  chatgpt: {
    envKey: "OPENAI_API_KEY",
    create: () => openai(process.env.OPENAI_MODEL || "gpt-5.5"),
  },
  gemini: {
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    create: () => google(process.env.GEMINI_MODEL || "gemini-3.5-flash"),
  },
} as const;

export function isModelKey(value: unknown): value is ModelKey {
  return typeof value === "string" && value in CONFIG;
}

/** 선택한 모델의 AI SDK 인스턴스. API 키가 없으면 안내 메시지와 함께 에러 */
export function getModel(key: ModelKey) {
  const { envKey, create } = CONFIG[key];
  if (!process.env[envKey]) {
    throw new Error(`${envKey}가 설정되지 않았습니다. .env.local에 API 키를 입력한 뒤 서버를 재시작해 주세요.`);
  }
  return create();
}

/** API 키가 설정된 모델 목록 */
export function getAvailableModels(): ModelKey[] {
  return (Object.keys(CONFIG) as ModelKey[]).filter((key) => !!process.env[CONFIG[key].envKey]);
}
