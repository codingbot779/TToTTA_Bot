import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Source } from "./types";

function loadModule<T>(relativePath: string, mocks: Record<string, unknown>): T {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports, URL, Response, console,
    require: (name: string) => {
      assert.ok(name in mocks, `예상하지 못한 외부 모듈: ${name}`);
      return mocks[name];
    },
  });
  return exports as T;
}

const FILE_ID = "11111111-1111-4111-8111-111111111111";
const FILE = { id: FILE_ID, name: "현대해상_펫보험.pdf", storage_path: `${FILE_ID}.pdf` };

type FileRecord = typeof FILE;
function downloadHarness(options: {
  loggedIn?: boolean; authError?: boolean; files?: readonly FileRecord[]; dbError?: boolean; signingError?: boolean;
} = {}) {
  const filters: [string, unknown][] = [];
  const signed: unknown[][] = [];
  let adminCalls = 0;
  const route = loadModule<{ GET: (req: Request) => Promise<Response> }>("../app/api/documents/download/route.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({
        data: { user: options.loggedIn === false ? null : { id: "test-user" } },
        error: options.authError ? { message: "auth failed" } : null,
      }) },
      from: (table: string) => {
        assert.equal(table, "document_files");
        return { select: (fields: string) => {
          assert.equal(fields, "id, name, storage_path");
          return { eq: (field: string, value: unknown) => {
            filters.push([field, value]);
            return { limit: async (limit: number) => {
              assert.equal(limit, 2);
              return { data: options.files ?? [FILE], error: options.dbError ? { message: "failed" } : null };
            } };
          } };
        } };
      },
    }) },
    "@/lib/supabase/admin": { createAdminClient: () => {
      adminCalls++;
      return { storage: { from: (bucket: string) => {
        assert.equal(bucket, "documents");
        return { createSignedUrl: async (...args: unknown[]) => {
          signed.push(args);
          return options.signingError
            ? { data: null, error: { message: "missing object" } }
            : { data: { signedUrl: "https://storage.example.test/signed-original" }, error: null };
        } };
      } } };
    } },
    "@/lib/document-files": { DOCUMENTS_BUCKET: "documents" },
  });
  return {
    get: (query: string) => route.GET(new Request(`http://localhost/api/documents/download?${query}`)),
    filters, signed, adminCalls: () => adminCalls,
  };
}

test("원본 다운로드는 로그인과 사용자 RLS 조회를 거쳐 DB 경로만 서명", async () => {
  const h = downloadHarness();
  const response = await h.get(`fileId=${FILE_ID}&storage_path=another-user.pdf`);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://storage.example.test/signed-original");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(h.filters, [["id", FILE_ID]]);
  assert.deepEqual(JSON.parse(JSON.stringify(h.signed)), [[FILE.storage_path, 60, { download: FILE.name }]]);
});

test("기존 대화의 파일명 출처는 정확한 이름으로 조회", async () => {
  const h = downloadHarness();
  const response = await h.get(new URLSearchParams({ source: FILE.name }).toString());
  assert.equal(response.status, 303);
  assert.deepEqual(h.filters, [["name", FILE.name]]);
});

for (const [label, options, query, status] of [
  ["비로그인", { loggedIn: false }, `fileId=${FILE_ID}`, 401],
  ["인증 오류", { authError: true }, `fileId=${FILE_ID}`, 401],
  ["잘못된 ID", {}, "fileId=../../private.pdf", 400],
  ["대상 누락", {}, "", 400],
  ["빈 출처", {}, "source=", 400],
  ["대상 중복", {}, `fileId=${FILE_ID}&source=file.pdf`, 400],
  ["삭제 또는 권한 없음", { files: [] }, `fileId=${FILE_ID}`, 404],
  ["동명 파일 모호함", { files: [FILE, { ...FILE, id: "second-file" }] }, "source=file.pdf", 409],
  ["조회 실패", { dbError: true }, `fileId=${FILE_ID}`, 500],
] as const) {
  test(`원본 다운로드 거부: ${label}`, async () => {
    const h = downloadHarness(options);
    const response = await h.get(query);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(h.adminCalls(), 0);
    assert.equal(h.signed.length, 0);
  });
}

test("Storage 원본 누락/서명 실패는 링크 대신 오류 반환", async () => {
  const h = downloadHarness({ signingError: true });
  assert.equal((await h.get(`fileId=${FILE_ID}`)).status, 502);
});

test("RAG는 청크의 원본 ID를 연결하고 동명 파일을 분리하며 같은 파일은 중복 제거", async () => {
  const queries: unknown[] = [];
  const rag = loadModule<{ retrieveDocuments: (client: unknown, question: string) => Promise<{ sources: Source[]; context: string }> }>("./rag.ts", {
    "./embeddings": { embedQuery: async () => [1, 0] },
  });
  const client = {
    rpc: async () => ({ data: [
      { id: 1, source: "보험.pdf", content: "첫 문서", similarity: 0.811 },
      { id: 2, source: "보험.pdf", content: "첫 문서 추가", similarity: 0.912 },
      { id: 3, source: "보험.pdf", content: "다른 동명 문서", similarity: 0.755 },
    ], error: null }),
    from: (table: string) => {
      assert.equal(table, "documents");
      return { select: (fields: string) => {
        assert.equal(fields, "id, file_id");
        return { in: async (field: string, ids: number[]) => {
          queries.push([field, ids]);
          return { data: [{ id: 1, file_id: FILE_ID }, { id: 2, file_id: FILE_ID }, { id: 3, file_id: "second-file" }], error: null };
        } };
      } };
    },
  };
  const result = await rag.retrieveDocuments(client, "질문");
  assert.deepEqual(JSON.parse(JSON.stringify(result.sources)), [
    { type: "doc", title: "보험.pdf", similarity: 0.91, fileId: FILE_ID },
    { type: "doc", title: "보험.pdf", similarity: 0.76, fileId: "second-file" },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(queries)), [["id", [1, 2, 3]]]);
  assert.match(result.context, /첫 문서/);
});

test("RAG 원본 연결 조회 실패 시 문서 답변과 기존 출처 유지", async () => {
  const rag = loadModule<{ retrieveDocuments: (client: unknown, question: string) => Promise<{ sources: Source[]; context: string }> }>("./rag.ts", {
    "./embeddings": { embedQuery: async () => [1, 0] },
  });
  const result = await rag.retrieveDocuments({
    rpc: async () => ({ data: [{ id: 1, source: "기존.pdf", content: "기존 내용", similarity: 0.8 }], error: null }),
    from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "lookup failed" } }) }) }),
  }, "질문");
  assert.deepEqual(JSON.parse(JSON.stringify(result.sources)), [{ type: "doc", title: "기존.pdf", similarity: 0.8 }]);
  assert.match(result.context, /기존 내용/);
});
