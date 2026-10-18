/**
 * 외부 서비스 연결 점검: Upstage 임베딩, Tavily MCP
 * 실행: npm run check
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { embedQuery } from "../lib/embeddings";
import { createMCPClient } from "@ai-sdk/mcp";
import { extractWebSources } from "../lib/tavily-mcp";

async function main() {
  const vector = await embedQuery("TToTA AI 연결 테스트");
  console.log(`✅ Upstage embedding: ${vector.length}차원`);

  const client = await createMCPClient({
    transport: {
      type: "http",
      url: `https://mcp.tavily.com/mcp/?tavilyApiKey=${process.env.TAVILY_API_KEY}`,
    },
  });
  try {
    const tools = await client.tools();
    console.log(`✅ Tavily MCP 툴: ${Object.keys(tools).join(", ")}`);
    const result = await client.callTool({
      name: "tavily_search",
      arguments: { query: "오늘 서울 날씨", max_results: 3 },
    });
    const sources = extractWebSources(result);
    console.log(`✅ Tavily 검색 결과 ${sources.length}건`);
    sources.forEach((s) => console.log("   -", s.title, s.type === "web" ? s.url : ""));
    if (process.argv.includes("--raw")) console.log(JSON.stringify(result).slice(0, 1500));
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
