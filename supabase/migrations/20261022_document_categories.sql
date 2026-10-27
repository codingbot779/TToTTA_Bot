-- 문서 카테고리 추가 마이그레이션 (supabase/schema.sql 1-2 섹션과 동일, 여러 번 실행해도 안전)
-- 앱 배포 전에 Supabase SQL Editor에서 먼저 실행하세요.

-- ─────────────────────────────────────────────────────────
-- 1-2. 문서 카테고리 (관리자가 업로드 시 지정, 사용자는 채팅에서 선택)
--      카테고리는 원본 파일에만 저장하므로 변경해도 재임베딩이 필요 없습니다.
--      NULL = 미분류 (전체 문서 검색에서만 사용)
-- ─────────────────────────────────────────────────────────
alter table public.document_files add column if not exists category text;
alter table public.document_files drop constraint if exists document_files_category_check;
alter table public.document_files add constraint document_files_category_check
  check (category is null or (char_length(category) between 1 and 40 and category = btrim(category)));
create index if not exists document_files_category_idx
  on public.document_files (category) where status = 'ready';

-- 기존 match_documents는 그대로 두고(전체 검색), 카테고리 검색은 별도 함수로 제공합니다.
create or replace function public.match_documents_by_category(
  query_embedding extensions.vector(4096),
  filter_category text,
  match_count int default 5,
  match_threshold float default 0.3
)
returns table (id bigint, source text, chunk_index int, content text, metadata jsonb, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select d.id, d.source, d.chunk_index, d.content, d.metadata,
         1 - (d.embedding <=> query_embedding) as similarity
  from public.documents d
  join public.document_files f on f.id = d.file_id
  where f.category = filter_category
    and f.status = 'ready'
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;
