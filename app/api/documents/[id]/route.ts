import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/document-files";

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
