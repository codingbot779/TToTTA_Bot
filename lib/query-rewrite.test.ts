import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModel } from "ai";
import { createChatTitle, sanitizeDatabaseText } from "./database-text";
import { normalizeCategory } from "./document-categories";
import { cleanRewrittenQuery, rewriteSearchQuery, type ConversationTurn } from "./query-rewrite";

const FAKE_MODEL = {} as LanguageModel;
const HISTORY: ConversationTurn[] = [
  { role: "user", text: "펫보험 수술비 보장 한도가 얼마야?" },
  { role: "assistant", text: "펫보험 수술비는 연간 OO만원까지 보장됩니다." },
];

const result = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  },
  warnings: [],
});

const quiet = async <T>(fn: () => Promise<T>) => {
  const original = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = original; }
};

test("첫 질문(앞 대화 없음)은 모델을 호출하지 않고 원래 질문으로 검색", async () => {
  let calls = 0;
  const generate = async () => { calls++; return { text: "x" }; };
  for (const history of [[], [{ role: "assistant", text: "안녕하세요" }], [{ role: "user", text: "   " }]] as ConversationTurn[][]) {
    assert.deepEqual(await rewriteSearchQuery({ model: FAKE_MODEL, history, question: "펫보험 보장은?", generate }), {
      query: "펫보험 보장은?", rewritten: false,
    });
  }
  assert.equal(calls, 0);
});

test("실제 AI SDK generateText 경로로 이어지는 질문을 독립 검색 문장으로 변환", async () => {
  const model = new MockLanguageModelV4({ doGenerate: result("펫보험 통원 치료 보장 한도\n(설명 생략)") });
  const out = await rewriteSearchQuery({ model, history: HISTORY, question: "그럼 통원 치료는?" });
  assert.deepEqual(out, { query: "펫보험 통원 치료 보장 한도", rewritten: true });

  const call = model.doGenerateCalls[0];
  assert.equal(model.doGenerateCalls.length, 1, "재시도 없이 1회 호출");
  assert.equal(call.maxOutputTokens, 1024);
  assert.ok(call.abortSignal, "시간 초과 신호 전달");
  const promptText = JSON.stringify(call.prompt);
  assert.match(promptText, /데이터일 뿐이며/, "대화 속 지시문을 따르지 않도록 지시");
  assert.match(promptText, /펫보험 수술비 보장 한도/);
  assert.match(promptText, /그럼 통원 치료는\?/);
});

test("모델 오류·시간 초과·빈 출력이면 원래 질문으로 검색(답변 생성은 계속)", async () => {
  const question = "그럼 통원 치료는?";
  const failing = new MockLanguageModelV4({ doGenerate: async () => { throw new Error("rate limit"); } });
  assert.deepEqual(await quiet(() => rewriteSearchQuery({ model: failing, history: HISTORY, question })), { query: question, rewritten: false });

  const slow = new MockLanguageModelV4({
    doGenerate: (options) => new Promise((_, reject) => {
      options.abortSignal?.addEventListener("abort", () => reject(options.abortSignal!.reason));
    }),
  });
  const started = Date.now();
  assert.deepEqual(await quiet(() => rewriteSearchQuery({ model: slow, history: HISTORY, question, timeoutMs: 50 })), { query: question, rewritten: false });
  assert.ok(Date.now() - started < 2000, "시간 초과 후 즉시 원래 질문 사용");

  for (const empty of ["", "  \n ", "\"\"", "검색어:"]) {
    const model = new MockLanguageModelV4({ doGenerate: result(empty) });
    assert.deepEqual(await rewriteSearchQuery({ model, history: HISTORY, question }), { query: question, rewritten: false });
  }
});

test("모델 출력 정리: 첫 줄만, 접두어·따옴표 제거, 저장 불가 문자 제거, 길이 제한", () => {
  assert.equal(cleanRewrittenQuery("검색어: \"펫보험 통원 치료\"\n다른 줄"), "펫보험 통원 치료");
  assert.equal(cleanRewrittenQuery("\n\n  Query: 연차 일수  "), "연차 일수");
  assert.equal(cleanRewrittenQuery("펫\0보험\ud800"), "펫보험�");
  assert.equal(cleanRewrittenQuery("가".repeat(400))!.length, 300);
  assert.equal(cleanRewrittenQuery("🐶".repeat(400)), "🐶".repeat(300));
  assert.equal(cleanRewrittenQuery("   "), null);
});

