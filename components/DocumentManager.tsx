"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_MAX_LENGTH, normalizeCategory } from "@/lib/document-categories";

type DocumentFile = {
  id: string;
  name: string;
  size: number | null;
  category: string | null;
  status: "uploading" | "processing" | "ready" | "error";
  chunk_count: number;
  error: string | null;
  created_at: string;
};

const ACCEPT = ".pdf,.hwp,.hwpx,.xlsx,.xls,.csv,.txt,.md,.json";

const STATUS_LABEL: Record<DocumentFile["status"], { text: string; className: string }> = {
  uploading: { text: "업로드 중", className: "bg-bubble text-muted" },
  processing: { text: "임베딩 중", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  ready: { text: "검색 가능", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  error: { text: "실패", className: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};

function formatSize(bytes: number | null) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `요청 실패 (${res.status})`);
  return json as T;
}

export function DocumentManager() {
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  // 이번에 업로드할 파일들에 적용할 카테고리 ("" = 미분류)
  const [uploadCategory, setUploadCategory] = useState("");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const { files } = await api<{ files: DocumentFile[] }>("/api/documents");
      setFiles(files);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const markBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const ingest = async (id: string) => {
    markBusy(id, true);
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "processing", error: null } : f)));
    try {
      await api(`/api/documents/${id}/ingest`, { method: "POST" });
    } catch {
      // 실패 사유는 목록의 error 필드로 표시
    } finally {
      markBusy(id, false);
      await reload();
    }
  };

  const uploadOne = async (file: File, category: string | null) => {
    // 1) 서버에서 서명 업로드 URL 발급 → 2) Storage로 직접 업로드 → 3) 임베딩 처리
    const { id, path, token } = await api<{ id: string; path: string; token: string }>("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, size: file.size, category }),
    });
    await reload();
    const { error } = await createClient().storage.from("documents").uploadToSignedUrl(path, token, file);
    if (error) {
      await api(`/api/documents/${id}`, { method: "DELETE" }).catch(() => {});
      throw new Error(`${file.name}: 업로드 실패 (${error.message})`);
    }
    await ingest(id);
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setMessage(null);
    let category: string | null;
    try {
      category = normalizeCategory(uploadCategory);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const errors: string[] = [];
    for (const file of Array.from(list)) {
      try {
        await uploadOne(file, category);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    await reload();
    if (errors.length) setMessage({ type: "error", text: errors.join("\n") });
    else
      setMessage({
        type: "info",
        text: `${list.length}개 문서를 ${category ? `'${category}' 카테고리로 ` : "미분류로 "}업로드했습니다.`,
      });
    if (inputRef.current) inputRef.current.value = "";
  };

  const saveCategory = async (file: DocumentFile, value: string) => {
    let category: string | null;
    try {
      category = normalizeCategory(value);
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
      return;
    }
    setEditing(null);
    if (category === file.category) return;
    markBusy(file.id, true);
    try {
      await api(`/api/documents/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, category } : f)));
      setMessage({ type: "info", text: `'${file.name}'의 카테고리를 ${category ? `'${category}'(으)로` : "미분류로"} 변경했습니다.` });
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      markBusy(file.id, false);
    }
  };

  const remove = async (file: DocumentFile) => {
    if (!confirm(`'${file.name}'을(를) 삭제할까요? 검색 대상에서도 제외됩니다.`)) return;
    markBusy(file.id, true);
    try {
      await api(`/api/documents/${file.id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message });
    } finally {
      markBusy(file.id, false);
    }
  };

  const uploading = busyIds.size > 0;
  const readyCount = files.filter((f) => f.status === "ready").length;
  const existingCategories = [...new Set(files.map((f) => f.category).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, "ko"),
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-10 pt-20 md:px-8 md:pt-12">
        <p className="eyebrow text-muted">KNOWLEDGE LIBRARY</p>
        <h1 className="editorial-title mt-4 text-4xl">문서 관리</h1>
        <p className="mt-2 text-sm text-muted">
          업로드한 문서는 Supabase Storage에 저장되고, Upstage Embedding으로 임베딩되어 모든 사용자의 질문 검색에
          사용됩니다.
        </p>

        <datalist id="document-categories">
          {existingCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <div className="mt-8">
          <label htmlFor="upload-category" className="text-sm font-medium">
            업로드할 문서의 카테고리
          </label>
          <input
            id="upload-category"
            list="document-categories"
            value={uploadCategory}
            maxLength={CATEGORY_MAX_LENGTH}
            disabled={uploading}
            onChange={(e) => setUploadCategory(e.target.value)}
            placeholder="예: 보험, 인사규정 (비워두면 미분류)"
            className="mt-2 block h-11 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm placeholder:text-muted disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-muted">
            기존 카테고리를 선택하거나 새로 입력하세요. 사용자는 채팅에서 카테고리를 골라 해당 문서만 검색할 수 있습니다.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!uploading) handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-accent/60"
          } ${uploading ? "cursor-wait opacity-70" : ""}`}
        >
          <div className="text-3xl">📄</div>
          <p className="mt-3 font-medium">
            {uploading ? "업로드 및 임베딩 중..." : "파일을 끌어다 놓거나 클릭해서 선택하세요"}
          </p>
          <p className="mt-1 text-xs text-muted">PDF, 한글(HWP·HWPX), 엑셀(XLSX·XLS), CSV, TXT, Markdown, JSON · 파일당 최대 50MB · 여러 개 선택 가능</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {message && (
          <div
            className={`mt-4 whitespace-pre-line rounded-xl border px-4 py-3 text-sm ${
              message.type === "error"
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                : "border-border bg-surface text-muted"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-8 flex items-baseline justify-between">
          <h2 className="font-semibold">업로드된 문서</h2>
          <span className="text-xs text-muted">
            검색 가능 {readyCount} / 전체 {files.length}
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-border bg-surface">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-muted">불러오는 중...</p>
          ) : files.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">아직 업로드된 문서가 없습니다.</p>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => {
                const status = STATUS_LABEL[f.status];
                const busy = busyIds.has(f.id);
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatSize(f.size)} · {new Date(f.created_at).toLocaleString("ko-KR")}
                        {f.status === "ready" && ` · ${f.chunk_count}개 청크`}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {editing?.id === f.id ? (
                          <form
                            className="flex items-center gap-1.5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              saveCategory(f, editing.value);
                            }}
                          >
                            <input
                              autoFocus
                              list="document-categories"
                              value={editing.value}
                              maxLength={CATEGORY_MAX_LENGTH}
                              aria-label={`${f.name} 카테고리`}
                              placeholder="비워두면 미분류"
                              onChange={(e) => setEditing({ id: f.id, value: e.target.value })}
                              onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                              className="h-9 w-44 rounded-md border border-border bg-background px-2"
                            />
                            <button type="submit" className="h-9 rounded-md border border-border px-2.5 hover:text-foreground">
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="h-9 rounded-md px-2 text-muted hover:text-foreground"
                            >
                              취소
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="rounded-full border border-border px-2 py-0.5">
                              {f.category ? `🗂️ ${f.category}` : "미분류"}
                            </span>
                            <button
                              type="button"
                              onClick={() => setEditing({ id: f.id, value: f.category ?? "" })}
                              disabled={busy}
                              className="text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40"
                            >
                              카테고리 변경
                            </button>
                          </>
                        )}
                      </div>
                      {f.status === "error" && f.error && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400">{f.error}</div>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.text}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => ingest(f.id)}
                        disabled={busy || f.status === "uploading"}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:text-foreground disabled:opacity-40"
                        title="다시 임베딩"
                      >
                        재처리
                      </button>
                      <button
                        onClick={() => remove(f)}
                        disabled={busy}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
