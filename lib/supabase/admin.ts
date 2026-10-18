import { createClient } from "@supabase/supabase-js";

/** 서버 전용: RLS를 우회하는 secret key 클라이언트 (문서 업로드/임베딩 저장용) */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았습니다. .env.local(또는 Vercel 환경변수)에 입력해 주세요.");
  }
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
