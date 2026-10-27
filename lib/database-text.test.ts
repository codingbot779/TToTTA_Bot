import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createChatTitle, sanitizeDatabaseText } from "./database-text";
import { normalizeCategory } from "./document-categories";

const assertSafe = (text: string) => assert.equal(sanitizeDatabaseText(text), text);

test("채팅 제목의 40자 경계에 있는 이모지를 분리하지 않음", () => {
  const question = "가".repeat(39) + "🐶 보험 질문";
  assert.notEqual(sanitizeDatabaseText(question.slice(0, 40)), question.slice(0, 40));
  const title = createChatTitle(question);
  assert.equal(title, "가".repeat(39) + "🐶");
  assert.equal(Array.from(title).length, 40);
  assertSafe(title);
  assert.equal(createChatTitle("🐶".repeat(50)), "🐶".repeat(40));
});

test("질문·답변의 NUL과 고립된 surrogate를 정제하고 정상 문자는 보존", () => {
  assert.equal(sanitizeDatabaseText("질문\0내용\ud800 / 답변\udc00 🐶"), "질문내용� / 답변� 🐶");
  assert.equal(createChatTitle(" \0보험\0 질문 \n"), "보험 질문");
  assert.equal(createChatTitle("\0 \n"), "");
  const normal = "한글 é 👨‍👩‍👧‍👦\n\t" + String.raw`\u0000`;
  assert.equal(sanitizeDatabaseText(normal), normal);
});

test("실제 채팅 라우트: 제목·질문·답변·출처 저장값 정제 (외부 의존성 모의)", async () => {
  const writes: { table: string; value: Record<string, unknown> }[] = [];
  let streamOptions: { onEnd: (value: unknown) => Promise<void> } | undefined;
  let retrievedQuestion = "";
  let modelHistory: unknown;
  const assertSafeValue = (value: unknown): void => {
    if (typeof value === "string") assertSafe(value);
    else if (Array.isArray(value)) value.forEach(assertSafeValue);
    else if (value && typeof value === "object") Object.values(value).forEach(assertSafeValue);
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
    from: (table: string) => ({
      insert: (value: Record<string, unknown>) => {
        assertSafeValue(value);
        writes.push({ table, value });
        return Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => ({ data: { id: "test-room" }, error: null }) }),
        });
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  const mocks: Record<string, unknown> = {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/models": { isModelKey: () => true, getModel: () => ({ model: {}, modelId: "test-model" }) },
    "@/lib/database-text": { createChatTitle, sanitizeDatabaseText },
    "@/lib/document-categories": { normalizeCategory },
    "@/lib/rag": { retrieveDocuments: async (_client: unknown, question: string) => {
      retrievedQuestion = question;
      return { context: "test context", sources: [{ type: "doc", title: "문서\0제목\ud800" }] };
    } },
    "@/lib/tavily-mcp": {
      getTavilyTools: async () => ({ tools: {}, close: async () => {} }),
      extractWebSources: () => [{ type: "web", title: "웹\0제목", url: "https://example.com/\0test" }],
    },
    ai: {
      convertToModelMessages: async (history: unknown) => { modelHistory = history; return history; },
      stepCountIs: () => ({}),
      streamText: () => ({ stream: new ReadableStream({ start(controller) {
        controller.enqueue({ type: "tool-result", output: {} });
        controller.close();
      } }) }),
      toUIMessageStream: (options: typeof streamOptions & { stream: ReadableStream }) => {
        streamOptions = options;
        return options;
      },
      createUIMessageStreamResponse: async ({ stream }: { stream: { stream: ReadableStream } }) => {
        // 실제 라우트의 웹검색 출처 수집 TransformStream까지 실행한다.
        const reader = stream.stream.getReader();
        try {
          while (!(await reader.read()).done) { /* 출처 수집 스트림 소비 */ }
        } finally {
          reader.releaseLock();
        }
        return new Response("ok");
      },
    },
  };
  const source = readFileSync(new URL("../app/api/chat/route.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: { POST?: (req: Request) => Promise<Response> } = {};
  runInNewContext(compiled, {
    exports, require: (name: string) => {
      assert.ok(name in mocks, `예상하지 못한 외부 모듈: ${name}`);
      return mocks[name];
    },
    Response, ReadableStream, TransformStream, console,
  });
  const question = "가".repeat(39) + "🐶\0 보험\ud800 질문";
  const response = await exports.POST!(new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ model: "claude", messages: [
      { role: "user", parts: [{ type: "text", text: question }] },
    ] }),
  }));
  assert.equal(response.status, 200);
  assert.equal(writes[0].value.title, "가".repeat(39) + "🐶");
  assert.equal(writes[1].value.content, sanitizeDatabaseText(question));
  assert.equal(retrievedQuestion, sanitizeDatabaseText(question));
  assertSafeValue(modelHistory);
  await streamOptions!.onEnd({ responseMessage: { parts: [{ type: "text", text: "답변\0내용\ud800 🐶" }] } });
  assert.equal(writes[2].value.content, "답변내용� 🐶");
  assert.deepEqual(JSON.parse(JSON.stringify(writes[2].value.sources)), [
    { type: "doc", title: "문서제목�" },
    { type: "web", title: "웹제목", url: "https://example.com/test" },
  ]);
});
