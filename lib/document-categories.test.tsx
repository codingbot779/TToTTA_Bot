import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createChatTitle, sanitizeDatabaseText } from "./database-text";
import { listSearchableCategories, normalizeCategory } from "./document-categories";
import { CategorySelect } from "../components/CategorySelect";
import { rewriteSearchQuery } from "./query-rewrite";

function loadModule<T>(relativePath: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports, URL, Response, ReadableStream, TransformStream, SyntaxError, console, crypto,
    require: (name: string) => {
      assert.ok(name in mocks, `예상하지 못한 외부 모듈: ${name}`);
      return mocks[name];
    },
  });
  return exports as T;
}

const FILE_ID = "11111111-1111-4111-8111-111111111111";

test("카테고리명 정규화: 공백·제어문자 정리, 빈 값은 미분류, 길이·타입 제한", () => {
  assert.equal(normalizeCategory("  보험   약관 "), "보험 약관");
  assert.equal(normalizeCategory("인사\0규정\n\t2026"), "인사규정 2026");
  assert.equal(normalizeCategory(""), null);
  assert.equal(normalizeCategory("   "), null);
  assert.equal(normalizeCategory(null), null);
  assert.equal(normalizeCategory(undefined), null);
  assert.equal(normalizeCategory("🐶".repeat(40)), "🐶".repeat(40));
  assert.throws(() => normalizeCategory("가".repeat(41)), /40자/);
  assert.throws(() => normalizeCategory(3), /문자열/);
});

test("검색 가능한 카테고리 목록: ready 문서만, 중복 제거, 가나다순, 조회 실패 시 빈 목록", async () => {
  const filters: unknown[] = [];
  const client = { from: (table: string) => {
    assert.equal(table, "document_files");
    return { select: (fields: string) => {
      assert.equal(fields, "category");
      return { eq: (k: string, v: unknown) => {
        filters.push(["eq", k, v]);
        return { not: async (k2: string, op: string, v2: unknown) => {
          filters.push(["not", k2, op, v2]);
          return { data: [{ category: "인사" }, { category: "보험" }, { category: "인사" }, { category: null }], error: null };
        } };
      } };
    } };
  } };
  assert.deepEqual(await listSearchableCategories(client as never), ["보험", "인사"]);
  assert.deepEqual(filters, [["eq", "status", "ready"], ["not", "category", "is", null]]);

  const failing = { from: () => ({ select: () => ({ eq: () => ({ not: async () => ({ data: null, error: { message: "column missing" } }) }) }) }) };
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await listSearchableCategories(failing as never), []);
  } finally {
    console.error = originalError;
  }
});

test("RAG: 카테고리 선택 시 카테고리 함수, 미선택 시 기존 전체 검색 함수 호출", async () => {
  const calls: [string, Record<string, unknown>][] = [];
  const rag = loadModule<{ retrieveDocuments: (c: unknown, q: string, n?: number, cat?: string | null) => Promise<unknown> }>(
    "./rag.ts", { "./embeddings": { embedQuery: async () => [0.5, 0.5] } },
  );
  const client = {
    rpc: async (name: string, params: Record<string, unknown>) => { calls.push([name, params]); return { data: [], error: null }; },
  };
  await rag.retrieveDocuments(client, "질문", 5, "보험");
  await rag.retrieveDocuments(client, "질문");
  assert.equal(calls[0][0], "match_documents_by_category");
  assert.equal(calls[0][1].filter_category, "보험");
  assert.equal(calls[0][1].match_count, 5);
  assert.equal(calls[1][0], "match_documents");
  assert.equal("filter_category" in calls[1][1], false);
});

