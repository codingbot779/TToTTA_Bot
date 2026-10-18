import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET, SUPPORTED_EXTENSIONS, extensionOf } from "@/lib/document-files";

const MAX_SIZE = 50 * 1024 * 1024;

/** 업로드된 문서 목록 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const { data, error: dbError } = await createAdminClient()
    .from("document_files")
    .select("id, name, size, status, chunk_count, error, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json({ files: data });
}

/**
 * 업로드 준비: 파일 레코드를 만들고 Storage 서명 업로드 URL을 발급한다.
 * 브라우저가 Storage로 직접 올리므로 Vercel 요청 크기 제한(4.5MB)을 받지 않는다.
 */
export async function POST(req: Request) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const { name, size } = (await req.json()) as { name?: string; size?: number };
  if (!name) return Response.json({ error: "파일명이 없습니다." }, { status: 400 });
  const ext = extensionOf(name);
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return Response.json({ error: `지원 형식: ${SUPPORTED_EXTENSIONS.join(", ")}` }, { status: 400 });
  }
  if (size && size > MAX_SIZE) return Response.json({ error: "50MB 이하 파일만 업로드할 수 있습니다." }, { status: 400 });

  const admin = createAdminClient();
  const id = crypto.randomUUID();
  // Storage 키에는 한글을 쓸 수 없어 ID로 저장하고 원본 파일명은 테이블에 보관
  const storagePath = `${id}${ext}`;

  const { error: insertError } = await admin.from("document_files").insert({
    id,
    name,
    size: size ?? null,
    storage_path: storagePath,
    uploaded_by: user.id,
  });
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  const { data, error: urlError } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(storagePath);
  if (urlError) {
    await admin.from("document_files").delete().eq("id", id);
    return Response.json({ error: `업로드 URL 발급 실패: ${urlError.message}` }, { status: 500 });
  }
  return Response.json({ id, path: data.path, token: data.token });
}
