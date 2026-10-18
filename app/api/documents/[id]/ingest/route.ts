import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestDocumentFile } from "@/lib/ingest";

// 큰 PDF는 임베딩에 시간이 걸릴 수 있음
export const maxDuration = 300;

/** Storage에 올라간 문서를 청크로 나눠 임베딩한 뒤 documents 테이블에 저장 (재처리도 동일) */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("document_files")
    .select("id, name, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) return Response.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });

  const setStatus = (fields: Record<string, unknown>) =>
    admin
      .from("document_files")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);

  await setStatus({ status: "processing", error: null });
  try {
    const chunkCount = await ingestDocumentFile(admin, file);
    await setStatus({ status: "ready", chunk_count: chunkCount });
    return Response.json({ status: "ready", chunkCount });
  } catch (e) {
    const message = e instanceof Error ? e.message : "처리 중 오류가 발생했습니다.";
    await setStatus({ status: "error", error: message, chunk_count: 0 });
    return Response.json({ status: "error", error: message }, { status: 500 });
  }
}