function chatHarness(categoryRows: { data: unknown[] | null; error: unknown }) {
  const writes: string[] = [];
  const categoryQueries: unknown[] = [];
  let retrieved: unknown[] | undefined;
  let system = "";
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: "test-user" } } }) },
    from: (table: string) => ({
      select: (fields: string) => {
        assert.equal(table, "document_files");
        assert.equal(fields, "id");
        const chain = {
          filters: [] as unknown[],
          eq(k: string, v: unknown) { this.filters.push([k, v]); return this; },
          async limit(n: number) { categoryQueries.push([...this.filters, ["limit", n]]); return categoryRows; },
        };
        return chain;
      },
      insert: (value: Record<string, unknown>) => {
        writes.push(table);
        void value;
        return Object.assign(Promise.resolve({ error: null }), {
          select: () => ({ single: async () => ({ data: { id: "room" }, error: null }) }),
        });
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  const route = loadModule<{ POST: (req: Request) => Promise<Response> }>("../app/api/chat/route.ts", {
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/models": { isModelKey: () => true, getModel: () => ({ model: {}, modelId: "test-model" }) },
    "@/lib/database-text": { createChatTitle, sanitizeDatabaseText },
    "@/lib/document-categories": { normalizeCategory },
    "@/lib/query-rewrite": { rewriteSearchQuery },
    "@/lib/rag": { retrieveDocuments: async (...args: unknown[]) => { retrieved = args.slice(1); return { context: "", sources: [] }; } },
    "@/lib/tavily-mcp": { getTavilyTools: async () => ({ tools: {}, close: async () => {} }), extractWebSources: () => [] },
    ai: {
      convertToModelMessages: async (h: unknown) => h,
      stepCountIs: () => ({}),
      streamText: (opts: { system: string }) => { system = opts.system; return { stream: new ReadableStream({ start: (c) => c.close() }) }; },
      toUIMessageStream: (o: unknown) => o,
      createUIMessageStreamResponse: async () => new Response("ok"),
    },
  });
  const post = (category: unknown) => route.POST(new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ model: "claude", category, messages: [{ role: "user", parts: [{ type: "text", text: "보장 범위는?" }] }] }),
  }));
  return { post, writes, categoryQueries, retrieved: () => retrieved, system: () => system };
}

test("채팅: 선택한 카테고리를 검증한 뒤 해당 범위로 검색하고 프롬프트에 범위를 알림", async () => {
  const h = chatHarness({ data: [{ id: FILE_ID }], error: null });
  const response = await h.post("  보험 ");
  assert.equal(response.status, 200);
  assert.deepEqual(h.categoryQueries, [[["category", "보험"], ["status", "ready"], ["limit", 1]]]);
  assert.deepEqual(h.retrieved(), ["보장 범위는?", 5, "보험"]);
  assert.match(h.system(), /'보험' 카테고리의 문서만 검색/);
  assert.deepEqual(h.writes, ["chat_rooms", "messages"]);
});

test("채팅: 카테고리 미선택(전체 문서)은 추가 조회 없이 기존 검색 유지", async () => {
  for (const category of [null, "", undefined]) {
    const h = chatHarness({ data: [], error: null });
    assert.equal((await h.post(category)).status, 200);
    assert.deepEqual(h.categoryQueries, []);
    assert.deepEqual(h.retrieved(), ["보장 범위는?", 5, null]);
    assert.doesNotMatch(h.system(), /카테고리의 문서만/);
  }
});

for (const [label, rows, category, status] of [
  ["문서 없는 카테고리", { data: [], error: null }, "없는분류", 400],
  ["카테고리 조회 실패(마이그레이션 전 등)", { data: null, error: { message: "column category does not exist" } }, "보험", 503],
  ["잘못된 카테고리 형식", { data: [], error: null }, 123, 400],
  ["너무 긴 카테고리", { data: [], error: null }, "가".repeat(41), 400],
] as const) {
  test(`채팅 거부: ${label} → 채팅방·메시지를 만들지 않음`, async () => {
    const h = chatHarness(rows as { data: unknown[] | null; error: unknown });
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await h.post(category);
      assert.equal(response.status, status);
      assert.ok((await response.json()).error);
    } finally {
      console.error = originalError;
    }
    assert.deepEqual(h.writes, []);
    assert.equal(h.retrieved(), undefined);
  });
}

