import React from "react";
import type { Source } from "@/lib/types";

export function Sources({ sources }: { sources: Source[] }) {
  return (
    <div className="mt-4">
      <div className="mb-1.5 text-xs font-medium text-muted">참고한 출처</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => source.type === "web" ? (
          <a
            key={`w-${index}`}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.url}
            className="inline-flex max-w-[260px] items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs transition hover:border-accent/60"
          >
            <span>🌐</span>
            <span className="truncate">{source.title}</span>
          </a>
        ) : (
          <span
            key={`d-${index}`}
            title={source.similarity !== undefined ? `유사도 ${source.similarity}` : undefined}
            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface pl-2 text-xs"
          >
            <span aria-hidden>📄</span>
            <span className="max-w-[180px] truncate">{source.title}</span>
            <a
              href={`/api/documents/download?${new URLSearchParams(
                source.fileId ? { fileId: source.fileId } : { source: source.title },
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${source.title} 원본 다운로드`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-r-lg border-l border-border px-2 text-muted transition hover:bg-bubble hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path d="M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              원본 다운로드
            </a>
          </span>
        ))}
      </div>
    </div>
  );
}
