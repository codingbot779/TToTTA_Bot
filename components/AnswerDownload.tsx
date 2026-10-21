"use client";

import React, { useState } from "react";
import type { Source } from "@/lib/types";
import type { AnswerFileFormat } from "@/lib/answer-export";

export function AnswerDownload({ text, sources, disabled = false }: {
  text: string;
  sources?: Source[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("AI 답변");
  const [format, setFormat] = useState<AnswerFileFormat | "pdf">("docx");
  const [includeSources, setIncludeSources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (disabled || saving || !text.trim()) return;
    // Open synchronously during the user gesture so PDF isn't blocked as an unsolicited popup.
    const printWindow = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !printWindow) {
      setError("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.");
      return;
    }
    setSaving(true);
    const answer = { title: title.trim() || "AI 답변", text, sources, includeSources };
    try {
      if (printWindow) {
        printWindow.opener = null;
        const { buildPrintDocument } = await import("@/lib/answer-print");
        printWindow.document.open();
        printWindow.document.write(buildPrintDocument(answer));
        printWindow.document.close();
        await printWindow.document.fonts.ready;
        printWindow.focus();
        printWindow.print();
      } else {
        const { createAnswerFile, answerFilename } = await import("@/lib/answer-export");
        const fileFormat = format as AnswerFileFormat;
        const blob = await createAnswerFile(answer, fileFormat);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = answerFilename(answer.title, fileFormat);
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch {
      printWindow?.close();
      setError("문서를 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="mt-3 text-xs">
    <button type="button" disabled={disabled || !text.trim()} aria-expanded={open}
      onClick={() => setOpen(!open)}
      className="rounded-md border border-border px-3 py-2 text-muted hover:text-foreground disabled:opacity-40">
      답변 다운로드
    </button>
    {open && <div className="mt-2 space-y-3 rounded-md border border-border bg-surface p-3">
      <label className="block">문서 제목
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)}
          className="mt-1 block w-full rounded border border-border bg-background px-2 py-2" />
      </label>
      <label className="block">파일 형식
        <select value={format} onChange={(e) => setFormat(e.target.value as AnswerFileFormat | "pdf")}
          className="ml-2 rounded border border-border bg-background px-2 py-2">
          <option value="docx">Word (.docx)</option>
          <option value="pdf">PDF (인쇄창에서 저장)</option>
          <option value="txt">텍스트 (.txt)</option>
          <option value="md">Markdown (.md)</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={includeSources} onChange={(e) => setIncludeSources(e.target.checked)} />참고한 출처 포함
      </label>
      {format === "pdf" && <p className="text-muted">인쇄창의 대상을 ‘PDF로 저장’으로 선택해 주세요.</p>}
      <p className="text-muted">현재 답변을 저장합니다. 이미지는 포함하지 않으며 복잡한 서식은 달라질 수 있습니다.</p>
      <button type="button" onClick={save} disabled={saving || disabled || !text.trim()}
        className="rounded bg-foreground px-3 py-2 text-background disabled:opacity-40">
        {saving ? "문서 생성 중..." : format === "pdf" ? "인쇄 / PDF 저장" : "다운로드"}
      </button>
      {error && <p role="alert" className="text-red-600">{error}</p>}
    </div>}
  </div>;
}
