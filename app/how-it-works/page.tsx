import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import {
  ChunkingIllustration,
  HeroFlowIllustration,
  StepIcon,
  VectorSpaceIllustration,
  type IconName,
} from "@/components/how-it-works/Illustrations";

export const metadata: Metadata = {
  title: "작동 원리 · TToTA AI",
  description: "TToTA AI가 문서와 웹을 읽고 출처와 함께 답하는 과정을 단계별로 설명합니다.",
};

type Step = { icon: IconName; title: string; body: string; tag: string };

const INGEST_STEPS: Step[] = [
  {
    icon: "upload",
    title: "관리자가 파일 선택",
    body: "문서 관리 페이지에 파일을 끌어다 놓습니다. PDF, 한글, 엑셀, CSV, 텍스트 등 파일당 50MB까지.",
    tag: "관리자 전용",
  },
  {
    icon: "cloud",
    title: "Storage로 바로 업로드",
    body: "서버가 서명된 업로드 URL을 발급하면 브라우저가 원본을 Supabase Storage에 직접 올립니다. 큰 파일도 서버 용량 제한을 받지 않아요.",
    tag: "Supabase Storage",
  },
  {
    icon: "text",
    title: "텍스트 추출",
    body: "형식마다 전용 파서로 글자만 뽑아냅니다. 엑셀은 시트별로, CSV는 각 행을 \"컬럼: 값\" 문장으로 바꿉니다.",
    tag: "PDF · HWP · XLSX 파서",
  },
  {
    icon: "scissors",
    title: "청크로 자르기",
    body: "긴 글을 약 1,000자씩 문단 경계에 맞춰 자르고, 앞뒤 200자를 겹쳐 문맥이 끊기지 않게 합니다.",
    tag: "1,000자 / 200자 겹침",
  },
  {
    icon: "vector",
    title: "벡터로 변환 (임베딩)",
    body: "각 청크를 AI가 '의미'를 숫자 4,096개로 표현한 벡터로 바꿉니다. 50개씩 묶어서 처리해요.",
    tag: "Upstage embedding-passage",
  },
  {
    icon: "database",
    title: "벡터 DB에 저장",
    body: "청크 원문과 벡터를 함께 저장하면 상태가 '검색 가능'으로 바뀌고, 이때부터 모든 사용자의 질문에 쓰입니다.",
    tag: "Supabase pgvector",
  },
];

const ANSWER_STEPS: Step[] = [
  {
    icon: "lock",
    title: "로그인 확인 · 채팅방 준비",
    body: "Google 계정으로 로그인한 사용자만 질문할 수 있습니다. 첫 질문이면 질문 앞부분을 제목으로 새 채팅방을 만들어요.",
    tag: "Supabase Auth",
  },
  {
    icon: "save",
    title: "질문 저장",
    body: "질문 내용과 사용한 모델, 시간을 채팅방에 기록합니다.",
    tag: "messages 테이블",
  },
  {
    icon: "vector",
    title: "질문도 벡터로",
    body: "문서를 바꿀 때와 같은 방식으로, 질문 문장을 검색용 벡터로 변환합니다.",
    tag: "Upstage embedding-query",
  },
  {
    icon: "search",
    title: "비슷한 문서 찾기",
    body: "질문 벡터와 방향이 가장 비슷한(코사인 유사도) 청크를 최대 5개 찾습니다. 유사도 0.3 미만은 관련 없다고 보고 버려요.",
    tag: "match_documents",
  },
  {
    icon: "sparkle",
    title: "AI가 답변 작성",
    body: "찾은 문서를 [참고 문서]로 붙여 선택한 모델에게 전달하고, 답변을 실시간으로 흘려보냅니다. 최신 정보가 필요하면 모델이 스스로 웹검색을 호출해요.",
    tag: "Claude · ChatGPT · Gemini",
  },
  {
    icon: "quote",
    title: "답변과 출처 저장",
    body: "참고한 문서(유사도 표시)와 웹 페이지 링크를 답변 아래에 보여주고, 다음에 다시 볼 수 있게 함께 저장합니다.",
    tag: "출처 표시",
  },
];

