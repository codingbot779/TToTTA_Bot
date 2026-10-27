-- TToTA AI 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요. (여러 번 실행해도 안전)

create extension if not exists vector with schema extensions;

-- ─────────────────────────────────────────────────────────
-- 1. RAG 문서 (원문 청크 + Upstage 임베딩)
--    Upstage embedding 모델은 4096차원.
--    pgvector 인덱스는 2000차원까지만 지원하므로 인덱스 없이 정확 검색합니다.
-- ─────────────────────────────────────────────────────────
create table if not exists public.documents (
  id          bigint generated always as identity primary key,
  source      text not null,                -- 파일명 (예: guide.pdf)
  chunk_index int  not null,
  content     text not null,                -- 원문 청크
  metadata    jsonb not null default '{}'::jsonb,
  embedding   extensions.vector(4096) not null,
  created_at  timestamptz not null default now()
);
create index if not exists documents_source_idx on public.documents (source);

alter table public.documents enable row level security;
drop policy if exists "documents readable by authenticated" on public.documents;
create policy "documents readable by authenticated"
  on public.documents for select to authenticated using (true);

create or replace function public.match_documents(
  query_embedding extensions.vector(4096),
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
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ─────────────────────────────────────────────────────────
-- 1-1. 업로드한 원본 파일 (Supabase Storage 'documents' 버킷)
--      업로드/삭제는 서버(관리자 API)에서 secret key로만 수행합니다.
-- ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)  -- 50MB
on conflict (id) do nothing;

create table if not exists public.document_files (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,                 -- 원본 파일명
  storage_path text not null unique,          -- documents 버킷 내 경로
  size         bigint,
  status       text not null default 'uploading'
               check (status in ('uploading', 'processing', 'ready', 'error')),
  chunk_count  int not null default 0,
  error        text,
  uploaded_by  uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.document_files enable row level security;
drop policy if exists "document files readable by authenticated" on public.document_files;
create policy "document files readable by authenticated"
  on public.document_files for select to authenticated using (true);

-- 청크 ↔ 원본 파일 연결 (파일 삭제 시 청크도 함께 삭제)
alter table public.documents
  add column if not exists file_id uuid references public.document_files (id) on delete cascade;
create index if not exists documents_file_idx on public.documents (file_id);

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

-- ─────────────────────────────────────────────────────────
-- 2. 채팅방
-- ─────────────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title      text not null default '새 대화',
  model      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_rooms_user_idx on public.chat_rooms (user_id, updated_at desc);

alter table public.chat_rooms enable row level security;
drop policy if exists "own rooms" on public.chat_rooms;
create policy "own rooms" on public.chat_rooms for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────
-- 3. 메시지 (질문 / 답변 / 참고 출처 / 생성 시간)
-- ─────────────────────────────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.chat_rooms (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  sources    jsonb not null default '[]'::jsonb,  -- [{type:'doc'|'web', title, url?}]
  model      text,
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on public.messages (room_id, created_at);

alter table public.messages enable row level security;
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
