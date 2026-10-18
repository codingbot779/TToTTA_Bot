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

/** 질문을 임베딩해 Supabase에서 관련 문서 청크를 검색한다 */
export async function retrieveDocuments(
  supabase: SupabaseClient,
  question: string,
  matchCount = 5,
): Promise<{ context: string; sources: Source[] }> {
  const embedding = await embedQuery(question);
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: JSON.stringify(embedding),
    match_count: matchCount,
    match_threshold: 0.3,
  });
  if (error) throw new Error(`문서 검색 실패: ${error.message}`);

  const docs = (data ?? []) as MatchedDocument[];
  const context = docs
    .map((d, i) => `[문서 ${i + 1}] 출처: ${d.source}\n${d.content}`)
    .join("\n\n---\n\n");

  // 같은 파일에서 여러 청크가 나오면 출처는 한 번만, 가장 높은 유사도로 표시
  const bySource = new Map<string, number>();
  for (const d of docs) {
    bySource.set(d.source, Math.max(bySource.get(d.source) ?? 0, d.similarity));
  }
  const sources: Source[] = [...bySource].map(([title, similarity]) => ({
    type: "doc",
    title,
    similarity: Math.round(similarity * 100) / 100,
  }));

  return { context, sources };
}