function documentsHarness(admin = true) {
  const inserts: Record<string, unknown>[] = [];
  const updates: [Record<string, unknown>, unknown][] = [];
  let updateResult: { data: unknown; error: unknown } = { data: { id: FILE_ID, category: "보험" }, error: null };
  const adminClient = {
    from: (table: string) => {
      assert.equal(table, "document_files");
      return {
        insert: async (value: Record<string, unknown>) => { inserts.push(value); return { error: null }; },
        update: (value: Record<string, unknown>) => ({
          eq: (_k: string, id: unknown) => ({ select: () => ({ maybeSingle: async () => { updates.push([value, id]); return updateResult; } }) }),
        }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      };
    },
    storage: { from: () => ({ createSignedUploadUrl: async (path: string) => ({ data: { path, token: "t" }, error: null }) }) },
  };
  const mocks = {
    "@/lib/admin": { requireAdmin: async () => admin ? { user: { id: "admin" } } : { error: Response.json({ error: "forbidden" }, { status: 403 }) } },
    "@/lib/supabase/admin": { createAdminClient: () => adminClient },
    "@/lib/document-files": { DOCUMENTS_BUCKET: "documents", SUPPORTED_EXTENSIONS: [".pdf"], extensionOf: (n: string) => n.slice(n.lastIndexOf(".")) },
    "@/lib/document-categories": { normalizeCategory },
  };
  const list = loadModule<{ POST: (req: Request) => Promise<Response> }>("../app/api/documents/route.ts", mocks);
  const item = loadModule<{ PATCH: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response> }>(
    "../app/api/documents/[id]/route.ts", mocks,
  );
  return {
    upload: (body: unknown) => list.POST(new Request("http://localhost/api/documents", { method: "POST", body: JSON.stringify(body) })),
    patch: (id: string, body: string) => item.PATCH(new Request(`http://localhost/api/documents/${id}`, { method: "PATCH", body }), { params: Promise.resolve({ id }) }),
    inserts, updates, setUpdateResult: (r: typeof updateResult) => { updateResult = r; },
  };
}

test("문서 업로드: 카테고리를 정규화해 저장하고 미입력은 미분류(null)", async () => {
  const h = documentsHarness();
  assert.equal((await h.upload({ name: "약관.pdf", size: 10, category: "  보험  약관 " })).status, 200);
  assert.equal((await h.upload({ name: "기타.pdf", size: 10 })).status, 200);
  assert.equal(h.inserts[0].category, "보험 약관");
  assert.equal(h.inserts[1].category, null);
  const bad = await h.upload({ name: "약관.pdf", size: 10, category: "가".repeat(41) });
  assert.equal(bad.status, 400);
  assert.equal(h.inserts.length, 2);
});

test("카테고리 변경: 관리자만, 형식 검증, 미분류 전환, 없는 문서는 404", async () => {
  const h = documentsHarness();
  const ok = await h.patch(FILE_ID, JSON.stringify({ category: " 보험 " }));
  assert.equal(ok.status, 200);
  assert.equal(h.updates[0][0].category, "보험");
  assert.equal(h.updates[0][1], FILE_ID);
  assert.equal((await h.patch(FILE_ID, JSON.stringify({ category: "" }))).status, 200);
  assert.equal(h.updates[1][0].category, null);
  assert.equal((await h.patch("../etc", JSON.stringify({ category: "보험" }))).status, 400);
  assert.equal((await h.patch(FILE_ID, "{not json")).status, 400);
  assert.equal((await h.patch(FILE_ID, JSON.stringify({ category: 5 }))).status, 400);
  h.setUpdateResult({ data: null, error: null });
  assert.equal((await h.patch(FILE_ID, JSON.stringify({ category: "보험" }))).status, 404);
  assert.equal(h.updates.length, 3);

  const user = documentsHarness(false);
  assert.equal((await user.patch(FILE_ID, JSON.stringify({ category: "보험" }))).status, 403);
  assert.equal(user.updates.length, 0);
});

test("카테고리 선택 UI: 전체 문서 기본값과 카테고리 옵션, HTML 이스케이프", () => {
  const html = renderToStaticMarkup(
    <CategorySelect categories={["보험", "<b>인사</b>"]} value="보험" onChange={() => {}} disabled={false} />,
  );
  assert.match(html, /aria-label="문서 카테고리 선택"/);
  assert.match(html, /<option value="">📚 전체 문서<\/option>/);
  assert.match(html, /<option value="보험" selected="">/);
  assert.doesNotMatch(html, /<b>인사<\/b>/);
});

test("스키마: 카테고리 컬럼·제약·카테고리 검색 함수가 정의되고 기존 전체 검색 함수는 유지", () => {
  const sql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists category text/);
  assert.match(sql, /document_files_category_check/);
  assert.match(sql, /create or replace function public\.match_documents_by_category\(/);
  assert.match(sql, /where f\.category = filter_category/);
  assert.match(sql, /create or replace function public\.match_documents\(\n  query_embedding extensions\.vector\(4096\),\n  match_count int default 5,/);
});
