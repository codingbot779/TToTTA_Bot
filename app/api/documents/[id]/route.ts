import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/document-files";
import { normalizeCategory } from "@/lib/document-categories";

/** 문서 카테고리 변경 (임베딩은 그대로 유지되므로 재처리 불필요) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "올바른 문서 ID가 아닙니다." }, { status: 400 });
  }

  let category: string | null;
  try {
    const body = (await req.json()) as { category?: unknown };
    category = normalizeCategory(body.category);
  } catch (e) {
    const message = e instanceof SyntaxError ? "요청 형식이 올바르지 않습니다." : (e as Error).message;
    return Response.json({ error: message }, { status: 400 });
  }

  const { data, error: updateError } = await createAdminClient()
    .from("document_files")
    .update({ category, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, category")
    .maybeSingle();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  if (!data) return Response.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });
  return Response.json(data);
}

/** 문서 삭제: Storage 원본 + 파일 레코드 (청크는 cascade로 함께 삭제) */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;

  const admin = createAdminClient();
  const { data: file } = await admin.from("document_files").select("storage_path").eq("id", id).maybeSingle();
  if (!file) return Response.json({ error: "문서를 찾을 수 없습니다." }, { status: 404 });

  await admin.storage.from(DOCUMENTS_BUCKET).remove([file.storage_path]);
  const { error: deleteError } = await admin.from("document_files").delete().eq("id", id);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
  return Response.json({ ok: true });
}