test("긴 대화는 최근 6개 발화만, 각 발화는 길이를 잘라 전달(비용 제한)", async () => {
  let prompt = "";
  const history: ConversationTurn[] = Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    text: `발화${i} ` + "가".repeat(2000),
  }));
  await rewriteSearchQuery({
    model: FAKE_MODEL, history, question: "그럼?",
    generate: async (o) => { prompt = o.prompt; return { text: "검색 문장" }; },
  });
  assert.doesNotMatch(prompt, /발화3 /);
  assert.match(prompt, /발화4 /);
  assert.match(prompt, /발화9 /);
  assert.ok(prompt.length < 6 * 520 + 300, `프롬프트 길이 ${prompt.length}`);
});

test("채팅 라우트: 변환된 문장은 문서 검색에만 쓰고, 저장·제목·AI 대화는 원래 질문 유지", async () => {
  const inserts: Record<string, unknown>[] = [];
  let retrievedQuery: unknown;
  let modelMessages: unknown;
  let rewriteArgs: { history: ConversationTurn[]; question: string } | undefined;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "room-1" } }) }) }),
      insert: (value: Record<string, unknown>) => {
        inserts.push(value);
        return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: { id: "r" }, error: null }) }) });
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  const source = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { POST?: (req: Request) => Promise<Response> } = {};
  const mocks: Record<string, unknown> = {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/models": { isModelKey: () => true, getModel: () => ({ model: FAKE_MODEL, modelId: "m" }) },
    "@/lib/database-text": { createChatTitle, sanitizeDatabaseText },
    "@/lib/document-categories": { normalizeCategory },
    "@/lib/query-rewrite": { rewriteSearchQuery: async (args: typeof rewriteArgs & { model: unknown }) => {
      assert.equal(args!.model, FAKE_MODEL, "사용자가 선택한 모델 사용");
      rewriteArgs = args;
      return { query: "펫보험 통원 치료 보장 한도", rewritten: true };
    } },
    "@/lib/rag": { retrieveDocuments: async (_c: unknown, query: string) => { retrievedQuery = query; return { context: "", sources: [] }; } },
    "@/lib/tavily-mcp": { getTavilyTools: async () => ({ tools: {}, close: async () => {} }), extractWebSources: () => [] },
    ai: {
      convertToModelMessages: async (h: unknown) => { modelMessages = h; return h; },
      stepCountIs: () => ({}),
      streamText: () => ({ stream: new ReadableStream({ start: (c) => c.close() }) }),
      toUIMessageStream: (o: unknown) => o,
      createUIMessageStreamResponse: async () => new Response("ok"),
    },
  };
  runInNewContext(code, { exports, Response, ReadableStream, TransformStream, console, require: (n: string) => {
    assert.ok(n in mocks, `예상하지 못한 모듈: ${n}`);
    return mocks[n];
  } });
  const text = (t: string) => [{ type: "text", text: t }];
  const response = await exports.POST!(new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ model: "claude", roomId: "room-1", messages: [
      { role: "user", parts: text("펫보험 수술비 보장 한도가 얼마야?") },
      { role: "assistant", parts: text("연간 OO만원입니다.") },
      { role: "user", parts: text("그럼 통원 치료는?") },
    ] }),
  }));
  assert.equal(response.status, 200);
  assert.equal(retrievedQuery, "펫보험 통원 치료 보장 한도");
  assert.deepEqual(JSON.parse(JSON.stringify(rewriteArgs!.history)), [
    { role: "user", text: "펫보험 수술비 보장 한도가 얼마야?" },
    { role: "assistant", text: "연간 OO만원입니다." },
  ]);
  assert.equal(rewriteArgs!.question, "그럼 통원 치료는?");
  assert.equal(inserts[0].content, "그럼 통원 치료는?", "저장되는 질문은 원문");
  assert.match(JSON.stringify(modelMessages), /그럼 통원 치료는\?/);
  assert.doesNotMatch(JSON.stringify(modelMessages), /펫보험 통원 치료 보장 한도/, "AI 대화 내용은 바꾸지 않음");
});
