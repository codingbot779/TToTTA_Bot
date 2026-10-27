import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeDatabaseText } from "./database-text";

export const CATEGORY_MAX_LENGTH = 40;

/**
 * 카테고리명을 저장·비교 가능한 형태로 정리한다.
 * 빈 값은 null(미분류), 형식이 잘못되면 Error를 던진다.
 */
export function normalizeCategory(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new Error("카테고리는 문자열이어야 합니다.");
  const category = sanitizeDatabaseText(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!category) return null;
  if (Array.from(category).length > CATEGORY_MAX_LENGTH) {
    throw new Error(`카테고리는 ${CATEGORY_MAX_LENGTH}자 이하로 입력해 주세요.`);
  }
  return category;
}

/** 검색 가능한 문서가 있는 카테고리 목록 (가나다순, 중복 제거). 조회 실패 시 빈 목록. */
export async function listSearchableCategories(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("document_files")
    .select("category")
    .eq("status", "ready")
    .not("category", "is", null);
  if (error) {
    console.error("[categories]", error.message);
    return [];
  }
  const categories = new Set<string>();
  for (const row of (data ?? []) as { category: string | null }[]) {
    if (row.category) categories.add(row.category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b, "ko"));
}
