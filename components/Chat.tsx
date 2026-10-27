"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AnswerDownload } from "./AnswerDownload";
import { CategorySelect } from "./CategorySelect";
import { Sources } from "./Sources";
import { LogoMark } from "./Logo";
import { ROOMS_CHANGED_EVENT } from "./Sidebar";
import type { ChatMessage, ModelKey } from "@/lib/types";
import type { ModelCatalog, ModelOption } from "@/lib/model-catalog";

const MODELS: { key: ModelKey; label: string; desc: string }[] = [
  { key: "claude", label: "Claude", desc: "Anthropic" },
  { key: "chatgpt", label: "ChatGPT", desc: "OpenAI" },
  { key: "gemini", label: "Gemini", desc: "Google" },
];
const MODEL_STORAGE_KEY = "ttota:model";
const CATEGORY_STORAGE_KEY = "ttota:category";
const modelIdStorageKey = (key: ModelKey) => `ttota:model-id:${key}`;

const isModelKey = (v: unknown): v is ModelKey => MODELS.some((m) => m.key === v);

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  roomId: string | null;
  initialMessages: ChatMessage[];
  initialModel?: string | null;
  catalog: ModelCatalog;
  /** 검색 가능한 문서가 있는 카테고리 목록 (비어 있으면 선택 UI를 숨김) */
  categories?: string[];
};

