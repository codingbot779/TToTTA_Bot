import { Logo } from "@/components/Logo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const FEATURES = [
  {
    icon: "📚",
    title: "내 문서 기반 답변 (RAG)",
    body: "업로드된 문서를 Upstage Embedding으로 색인해, 질문과 가장 관련 있는 내용을 찾아 근거로 답합니다.",
  },
  {
    icon: "🌐",
    title: "최신 정보 웹검색",
    body: "뉴스·날씨·최근 이슈처럼 최신 정보가 필요하면 Tavily 웹검색 결과를 참고해 답합니다.",
  },
  {
    icon: "🔀",
    title: "원하는 AI 모델 선택",
    body: "Claude, ChatGPT, Gemini 중 원하는 모델을 골라 같은 대화 안에서도 바꿔가며 쓸 수 있습니다.",
  },
  {
    icon: "🗂️",
    title: "대화 기록 저장",
    body: "채팅방별로 질문과 답변, 참고 출처, 대화 시간이 저장되어 언제든 다시 열어볼 수 있습니다.",
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6 pb-20 pt-12 text-center sm:pt-20">
        <span className="mb-6 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted">
          문서 + 웹을 함께 읽는 AI 어시스턴트
        </span>
        <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          궁금한 건 <span className="text-accent">TToTA</span>에게
          <br />
          물어보세요
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          TToTA AI는 준비된 문서 데이터와 실시간 웹검색 결과를 근거로 답하는 RAG 기반 챗봇입니다.
          답변마다 참고한 문서와 출처를 함께 보여드려요.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <GoogleSignInButton />
          {error && (
            <p className="text-sm text-red-600">로그인에 실패했습니다. 다시 시도해 주세요.</p>
          )}
        </div>

        <section className="mt-20 grid w-full gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-6">
              <div className="text-2xl">{f.icon}</div>
              <h2 className="mt-4 font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="py-6 text-center text-xs text-muted">© TToTA AI</footer>
    </div>
  );
}
