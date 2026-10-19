import Link from "next/link";
import { Logo } from "@/components/Logo";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const FEATURES = [
  {
    icon: "01 / DOCUMENTS",
    title: "내 문서 기반 답변 (RAG)",
    body: "업로드된 문서를 Upstage Embedding으로 색인해, 질문과 가장 관련 있는 내용을 찾아 근거로 답합니다.",
  },
  {
    icon: "02 / WEB SEARCH",
    title: "최신 정보 웹검색",
    body: "뉴스·날씨·최근 이슈처럼 최신 정보가 필요하면 Tavily 웹검색 결과를 참고해 답합니다.",
  },
  {
    icon: "03 / MULTI-MODEL",
    title: "원하는 AI 모델 선택",
    body: "Claude, ChatGPT, Gemini 중 원하는 모델을 골라 같은 대화 안에서도 바꿔가며 쓸 수 있습니다.",
  },
  {
    icon: "04 / HISTORY",
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
      <header className="mx-auto flex min-h-20 w-full max-w-[1440px] items-center justify-between gap-4 px-6 sm:px-12">
        <Logo />
        <Link href="/how-it-works" className="rounded-full border border-border px-5 py-3 text-sm text-muted transition hover:bg-surface hover:text-foreground">
          작동 원리 ↗
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-12 sm:py-24">
          <p className="eyebrow text-muted">DOCUMENTS + WEB / TToTA AI</p>
          <h1 className="editorial-title mt-8 text-[clamp(2.75rem,7.5vw,7rem)]">
            질문은 자유롭게.
            <br />
            답변은 근거 있게.
          </h1>
          <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-16">
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              내 문서의 깊이와 웹의 최신 정보를 하나의 대화로.
              TToTA는 필요한 내용을 찾아 읽고, 답변과 함께 출처를 전합니다.
            </p>
            <div className="flex flex-col items-start gap-4 lg:items-end">
              <GoogleSignInButton />
              <p className="text-xs text-muted">Google 계정으로 로그인하고 대화를 시작하세요.</p>
              {error && (
                <p role="alert" className="text-sm text-red-300">로그인에 실패했습니다. 다시 시도해 주세요.</p>
              )}
            </div>
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-sm text-muted">
            <span className="eyebrow">ONE CONVERSATION. YOUR CHOICE.</span>
            <span>Claude / ChatGPT / Gemini</span>
          </div>
        </section>

        <section className="paper-section px-6 py-16 sm:px-12 sm:py-24" aria-labelledby="features-heading">
          <div className="mx-auto max-w-[1344px]">
            <p className="eyebrow text-muted">BUILT FOR YOUR QUESTIONS</p>
            <h2 id="features-heading" className="editorial-title mt-5 max-w-3xl text-4xl sm:text-5xl">
              흩어진 정보에서,<br />필요한 답변으로.
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl bg-surface p-8">
                  <p className="eyebrow text-muted">{f.icon}</p>
                  <h3 className="mt-10 text-xl font-normal tracking-tight">{f.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
            <Link href="/how-it-works" className="mt-10 inline-flex min-h-12 items-center rounded-full bg-foreground px-6 py-3 text-sm text-background transition hover:opacity-80">
              TToTA의 작동 원리 살펴보기 ↗
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-6 px-6 py-12 sm:px-12">
        <Logo />
        <p className="eyebrow text-muted">© TToTA AI · ANSWERS WITH CONTEXT</p>
      </footer>
    </div>
  );
}
