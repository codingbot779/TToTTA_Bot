import { marked, type Token, type Tokens } from "marked";
import {
  Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { Source } from "./types";

export type AnswerExport = {
  title: string;
  text: string;
  sources?: Source[];
  includeSources: boolean;
};
export type AnswerFileFormat = "docx" | "txt" | "md";

function inline(text: string, style: { bold?: boolean; italics?: boolean } = {}): TextRun[] {
  return marked.Lexer.lexInline(text).flatMap((token): TextRun[] => {
    if (token.type === "strong") return inline(token.text, { ...style, bold: true });
    if (token.type === "em") return inline(token.text, { ...style, italics: true });
    if (token.type === "link") return [...inline(token.text, style), new TextRun(` (${token.href})`)];
    if (token.type === "br") return [new TextRun({ break: 1 })];
    if (token.type === "image") return [new TextRun({ text: `[이미지: ${token.text}]`, ...style })];
    if (token.type === "escape" || token.type === "codespan" || token.type === "text") {
      return [new TextRun({ text: token.text, ...style })];
    }
    return [new TextRun({ text: token.raw, ...style })];
  });
}

function wordBlocks(tokens: Token[]): (Paragraph | Table)[] {
  return tokens.flatMap((token): (Paragraph | Table)[] => {
    switch (token.type) {
      case "heading": {
        const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
        return [new Paragraph({ heading: levels[token.depth - 1], children: inline(token.text) })];
      }
      case "paragraph":
      case "text":
        return [new Paragraph({ children: inline(token.text), spacing: { after: 160 } })];
      case "blockquote": return wordBlocks((token as Tokens.Blockquote).tokens);
      case "list":
        return (token as Tokens.List).items.flatMap((item, index) => [
          new Paragraph({ children: [new TextRun(token.ordered ? `${Number(token.start) + index}. ` : "• "),
            ...inline(item.text)], spacing: { after: 100 } }),
        ]);
      case "code":
        return (token as Tokens.Code).text.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, font: "Courier New" })] }));
      case "table":
        return [new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [(token as Tokens.Table).header, ...(token as Tokens.Table).rows].map((row, i) => new TableRow({
            tableHeader: i === 0,
            children: row.map((cell) => new TableCell({ children: [new Paragraph({ children: inline(cell.text, { bold: i === 0 }) })] })),
          })),
        })];
      case "html": return [new Paragraph({ text: token.text })];
      case "hr": return [new Paragraph({ text: "────────────────" })];
      default: return [];
    }
  });
}

export function answerFilename(title: string, extension: AnswerFileFormat): string {
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/^[. _]+|[. _]+$/g, "").slice(0, 80);
  return `${name || "AI 답변"}.${extension}`;
}

function plainInline(text: string): string {
  return marked.Lexer.lexInline(text).map((t): string => {
    if (t.type === "strong" || t.type === "em" || t.type === "del") return plainInline(t.text);
    if (t.type === "link") return `${plainInline(t.text)} (${t.href})`;
    if (t.type === "br") return "\n";
    return "text" in t ? String(t.text) : t.raw;
  }).join("");
}

function plainText(tokens: Token[]): string {
  return tokens.map((t): string => {
    if (t.type === "list") return (t as Tokens.List).items.map((item, i) => `${t.ordered ? `${Number(t.start) + i}.` : "•"} ${plainText(item.tokens)}`).join("\n");
    if (t.type === "table") {
      const table = t as Tokens.Table;
      return [table.header, ...table.rows].map((row) => row.map((cell) => plainInline(cell.text)).join("\t")).join("\n");
    }
    if (t.type === "blockquote") return plainText((t as Tokens.Blockquote).tokens);
    if (t.type === "code" || t.type === "html") return t.text;
    return "text" in t ? plainInline(String(t.text)) : "";
  }).filter(Boolean).join("\n\n");
}

export async function createAnswerFile(answer: AnswerExport, format: AnswerFileFormat): Promise<Blob> {
  if (!answer.text.trim()) throw new Error("저장할 답변이 없습니다.");
  if (format === "txt" || format === "md") {
    const sourceText = answer.includeSources && answer.sources?.length
      ? `\n\n${format === "md" ? "## " : ""}참고한 출처\n${answer.sources.map((s) => `- ${s.title}${s.type === "web" ? ` — ${s.url}` : ""}`).join("\n")}` : "";
    const body = format === "md" ? answer.text : plainText(marked.lexer(answer.text));
    return new Blob(["\uFEFF", `${format === "md" ? "# " : ""}${answer.title || "AI 답변"}\n\n${body}${sourceText}\n`], { type: format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
  }
  if (format !== "docx") throw new Error("지원하지 않는 형식입니다.");
  const sources = answer.includeSources ? (answer.sources ?? []) : [];
  const doc = new Document({
    title: answer.title,
    creator: "TToTA AI",
    styles: { default: { document: { run: { font: "맑은 고딕", size: 22 } } } },
    sections: [{ children: [
      new Paragraph({ text: answer.title || "AI 답변", heading: HeadingLevel.TITLE }),
      ...wordBlocks(marked.lexer(answer.text)),
      ...(sources.length ? [new Paragraph({ text: "참고한 출처", heading: HeadingLevel.HEADING_2 }),
        ...sources.map((s) => new Paragraph({ text: s.type === "web" ? `${s.title} — ${s.url}` : s.title }))] : []),
    ] }],
  });
  return Packer.toBlob(doc);
}
