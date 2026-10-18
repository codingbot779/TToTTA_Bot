import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/server";

/** ADMIN_EMAILS(쉼표 구분)에 등록된 계정만 문서를 관리할 수 있다 */
export function isAdmin(user: Pick<User, "email"> | null | undefined) {
  if (!user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

/** API 라우트용: 로그인한 관리자면 user, 아니면 에러 Response */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  if (!isAdmin(user)) return { error: Response.json({ error: "관리자만 문서를 관리할 수 있습니다." }, { status: 403 }) };
  return { user };
}
