# TToTA AI

`dataset/` 폴더의 문서와 실시간 웹검색 결과를 근거로 답하는 RAG 기반 AI 챗봇입니다.

- **Next.js 15** (App Router) — Vercel 배포 가능
- **LLM 선택**: Claude / ChatGPT / Gemini (Vercel AI SDK)
- **RAG**: Upstage Embedding(4096차원) → Supabase pgvector 저장·검색
- **웹검색**: Tavily 원격 MCP 서버(`tavily_search`)를 모델이 필요할 때 호출
- **로그인**: Supabase Auth + Google OAuth
- **대화 저장**: 채팅방별 질문·답변·참고 출처·생성 시간 (Supabase DB)

## 1. 환경변수

`.env.example`을 참고해 `.env.local`을 채웁니다. (이미 생성되어 있으면 빈칸만 입력)

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 프로젝트 URL / Publishable key |
| `SUPABASE_SECRET_KEY` | 문서 적재 스크립트(`npm run ingest`) 전용. Project Settings → API Keys → Secret key |
| `UPSTAGE_API_KEY` | Upstage 임베딩 |
| `TAVILY_API_KEY` | Tavily 웹검색(MCP) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | 사용할 LLM 키 (없는 모델은 선택 시 안내 메시지) |
| `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GEMINI_MODEL` | (선택) 모델 ID 변경 |

## 2. Supabase 설정

1. **SQL Editor**에서 [`supabase/schema.sql`](supabase/schema.sql) 전체를 실행합니다.
   (documents / chat_rooms / messages 테이블, RLS, `match_documents` 함수 생성)
2. **Google OAuth 클라이언트 만들기** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → 사용자 인증 정보 → OAuth 클라이언트 ID(웹 애플리케이션)
   - 승인된 리디렉션 URI: `https://<프로젝트>.supabase.co/auth/v1/callback`
3. Supabase **Authentication → Sign In / Providers → Google** 활성화 후 Client ID / Secret 입력
4. Supabase **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (배포 후 Vercel 도메인으로 변경)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://<vercel-도메인>/auth/callback`

## 3. 문서 임베딩

```bash
# dataset/ 에 .pdf .txt .md .csv .json 파일을 넣고
npm run ingest             # 전체
npm run ingest -- a.pdf    # 특정 파일만 (재실행 시 해당 파일 데이터를 교체)
```

## 4. 실행

```bash
npm install
npm run check   # (선택) Upstage·Tavily MCP 연결 점검
npm run dev     # http://localhost:3000
```

## 5. Vercel 배포

1. GitHub 저장소를 Vercel에 Import
2. Environment Variables에 `.env.local` 값을 동일하게 입력 (`SUPABASE_SECRET_KEY`는 앱 실행에는 필요 없음)
3. 배포 도메인을 Supabase Redirect URLs에 추가

## 구조

```
app/
  page.tsx                 랜딩페이지 (Google로 시작하기)
  auth/callback, signout   OAuth 콜백 / 로그아웃
  chat/                    챗봇 (사이드바 + 채팅방)
  api/chat/route.ts        RAG 검색 → LLM 스트리밍(+Tavily MCP) → DB 저장
components/                Chat, Sidebar, 로그인 버튼
lib/                       supabase 클라이언트, embeddings, rag, models, tavily-mcp
scripts/ingest.ts          dataset → 청크 → 임베딩 → Supabase
supabase/schema.sql        DB 스키마
```
