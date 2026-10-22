import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENTS_BUCKET } from "@/lib/document-files";

export const dynamic = "force-dynamic";

const fail = (message: string, status: number) => Response.json(
  { error: message }, { status, headers: { "Cache-Control": "private, no-store" } },
);

/** 기존의 로그인 사용자 문서 열람 정책(RLS)을 확인한 뒤 비공개 원본의 단기 링크로 이동한다. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail("로그인이 필요합니다.", 401);

  const params = new URL(req.url).searchParams;
  const fileId = params.get("fileId");
  const source = params.get("source");
  if ((fileId === null) === (source === null)) return fail("문서 ID 또는 출처를 지정해 주세요.", 400);
  if (fileId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
    return fail("올바른 문서 ID가 아닙니다.", 400);
  }
  if (source !== null && (!source || source.length > 1024)) return fail("올바른 출처가 아닙니다.", 400);

  // 관리 키로 임의 경로를 서명하지 않는다. 사용자의 RLS 조회로 접근 가능한 파일을 먼저 결정한다.
  const query = supabase.from("document_files").select("id, name, storage_path");
  const { data: files, error } = await (fileId !== null
    ? query.eq("id", fileId)
    : query.eq("name", source!)).limit(2);
  if (error) return fail("문서 정보를 조회하지 못했습니다.", 500);
  if (!files?.length) return fail("원본이 삭제되었거나 접근할 수 없는 문서입니다.", 404);
  if (files.length !== 1) return fail("같은 이름의 문서가 여러 개입니다. 새 답변의 출처에서 다운로드해 주세요.", 409);

  const file = files[0];
  const { data, error: signingError } = await createAdminClient().storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.name });
  if (signingError || !data?.signedUrl) return fail("원본 다운로드 링크를 만들지 못했습니다.", 502);

  return new Response(null, {
    status: 303,
    headers: {
      Location: data.signedUrl,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