export function Chat({ roomId: initialRoomId, initialMessages, initialModel, catalog, categories = [] }: Props) {
  const availableModels = MODELS.map((m) => m.key).filter((key) => catalog[key]?.length);
  const usable = (key: unknown): key is ModelKey => isModelKey(key) && availableModels.includes(key);
  const [model, setModel] = useState<ModelKey>(
    usable(initialModel) ? initialModel : (availableModels[0] ?? "claude"),
  );
  // 제공사별로 선택한 세부 모델 ID (기본값: 목록의 첫 번째 = .env.local 기본 모델)
  const [modelIds, setModelIds] = useState<Partial<Record<ModelKey, string>>>(() =>
    Object.fromEntries(availableModels.map((key) => [key, catalog[key]![0].id])),
  );
  const modelId = modelIds[model];
  // "" = 전체 문서
  const [category, setCategory] = useState("");
  const [input, setInput] = useState("");
  const roomIdRef = useRef(initialRoomId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, regenerate, status, stop, error, clearError } = useChat<ChatMessage>({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onFinish: ({ message }) => {
      const newRoomId = message.metadata?.roomId;
      if (newRoomId && !roomIdRef.current) {
        roomIdRef.current = newRoomId;
        window.history.replaceState(null, "", `/chat/${newRoomId}`);
      }
      window.dispatchEvent(new Event(ROOMS_CHANGED_EVENT));
    },
  });

  // 새 채팅에서는 마지막으로 사용한 모델을 기본값으로
  useEffect(() => {
    if (usable(initialModel)) return;
    try {
      const saved = localStorage.getItem(MODEL_STORAGE_KEY);
      if (usable(saved)) setModel(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModel]);

  // 제공사별로 마지막에 고른 세부 모델 복원
  useEffect(() => {
    try {
      const restored: Partial<Record<ModelKey, string>> = {};
      for (const key of availableModels) {
        const saved = localStorage.getItem(modelIdStorageKey(key));
        if (saved && catalog[key]?.some((o) => o.id === saved)) restored[key] = saved;
      }
      setModelIds((prev) => ({ ...prev, ...restored }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마지막에 고른 카테고리 복원 (현재 목록에 없으면 전체 문서)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CATEGORY_STORAGE_KEY);
      if (saved && categories.includes(saved)) setCategory(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCategory = (value: string) => {
    setCategory(value);
    clearError();
    try {
      if (value) localStorage.setItem(CATEGORY_STORAGE_KEY, value);
      else localStorage.removeItem(CATEGORY_STORAGE_KEY);
    } catch {}
  };

  const changeModelId = (id: string) => {
    setModelIds((prev) => ({ ...prev, [model]: id }));
    clearError();
    try {
      localStorage.setItem(modelIdStorageKey(model), id);
    } catch {}
  };

  const changeModel = (key: ModelKey) => {
    setModel(key);
    clearError();
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, key);
    } catch {}
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const requestBody = () => ({ model, modelId, roomId: roomIdRef.current, category: category || null });

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    sendMessage(
      { text, metadata: { createdAt: new Date().toISOString() } },
      { body: requestBody() },
    );
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const retry = () => {
    clearError();
    regenerate({ body: requestBody() });
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-center gap-2 border-b border-border pb-3 pl-16 pr-4 pt-3 md:justify-start md:pl-6">
        <ModelSelect value={model} onChange={changeModel} disabled={busy} available={availableModels} />
        {catalog[model] && (
          <ModelIdSelect
            options={catalog[model]!}
            value={modelId}
            onChange={changeModelId}
            disabled={busy}
          />
        )}
        {categories.length > 0 && (
          <CategorySelect categories={categories} value={category} onChange={changeCategory} disabled={busy} />
        )}
      </header>

      {availableModels.length === 0 && (
        <div className="border-b border-border bg-surface px-4 py-2.5 text-center text-sm text-muted">
          사용 가능한 AI 모델이 없습니다. .env.local에 LLM API 키를 입력한 뒤 서버를 재시작해 주세요.
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <LogoMark className="h-12 w-12" />
            <p className="eyebrow mt-5 text-muted">YOUR KNOWLEDGE, CONNECTED</p>
            <h1 className="editorial-title mt-4 text-3xl sm:text-5xl">무엇을 도와드릴까요?</h1>
            <p className="mt-3 text-muted">
              {category
                ? `'${category}' 카테고리 문서를 기준으로 답변합니다.`
                : "문서 내용이나 최신 소식 등 무엇이든 물어보세요."}
            </p>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:px-6">
            {messages.map((m) =>
              m.role === "user" ? <UserMessage key={m.id} message={m} /> : <AssistantMessage key={m.id} message={m} downloadingDisabled={busy} />,
            )}
            {status === "submitted" && <Thinking label="문서를 찾아보는 중..." />}
            {error && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                <span>{parseError(error)}</span>
                <button
                  onClick={retry}
                  className="shrink-0 rounded-lg border border-current px-2.5 py-1 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  {catalog[model]?.find((o) => o.id === modelId)?.label ?? MODELS.find((m) => m.key === model)?.label}
                  (으)로 다시 시도
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="px-4 pb-5 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-md border border-border bg-surface p-2 focus-within:border-[#55beff] focus-within:ring-1 focus-within:ring-[#55beff]">
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              placeholder="TToTA AI에게 질문하기..."
              aria-label="질문 입력"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2 outline-none placeholder:text-muted"
            />
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-xs text-muted">Shift + Enter 줄바꿈</span>
              {busy ? (
                <button
                  onClick={() => stop()}
                  className="flex h-11 w-11 items-center justify-center rounded-md bg-foreground text-background"
                  aria-label="중지"
                >
                  <span className="h-3 w-3 rounded-sm bg-current" />
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={!input.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-md bg-accent text-[#0b0b0b] transition hover:bg-accent-strong disabled:opacity-40"
                  aria-label="보내기"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            TToTA AI는 실수할 수 있습니다. 중요한 정보는 출처를 확인해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModelSelect({
  value,
  onChange,
  disabled,
  available,
}: {
  value: ModelKey;
  onChange: (key: ModelKey) => void;
  disabled: boolean;
  available: ModelKey[];
}) {
  return (
    <div className="flex rounded-md border border-border bg-surface p-1 text-sm">
      {MODELS.map((m) => {
        const enabled = available.includes(m.key);
        return (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            disabled={disabled || !enabled}
            title={enabled ? m.desc : `${m.label} API 키 미설정`}
            className={`min-h-9 rounded px-3 py-1.5 transition disabled:cursor-not-allowed ${
              value === m.key ? "bg-foreground text-background" : "text-muted hover:text-foreground"
            } ${enabled ? "" : "line-through opacity-40 hover:text-muted"}`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function ModelIdSelect({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ModelOption[];
  value?: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="세부 모델 선택"
        className="h-11 max-w-[220px] appearance-none truncate rounded-md border border-border bg-surface py-1.5 pl-3 pr-8 text-sm transition hover:border-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((o, i) => (
          <option key={o.id} value={o.id}>
            {o.label}
            {i === 0 ? " (기본)" : ""}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function textOf(message: ChatMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-bubble px-4 py-2.5">{textOf(message)}</div>
      <span className="mt-1 text-[11px] text-muted">{formatTime(message.metadata?.createdAt)}</span>
    </div>
  );
}

function AssistantMessage({ message, downloadingDisabled }: { message: ChatMessage; downloadingDisabled: boolean }) {
  const text = textOf(message);
  const searching = message.parts.some(
    (p) =>
      (p.type === "dynamic-tool" || p.type.startsWith("tool-")) &&
      "state" in p &&
      (p.state === "input-streaming" || p.state === "input-available"),
  );
  const searched = message.parts.some((p) => p.type === "dynamic-tool" || p.type.startsWith("tool-"));
  const meta = message.metadata;
  const modelLabel = meta?.modelId ?? MODELS.find((m) => m.key === meta?.model)?.label;

  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1">
        {searched && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted">
            🌐 {searching ? "웹에서 최신 정보를 검색하는 중..." : "웹검색 결과를 참고했어요"}
          </div>
        )}
        {text ? (
          <div className="markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
            >
              {text}
            </ReactMarkdown>
          </div>
        ) : (
          !searching && <Thinking label="답변을 작성하는 중..." inline />
        )}
        {text && <AnswerDownload text={text} sources={meta?.sources} disabled={downloadingDisabled} />}
        {meta?.sources && meta.sources.length > 0 && <Sources sources={meta.sources} />}
        <div className="mt-2 text-[11px] text-muted">
          {[modelLabel, formatTime(meta?.createdAt)].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}

function Thinking({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <div className={`flex items-center gap-3 text-sm text-muted ${inline ? "" : "pl-10"}`}>
      <span className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}

function parseError(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {}
  return error.message || "오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}
