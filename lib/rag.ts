import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "./embeddings";
import type { Source } from "./types";

type MatchedDocument = {
  id: number;
  source: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

/** 질문을 임베딩해 Supabase에서 관련 문서 청크를 검색한다. category가 있으면 그 카테고리 문서만 검색한다. */
export async function retrieveDocuments(
  supabase: SupabaseClient,
  question: string,
  matchCount = 5,
  category: string | null = null,
): Promise<{ context: string; sources: Source[] }> {
  const embedding = await embedQuery(question);
  const params = {
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    match_threshold: 0.3,
  };
  const { data, error } = category
    ? await supabase.rpc("match_documents_by_category", { ...params, filter_category: category })
    : await supabase.rpc("match_documents", params);
  if (error) throw new Error(`문서 검색 실패: ${error.message}`);

  const docs = (data ?? []) as MatchedDocument[];
  const context = docs
    .map((d, i) => `[문서 ${i + 1}] 출처: ${d.source}\n${d.content}`)
    .join("\n\n---\n\n");

  // RPC 반환형/운영 스키마 변경 없이 청크 ID로 원본 파일을 연결한다.
  const fileIds = new Map<number, string>();
  if (docs.length) {
    const { data: rows, error: fileError } = await supabase
      .from("documents")
      .select("id, file_id")
      .in("id", docs.map((doc) => doc.id));
    if (!fileError) {
      for (const row of rows ?? []) {
        if (row.file_id) fileIds.set(row.id, row.file_id);
      }
    }
  }

  // 동명 파일은 ID로 구분하고, 같은 파일은 가장 높은 유사도만 표시한다.
  const bySource = new Map<string, Extract<Source, { type: "doc" }>>();
  for (const d of docs) {
    const fileId = fileIds.get(d.id);
    const key = fileId ? `file:${fileId}` : `source:${d.source}`;
    const previous = bySource.get(key);
    bySource.set(key, {
      type: "doc",
      title: d.source,
      similarity: Math.max(previous?.similarity ?? 0, d.similarity),
      ...(fileId ? { fileId } : {}),
    });
  }
  const sources: Source[] = [...bySource.values()].map((source) => ({
    ...source,
    similarity: Math.round((source.similarity ?? 0) * 100) / 100,
  }));

  return { context, sources };
}
