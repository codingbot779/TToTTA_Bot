import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { Source } from "./types";

const TAVILY_MCP_URL = "https://mcp.tavily.com/mcp/";
// 모델에게 노출할 Tavily 툴 (검색만 사용)
const ALLOWED_TOOLS = ["tavily_search", "tavily-search"];

/**
 * Tavily 원격 MCP 서버에 연결해 웹검색 툴을 가져온다.
 * 연결에 실패하면 웹검색 없이 동작하도록 빈 툴셋을 돌려준다.
 */
export async function getTavilyTools(): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return { tools: {}, close: async () => {} };

  try {
    const client = await createMCPClient({
      transport: {
        type: "http",
        url: `${TAVILY_MCP_URL}?tavilyApiKey=${encodeURIComponent(apiKey)}`,
      },
    });
    const all = await client.tools();
    const tools = Object.fromEntries(
      Object.entries(all).filter(([name]) => ALLOWED_TOOLS.includes(name)),
    ) as ToolSet;
    return { tools, close: () => client.close() };
  } catch (error) {
    console.error("[Tavily MCP] 연결 실패, 웹검색 없이 진행합니다:", error);
    return { tools: {}, close: async () => {} };
  }
}

/** Tavily MCP 툴 결과에서 제목/URL 목록을 뽑아낸다 */
export function extractWebSources(output: unknown): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();
  const add = (url: string, title?: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    let fallback = url;
    try {
      fallback = new URL(url).hostname;
    } catch {}
    sources.push({ type: "web", title: title?.trim() || fallback, url });
  };

  const texts = collectTexts(output);
  // 현재 Tavily MCP는 {"results":[{"url","title",...}]} JSON 텍스트를 돌려준다
  for (const text of texts) {
    try {
      const parsed = JSON.parse(text) as { results?: { url: string; title?: string }[] };
      parsed.results?.forEach((r) => add(r.url, r.title));
    } catch {}
  }
  const text = texts.join("\n");
  // 이전 텍스트 형식("Title: ...\nURL: ...") 대비
  if (sources.length === 0) {
    for (const m of text.matchAll(/Title:\s*(.+?)\s*\n\s*URL:\s*(\S+)/g)) add(m[2], m[1]);
  }
  return sources;
}

function collectTexts(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectTexts);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string") return [obj.text];
    return Object.values(obj).flatMap(collectTexts);
  }
  return [];
}
