import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AnswerExport } from "./answer-export";

/** No remote images, executable HTML, or external styles in exported documents. */
export function buildPrintDocument(answer: AnswerExport): string {
  const body = renderToStaticMarkup(<main>
    <h1>{answer.title || "AI 답변"}</h1>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>[이미지: {alt}]</span> }}>{answer.text}</ReactMarkdown>
    {answer.includeSources && !!answer.sources?.length && <section>
      <h2>참고한 출처</h2>
      <ul>{answer.sources.map((source, index) => <li key={index}>{source.title}{source.type === "web" ? ` — ${source.url}` : ""}</li>)}</ul>
    </section>}
  </main>);
  const title = renderToStaticMarkup(<title>{answer.title || "AI 답변"}</title>);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">${title}<style>
    @page { size: A4; margin: 20mm; }
    body { color: #111; font: 11pt/1.7 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; overflow-wrap: anywhere; }
    main { max-width: 800px; margin: auto; }
    h1, h2, h3 { line-height: 1.4; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #aaa; padding: 6px; text-align: left; }
    tr, pre { break-inside: avoid; }
    pre { white-space: pre-wrap; background: #f5f5f5; padding: 12px; }
    blockquote { border-left: 3px solid #aaa; margin-left: 0; padding-left: 12px; }
    a { color: inherit; }
  </style></head><body>${body}</body></html>`;
}
