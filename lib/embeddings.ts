const UPSTAGE_URL = "https://api.upstage.ai/v1/embeddings";

type EmbeddingKind = "query" | "passage";

/** Upstage Embedding API 호출 (4096차원). 문서는 passage, 질문은 query 모델 사용 */
export async function embed(texts: string[], kind: EmbeddingKind): Promise<number[][]> {
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");

  const res = await fetch(UPSTAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: `embedding-${kind}`, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`Upstage embedding 실패 (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([text], "query");
  return vector;
}
