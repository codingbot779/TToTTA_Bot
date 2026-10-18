import { getAvailableModels, getDefaultModelId } from "./models";
import type { ModelKey } from "./types";

export type ModelOption = { id: string; label: string };
export type ModelCatalog = Partial<Record<ModelKey, ModelOption[]>>;

const CACHE_SECONDS = 60 * 60;

// 채팅에 맞지 않는 모델(TTS, 이미지, 임베딩 등)은 목록에서 제외
const EXCLUDE = /tts|audio|realtime|transcribe|image|embedding|moderation|search|computer-use|robotics|customtools|instruct|codex|live|dall-e|whisper|babbage|davinci/i;

/** 버전 번호가 큰 모델이 위로 오도록 정렬 */
function byVersionDesc(a: ModelOption, b: ModelOption) {
  return b.id.localeCompare(a.id, undefined, { numeric: true });
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers, next: { revalidate: CACHE_SECONDS } });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function listGemini(): Promise<ModelOption[]> {
  const data = await fetchJson<{
    models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
  }>("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  });
  return data.models
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName ?? m.name }))
    .filter((m) => /^gemini-\d/.test(m.id) && !EXCLUDE.test(m.id));
}

async function listOpenAI(): Promise<ModelOption[]> {
  const data = await fetchJson<{ data: { id: string }[] }>("https://api.openai.com/v1/models", {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  });
  return data.data
    .map((m) => ({ id: m.id, label: m.id }))
    .filter(
      (m) =>
        /^(gpt-[4-9]|o\d)/.test(m.id) &&
        !EXCLUDE.test(m.id) &&
        !/\d{4}-\d{2}-\d{2}|preview|chat-latest/.test(m.id), // 날짜 스냅샷/프리뷰 제외
    );
}

async function listAnthropic(): Promise<ModelOption[]> {
  const data = await fetchJson<{ data: { id: string; display_name?: string }[] }>(
    "https://api.anthropic.com/v1/models?limit=100",
    { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
  );
  return data.data.map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
}

const LISTERS: Record<ModelKey, () => Promise<ModelOption[]>> = {
  claude: listAnthropic,
  chatgpt: listOpenAI,
  gemini: listGemini,
};

/**
 * API 키가 설정된 제공사별로, 그 키로 사용할 수 있는 모델 목록을 가져온다.
 * 목록 조회에 실패하면 .env.local의 기본 모델만 보여준다. (1시간 캐시)
 */
export async function getModelCatalog(): Promise<ModelCatalog> {
  const entries = await Promise.all(
    getAvailableModels().map(async (key) => {
      const defaultId = getDefaultModelId(key);
      let options: ModelOption[] = [];
      try {
        options = (await LISTERS[key]()).sort(byVersionDesc);
      } catch (error) {
        console.error(`[models] ${key} 모델 목록 조회 실패:`, error);
      }
      // 기본 모델을 맨 앞에
      const rest = options.filter((o) => o.id !== defaultId);
      const def = options.find((o) => o.id === defaultId) ?? { id: defaultId, label: defaultId };
      return [key, [def, ...rest]] as const;
    }),
  );
  return Object.fromEntries(entries);
}