const ARCHITECTURE = [
  { name: "Supabase", role: "로그인 · 원본 파일 · 벡터 DB · 대화 기록" },
  { name: "Upstage", role: "문서와 질문을 4,096차원 벡터로 변환" },
  { name: "Tavily (MCP)", role: "필요할 때만 실시간 웹검색" },
  { name: "Claude · ChatGPT · Gemini", role: "근거를 읽고 답변 생성" },
];

const FORMATS = [".pdf", ".hwp", ".hwpx", ".xlsx", ".xls", ".csv", ".txt", ".md", ".json"];

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow text-muted">{eyebrow}</p>
      <h2 className="editorial-title mt-4 text-3xl sm:text-5xl">{title}</h2>
      <p className="mt-4 leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="relative rounded-xl border border-border bg-surface p-8">
          <div className="flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-border text-muted">
              <StepIcon name={s.icon} />
            </span>
            <span className="eyebrow text-muted">{String(i + 1).padStart(2, "0")}</span>
          </div>
          <h3 className="mt-5 text-xl font-normal tracking-tight">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          <span className="mt-4 inline-block rounded-full bg-bubble px-3 py-1 text-xs text-muted">{s.tag}</span>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label="TToTA AI 홈">
          <Logo />
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          시작하기
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24">
        {/* 히어로 */}
        <section className="grid items-center gap-12 pt-10 sm:pt-16 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span className="eyebrow text-muted">
              작동 원리
            </span>
            <h1 className="editorial-title mt-6 text-5xl sm:text-6xl">
              TToTA는 찾아보고 답합니다
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              AI가 기억에만 의존하면 그럴듯한 오답을 만들 수 있습니다. TToTA는 질문을 받으면 먼저 등록된 문서에서
              관련 내용을 찾고, 최신 정보가 필요하면 웹을 검색한 뒤, 그 근거를 읽고 답합니다. 이 방식을{" "}
              <strong className="text-foreground">RAG(검색 증강 생성)</strong>라고 부릅니다.
            </p>
          </div>
          <HeroFlowIllustration className="w-full" />
        </section>

        {/* 전체 구조 */}
        <section className="mt-28">
          <SectionHeading
            eyebrow="한눈에 보기"
            title="누가 어떤 일을 하나요?"
            body="화면과 서버는 Next.js 하나로 만들어져 Vercel에서 돌아가고, 저장·변환·검색·답변은 각 분야의 전문 서비스가 맡습니다."
          />
          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.2fr_auto_1.4fr]">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <p className="text-xs font-semibold text-muted">사용자</p>
              <h3 className="mt-2 font-semibold">브라우저</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                <li>· Google 로그인</li>
                <li>· 채팅 · 모델 선택</li>
                <li>· (관리자) 문서 업로드</li>
              </ul>
            </div>
            <Arrow />
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="eyebrow text-muted">TToTA 서버 · Vercel</p>
              <h3 className="mt-2 font-semibold">Next.js</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="rounded-lg bg-bubble px-3 py-2">
                  <code className="text-xs">/api/chat</code>
                  <p className="text-xs text-muted">검색 → 답변 스트리밍 → 저장</p>
                </li>
                <li className="rounded-lg bg-bubble px-3 py-2">
                  <code className="text-xs">/api/documents</code>
                  <p className="text-xs text-muted">업로드 URL · 임베딩 처리 · 삭제</p>
                </li>
              </ul>
            </div>
            <Arrow />
            <ul className="grid gap-3">
              {ARCHITECTURE.map((a) => (
                <li key={a.name} className="rounded-2xl border border-border bg-surface px-5 py-3.5">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted">{a.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 문서 준비 */}
        <section className="mt-28">
          <SectionHeading
            eyebrow="1단계 · 미리 해두는 일"
            title="문서를 '검색할 수 있는 형태'로 바꿔둡니다"
            body="AI가 수백 쪽짜리 문서를 질문마다 통째로 읽을 수는 없습니다. 그래서 문서를 작은 조각(청크)으로 나누고, 각 조각의 의미를 숫자(벡터)로 바꿔 저장해 둡니다."
          />
          <div className="mt-10 rounded-3xl border border-border bg-sidebar p-6 sm:p-10">
            <ChunkingIllustration className="mx-auto w-full max-w-3xl" />
          </div>
          <StepList steps={INGEST_STEPS} />
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="mr-1">지원 형식</span>
            {FORMATS.map((f) => (
              <code key={f} className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs">
                {f}
              </code>
            ))}
            <span className="ml-1 text-xs">· 이미지로만 된 스캔 PDF는 글자를 뽑을 수 없어 제외</span>
          </div>
        </section>

        {/* 벡터 검색 */}
        <section className="mt-28 grid items-center gap-12 lg:grid-cols-2">
          <VectorSpaceIllustration className="w-full" />
          <div>
            <SectionHeading
              eyebrow="잠깐, 벡터 검색이란?"
              title="단어가 아니라 '의미'로 찾습니다"
              body="임베딩을 거친 문장은 의미가 비슷할수록 공간에서 가까운 곳에 놓입니다. 그래서 문서에 '연차'라는 단어가 없고 '연간 유급휴가 15일'이라고만 적혀 있어도, '연차는 며칠?'이라는 질문과 가깝다는 걸 알아챕니다."
            />
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                <span>
                  <strong>코사인 유사도</strong>로 두 벡터가 얼마나 같은 방향을 가리키는지 0~1 사이 점수로 계산
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                <span>
                  점수 상위 <strong>5개</strong> 청크만 골라 AI에게 전달 (0.3 미만은 제외)
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                <span>답변 아래 문서 출처 칩에 마우스를 올리면 이 유사도 점수를 볼 수 있어요</span>
              </li>
            </ul>
          </div>
        </section>

        {/* 질문 → 답변 */}
        <section className="mt-28">
          <SectionHeading
            eyebrow="2단계 · 질문할 때마다"
            title="질문 하나가 답변이 되기까지"
            body="전송 버튼을 누르면 서버에서 아래 과정이 순서대로 일어납니다. 답변은 완성될 때까지 기다리지 않고 만들어지는 대로 화면에 흘러나옵니다."
          />
          <StepList steps={ANSWER_STEPS} />
        </section>

        {/* 문서 vs 웹 */}
        <section className="mt-28">
          <SectionHeading
            eyebrow="근거를 고르는 기준"
            title="문서가 먼저, 웹은 필요할 때"
            body="AI에게는 아래 원칙이 시스템 프롬프트로 주어집니다. 웹검색은 매번 하지 않고, 모델이 필요하다고 판단할 때만 도구로 호출합니다 (한 답변에 최대 5단계)."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <RuleCard icon="text" title="참고 문서 우선" body="찾은 문서에 관련 내용이 있으면 그것을 최우선 근거로 답합니다." />
            <RuleCard icon="globe" title="최신 정보는 웹검색" body="뉴스·날씨·주가·최근 사건처럼 실시간 정보가 필요하거나 문서에 답이 없으면 Tavily로 검색합니다." />
            <RuleCard icon="quote" title="근거 없으면 모른다고" body="찾은 근거가 없는 내용은 지어내지 않고 모른다고 답합니다." />
          </div>
        </section>

        {/* CTA */}
        <section className="paper-section mt-24 rounded-xl px-6 py-16 text-center sm:px-12">
          <p className="eyebrow mb-5 text-muted">FROM KNOWLEDGE TO ANSWERS</p>
          <h2 className="editorial-title text-3xl sm:text-5xl">이제 직접 물어보세요</h2>
          <p className="mx-auto mt-4 max-w-lg leading-relaxed opacity-75">
            Google 계정으로 로그인하면 바로 시작할 수 있습니다. 답변마다 어떤 문서와 페이지를 참고했는지 함께 보여드려요.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-6 py-3 font-medium text-background transition hover:opacity-80"
          >
            TToTA 시작하기 →
          </Link>
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted">© TToTA AI</footer>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-accent" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h16M14 6l6 6-6 6" />
      </svg>
    </div>
  );
}

function RuleCard({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bubble text-accent">
        <StepIcon name={icon} />
      </span>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
